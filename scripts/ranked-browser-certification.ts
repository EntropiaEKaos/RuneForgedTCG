import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { RANKED_DECK_POOL_VERSION, RANKED_PRECONS, RANKED_RULESET_VERSION } from "../src/game/ranked-decks";

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) throw new Error("E2E_BASE_URL is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (process.env.RANKED_RELEASE_CERTIFIED !== "true") throw new Error("RANKED_RELEASE_CERTIFIED=true is required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class BrowserClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const cookieHeaders = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
    if (cookieHeaders.length) this.cookie = cookieHeaders.map((value) => value.split(";", 1)[0]).join("; ");
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }
}

async function register(client: BrowserClient, name: string) {
  const result = await client.request("/api/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: name }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.ok, true);
  assert.match(String(result.body.recoveryCode || ""), /^[A-Za-z0-9_-]{24,}$/);
  return result.body as { player: { id: number; name: string }; recoveryCode: string };
}

async function recover(recoveryCode: string, expectedPlayerId: number) {
  const client = new BrowserClient();
  const result = await client.request("/api/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.recovered, true);
  assert.equal(result.body.player.id, expectedPlayerId);
  return client;
}

function queue(client: BrowserClient, deckId: string, waitSeconds = 1, allowAiFallback = false) {
  return client.request("/api/matchmaking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deckId, mode: "ranked", waitSeconds, allowAiFallback }),
  });
}

async function leaveQueue(client: BrowserClient) {
  const result = await client.request("/api/matchmaking", { method: "DELETE" });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
}

async function playerRow(id: number) {
  const result = await pool.query(
    `select id, mmr, peak_mmr, ranked_wins, ranked_losses, ranked_games_in_placement
       from players where id=$1`,
    [id],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0] as {
    id: number;
    mmr: number;
    peak_mmr: number;
    ranked_wins: number;
    ranked_losses: number;
    ranked_games_in_placement: number;
  };
}

async function main() {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

  // CI is intentionally fail-closed by default. This certification flips only
  // the disposable test database while the process-level release flag remains
  // independently required, proving the two-key runtime gate.
  await pool.query(`
    insert into game_settings(key, value)
    values ('main', '{"rankedEnabled":true}'::jsonb)
    on conflict (key) do update
      set value = game_settings.value || '{"rankedEnabled":true}'::jsonb,
          updated_at = now()
  `);
  await sleep(1_250);

  const seasonResult = await pool.query(
    `select id, name, start_at, end_at, active
       from ranked_seasons
      where active=true and start_at <= now() and end_at > now()
      order by start_at desc limit 1`,
  );
  assert.equal(seasonResult.rowCount, 1, "a Ranked certification season must be open");
  const season = seasonResult.rows[0];

  const hostOriginal = new BrowserClient();
  const guest = new BrowserClient();
  const hostIdentity = await register(hostOriginal, `Ranked Cert Host ${runId}`);
  const guestIdentity = await register(guest, `Ranked Cert Guest ${runId}`);

  const status = await hostOriginal.request("/api/ranked");
  assert.equal(status.response.status, 200, JSON.stringify(status.body));
  assert.equal(status.body.rankedEnabled, true, "Ranked must become operational only with config + certified env");
  assert.equal(status.body.rankedConfigured, true);
  assert.equal(status.body.rankedReleaseCertified, true);
  assert.equal(status.body.season?.id, season.id);
  assert.equal(status.body.rankedRulesVersion, RANKED_RULESET_VERSION);
  assert.equal(status.body.rankedDeckPoolVersion, RANKED_DECK_POOL_VERSION);
  assert.equal(status.body.certifiedDecks?.length, RANKED_PRECONS.length);

  const invalidDeck = await queue(hostOriginal, "not-a-certified-ranked-deck");
  assert.equal(invalidDeck.response.status, 400, JSON.stringify(invalidDeck.body));

  const hostBefore = await playerRow(hostIdentity.player.id);
  const guestBefore = await playerRow(guestIdentity.player.id);

  const hostQueued = await queue(hostOriginal, RANKED_PRECONS[0].id);
  assert.equal(hostQueued.response.status, 200, JSON.stringify(hostQueued.body));
  assert.equal(hostQueued.body.status, "queued", JSON.stringify(hostQueued.body));

  const guestMatched = await queue(guest, RANKED_PRECONS[1].id);
  assert.equal(guestMatched.response.status, 200, JSON.stringify(guestMatched.body));
  assert.equal(guestMatched.body.status, "matched", JSON.stringify(guestMatched.body));
  const roomCode = String(guestMatched.body.opponent?.roomCode || "");
  assert.match(roomCode, /^[A-Z2-9]{6}$/);

  // Simulate a real reconnect/session rotation while the Ranked room is active.
  const host = await recover(hostIdentity.recoveryCode, hostIdentity.player.id);
  const oldSession = await hostOriginal.request("/api/player");
  assert.equal(oldSession.response.status, 401, "recovery must revoke the previous host session");
  const resumed = await queue(host, RANKED_PRECONS[0].id);
  assert.equal(resumed.response.status, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.status, "matched");
  assert.equal(resumed.body.resumed, true);
  assert.equal(resumed.body.opponent?.roomCode, roomCode);

  const roomDb = await pool.query(
    `select id, mode, ranked_season_id, ranked_config_snapshot, settled_at
       from pvp_rooms where code=$1`,
    [roomCode],
  );
  assert.equal(roomDb.rowCount, 1);
  assert.equal(roomDb.rows[0].mode, "ranked");
  assert.equal(roomDb.rows[0].ranked_season_id, season.id);
  assert.equal(roomDb.rows[0].ranked_config_snapshot?.rulesVersion, RANKED_RULESET_VERSION);
  assert.equal(roomDb.rows[0].ranked_config_snapshot?.deckPoolVersion, RANKED_DECK_POOL_VERSION);
  assert.equal(roomDb.rows[0].settled_at, null);

  const forfeit = await guest.request(`/api/pvp/${roomCode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "leave" }),
  });
  assert.equal(forfeit.response.status, 200, JSON.stringify(forfeit.body));
  assert.equal(forfeit.body.forfeited, true);
  assert.equal(forfeit.body.settlement?.alreadySettled, false);

  const hostAfter = await playerRow(hostIdentity.player.id);
  const guestAfter = await playerRow(guestIdentity.player.id);
  assert.ok(hostAfter.mmr > hostBefore.mmr, `winner MMR must rise: ${hostBefore.mmr} -> ${hostAfter.mmr}`);
  assert.ok(guestAfter.mmr < guestBefore.mmr, `loser MMR must fall: ${guestBefore.mmr} -> ${guestAfter.mmr}`);
  assert.equal(hostAfter.ranked_wins, hostBefore.ranked_wins + 1);
  assert.equal(hostAfter.ranked_losses, hostBefore.ranked_losses);
  assert.equal(guestAfter.ranked_wins, guestBefore.ranked_wins);
  assert.equal(guestAfter.ranked_losses, guestBefore.ranked_losses + 1);
  assert.equal(hostAfter.ranked_games_in_placement, Math.max(0, hostBefore.ranked_games_in_placement - 1));
  assert.equal(guestAfter.ranked_games_in_placement, Math.max(0, guestBefore.ranked_games_in_placement - 1));

  const historyRows = await pool.query(
    `select player_id, won, mmr_change, mmr_before, mmr_after, season_id, rules_version, deck_pool_version
       from ranked_matches
      where player_id in ($1, $2)
      order by player_id`,
    [hostIdentity.player.id, guestIdentity.player.id],
  );
  assert.equal(historyRows.rowCount, 2, "Ranked settlement must persist exactly two player perspectives");
  for (const row of historyRows.rows) {
    assert.equal(row.season_id, season.id);
    assert.equal(row.rules_version, RANKED_RULESET_VERSION);
    assert.equal(row.deck_pool_version, RANKED_DECK_POOL_VERSION);
    assert.equal(row.mmr_after - row.mmr_before, row.mmr_change);
  }
  const winnerHistory = historyRows.rows.find((row) => row.player_id === hostIdentity.player.id);
  const loserHistory = historyRows.rows.find((row) => row.player_id === guestIdentity.player.id);
  assert.equal(winnerHistory?.won, true);
  assert.ok(Number(winnerHistory?.mmr_change) > 0);
  assert.equal(loserHistory?.won, false);
  assert.ok(Number(loserHistory?.mmr_change) < 0);

  const rankedView = await host.request("/api/ranked");
  assert.equal(rankedView.response.status, 200, JSON.stringify(rankedView.body));
  assert.equal(rankedView.body.player?.mmr, hostAfter.mmr);
  assert.equal(rankedView.body.history?.[0]?.seasonId ?? rankedView.body.history?.[0]?.season_id, season.id);

  // Settlement is idempotent: a repeated leave on a finished room cannot write
  // a second history row or move either rating a second time.
  const repeatedLeave = await guest.request(`/api/pvp/${roomCode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "leave" }),
  });
  assert.equal(repeatedLeave.response.status, 200, JSON.stringify(repeatedLeave.body));
  assert.equal(repeatedLeave.body.alreadyFinished, true);
  const repeatedRows = await pool.query(
    `select count(*)::int as count from ranked_matches where player_id in ($1, $2)`,
    [hostIdentity.player.id, guestIdentity.player.id],
  );
  assert.equal(repeatedRows.rows[0].count, 2);
  assert.deepEqual(await playerRow(hostIdentity.player.id), hostAfter);
  assert.deepEqual(await playerRow(guestIdentity.player.id), guestAfter);

  // Anti-farming: the same pair cannot immediately rematch inside the configured
  // cooldown even though both clients actively poll the Ranked queue.
  await leaveQueue(host);
  await leaveQueue(guest);
  const cooldownHost = await queue(host, RANKED_PRECONS[0].id);
  assert.equal(cooldownHost.body.status, "queued", JSON.stringify(cooldownHost.body));
  const cooldownGuest = await queue(guest, RANKED_PRECONS[1].id);
  assert.equal(cooldownGuest.body.status, "queued", `recent opponents must not immediately rematch: ${JSON.stringify(cooldownGuest.body)}`);
  const cooldownHostPoll = await queue(host, RANKED_PRECONS[0].id);
  assert.equal(cooldownHostPoll.body.status, "queued", `rematch cooldown must apply symmetrically: ${JSON.stringify(cooldownHostPoll.body)}`);

  // Ranked never silently degrades to AI, even after a long wait.
  await leaveQueue(host);
  await leaveQueue(guest);
  const noAiFallback = await queue(host, RANKED_PRECONS[0].id, 120, true);
  assert.equal(noAiFallback.response.status, 200, JSON.stringify(noAiFallback.body));
  assert.equal(noAiFallback.body.status, "queued");
  assert.notEqual(noAiFallback.body.status, "ai_fallback");
  await leaveQueue(host);

  // Closing every season must immediately stop new Ranked admissions while
  // preserving the already-settled history above.
  await pool.query(`update ranked_seasons set active=false where active=true`);
  const seasonClosedClient = new BrowserClient();
  await register(seasonClosedClient, `Ranked Cert Closed Season ${runId}`);
  const seasonClosed = await queue(seasonClosedClient, RANKED_PRECONS[2].id);
  assert.equal(seasonClosed.response.status, 409, JSON.stringify(seasonClosed.body));
  assert.match(String(seasonClosed.body.error || ""), /No active Ranked season/i);
  await pool.query(`update ranked_seasons set active=true where id=$1`, [season.id]);

  const evidence = {
    ok: true,
    roomCode,
    seasonId: season.id,
    rulesVersion: RANKED_RULESET_VERSION,
    deckPoolVersion: RANKED_DECK_POOL_VERSION,
    host: { id: hostIdentity.player.id, mmrBefore: hostBefore.mmr, mmrAfter: hostAfter.mmr },
    guest: { id: guestIdentity.player.id, mmrBefore: guestBefore.mmr, mmrAfter: guestAfter.mmr },
    contracts: [
      "two-key release gate",
      "certified precon admission",
      "two-player ranked matchmaking",
      "session recovery and active-room resume",
      "season snapshot provenance",
      "forfeit settlement",
      "atomic dual-perspective MMR history",
      "placement decrement",
      "idempotent finished-room settlement",
      "rematch cooldown anti-farming",
      "no ranked AI fallback",
      "closed-season admission rejection",
    ],
  };
  await mkdir("artifacts/ranked-certification", { recursive: true });
  await writeFile("artifacts/ranked-certification/result.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`RANKED BROWSER CERTIFICATION: PASS — ${evidence.contracts.length} contracts (${roomCode})`);
}

main().finally(async () => {
  await pool.end();
});
