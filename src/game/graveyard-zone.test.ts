import assert from "node:assert/strict";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import {
  activateAbility,
  applyEffect,
  applyStackedAction,
  castSpell,
  cleanupDead,
  createCustomGame,
  drawCards,
  makePermanent,
  makeUnit,
} from "./engine";
import { graveyardEntries, graveyardHasUniqueIds } from "./graveyard";
import type { CardDef, CardInstance, DeckInput, GameState } from "./types";

const deck: DeckInput = {
  id: "graveyard-zone-cert",
  name: "Graveyard Zone Certification",
  cards: Array(20).fill("ember_whelp"),
};

const cards: CardDef[] = [
  {
    defId: "gy_outlet",
    name: "Graveyard Outlet",
    region: "Voidborn",
    type: "Unit",
    cost: 1,
    power: 1,
    health: 3,
    rarity: "Common",
    description: "Discard a chosen card as a real cost.",
    emoji: "🜏",
    activatedAbilities: [{
      description: "Feed the grave",
      cost: { discardFromHand: 1 },
      effect: { kind: "damageNexus", amount: 1, target: "none" },
    }],
  },
  {
    defId: "gy_fodder",
    name: "Graveyard Fodder",
    region: "Tidecall",
    type: "Spell",
    cost: 1,
    rarity: "Common",
    description: "Discard fixture.",
    emoji: "📜",
    spell: { kind: "draw", amount: 1, target: "none" },
  },
  {
    defId: "gy_resolve_spell",
    name: "Resolved Memory",
    region: "Tidecall",
    type: "Spell",
    cost: 0,
    rarity: "Common",
    description: "Resolution fixture.",
    emoji: "🌊",
    spell: { kind: "draw", amount: 1, target: "none" },
  },
  {
    defId: "gy_counter",
    name: "Seal the Memory",
    region: "Tidecall",
    type: "Spell",
    cost: 0,
    rarity: "Common",
    description: "Counter fixture.",
    emoji: "🚫",
    speed: "Burst",
    spell: { kind: "negateSpell", amount: 0, target: "spellOnStack" },
  },
  {
    defId: "gy_permanent",
    name: "Graveyard Reliquary",
    region: "Voidborn",
    type: "Artifact",
    cost: 1,
    maxHealth: 2,
    rarity: "Common",
    description: "Destroyed permanent fixture.",
    emoji: "⚱️",
  },
];

function game(): GameState {
  return createCustomGame("Graveyard Cert", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: true,
    seed: 1_013_337,
  });
}

registerCustomCards(cards);

try {
  {
    const state = game();
    assert.deepEqual(state.players.player.graveyard, [], "new player state materializes an empty graveyard");
    assert.deepEqual(state.players.ai.graveyard, [], "both sides receive the authoritative public zone");
    assert.equal(graveyardHasUniqueIds(state), true);
  }

  {
    const state = game();
    const hand: CardInstance[] = Array.from({ length: state.rules.handCap }, (_, index) => ({
      instanceId: `overflow-hand-${index}`,
      defId: "ember_whelp",
    }));
    state.players.player.hand = hand;
    state.players.player.deck = ["ember_whelp"];
    drawCards(state, "player", 1);
    const graveyard = graveyardEntries(state, "player");
    assert.equal(graveyard.length, 1);
    assert.equal(graveyard[0]?.defId, "ember_whelp");
    assert.equal(graveyard[0]?.reason, "overflow");
    assert.equal(state.players.player.deck.length, 0);
  }

  {
    const state = game();
    state.players.ai.deck = ["ember_whelp", "ember_whelp"];
    applyEffect(state, "player", { kind: "mill", amount: 2, target: "none" });
    assert.deepEqual(
      graveyardEntries(state, "ai").map((entry) => [entry.defId, entry.reason]),
      [["ember_whelp", "mill"], ["ember_whelp", "mill"]],
      "mill preserves ordered physical cards in the opponent graveyard",
    );
  }

  {
    const state = game();
    const unit = makeUnit(state, "ember_whelp", "player");
    unit.summonedThisTurn = false;
    unit.health = 0;
    state.players.player.bench.push(unit);
    cleanupDead(state);
    const death = graveyardEntries(state, "player").at(-1);
    assert.equal(death?.defId, "ember_whelp");
    assert.equal(death?.reason, "death");
    assert.equal(death?.sourceInstanceId, unit.instanceId);
    assert.equal(state.players.player.bench.some((candidate) => candidate.instanceId === unit.instanceId), false);
  }

  {
    const state = game();
    const permanent = makePermanent(state, "gy_permanent", "player");
    permanent.health = 0;
    state.players.player.permanents.push(permanent);
    cleanupDead(state);
    const destroyed = graveyardEntries(state, "player").at(-1);
    assert.equal(destroyed?.defId, "gy_permanent");
    assert.equal(destroyed?.reason, "destroy");
    assert.equal(destroyed?.sourceInstanceId, permanent.instanceId);
  }

  {
    let state = game();
    const outlet = makeUnit(state, "gy_outlet", "player");
    outlet.summonedThisTurn = false;
    state.players.player.bench.push(outlet);
    state.players.player.hand = [{ instanceId: "fodder-in-hand", defId: "gy_fodder" }];
    state = activateAbility(state, "player", outlet.instanceId, 0, undefined, undefined, ["fodder-in-hand"]);
    assert.equal(state.players.player.hand.length, 0);
    const discarded = graveyardEntries(state, "player").at(-1);
    assert.equal(discarded?.defId, "gy_fodder");
    assert.equal(discarded?.reason, "discard");
    assert.equal(discarded?.sourceInstanceId, outlet.instanceId);
  }

  {
    let state = game();
    state.players.player.mana = 10;
    state.players.player.maxMana = 10;
    state.players.player.hand = [{ instanceId: "resolved-spell", defId: "gy_resolve_spell" }];
    state = castSpell(state, "player", "resolved-spell");
    const resolved = graveyardEntries(state, "player").at(-1);
    assert.equal(resolved?.defId, "gy_resolve_spell");
    assert.equal(resolved?.reason, "spell");
    assert.equal(resolved?.sourceInstanceId, "resolved-spell");
  }

  {
    const state = game();
    state.players.player.mana = 10;
    state.players.player.maxMana = 10;
    state.players.ai.mana = 10;
    state.players.ai.maxMana = 10;
    state.players.player.hand = [{ instanceId: "pending-spell", defId: "gy_resolve_spell" }];
    state.players.ai.hand = [{ instanceId: "counter-spell", defId: "gy_counter" }];

    const result = applyStackedAction(
      state,
      { kind: "spell", player: "player", instanceId: "pending-spell", defId: "gy_resolve_spell" },
      {
        human: "skip",
        playerCounter: {
          kind: "spell",
          player: "ai",
          instanceId: "counter-spell",
          defId: "gy_counter",
          targetInstanceId: "pending-spell",
        },
      },
    ).next;

    const playerGraveyard = graveyardEntries(result, "player");
    const aiGraveyard = graveyardEntries(result, "ai");
    assert.equal(playerGraveyard.some((entry) => entry.defId === "gy_resolve_spell" && entry.reason === "counter"), true);
    assert.equal(aiGraveyard.some((entry) => entry.defId === "gy_counter" && entry.reason === "spell"), true);
    assert.equal(result.players.player.hand.length, 0);
    assert.equal(result.players.ai.hand.length, 0);
  }

  {
    const state = game();
    state.players.player.deck = ["ember_whelp", "ember_whelp", "ember_whelp"];
    applyEffect(state, "ai", { kind: "mill", amount: 3, target: "none" });
    assert.equal(graveyardHasUniqueIds(state), true, "all public graveyard entries have globally unique deterministic ids");
    assert.deepEqual(
      graveyardEntries(state, "player").map((entry) => entry.roundEntered),
      [state.round, state.round, state.round],
      "graveyard ordering and round provenance are deterministic",
    );
  }

  console.log("GRAVEYARD ZONE 1.0: PASS — initialization, overflow, mill, death, destroy, selected discard, resolved spell, countered spell and unique ids certified");
} finally {
  clearRegisteredCustomCards();
}
