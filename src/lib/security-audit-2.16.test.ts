// Rewritten as a plain script (this project has no Jest/Vitest runner —
// every other *.test.ts file here runs via `npx tsx <file>` and uses
// node:assert, not describe/it/expect). This file used describe/it/expect
// and could never actually execute via the project's own test convention —
// `describe is not defined` on every run, meaning the two checks below were
// never verified, in this sandbox or presumably in real CI either.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

function read(file: string) { return fs.readFileSync(path.join(process.cwd(), file), "utf8"); }

// spectator feed hides remaining deck identities/order
{
  const src = read("src/app/api/pvp/[code]/spectate/route.ts");
  assert.ok(src.includes("toSpectatorGameState"), "Spectator feed must use a dedicated public DTO");
  const dto = read("src/lib/spectator-state.ts");
  assert.ok(dto.includes("handCount") && dto.includes("deckCount"), "Spectator DTO exposes counts instead of hidden card arrays");
  assert.ok(!dto.includes("rngState") && !dto.includes("idCounter"), "Spectator DTO must not expose authoritative RNG internals");
}

// ownership integrity migration covers core player-owned resources
{
  const sql = read("drizzle/0018_ownership_integrity.sql");
  for (const name of [
    "fk_matches_player", "fk_match_tokens_player", "fk_mode_attempts_player",
    "fk_custom_decks_owner", "fk_replays_player", "fk_player_cards_player",
    "fk_economy_transactions_player", "fk_shared_decks_player",
    "fk_mode_rewards_player", "fk_player_achievements_player", "fk_player_dailies_player",
    "fk_draft_sessions_player", "fk_pvp_rooms_host_player", "fk_friendships_player",
    "fk_ranked_matches_player", "fk_matchmaking_queue_player", "fk_player_packs_player",
  ]) {
    assert.ok(sql.includes(name), `Ownership integrity migration missing ${name}`);
  }
  assert.ok(sql.includes("NOT VALID"), "Ownership FKs must be added NOT VALID to avoid locking existing rows");
}

console.log("security-audit-2.16: PASS");
