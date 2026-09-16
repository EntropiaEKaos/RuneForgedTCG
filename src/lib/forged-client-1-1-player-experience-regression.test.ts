import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const profile = read("src/app/profile/ProfileClient.tsx");
const headquarters = read("src/components/PlayerHeadquarters.tsx");
const wardrobe = read("src/app/collection/variants/CosmeticWardrobeClient.tsx");
const metrics = read("src/app/api/admin/metrics/overview/route.ts");
const commandCenter = read("src/app/admin/studio/command-center/CommandCenterClient.tsx");
const p1Registry = read("src/game/alpha-p1-art.ts");
const nextConfig = read("next.config.ts");

// Profile 2.0 keeps the competitive-client information architecture while
// preserving existing account recovery and Ranked authority boundaries.
assert.match(profile, /type ProfileTab = "overview" \| "ranked" \| "collection" \| "legacy" \| "security"/);
assert.match(profile, /profile\.viewed/);
assert.match(profile, /profile\.tab_selected/);
assert.match(profile, /Ranked do Nexus/);
assert.match(profile, /COLLECTION 2\.0/);
assert.match(profile, /RECUPERAR(?: CONTA)?/);
assert.doesNotMatch(profile, /setMmr|updateMmr|mutateMmr|writeMmr/i, "Profile must not include MMR mutation helpers");

// Home/QG is account-aware and emits first-party journey intent.
assert.match(headquarters, /QUARTEL-GENERAL/);
assert.match(headquarters, /home\.player_hq_viewed/);
assert.match(headquarters, /journey\.profile_intent/);
assert.match(headquarters, /journey\.play_intent/);

// Variant prestige remains cosmetic-only and instrumented.
assert.match(wardrobe, /COLLECTION 2\.0 · IDENTIDADE VISUAL/);
assert.match(wardrobe, /100% cosmético/);
assert.match(wardrobe, /collection\.variants_viewed/);
assert.match(wardrobe, /collection\.variant_equipped/);
assert.match(wardrobe, /collection\.variant_reset/);
assert.match(wardrobe, /nunca altera raridade de gameplay, stats, efeitos, limite de cópias, matchmaking ou regras competitivas/);

// Command Center funnel uses persisted product milestones, not click-only telemetry.
for (const contract of [
  /from players\) as account_created/,
  /from pack_openings where player_id is not null\) as pack_opened/,
  /from custom_decks where owner_player_id is not null\) as deck_created/,
  /from matches where player_id is not null\) as match_played/,
  /from matches where player_id is not null and won = true\) as match_won/,
  /ranked_wins \+ ranked_losses > 0\) as ranked_started/,
]) assert.match(metrics, contract);
assert.match(commandCenter, /PLAYER JOURNEY · AUTHORITATIVE/);
assert.match(commandCenter, /Funil completo do jogador/);
assert.match(commandCenter, /Primeiro pack/);
assert.match(commandCenter, /Primeiro deck/);
assert.match(commandCenter, /Primeira partida/);
assert.match(commandCenter, /Primeira vitória/);

// Alpha P1 Batch 2 is additive, explicit and build-materialized.
for (const defId of ["ember_blade", "ember_phantom", "forest_pack_shelter", "forest_summon_pack", "forest_packrunner"]) {
  assert.match(p1Registry, new RegExp(`"${defId}"`));
}
assert.match(p1Registry, /ALPHA_P1_BATCH_2_IDS/);
assert.match(nextConfig, /generate-alpha-p1-batch-2-art\.mjs/);

console.log("FORGED CLIENT 1.1 PLAYER EXPERIENCE SOURCE CONTRACT: PASS — Profile 2.0 + Player HQ + cosmetic variants + authoritative funnel + P1 Batch 2 locked");
