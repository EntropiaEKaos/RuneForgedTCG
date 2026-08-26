import assert from "node:assert/strict";
import { VANILLA_ADDITIONAL_CARDS } from "@/game/cards/vanilla";
import { canPlayCard, castSpell, createCustomGame, playUnit, spellNeedsTarget } from "@/game/engine";
import type { TargetKind } from "@/game/types";

function targetFor(kind: TargetKind | null, game: ReturnType<typeof createCustomGame>): string | undefined {
  if (!kind || kind === "none") return undefined;
  if (["enemyUnit", "anyUnit", "anyBoard"].includes(kind)) return game.players.ai.bench[0]?.instanceId;
  if (["allyUnit", "self"].includes(kind)) return game.players.player.bench[0]?.instanceId;
  if (["enemyPermanent", "allyPermanent", "anyPermanent", "enemySentinela", "allySentinela", "anySentinela", "spellOnStack"].includes(kind)) return undefined;
  return undefined;
}

let resolved = 0;
for (const card of Object.values(VANILLA_ADDITIONAL_CARDS)) {
  const game = createCustomGame(
    "Vanilla Smoke",
    { id: "vanilla-smoke", name: "Vanilla Smoke", cards: [card.defId] },
    { id: "vanilla-smoke-ai", name: "Vanilla Smoke AI", cards: ["ember_whelp"] },
    {
      seed: 92000 + resolved,
      skipMulligan: true,
      playerGoesFirst: true,
      playerStartingHand: 1,
      playerStartingMana: 20,
      aiStartingMana: 0,
      playerBench: ["ember_whelp"],
      aiBench: ["ember_whelp"],
    },
  );
  const instance = game.players.player.hand.find((item) => item.defId === card.defId);
  assert.ok(instance, `${card.defId}: must be drawn into the smoke-test hand`);
  assert.equal(canPlayCard(game, "player", instance.instanceId), true, `${card.defId}: must be playable with 20 mana and prepared targets`);

  let next;
  if (card.type === "Spell") {
    const targetKind = spellNeedsTarget(card.defId);
    next = castSpell(game, "player", instance.instanceId, targetFor(targetKind, game));
  } else if (card.type === "Equipment") {
    next = playUnit(game, "player", instance.instanceId, game.players.player.bench[0]?.instanceId);
  } else {
    next = playUnit(game, "player", instance.instanceId);
  }
  assert.notEqual(next, game, `${card.defId}: engine action must resolve to a new state`);
  resolved += 1;
}

assert.equal(resolved, 180);
console.log("VANILLA RUNTIME SMOKE: 180/180 new cards playable and resolved by the authoritative engine");
