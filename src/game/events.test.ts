import { createCustomGame } from "./engine";
import { deriveGameEvents } from "./events";
import type { DeckInput } from "./types";

const deck: DeckInput = {
  id: "test",
  name: "Test",
  cards: ["ember_whelp", "ember_whelp", "ember_bolt", "wood_growth"],
};

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, actual?: unknown, expected?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} | esperado:`, expected, "recebido:", actual);
  }
}

console.log("\n🧪 GAME EVENTS — regressão de eventos semânticos\n");

{
  const before = createCustomGame("P", deck, deck, { skipMulligan: true });
  const after = structuredClone(before);
  const unit = {
    instanceId: "u1",
    defId: "ember_whelp",
    race: "Dragon" as const,
    races: ["Dragon" as const],
    power: 2,
    basePower: 2,
    health: 1,
    maxHealth: 1,
    keywords: [],
    barrier: false,
    frostbitten: false,
    stunned: false,
    isAttacking: false,
    hasStruck: false,
    summonedThisTurn: false,
    owner: "player" as const,
    isChampion: false,
    leveled: false,
    strikes: 0,
    nexusStrikes: 0,
    equipment: [],
    powerBuffs: 0,
    healthBuffs: 0,
    permanentHealthModifier: 0,
    poisonCounters: 0,
    hasAttackedThisTurn: false,
  };
  after.players.player.bench = [unit];
  const events = deriveGameEvents(before, after);
  check("summon gera UNIT_SUMMONED", events.some((e) => e.type === "UNIT_SUMMONED" && e.unitId === "u1"), events, "UNIT_SUMMONED");
}

{
  const before = createCustomGame("P", deck, deck, { skipMulligan: true });
  const after = structuredClone(before);
  const base = {
    instanceId: "u1",
    defId: "ember_whelp",
    race: "Dragon" as const,
    races: ["Dragon" as const],
    power: 2,
    basePower: 2,
    health: 2,
    maxHealth: 2,
    keywords: [],
    barrier: false,
    frostbitten: false,
    stunned: false,
    isAttacking: false,
    hasStruck: false,
    summonedThisTurn: false,
    owner: "player" as const,
    isChampion: false,
    leveled: false,
    strikes: 0,
    nexusStrikes: 0,
    equipment: [],
    powerBuffs: 0,
    healthBuffs: 0,
    permanentHealthModifier: 0,
    poisonCounters: 0,
    hasAttackedThisTurn: false,
  };
  after.players.player.bench = [base];
  const damaged = structuredClone(after);
  damaged.players.player.bench[0].health = 1;
  const damage = deriveGameEvents(after, damaged);
  check("perda de vida gera UNIT_DAMAGED", damage.some((e) => e.type === "UNIT_DAMAGED" && e.amount === 1), damage, "1 damage");

  // Bug de teste corrigido: antes isto mutava `first` de volta para 2 e
  // comparava contra `after` (que também já era 2) — nenhuma diferença
  // real era observada, então UNIT_HEALED nunca podia disparar. Agora
  // comparamos damaged(1) -> healed(2), uma transição de verdade.
  const healed = structuredClone(damaged);
  healed.players.player.bench[0].health = 2;
  const heal = deriveGameEvents(damaged, healed);
  check("aumento de vida gera UNIT_HEALED", heal.some((e) => e.type === "UNIT_HEALED" && e.amount === 1), heal, "1 heal");
}

{
  const before = createCustomGame("P", deck, deck, { skipMulligan: true });
  const after = structuredClone(before);
  after.players.ai.nexusHealth -= 4;
  const events = deriveGameEvents(before, after);
  check("dano ao Nexus gera NEXUS_DAMAGED", events.some((e) => e.type === "NEXUS_DAMAGED" && e.player === "ai" && e.amount === 4), events, "4 nexus damage");
}

{
  const before = createCustomGame("P", deck, deck, { skipMulligan: true });
  const after = structuredClone(before);
  after.players.ai.poisonCounters = 3;
  const events = deriveGameEvents(before, after);
  check("veneno gera NEXUS_POISONED", events.some((e) => e.type === "NEXUS_POISONED" && e.player === "ai" && e.amount === 3 && e.total === 3), events, "3 poison");
}

{
  const before = createCustomGame("P", deck, deck, { skipMulligan: true });
  const unit = {
    instanceId: "shield", defId: "ember_whelp", races: ["Dragon" as const], power: 2, basePower: 2,
    health: 2, maxHealth: 2, keywords: [], barrier: true, frostbitten: false, stunned: false,
    isAttacking: false, hasStruck: false, summonedThisTurn: false, owner: "player" as const,
    isChampion: false, leveled: false, strikes: 0, nexusStrikes: 0, equipment: [], powerBuffs: 0,
    healthBuffs: 0, permanentHealthModifier: 0, poisonCounters: 0, hasAttackedThisTurn: false,
  };
  before.players.player.bench = [unit];
  const after = structuredClone(before);
  after.players.player.bench[0].barrier = false;
  const events = deriveGameEvents(before, after);
  check("quebra de barreira gera STATUS_REMOVED", events.some((e) => e.type === "STATUS_REMOVED" && e.status === "barrier"), events, "barrier removed");
}

console.log(`\nRESULTADO: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
