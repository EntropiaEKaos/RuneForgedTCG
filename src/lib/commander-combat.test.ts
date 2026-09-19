import assert from "node:assert/strict";
import { collectibleCards } from "../game/cards";
import {
  commanderCombatPersistence,
  createCommanderCombatEnvelope,
  processCommanderCombatCommand,
  projectCommanderCombatState,
} from "./commander-combat";

async function main() {
  const generals = collectibleCards()
    .filter((card) => card.collectible !== false && (card.isChampion || card.isLegend))
    .slice(0, 4);
  assert.equal(generals.length, 4, "fixture requires four collectible Champion/Legend cards");

  const pool = collectibleCards().filter((card) => card.collectible !== false).slice(0, 24);
  assert.ok(pool.length >= 20, "fixture requires a broad collectible pool");
  const playable = collectibleCards().find((card) =>
    card.collectible !== false
    && ["Unit", "Enchantment", "Artifact", "Sentinela"].includes(card.type)
    && card.cost <= 10,
  );
  assert.ok(playable, "fixture requires a stageable physical card");

  const seats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => playable.defId),
    generalDefId: general.defId,
  }));

  const initial = await createCommanderCombatEnvelope("commander:test-room", 5, 0x12345678, seats);
  assert.equal(initial.protocol.revision, 5);
  assert.equal(initial.match.turn.activeSeat, "p1");
  assert.equal(initial.zones.p1.hand.length, 5);
  assert.equal(initial.zones.p1.deck.length, 55);
  assert.equal(initial.match.battlefield?.objects.length, 0);

  const p1 = projectCommanderCombatState(initial, 0);
  assert.equal(p1.revision, 5);
  assert.equal(p1.viewerSeat, 0);
  assert.equal(p1.seats[0].hand?.length, 5, "viewer receives own hand identities");
  assert.match(p1.seats[0].hand?.[0]?.instanceId ?? "", /^p1:card:\d+$/);
  assert.ok(p1.seats[0].hand?.[0]?.defId);
  assert.equal(p1.seats[1].hand, undefined, "viewer must not receive opponent hand identities");
  assert.equal("deck" in p1.seats[0], false, "future deck identities must never be projected");

  const playableEnvelope = {
    ...initial,
    match: {
      ...initial.match,
      phase: "main_1" as const,
      seats: {
        ...initial.match.seats,
        p1: { ...initial.match.seats.p1, mana: 10, maxMana: 10 },
      },
    },
  };
  const cardInstance = playableEnvelope.zones.p1.hand[0]!;
  assert.throws(
    () => processCommanderCombatCommand(playableEnvelope, 100, 0, {
      commandId: "cmd-play-forged",
      expectedRevision: 5,
      type: "play_card",
      payload: { instanceId: "p1:card:9999" },
    }),
    /is not in p1's hand/,
    "server must reject forged card instance ids",
  );
  const played = processCommanderCombatCommand(playableEnvelope, 100, 0, {
    commandId: "cmd-play-1",
    expectedRevision: 5,
    type: "play_card",
    payload: { instanceId: cardInstance.instanceId, defId: "__ignored-client-def__", cost: 0 },
  });
  assert.equal(played.protocol.revision, 6);
  assert.equal(played.zones.p1.hand.length, 4);
  assert.equal(played.zones.p1.hand.some((card) => card.instanceId === cardInstance.instanceId), false);
  assert.equal(played.match.resolution.stack.items.at(-1)?.kind, "card_cast");
  assert.equal(
    (played.match.resolution.stack.items.at(-1)?.payload as { defId?: string })?.defId,
    playable.defId,
    "server must derive defId from the authoritative hand instance",
  );
  assert.equal(played.match.seats.p1.mana, 10 - playable.cost);
  assert.equal(played.match.resolution.priority.holder, "p2");

  assert.throws(
    () => processCommanderCombatCommand(initial, 100, 0, {
      commandId: "cmd-forged-attacker",
      expectedRevision: 5,
      type: "declare_attacker",
      payload: { unitId: "forged-client-id", defendingSeat: "p2" },
    }),
    /not exposed by the PostgreSQL bridge yet/,
    "attack declarations remain closed until battlefield authority is exposed deliberately",
  );

  const passed = processCommanderCombatCommand(initial, 100, 0, {
    commandId: "cmd-pass-1",
    expectedRevision: 5,
    type: "pass_priority",
  });
  assert.equal(passed.protocol.revision, 6);
  assert.equal(passed.match.resolution.priority.holder, "p2");

  assert.throws(
    () => processCommanderCombatCommand(passed, 100, 0, {
      commandId: "cmd-stale",
      expectedRevision: 5,
      type: "pass_priority",
    }),
    /Expected Commander revision 6/,
    "stale room revisions must fail closed",
  );

  const conceded = processCommanderCombatCommand(passed, 101, 1, {
    commandId: "cmd-concede-p2",
    expectedRevision: 6,
    type: "concede",
  });
  assert.equal(conceded.protocol.revision, 7);
  assert.equal(conceded.match.seats.p2.eliminated, true);

  const persisted = commanderCombatPersistence(conceded);
  assert.equal(persisted.version, 7);
  assert.equal(persisted.state, "playing");
  assert.equal(persisted.gameState.kind, "commander_4p_combat_v1");

  console.log("COMMANDER 4P COMBAT BRIDGE: PASS — projection privacy + revision CAS + authoritative command reduction");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
