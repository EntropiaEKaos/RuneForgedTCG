import assert from "node:assert/strict";
import {
  RANKED_DECK_POOL_VERSION,
  RANKED_FORMAT_ID,
  RANKED_PRECONS,
  RANKED_RULESET_VERSION,
  createRankedRoomCertification,
  isCertifiedRankedDeck,
  resolveRankedPrecon,
  validateRankedPreconPool,
  verifyRankedRoomCertification,
} from "@/game/ranked-decks";
import { calculateAppliedMmrResult, getRankTier } from "@/lib/ranked";
import { isRankedSeasonOpen } from "@/lib/ranked-season-window";

const checks: string[] = [];
const ok = (condition: unknown, label: string) => {
  assert.ok(condition, label);
  checks.push(label);
};

assert.equal(RANKED_PRECONS.length, 4);
checks.push("Season Zero exposes exactly four certified precons");
assert.deepEqual(validateRankedPreconPool(), []);
checks.push("all Ranked precons satisfy deck construction rules");

for (const deck of RANKED_PRECONS) {
  assert.equal(deck.cards.length, 40);
  assert.equal(deck.formatId, RANKED_FORMAT_ID);
  ok(isCertifiedRankedDeck(resolveRankedPrecon(deck.id)), `${deck.id} resolves as certified`);
}

const host = resolveRankedPrecon(RANKED_PRECONS[0].id);
const guest = resolveRankedPrecon(RANKED_PRECONS[1].id);
const roomCertification = createRankedRoomCertification(host, guest);
assert.equal(roomCertification.rulesVersion, RANKED_RULESET_VERSION);
assert.equal(roomCertification.deckPoolVersion, RANKED_DECK_POOL_VERSION);
ok(verifyRankedRoomCertification(roomCertification, host, guest), "room certification accepts the exact snapshotted decks");
ok(verifyRankedRoomCertification({ ...roomCertification, rulesVersion: "historical-rules", deckPoolVersion: "historical-pool" }, host, guest), "in-flight rooms remain settleable after a future release changes current version constants");

const tamperedGuest = { ...guest, cards: [...guest.cards] };
tamperedGuest.cards[0] = host.cards[0];
ok(!verifyRankedRoomCertification(roomCertification, host, tamperedGuest), "room certification rejects a tampered deck snapshot");
ok(!isCertifiedRankedDeck(tamperedGuest), "certified-pool check rejects modified card contents");

const reordered = { ...host, cards: [...host.cards].reverse() };
ok(isCertifiedRankedDeck(reordered), "deck certification is order-insensitive but copy-sensitive");

const floorLoss = calculateAppliedMmrResult(0, 1200, false, false, {
  eloDivisor: 400,
  placementK: 40,
  normalK: 24,
  minimumMmr: 0,
});
assert.deepEqual(floorLoss, { mmrChange: 0, mmrAfter: 0 });
checks.push("MMR history records the applied clamped delta at the floor");

const normalWin = calculateAppliedMmrResult(1200, 1200, true, false);
assert.equal(normalWin.mmrAfter - 1200, normalWin.mmrChange);
ok(normalWin.mmrChange > 0, "normal ranked win produces a consistent positive applied delta");

assert.equal(getRankTier(50_000).name, "Grão-Mestre");
checks.push("MMR above the last configured ceiling remains in the top tier");

const start = new Date("2026-09-01T00:00:00Z");
const end = new Date("2026-10-01T00:00:00Z");
const season = { active: true, startAt: start, endAt: end };
ok(!isRankedSeasonOpen(season, new Date("2026-08-31T23:59:59Z")), "season is closed before start");
ok(isRankedSeasonOpen(season, start), "season opens exactly at start");
ok(!isRankedSeasonOpen(season, end), "season closes exactly at end");
ok(!isRankedSeasonOpen({ ...season, active: false }, new Date("2026-09-10T00:00:00Z")), "inactive season stays closed inside its date window");

console.log(`RANKED LAUNCH 2.97 BEHAVIOR: PASS (${checks.length} executable contracts)`);
