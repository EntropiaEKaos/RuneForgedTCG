import assert from "node:assert/strict";
import { alphaArtBacklogSnapshot, alphaArtExposure, alphaArtPriorityQueue } from "./alpha-art-priority";
import { ARCHETYPES } from "./archetypes";
import { getCard } from "./cards";
import { DECKS } from "./decks";
import {
  FLAGSHIP_ART_ROOT,
  FLAGSHIP_ART_TARGETS,
  FLAGSHIP_ART_FORMAT,
  flagshipArtTargetsForRegion,
  type FlagshipArtTarget,
} from "./flagship-art";
import { certifiedSemanticCardType } from "./semantic-card-types";
import type { Region } from "./types";

const REGIONS: Region[] = ["Emberhold", "Tidecall", "Ironwood", "Voidborn", "Florestia", "Tempestade"];
const STARTER_BY_REGION: Record<Region, string> = {
  Emberhold: "ember_aggro",
  Tidecall: "tide_control",
  Ironwood: "wood_midrange",
  Voidborn: "void_shadow",
  Florestia: "florestia_tribal",
  Tempestade: "tempestade_rush",
};

assert.equal(FLAGSHIP_ART_TARGETS.length, 30, "Alpha Flagship Art Set must stay deliberately scoped to 30 unique masters");
assert.equal(FLAGSHIP_ART_FORMAT.aspectRatio, "4:5");
assert.equal(FLAGSHIP_ART_FORMAT.delivery, "webp");

const defIds = new Set<string>();
const paths = new Set<string>();
for (const target of FLAGSHIP_ART_TARGETS) {
  assert.equal(defIds.has(target.defId), false, `duplicate flagship defId: ${target.defId}`);
  assert.equal(paths.has(target.assetPath), false, `duplicate flagship asset path: ${target.assetPath}`);
  defIds.add(target.defId);
  paths.add(target.assetPath);

  const card = getCard(target.defId);
  assert.equal(card.region, target.region, `${target.defId} flagship region must match authored card region`);
  assert.ok(target.assetPath.startsWith(`${FLAGSHIP_ART_ROOT}/${target.region.toLowerCase()}/`));
  assert.ok(target.assetPath.endsWith(".webp"));
  assert.ok(target.brief.length >= 48, `${target.defId} needs a usable art-direction brief`);

  if (target.tier === "champion") {
    assert.equal(card.isChampion, true, `${target.defId} must be a Champion`);
    assert.notEqual(card.collectible, false, `${target.defId} must be the collectible/base Champion form`);

    const visited = new Set<string>();
    let cursor = card;
    while (cursor.levelUp?.toDefId) {
      assert.equal(visited.has(cursor.defId), false, `Champion level-up cycle detected at ${cursor.defId}`);
      visited.add(cursor.defId);
      const next = getCard(cursor.levelUp.toDefId);
      assert.equal(next.isChampion, true, `${cursor.levelUp.toDefId} must remain a Champion form`);
      assert.equal(next.region, target.region, `${cursor.levelUp.toDefId} must remain in ${target.region}`);
      cursor = next;
      assert.ok(visited.size < 6, `${target.defId} Champion chain is unexpectedly long`);
    }
    assert.ok(visited.size >= 1, `${target.defId} must have at least one evolved form`);
  }

  if (target.tier === "semantic") {
    const semantic = certifiedSemanticCardType(card);
    assert.ok(semantic, `${target.defId} must remain a certified semantic card`);
    assert.equal(semantic?.key, target.semanticRole, `${target.defId} semantic art role must match gameplay contract`);
    assert.ok(target.defId.startsWith("rfalpha_"), `${target.defId} must belong to the Alpha semantic wave`);
  }

  if (target.tier === "starter-signature") {
    const deckId = STARTER_BY_REGION[target.region];
    const deck = DECKS.find((entry) => entry.id === deckId);
    assert.ok(deck, `starter ${deckId} must exist`);
    assert.ok(deck?.cards.includes(target.defId), `${target.defId} must actually ship in starter ${deckId}`);
    assert.ok(ARCHETYPES[deckId]?.signatures.includes(target.defId), `${target.defId} must be an authored signature of ${deckId}`);
  }
}

for (const region of REGIONS) {
  const targets = flagshipArtTargetsForRegion(region);
  assert.equal(targets.length, 5, `${region} must receive exactly five Flagship masters`);
  const count = (tier: FlagshipArtTarget["tier"]) => targets.filter((target) => target.tier === tier).length;
  assert.equal(count("champion"), 1, `${region} needs one Champion master`);
  assert.equal(count("semantic"), 3, `${region} needs Structure + Ritual + Trap art`);
  assert.equal(count("starter-signature"), 1, `${region} needs one starter signature master`);
  assert.deepEqual(
    targets.filter((target) => target.tier === "semantic").map((target) => target.semanticRole).sort(),
    ["ritual", "structure", "trap"],
    `${region} semantic art coverage must be complete`,
  );
}

const backlog = alphaArtBacklogSnapshot();
assert.deepEqual(
  backlog,
  {
    starterDecks: 6,
    starterSlots: 240,
    uniqueStarterCards: 140,
    covered: 71,
    missing: 69,
    byPriority: { P0: 0, P1: 26, P2: 43 },
  },
  "Alpha art priority baseline must remain deterministic so Studio production queues cannot drift silently",
);
const priorityQueue = alphaArtPriorityQueue();
assert.equal(priorityQueue.length, 69);
assert.equal(alphaArtExposure("ember_bolt").priority, "covered");
assert.equal(alphaArtExposure("ember_bolt").copies, 5);
assert.equal(alphaArtExposure("wood_webweaver").priority, "covered");
assert.equal(alphaArtExposure("wood_webweaver").copies, 5);
assert.equal(alphaArtExposure("ember_sprinter").priority, "covered");
assert.equal(alphaArtExposure("wood_ward").priority, "covered");
assert.equal(alphaArtExposure("ember_face").priority, "covered");
assert.equal(alphaArtExposure("ember_drake").priority, "covered");
assert.equal(alphaArtExposure("ember_stun").priority, "covered");
assert.equal(alphaArtExposure("forest_canopy_warden").priority, "covered");
assert.equal(alphaArtExposure("forest_cub").priority, "covered");
assert.equal(alphaArtExposure("storm_dashbolt").priority, "covered");
assert.equal(alphaArtExposure("storm_eye").priority, "covered");
assert.equal(alphaArtExposure("storm_herald").priority, "covered");
assert.equal(alphaArtExposure("storm_lightning").priority, "covered");
assert.equal(alphaArtExposure("storm_sky_sentinel").priority, "covered");
assert.equal(alphaArtExposure("storm_strikecaller").priority, "covered");
assert.equal(alphaArtExposure("tide_sprite").priority, "covered");
assert.equal(alphaArtExposure("void_drain").priority, "covered");
assert.equal(alphaArtExposure("wood_cub").priority, "covered");
assert.equal(alphaArtExposure("ember_ashguard").priority, "covered");
for (const defId of [
  "ember_duelist",
  "ember_raider",
  "ember_herald",
  "ember_whelp",
  "ember_zealot",
  "ember_blade",
  "ember_phantom",
  "forest_pack_shelter",
  "forest_summon_pack",
  "forest_packrunner",
  "forest_entangle",
  "forest_stalker",
  "wood_ent",
  "wood_stag",
  "wood_caller",
  "wood_bark_rupture",
  "wood_claw",
  "wood_martyr",
  "wood_recall",
  "wood_root_prison",
]) {
  assert.equal(alphaArtExposure(defId).priority, "covered", `${defId} must leave the P1 queue after certified activation`);
}
assert.deepEqual(
  priorityQueue.filter((row) => row.priority === "P0").map((row) => row.defId),
  [],
  "Alpha P1 activation must keep the P0 production queue exhausted",
);
assert.equal(
  priorityQueue.filter((row) => row.priority === "P1").length,
  31,
  "Alpha P1 Batch 3 activation must leave exactly 31 P1 cards pending",
);
assert.ok(priorityQueue.every((row, index) => index === 0 || priorityQueue[index - 1].score >= row.score));

console.log("FORGED ALPHA FLAGSHIP + ACTIVE PRIORITY ART: 71 covered / 69 starter backlog / 0 P0 pending / 26 P1 pending / PASS");
