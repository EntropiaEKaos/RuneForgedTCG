import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allCards } from "@/game/cards";
import { CARD_DOCTRINES, validateAuthorableCard } from "@/game/card-authoring";
import { DECKS, validateDeck } from "@/game/decks";
import { buildCardDependencyGraph } from "@/game/content-dependency-graph";
import { cardRegions } from "@/game/region-identity";

const fourRegions = (["Emberhold", "Tidecall", "Ironwood", "Voidborn"] as const).flatMap((region) => {
  const ids = allCards().filter((card) => card.collectible !== false && card.region === region && cardRegions(card).length === 1).slice(0, 4).map((card) => card.defId);
  assert.equal(ids.length, 4, `${region} needs four pure collectible fixtures`);
  return [ids[0], ids[0], ids[0], ids[1], ids[1], ids[1], ids[2], ids[2], ids[2], ids[3]];
});
const illegal = validateDeck(fourRegions);
assert.equal(fourRegions.length, 40);
assert.equal(illegal.ok, false);
assert.equal(illegal.regions.length, 4);
assert.ok(illegal.errors.some((error) => error.includes("At most 3 regions")));
assert.deepEqual(validateDeck([]).regions, []);

const authored = validateAuthorableCard({
  defId: "doctrine_probe",
  name: "Doctrine Probe",
  region: "Emberhold",
  regions: ["Emberhold"],
  type: "Unit",
  cost: 1,
  description: "Regression fixture",
  rarity: "Common",
  emoji: "🧪",
  power: 1,
  health: 1,
  doctrineAffinities: CARD_DOCTRINES.map((item) => item.id),
});
assert.equal(authored.ok, true);
if (!authored.ok) throw new Error("Doctrine fixture failed authoring");
assert.equal(authored.card.doctrineAffinities?.length, CARD_DOCTRINES.length);

for (const deck of DECKS) assert.deepEqual(deck.regions, validateDeck(deck.cards).regions, `${deck.id} region metadata drift`);

const nestedReference = buildCardDependencyGraph([{
  defId: "nested_reference_probe",
  name: "Nested Reference Probe",
  region: "Emberhold",
  type: "Spell",
  cost: 1,
  description: "Regression fixture",
  rarity: "Common",
  emoji: "🧪",
  collectible: true,
  spell: { kind: "draw", amount: 1, target: "none", also: { kind: "summonToken", amount: 1, target: "none", tokenDefId: "missing_token" } },
}]);
assert.ok(nestedReference.edges.some((edge) => edge.path === "spell.also.tokenDefId" && edge.to === "missing_token"));

const bootstrap = readFileSync("scripts/database-bootstrap.ts", "utf8");
assert.ok(bootstrap.indexOf("create table if not exists runeforge_schema_meta") < bootstrap.indexOf("for (const file of files)"));
assert.match(bootstrap, /0030_bugfix_integrity\.sql/);
assert.match(readFileSync("scripts/production-verify.ts", "utf8"), /shared_deck_downloads/);
assert.match(readFileSync("scripts/production-verify.ts", "utf8"), /version='2\.(?:9[1-9]|[1-9][0-9]{2,})(?:\.\d+)?'/);

const pipeline = readFileSync("src/lib/content-pipeline.ts", "utf8");
assert.match(pipeline, /dependenciesForCard/);
assert.match(pipeline, /ref\.kind === "token"/);
assert.match(pipeline, /ref\.kind === "equipment"/);

const simulate = readFileSync("src/app/api/admin/studio/simulate/route.ts", "utf8");
assert.ok(simulate.slice(simulate.indexOf("export async function POST")).includes('adminRoleAllowed(actor.role,"qa")'));
const matrix = readFileSync("src/app/api/admin/studio/balance/matrix/route.ts", "utf8");
assert.match(matrix, /MAX_MATRIX_GAMES/);
assert.match(matrix, /status: "failed"/);
assert.match(readFileSync("src/app/admin/studio/5/StudioFive.tsx", "utf8"), /r\.games \?\? r\.completedGames/);

const journey = readFileSync("src/components/game/PlayerJourney.tsx", "utf8");
assert.match(journey, /new Set\(\[\.\.\.record, \.\.\.achievedNow\]\)/);
assert.match(journey, /JSON\.stringify\(achievedList\)/);
assert.match(readFileSync("src/app/play/hooks/useGamePresentation.ts", "utf8"), /stopAmbience/);

const community = readFileSync("src/app/community/CommunityClient.tsx", "utf8");
assert.match(community, /<article/);
assert.match(community, /parseDeckCards/);
assert.match(readFileSync("src/app/api/decks/share\/\[id\]\/route.ts", "utf8"), /sharedDeckDownloads/);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.dependencies.next, "16.3.3");
assert.equal(packageJson.devDependencies["eslint-config-next"], "16.3.3");
const ciInstall = readFileSync("scripts/ci-install.mjs", "utf8");
assert.match(ciInstall, /package-lock\.json/);
assert.match(ciInstall, /\["ci"/);

console.log("BUGFIX 2.88: PASS");
