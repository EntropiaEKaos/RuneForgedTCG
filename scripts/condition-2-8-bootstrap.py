from pathlib import Path


def rep(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


rep(
    "src/game/types.ts",
    '  | { kind: "allyPermanentsAtLeast"; min: number }\n  | { kind: "enemyPermanentsAtLeast"; min: number }\n  | { kind: "nexusBelow"; amount: number }',
    '  | { kind: "allyPermanentsAtLeast"; min: number }\n  | { kind: "enemyPermanentsAtLeast"; min: number }\n  | { kind: "allySentinelasAtLeast"; min: number }\n  | { kind: "enemySentinelasAtLeast"; min: number }\n  | { kind: "nexusBelow"; amount: number }',
)

rep(
    "src/game/card-authoring.ts",
    'export const MECHANIC_CONDITION_KINDS = ["always","selfDamaged","allyRace","allyClass","enemyRace","enemyClass","allyUnitsAtLeast","enemyUnitsAtLeast","allyPermanentsAtLeast","enemyPermanentsAtLeast","nexusBelow","opponentNexusBelow","manaAtLeast","opponentManaAtLeast","spellManaAtLeast","opponentSpellManaAtLeast","handAtLeast","opponentHandAtLeast","roundAtLeast","and","or","not"] as const;',
    'export const MECHANIC_CONDITION_KINDS = ["always","selfDamaged","allyRace","allyClass","enemyRace","enemyClass","allyUnitsAtLeast","enemyUnitsAtLeast","allyPermanentsAtLeast","enemyPermanentsAtLeast","allySentinelasAtLeast","enemySentinelasAtLeast","nexusBelow","opponentNexusBelow","manaAtLeast","opponentManaAtLeast","spellManaAtLeast","opponentSpellManaAtLeast","handAtLeast","opponentHandAtLeast","roundAtLeast","and","or","not"] as const;',
)
rep(
    "src/game/card-authoring.ts",
    '  if (kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") return { kind, min: Math.max(1, Math.min(8, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;\n  if (kind === "nexusBelow"',
    '  if (kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") return { kind, min: Math.max(1, Math.min(8, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;\n  if (kind === "allySentinelasAtLeast" || kind === "enemySentinelasAtLeast") return { kind, min: Math.max(1, Math.min(20, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;\n  if (kind === "nexusBelow"',
)

rep(
    "src/game/condition-contract.ts",
    '  allyPermanentsAtLeast: { kind: "allyPermanentsAtLeast", min: 1 },\n  enemyPermanentsAtLeast: { kind: "enemyPermanentsAtLeast", min: 1 },\n  nexusBelow:',
    '  allyPermanentsAtLeast: { kind: "allyPermanentsAtLeast", min: 1 },\n  enemyPermanentsAtLeast: { kind: "enemyPermanentsAtLeast", min: 1 },\n  allySentinelasAtLeast: { kind: "allySentinelasAtLeast", min: 1 },\n  enemySentinelasAtLeast: { kind: "enemySentinelasAtLeast", min: 1 },\n  nexusBelow:',
)

rep(
    "src/game/aura-condition-contract.ts",
    '  "allyPermanentsAtLeast",\n  "enemyPermanentsAtLeast",\n  "nexusBelow",',
    '  "allyPermanentsAtLeast",\n  "enemyPermanentsAtLeast",\n  "allySentinelasAtLeast",\n  "enemySentinelasAtLeast",\n  "nexusBelow",',
)
rep(
    "src/game/aura-condition-contract.ts",
    '  if (condition.kind === "allyPermanentsAtLeast") return player.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "enemyPermanentsAtLeast") return enemy.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "nexusBelow")',
    '  if (condition.kind === "allyPermanentsAtLeast") return player.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "enemyPermanentsAtLeast") return enemy.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "allySentinelasAtLeast") return player.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length >= condition.min;\n  if (condition.kind === "enemySentinelasAtLeast") return enemy.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length >= condition.min;\n  if (condition.kind === "nexusBelow")',
)

rep(
    "src/game/engine/effects.ts",
    '  if (condition.kind === "allyPermanentsAtLeast") return p.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "enemyPermanentsAtLeast") return opponent.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "nexusBelow")',
    '  if (condition.kind === "allyPermanentsAtLeast") return p.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "enemyPermanentsAtLeast") return opponent.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;\n  if (condition.kind === "allySentinelasAtLeast") return p.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length >= condition.min;\n  if (condition.kind === "enemySentinelasAtLeast") return opponent.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length >= condition.min;\n  if (condition.kind === "nexusBelow")',
)

rep(
    "src/game/engine/sentinela-state.ts",
    'export function cleanupSentinelas(state: GameState): void {\n  let removedAuraSource = false;\n  for (const pid of ["player", "ai"] as PlayerId[]) {\n    const p = state.players[pid];\n    const dead = p.sentinelas.filter((s) => s.loyalty <= 0);\n    for (const s of dead) {\n      const def = getCard(s.defId);\n      state.log.push(`A Sentinela ${def.name} foi destruída (Lealdade 0).`);\n      if (def.aura) removedAuraSource = true;\n    }\n    p.sentinelas = p.sentinelas.filter((s) => s.loyalty > 0);\n  }\n  if (removedAuraSource) recomputeContinuousAuras(state);\n}',
    'export function cleanupSentinelas(state: GameState): void {\n  let removedSentinela = false;\n  for (const pid of ["player", "ai"] as PlayerId[]) {\n    const p = state.players[pid];\n    const dead = p.sentinelas.filter((s) => s.loyalty <= 0);\n    if (dead.length) removedSentinela = true;\n    for (const s of dead) {\n      const def = getCard(s.defId);\n      state.log.push(`A Sentinela ${def.name} foi destruída (Lealdade 0).`);\n    }\n    p.sentinelas = p.sentinelas.filter((s) => s.loyalty > 0);\n  }\n  if (removedSentinela) recomputeContinuousAuras(state);\n}',
)

rep(
    "src/app/admin/studio/AbilityComposerFields.tsx",
    '  if (kind === "allyUnitsAtLeast" || kind === "enemyUnitsAtLeast" || kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") return { kind, min: 1 } as MechanicCondition;',
    '  if (kind === "allyUnitsAtLeast" || kind === "enemyUnitsAtLeast" || kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast" || kind === "allySentinelasAtLeast" || kind === "enemySentinelasAtLeast") return { kind, min: 1 } as MechanicCondition;',
)
rep(
    "src/app/admin/studio/AbilityComposerFields.tsx",
    '      {(kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") && <Field label={kind === "allyPermanentsAtLeast" ? "Living allied Permanents ≥" : "Living enemy Permanents ≥"}><input className="input" type="number" min={1} max={8} value={(value as Extract<MechanicCondition, { kind: "allyPermanentsAtLeast" | "enemyPermanentsAtLeast" }>).min ?? 1} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allyPermanentsAtLeast" | "enemyPermanentsAtLeast" }>), min: Number(event.target.value) })} /></Field>}\n      {(kind === "nexusBelow"',
    '      {(kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") && <Field label={kind === "allyPermanentsAtLeast" ? "Living allied Permanents ≥" : "Living enemy Permanents ≥"}><input className="input" type="number" min={1} max={8} value={(value as Extract<MechanicCondition, { kind: "allyPermanentsAtLeast" | "enemyPermanentsAtLeast" }>).min ?? 1} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allyPermanentsAtLeast" | "enemyPermanentsAtLeast" }>), min: Number(event.target.value) })} /></Field>}\n      {(kind === "allySentinelasAtLeast" || kind === "enemySentinelasAtLeast") && <Field label={kind === "allySentinelasAtLeast" ? "Living allied Sentinelas ≥" : "Living enemy Sentinelas ≥"}><input className="input" type="number" min={1} max={20} value={(value as Extract<MechanicCondition, { kind: "allySentinelasAtLeast" | "enemySentinelasAtLeast" }>).min ?? 1} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allySentinelasAtLeast" | "enemySentinelasAtLeast" }>), min: Number(event.target.value) })} /></Field>}\n      {(kind === "nexusBelow"',
)

rep(
    "src/app/admin/studio/cards/ContinuousAuraConditionEditor.tsx",
    '  if (kind === "allyUnitsAtLeast" || kind === "enemyUnitsAtLeast" || kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") return { kind, min: 1 } as MechanicCondition;',
    '  if (kind === "allyUnitsAtLeast" || kind === "enemyUnitsAtLeast" || kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast" || kind === "allySentinelasAtLeast" || kind === "enemySentinelasAtLeast") return { kind, min: 1 } as MechanicCondition;',
)
rep(
    "src/app/admin/studio/cards/ContinuousAuraConditionEditor.tsx",
    '        {(kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") && <label className="block"><span className="label">{kind === "allyPermanentsAtLeast" ? "Permanents aliadas vivas ≥" : "Permanents inimigas vivas ≥"}</span><input className="input" type="number" min={1} max={8} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>}\n\n        {(kind === "nexusBelow"',
    '        {(kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") && <label className="block"><span className="label">{kind === "allyPermanentsAtLeast" ? "Permanents aliadas vivas ≥" : "Permanents inimigas vivas ≥"}</span><input className="input" type="number" min={1} max={8} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>}\n        {(kind === "allySentinelasAtLeast" || kind === "enemySentinelasAtLeast") && <label className="block"><span className="label">{kind === "allySentinelasAtLeast" ? "Sentinelas aliadas vivas ≥" : "Sentinelas inimigas vivas ≥"}</span><input className="input" type="number" min={1} max={20} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>}\n\n        {(kind === "nexusBelow"',
)

rep(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    '<Panel title="Continuous Aura" eyebrow="CONDITION 2.7 — RESOURCE THRESHOLDS">',
    '<Panel title="Continuous Aura" eyebrow="CONDITION 2.8 — SENTINELA BOARD THRESHOLDS">',
)
rep(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'quantidade de Permanents vivas aliadas ou inimigas, rodada atual,',
    'quantidade de Permanents vivas aliadas ou inimigas, quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual,',
)
rep(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'quantidade de Permanents vivas aliadas ou inimigas, rodada atual,',
    'quantidade de Permanents vivas aliadas ou inimigas, quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual,',
)

rep(
    "src/game/aura-2-5-conditional-auras.test.ts",
    '"allyPermanentsAtLeast", "enemyPermanentsAtLeast", "nexusBelow"',
    '"allyPermanentsAtLeast", "enemyPermanentsAtLeast", "allySentinelasAtLeast", "enemySentinelasAtLeast", "nexusBelow"',
)

rep(
    "scripts/test-suites.mjs",
    '  "src/game/condition-2-7-resource-thresholds.test.ts",\n  "src/game/activated-abilities.test.ts",',
    '  "src/game/condition-2-7-resource-thresholds.test.ts",\n  "src/game/condition-2-8-sentinela-board-thresholds.test.ts",\n  "src/game/activated-abilities.test.ts",',
)

p = Path("docs/AURA-2.md")
text = p.read_text()
text += '''\n\n## Condition System 2.8 — Sentinela Board Thresholds\n\nContinuous Auras podem agora observar `allySentinelasAtLeast` e `enemySentinelasAtLeast`. Só contam Sentinelas com `loyalty > 0`, usando a zona autoritativa `PlayerState.sentinelas`. Uma Sentinela-fonte com condição aliada conta a si própria enquanto tiver Lealdade positiva. A remoção de qualquer Sentinela por `cleanupSentinelas()` recompõe Auras no mesmo estado, inclusive quando a Sentinela removida não possuía Aura própria.\n'''
p.write_text(text)

Path("docs/CONDITION-2-8.md").write_text('''# Condition System 2.8 — Sentinela Board Thresholds\n\n## Objetivo\n\nCondition 2.8 completa a leitura das zonas principais do battlefield com duas folhas públicas:\n\n```ts\n{ kind: "allySentinelasAtLeast", min: N }\n{ kind: "enemySentinelasAtLeast", min: N }\n```\n\n## Semântica autoritativa\n\nA contagem lê diretamente `PlayerState.sentinelas` e considera ativa somente a instância com `loyalty > 0`. Uma Sentinela em Lealdade zero deixa de satisfazer a condição antes mesmo de ser removida fisicamente por cleanup.\n\nA orientação é controller-scoped: `ally*` observa a zona do controlador da fonte e `enemy*` observa o outro jogador. A mesma regra vale para player e IA.\n\nSentinelas continuam fora de `bench` e `permanents`; este corte não mistura zonas nem cria contador paralelo.\n\n## Envelope de authoring\n\nO Studio e o sanitizer usam `1..20` como envelope de segurança de authoring. Isso **não** cria um `sentinelasCap` de gameplay. O engine atual não publica um cap configurável de Sentinelas; a heurística da IA que prefere até duas Sentinelas continua sendo apenas política da IA, não regra do jogo.\n\n## Lifecycle\n\nEntrada de Sentinela já converge pelo `playUnit()` semântico, que recompõe Continuous Auras quando há fonte condicional.\n\nNa saída, `cleanupSentinelas()` passa a recompor Auras quando qualquer Sentinela é removida por `loyalty <= 0`, mesmo que a Sentinela removida não tenha Aura própria. Isso permite que thresholds de board desliguem no mesmo estado autoritativo.\n\nUma Sentinela que seja fonte de Aura e use `allySentinelasAtLeast` conta a si própria enquanto tiver Lealdade positiva.\n\n## Studio e Ability Grammar\n\nAs duas folhas aparecem no Ability Composer e no editor de Continuous Aura, suportam `AND`, `OR` e `NOT`, e entram automaticamente no Ability Grammar pelo catálogo canônico de condições.\n\n## Certificação\n\n`condition-2-8-sentinela-board-thresholds.test.ts` cobre catálogo, clamps, orientação player/IA, `loyalty > 0`, fail-closed em Lealdade zero antes de cleanup, composição, Mechanics, Aura, auto-contagem da Sentinela-fonte, entrada real por `playUnit()`, saída real por `cleanupSentinelas()`, authoring e Ability Grammar. O total comportamental sobe de 74 para 75 targets.\n''')

Path("src/game/condition-2-8-sentinela-board-thresholds.test.ts").write_text(r'''import assert from "node:assert/strict";
import "./aura-2-types";
import { ABILITY_GRAMMAR_CATALOG, blueprintFromPermanentStatAura } from "./ability-system";
import { auraConditionMatches } from "./aura-condition-contract";
import { MECHANIC_CONDITION_KINDS, sanitizeMechanicCondition, validateAuthorableCard } from "./card-authoring";
import { CONDITION_RUNTIME_SUPPORT, conditionKindsAtDepth } from "./condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import { createGame, makePermanent, makeUnit, mechanicConditionMatches, playUnit, recomputeContinuousAuras } from "./engine";
import { cleanupSentinelas } from "./engine/sentinela-state";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura, SentinelaInstance } from "./types";

const unitCard = (defId: string, mechanics?: CardDef["mechanics"]): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 4,
  race: "Spirit",
  ...(mechanics?.length ? { mechanics } : {}),
  description: "Condition 2.8 Sentinela-board threshold test unit.",
  rarity: "Common",
  emoji: "🛡️",
});

const sentinelaCard = (defId: string, aura?: PermanentStatAura): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Sentinela",
  cost: 2,
  ...(aura ? { aura } : {}),
  description: "Condition 2.8 test Sentinela.",
  rarity: "Legend",
  emoji: "🜲",
  sentinela: {
    startingLoyalty: 3,
    abilities: [{
      cost: 1,
      description: "+1: compre 1.",
      effect: { kind: "draw", amount: 1, target: "none" },
    }],
  },
});

const permanentCard = (defId: string, aura: PermanentStatAura): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Condition 2.8 threshold Aura.",
  rarity: "Rare",
  emoji: "🔭",
});

const sentinelaInstance = (defId: string, owner: "player" | "ai", loyalty = 3, instanceId = `sen_${defId}_${owner}`): SentinelaInstance => ({
  instanceId,
  defId,
  owner,
  loyalty,
  activatedThisTurn: false,
});

for (const kind of ["allySentinelasAtLeast", "enemySentinelasAtLeast"] as const) {
  assert.equal(MECHANIC_CONDITION_KINDS.includes(kind), true);
  assert.equal(CONDITION_RUNTIME_SUPPORT[kind], "supported");
  assert.equal(conditionKindsAtDepth(0).includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts[kind], "supported");
}

assert.deepEqual(sanitizeMechanicCondition({ kind: "allySentinelasAtLeast", min: 99 }), { kind: "allySentinelasAtLeast", min: 20 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "enemySentinelasAtLeast", min: 0 }), { kind: "enemySentinelasAtLeast", min: 1 });
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } }),
  { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } },
);

withRegisteredCardSnapshot([unitCard("test_condition28_source"), sentinelaCard("test_condition28_sentinel")], () => {
  const state = createGame("Condition 2.8 Mechanics", DECKS[3], DECKS[2], true, 628001);
  const playerSource = makeUnit(state, "test_condition28_source", "player");
  const aiSource = makeUnit(state, "test_condition28_source", "ai");
  state.players.player.bench = [playerSource];
  state.players.ai.bench = [aiSource];
  state.players.player.sentinelas = [
    sentinelaInstance("test_condition28_sentinel", "player", 3, "condition28_player_live"),
    sentinelaInstance("test_condition28_sentinel", "player", 0, "condition28_player_zero"),
  ];
  state.players.ai.sentinelas = [
    sentinelaInstance("test_condition28_sentinel", "ai", 2, "condition28_ai_live"),
    sentinelaInstance("test_condition28_sentinel", "ai", 0, "condition28_ai_zero"),
  ];

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allySentinelasAtLeast", min: 1 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allySentinelasAtLeast", min: 2 }), false, "zero-loyalty ally does not count before cleanup");
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemySentinelasAtLeast", min: 1 }), true);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "enemySentinelasAtLeast", min: 1 }), true, "AI observes the player Sentinela zone symmetrically");

  state.players.ai.sentinelas[0].loyalty = 0;
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemySentinelasAtLeast", min: 1 }), false, "loyalty zero fails closed before physical cleanup");
  assert.equal(mechanicConditionMatches(state, playerSource, {
    kind: "and",
    children: [
      { kind: "allySentinelasAtLeast", min: 1 },
      { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 1 } },
    ],
  }), true);
});

withRegisteredCardSnapshot([sentinelaCard("test_condition28_aura_probe")], () => {
  const state = createGame("Condition 2.8 Aura Orientation", DECKS[3], DECKS[2], true, 628002);
  state.players.player.sentinelas = [sentinelaInstance("test_condition28_aura_probe", "player", 1)];
  state.players.ai.sentinelas = [sentinelaInstance("test_condition28_aura_probe", "ai", 1)];
  assert.equal(auraConditionMatches(state, "player", { kind: "allySentinelasAtLeast", min: 1 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "enemySentinelasAtLeast", min: 1 }), true);
  state.players.ai.sentinelas[0].loyalty = 0;
  assert.equal(auraConditionMatches(state, "player", { kind: "enemySentinelasAtLeast", min: 1 }), false);
});

// A Sentinela Aura source counts itself while loyalty is positive.
withRegisteredCardSnapshot([
  sentinelaCard("test_condition28_self_count_command", {
    buffPower: 2,
    buffHealth: 0,
    condition: { kind: "allySentinelasAtLeast", min: 1 },
  }),
  unitCard("test_condition28_self_count_ally"),
], () => {
  const state = createGame("Condition 2.8 Self Count", DECKS[3], DECKS[2], true, 628003);
  const ally = makeUnit(state, "test_condition28_self_count_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.sentinelas = [sentinelaInstance("test_condition28_self_count_command", "player", 3)];
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 4, "living Sentinela Aura source satisfies allySentinelasAtLeast:1 with itself");
});

// Real entry and exit: playUnit crosses upward; cleanup of a non-Aura Sentinela crosses downward.
withRegisteredCardSnapshot([
  permanentCard("test_condition28_threshold_aura", {
    buffPower: 2,
    buffHealth: 0,
    condition: { kind: "allySentinelasAtLeast", min: 1 },
  }),
  sentinelaCard("test_condition28_entering_sentinel"),
  unitCard("test_condition28_lifecycle_ally"),
], () => {
  const state = createGame("Condition 2.8 Lifecycle", DECKS[3], DECKS[2], true, 628004);
  const ally = makeUnit(state, "test_condition28_lifecycle_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.permanents = [makePermanent(state, "test_condition28_threshold_aura", "player")];
  state.players.player.sentinelas = [];
  state.players.player.hand = [{ instanceId: "condition28_sentinel_hand", defId: "test_condition28_entering_sentinel" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2, "Aura starts inactive with no living Sentinela");

  const entered = playUnit(state, "player", "condition28_sentinel_hand");
  const powered = entered.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(entered.players.player.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length, 1);
  assert.equal(powered.power, 4, "Sentinela entry activates the conditional Aura in the authoritative returned state");

  entered.players.player.sentinelas[0].loyalty = 0;
  assert.equal(auraConditionMatches(entered, "player", { kind: "allySentinelasAtLeast", min: 1 }), false, "zero loyalty fails before cleanup");
  cleanupSentinelas(entered);
  const stabilized = entered.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(entered.players.player.sentinelas.length, 0);
  assert.equal(stabilized.power, 2, "cleanup of a non-Aura Sentinela disables threshold Aura in the same transition");
});

const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition28_mechanic", [{
  key: "sentinel_watch",
  name: "Sentinel Watch",
  trigger: "onRoundStart",
  condition: { kind: "enemySentinelasAtLeast", min: 1 },
  effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "enemySentinelasAtLeast", min: 1 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(permanentCard("valid_condition28_aura", {
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "allySentinelasAtLeast", min: 1 },
      { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } },
    ],
  },
}));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
assert.deepEqual(auraAuthored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "allySentinelasAtLeast", min: 1 },
    { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } },
  ],
});

const commandAuthored = validateAuthorableCardWithSemanticTypes(sentinelaCard("valid_condition28_command", {
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "allySentinelasAtLeast", min: 1 },
}));
assert.equal(commandAuthored.ok, true);
assert.ok(commandAuthored.ok);
assert.deepEqual(commandAuthored.card.aura?.condition, { kind: "allySentinelasAtLeast", min: 1 });
const blueprint = blueprintFromPermanentStatAura(commandAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, commandAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.8: PASS — living allied/enemy Sentinela thresholds, loyalty > 0 semantics, self-counting command source, real entry/cleanup Aura lifecycle, authoring and Ability Grammar certified");
''')
