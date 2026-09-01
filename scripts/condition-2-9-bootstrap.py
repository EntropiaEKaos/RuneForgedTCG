from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    if content.count(old) != 1:
        raise SystemExit(f"anchor not unique in {path}: count={content.count(old)}")
    write(path, content.replace(old, new, 1))


# Typed condition contract.
replace_once(
    "src/game/types.ts",
    '  | { kind: "opponentSpellManaAtLeast"; amount: number }\n  | { kind: "handAtLeast"; amount: number }',
    '  | { kind: "opponentSpellManaAtLeast"; amount: number }\n'
    '  | { kind: "spellsCastAtLeast"; amount: number }\n'
    '  | { kind: "opponentSpellsCastAtLeast"; amount: number }\n'
    '  | { kind: "alliesSummonedAtLeast"; amount: number }\n'
    '  | { kind: "opponentAlliesSummonedAtLeast"; amount: number }\n'
    '  | { kind: "nexusDamageDealtAtLeast"; amount: number }\n'
    '  | { kind: "opponentNexusDamageDealtAtLeast"; amount: number }\n'
    '  | { kind: "handAtLeast"; amount: number }',
)

# Canonical authoring catalog + safety envelope. No gameplay cap is introduced.
replace_once(
    "src/game/card-authoring.ts",
    '"spellManaAtLeast","opponentSpellManaAtLeast","handAtLeast"',
    '"spellManaAtLeast","opponentSpellManaAtLeast","spellsCastAtLeast","opponentSpellsCastAtLeast","alliesSummonedAtLeast","opponentAlliesSummonedAtLeast","nexusDamageDealtAtLeast","opponentNexusDamageDealtAtLeast","handAtLeast"',
)
replace_once(
    "src/game/card-authoring.ts",
    '  if (kind === "spellManaAtLeast" || kind === "opponentSpellManaAtLeast") return { kind, amount: Math.max(0, Math.min(10, Math.trunc(finite(c.amount)))) } as MechanicCondition;\n  if (kind === "roundAtLeast")',
    '  if (kind === "spellManaAtLeast" || kind === "opponentSpellManaAtLeast") return { kind, amount: Math.max(0, Math.min(10, Math.trunc(finite(c.amount)))) } as MechanicCondition;\n'
    '  if (kind === "spellsCastAtLeast" || kind === "opponentSpellsCastAtLeast" || kind === "alliesSummonedAtLeast" || kind === "opponentAlliesSummonedAtLeast" || kind === "nexusDamageDealtAtLeast" || kind === "opponentNexusDamageDealtAtLeast") return { kind, amount: Math.max(1, Math.min(2000, Math.trunc(finite(c.amount, 1)))) } as MechanicCondition;\n'
    '  if (kind === "roundAtLeast")',
)

# Runtime support probes.
replace_once(
    "src/game/condition-contract.ts",
    '  opponentSpellManaAtLeast: { kind: "opponentSpellManaAtLeast", amount: 1 },\n  handAtLeast:',
    '  opponentSpellManaAtLeast: { kind: "opponentSpellManaAtLeast", amount: 1 },\n'
    '  spellsCastAtLeast: { kind: "spellsCastAtLeast", amount: 1 },\n'
    '  opponentSpellsCastAtLeast: { kind: "opponentSpellsCastAtLeast", amount: 1 },\n'
    '  alliesSummonedAtLeast: { kind: "alliesSummonedAtLeast", amount: 1 },\n'
    '  opponentAlliesSummonedAtLeast: { kind: "opponentAlliesSummonedAtLeast", amount: 1 },\n'
    '  nexusDamageDealtAtLeast: { kind: "nexusDamageDealtAtLeast", amount: 1 },\n'
    '  opponentNexusDamageDealtAtLeast: { kind: "opponentNexusDamageDealtAtLeast", amount: 1 },\n'
    '  handAtLeast:',
)

# Generic Mechanics evaluator.
replace_once(
    "src/game/engine/effects.ts",
    '  if (condition.kind === "opponentSpellManaAtLeast") return opponent.spellMana >= condition.amount;\n  if (condition.kind === "handAtLeast")',
    '  if (condition.kind === "opponentSpellManaAtLeast") return opponent.spellMana >= condition.amount;\n'
    '  if (condition.kind === "spellsCastAtLeast") return p.stats.spellsCast >= condition.amount;\n'
    '  if (condition.kind === "opponentSpellsCastAtLeast") return opponent.stats.spellsCast >= condition.amount;\n'
    '  if (condition.kind === "alliesSummonedAtLeast") return p.stats.alliesSummoned >= condition.amount;\n'
    '  if (condition.kind === "opponentAlliesSummonedAtLeast") return opponent.stats.alliesSummoned >= condition.amount;\n'
    '  if (condition.kind === "nexusDamageDealtAtLeast") return p.stats.nexusDamageDealt >= condition.amount;\n'
    '  if (condition.kind === "opponentNexusDamageDealtAtLeast") return opponent.stats.nexusDamageDealt >= condition.amount;\n'
    '  if (condition.kind === "handAtLeast")',
)

# Continuous Aura support + evaluator.
replace_once(
    "src/game/aura-condition-contract.ts",
    '  "opponentSpellManaAtLeast",\n  "handAtLeast",',
    '  "opponentSpellManaAtLeast",\n'
    '  "spellsCastAtLeast",\n'
    '  "opponentSpellsCastAtLeast",\n'
    '  "alliesSummonedAtLeast",\n'
    '  "opponentAlliesSummonedAtLeast",\n'
    '  "nexusDamageDealtAtLeast",\n'
    '  "opponentNexusDamageDealtAtLeast",\n'
    '  "handAtLeast",',
)
replace_once(
    "src/game/aura-condition-contract.ts",
    '  if (condition.kind === "opponentSpellManaAtLeast") return enemy.spellMana >= condition.amount;\n  if (condition.kind === "handAtLeast")',
    '  if (condition.kind === "opponentSpellManaAtLeast") return enemy.spellMana >= condition.amount;\n'
    '  if (condition.kind === "spellsCastAtLeast") return player.stats.spellsCast >= condition.amount;\n'
    '  if (condition.kind === "opponentSpellsCastAtLeast") return enemy.stats.spellsCast >= condition.amount;\n'
    '  if (condition.kind === "alliesSummonedAtLeast") return player.stats.alliesSummoned >= condition.amount;\n'
    '  if (condition.kind === "opponentAlliesSummonedAtLeast") return enemy.stats.alliesSummoned >= condition.amount;\n'
    '  if (condition.kind === "nexusDamageDealtAtLeast") return player.stats.nexusDamageDealt >= condition.amount;\n'
    '  if (condition.kind === "opponentNexusDamageDealtAtLeast") return enemy.stats.nexusDamageDealt >= condition.amount;\n'
    '  if (condition.kind === "handAtLeast")',
)

# Negated cards are still committed/cast. Make that public-state transition converge
# level-up and conditional Auras immediately (also closes hand/resource condition gaps).
replace_once(
    "src/game/engine/reactions.ts",
    'import { castSpell, effectiveCost, playUnit } from "./semantic-actions";\n',
    'import { castSpell, effectiveCost, playUnit } from "./semantic-actions";\n'
    'import { checkLevelUps } from "./effects";\n'
    'import { recomputeContinuousAuras } from "./state";\n',
)
replace_once(
    "src/game/engine/reactions.ts",
    '  player.hand = player.hand.filter((card) => card.instanceId !== item.instanceId);\n}\n',
    '  player.hand = player.hand.filter((card) => card.instanceId !== item.instanceId);\n'
    '  checkLevelUps(state);\n'
    '  recomputeContinuousAuras(state);\n'
    '}\n',
)

# Studio Ability Composer defaults + progress fields.
for path in [
    "src/app/admin/studio/AbilityComposerFields.tsx",
    "src/app/admin/studio/cards/ContinuousAuraConditionEditor.tsx",
]:
    replace_once(
        path,
        '"opponentSpellManaAtLeast" || kind === "handAtLeast"',
        '"opponentSpellManaAtLeast" || kind === "spellsCastAtLeast" || kind === "opponentSpellsCastAtLeast" || kind === "alliesSummonedAtLeast" || kind === "opponentAlliesSummonedAtLeast" || kind === "nexusDamageDealtAtLeast" || kind === "opponentNexusDamageDealtAtLeast" || kind === "handAtLeast"',
    )

replace_once(
    "src/app/admin/studio/AbilityComposerFields.tsx",
    '      {kind === "roundAtLeast" && <Field label="Round ≥"><input className="input" type="number" min={1} max={2000} value={(value as Extract<MechanicCondition, { kind: "roundAtLeast" }>).amount} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "roundAtLeast" }>), amount: Number(event.target.value) })} /></Field>}\n',
    '      {(kind === "spellsCastAtLeast" || kind === "opponentSpellsCastAtLeast" || kind === "alliesSummonedAtLeast" || kind === "opponentAlliesSummonedAtLeast" || kind === "nexusDamageDealtAtLeast" || kind === "opponentNexusDamageDealtAtLeast") && <Field label={kind === "spellsCastAtLeast" ? "Your spells cast ≥" : kind === "opponentSpellsCastAtLeast" ? "Opponent spells cast ≥" : kind === "alliesSummonedAtLeast" ? "Your allies summoned ≥" : kind === "opponentAlliesSummonedAtLeast" ? "Opponent allies summoned ≥" : kind === "nexusDamageDealtAtLeast" ? "Your Nexus damage dealt ≥" : "Opponent Nexus damage dealt ≥"}><input className="input" type="number" min={1} max={2000} value={(value as Extract<MechanicCondition, { kind: "spellsCastAtLeast" | "opponentSpellsCastAtLeast" | "alliesSummonedAtLeast" | "opponentAlliesSummonedAtLeast" | "nexusDamageDealtAtLeast" | "opponentNexusDamageDealtAtLeast" }>).amount} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "spellsCastAtLeast" | "opponentSpellsCastAtLeast" | "alliesSummonedAtLeast" | "opponentAlliesSummonedAtLeast" | "nexusDamageDealtAtLeast" | "opponentNexusDamageDealtAtLeast" }>), amount: Number(event.target.value) })} /></Field>}\n'
    '      {kind === "roundAtLeast" && <Field label="Round ≥"><input className="input" type="number" min={1} max={2000} value={(value as Extract<MechanicCondition, { kind: "roundAtLeast" }>).amount} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "roundAtLeast" }>), amount: Number(event.target.value) })} /></Field>}\n',
)
replace_once(
    "src/app/admin/studio/cards/ContinuousAuraConditionEditor.tsx",
    '        {kind === "roundAtLeast" && <label className="block"><span className="label">Rodada ≥</span><input className="input" type="number" min={1} max={2000} value={safeValue.amount} onChange={(event) => onChange({ ...safeValue, amount: Number(event.target.value) })} /></label>}\n',
    '        {(kind === "spellsCastAtLeast" || kind === "opponentSpellsCastAtLeast" || kind === "alliesSummonedAtLeast" || kind === "opponentAlliesSummonedAtLeast" || kind === "nexusDamageDealtAtLeast" || kind === "opponentNexusDamageDealtAtLeast") && <label className="block"><span className="label">{kind === "spellsCastAtLeast" ? "Seus feitiços conjurados ≥" : kind === "opponentSpellsCastAtLeast" ? "Feitiços inimigos conjurados ≥" : kind === "alliesSummonedAtLeast" ? "Seus aliados invocados ≥" : kind === "opponentAlliesSummonedAtLeast" ? "Aliados inimigos invocados ≥" : kind === "nexusDamageDealtAtLeast" ? "Seu dano ao Nexus ≥" : "Dano inimigo ao Nexus ≥"}</span><input className="input" type="number" min={1} max={2000} value={safeValue.amount} onChange={(event) => onChange({ ...safeValue, amount: Number(event.target.value) })} /></label>}\n'
    '        {kind === "roundAtLeast" && <label className="block"><span className="label">Rodada ≥</span><input className="input" type="number" min={1} max={2000} value={safeValue.amount} onChange={(event) => onChange({ ...safeValue, amount: Number(event.target.value) })} /></label>}\n',
)

# Studio explanatory copy.
replace_once(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'eyebrow="CONDITION 2.8 — SENTINELA BOARD THRESHOLDS"',
    'eyebrow="CONDITION 2.9 — MATCH PROGRESS THRESHOLDS"',
)
replace_once(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual, vida do próprio Nexus',
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus',
)
# Same phrase occurs twice (Unit-source and non-Unit-source copy); patch second occurrence too.
replace_once(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual, vida do próprio Nexus',
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus',
)

# Aura 2.5 contract regression list.
replace_once(
    "src/game/aura-2-5-conditional-auras.test.ts",
    '"spellManaAtLeast", "opponentSpellManaAtLeast", "handAtLeast"',
    '"spellManaAtLeast", "opponentSpellManaAtLeast", "spellsCastAtLeast", "opponentSpellsCastAtLeast", "alliesSummonedAtLeast", "opponentAlliesSummonedAtLeast", "nexusDamageDealtAtLeast", "opponentNexusDamageDealtAtLeast", "handAtLeast"',
)

# Behavioral suite target 76.
replace_once(
    "scripts/test-suites.mjs",
    '  "src/game/condition-2-8-sentinela-board-thresholds.test.ts",\n',
    '  "src/game/condition-2-8-sentinela-board-thresholds.test.ts",\n  "src/game/condition-2-9-match-progress-thresholds.test.ts",\n',
)

# Dedicated behavioral certification.
test = r'''import assert from "node:assert/strict";
import "./aura-2-types";
import { ABILITY_GRAMMAR_CATALOG, blueprintFromPermanentStatAura } from "./ability-system";
import { auraConditionMatches } from "./aura-condition-contract";
import { MECHANIC_CONDITION_KINDS, sanitizeMechanicCondition, validateAuthorableCard } from "./card-authoring";
import { CONDITION_RUNTIME_SUPPORT, conditionKindsAtDepth } from "./condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  castSpell,
  createGame,
  declareAttack,
  makePermanent,
  makeUnit,
  mechanicConditionMatches,
  playUnit,
  recomputeContinuousAuras,
  resolveCombat,
} from "./engine";
import { applyStackedAction } from "./engine/reactions";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura } from "./types";

const unitCard = (defId: string, extra: Partial<CardDef> = {}): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 4,
  race: "Spirit",
  description: "Condition 2.9 match-progress test unit.",
  rarity: "Common",
  emoji: "📈",
  ...extra,
});

const auraCard = (defId: string, condition: PermanentStatAura["condition"]): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 1,
  maxHealth: 4,
  aura: { buffPower: 2, buffHealth: 0, condition },
  description: "Condition 2.9 progress Aura.",
  rarity: "Rare",
  emoji: "📊",
});

const spellCard = (defId: string, effect: CardDef["spell"], speed?: "Fast" | "Burst"): CardDef => ({
  defId,
  name: defId,
  region: "Tidecall",
  type: "Spell",
  cost: 1,
  spell: effect,
  ...(speed ? { speed } : {}),
  description: "Condition 2.9 test spell.",
  rarity: "Common",
  emoji: "✨",
});

const progressKinds = [
  "spellsCastAtLeast",
  "opponentSpellsCastAtLeast",
  "alliesSummonedAtLeast",
  "opponentAlliesSummonedAtLeast",
  "nexusDamageDealtAtLeast",
  "opponentNexusDamageDealtAtLeast",
] as const;

for (const kind of progressKinds) {
  assert.equal(MECHANIC_CONDITION_KINDS.includes(kind), true);
  assert.equal(CONDITION_RUNTIME_SUPPORT[kind], "supported");
  assert.equal(conditionKindsAtDepth(0).includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts[kind], "supported");
}

assert.deepEqual(sanitizeMechanicCondition({ kind: "spellsCastAtLeast", amount: -5 }), { kind: "spellsCastAtLeast", amount: 1 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "opponentAlliesSummonedAtLeast", amount: 99999 }), { kind: "opponentAlliesSummonedAtLeast", amount: 2000 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "nexusDamageDealtAtLeast", amount: 7.9 }), { kind: "nexusDamageDealtAtLeast", amount: 7 });

withRegisteredCardSnapshot([unitCard("test_condition29_source")], () => {
  const state = createGame("Condition 2.9 Orientation", DECKS[3], DECKS[2], true, 629001);
  const playerSource = makeUnit(state, "test_condition29_source", "player");
  const aiSource = makeUnit(state, "test_condition29_source", "ai");
  state.players.player.bench = [playerSource];
  state.players.ai.bench = [aiSource];
  state.players.player.stats = { spellsCast: 3, alliesSummoned: 5, nexusDamageDealt: 8 };
  state.players.ai.stats = { spellsCast: 2, alliesSummoned: 4, nexusDamageDealt: 6 };

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "spellsCastAtLeast", amount: 3 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentSpellsCastAtLeast", amount: 3 }), false);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "opponentSpellsCastAtLeast", amount: 3 }), true, "AI reads player progress symmetrically");
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "alliesSummonedAtLeast", amount: 5 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentAlliesSummonedAtLeast", amount: 5 }), false);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "nexusDamageDealtAtLeast", amount: 8 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentNexusDamageDealtAtLeast", amount: 7 }), false);
  assert.equal(mechanicConditionMatches(state, playerSource, {
    kind: "and",
    children: [
      { kind: "spellsCastAtLeast", amount: 3 },
      { kind: "not", child: { kind: "opponentNexusDamageDealtAtLeast", amount: 7 } },
    ],
  }), true);

  assert.equal(auraConditionMatches(state, "player", { kind: "spellsCastAtLeast", amount: 3 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "opponentAlliesSummonedAtLeast", amount: 5 }), false);
  assert.equal(auraConditionMatches(state, "ai", { kind: "opponentNexusDamageDealtAtLeast", amount: 8 }), true);
});

// Real spell cast crosses a controller progress threshold in the returned state.
withRegisteredCardSnapshot([
  auraCard("test_condition29_spell_aura", { kind: "spellsCastAtLeast", amount: 1 }),
  unitCard("test_condition29_spell_ally"),
  spellCard("test_condition29_progress_spell", { kind: "draw", amount: 1, target: "none" }),
], () => {
  const state = createGame("Condition 2.9 Spell Lifecycle", DECKS[3], DECKS[2], true, 629002);
  const ally = makeUnit(state, "test_condition29_spell_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.permanents = [makePermanent(state, "test_condition29_spell_aura", "player")];
  state.players.player.hand = [{ instanceId: "condition29_spell", defId: "test_condition29_progress_spell" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const next = castSpell(state, "player", "condition29_spell");
  assert.equal(next.players.player.stats.spellsCast, 1);
  assert.equal(next.players.player.bench[0].power, 4, "spell-cast progress activates Aura immediately");
});

// Real Unit play crosses alliesSummoned in the returned state.
withRegisteredCardSnapshot([
  auraCard("test_condition29_summon_aura", { kind: "alliesSummonedAtLeast", amount: 1 }),
  unitCard("test_condition29_summon_ally"),
  unitCard("test_condition29_entering_unit"),
], () => {
  const state = createGame("Condition 2.9 Summon Lifecycle", DECKS[3], DECKS[2], true, 629003);
  const ally = makeUnit(state, "test_condition29_summon_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.permanents = [makePermanent(state, "test_condition29_summon_aura", "player")];
  state.players.player.hand = [{ instanceId: "condition29_unit", defId: "test_condition29_entering_unit" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const next = playUnit(state, "player", "condition29_unit");
  assert.equal(next.players.player.stats.alliesSummoned, 1);
  const existing = next.players.player.bench.find((candidate) => candidate.instanceId === ally.instanceId)!;
  assert.equal(existing.power, 4, "summon progress activates Aura immediately");
});

// Real combat crosses nexusDamageDealt and cleanup/recompute observes it.
withRegisteredCardSnapshot([
  auraCard("test_condition29_damage_aura", { kind: "nexusDamageDealtAtLeast", amount: 2 }),
  unitCard("test_condition29_damage_ally"),
  unitCard("test_condition29_attacker", { power: 2, health: 4 }),
], () => {
  const state = createGame("Condition 2.9 Damage Lifecycle", DECKS[3], DECKS[2], true, 629004);
  const ally = makeUnit(state, "test_condition29_damage_ally", "player");
  const attacker = makeUnit(state, "test_condition29_attacker", "player");
  attacker.summonedThisTurn = false;
  state.players.player.bench = [ally, attacker];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition29_damage_aura", "player")];
  state.activePlayer = "player";
  state.attackToken = "player";
  state.phase = "main";
  state.hasAttackedThisTurn = false;
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const declared = declareAttack(state, "player", [attacker.instanceId]);
  const next = resolveCombat(declared, {});
  assert.equal(next.players.player.stats.nexusDamageDealt, 2);
  const existing = next.players.player.bench.find((candidate) => candidate.instanceId === ally.instanceId)!;
  assert.equal(existing.power, 4, "combat Nexus damage activates Aura in authoritative combat resolution");
});

// A negated Spell is still a cast: stack consumption must advance level-up and Auras now.
withRegisteredCardSnapshot([
  auraCard("test_condition29_negated_aura", { kind: "spellsCastAtLeast", amount: 1 }),
  unitCard("test_condition29_negated_ally"),
  unitCard("test_condition29_champion_1", {
    isChampion: true,
    levelUp: { type: "spellsCast", amount: 1, toDefId: "test_condition29_champion_2", hint: "Cast one spell" },
  }),
  unitCard("test_condition29_champion_2", { isChampion: true, power: 5, health: 5 }),
  spellCard("test_condition29_pending_spell", { kind: "draw", amount: 1, target: "none" }, "Fast"),
  spellCard("test_condition29_counter", { kind: "negateSpell", amount: 0, target: "spellOnStack" }, "Burst"),
], () => {
  const state = createGame("Condition 2.9 Negated Cast", DECKS[3], DECKS[2], true, 629005);
  const ally = makeUnit(state, "test_condition29_negated_ally", "player");
  const champion = makeUnit(state, "test_condition29_champion_1", "player");
  champion.summonedThisTurn = false;
  state.players.player.bench = [ally, champion];
  state.players.player.permanents = [makePermanent(state, "test_condition29_negated_aura", "player")];
  state.players.player.hand = [{ instanceId: "condition29_pending", defId: "test_condition29_pending_spell" }];
  state.players.ai.hand = [{ instanceId: "condition29_counter", defId: "test_condition29_counter" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const result = applyStackedAction(
    state,
    { kind: "spell", player: "player", instanceId: "condition29_pending", defId: "test_condition29_pending_spell" },
    {
      human: "skip",
      playerCounter: { kind: "spell", player: "ai", instanceId: "condition29_counter", defId: "test_condition29_counter" },
    },
  ).next;
  assert.equal(result.players.player.hand.some((card) => card.instanceId === "condition29_pending"), false);
  assert.equal(result.players.player.stats.spellsCast, 1, "negated pending Spell still counts as cast");
  assert.equal(result.players.player.bench.find((candidate) => candidate.instanceId === ally.instanceId)!.power, 4, "negated cast recomputes conditional Aura");
  assert.equal(result.players.player.bench.find((candidate) => candidate.instanceId === champion.instanceId)!.defId, "test_condition29_champion_2", "negated cast advances Champion level-up immediately");
});

const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition29_mechanic", {
  mechanics: [{
    key: "battle_memory",
    name: "Battle Memory",
    trigger: "onRoundStart",
    condition: { kind: "opponentNexusDamageDealtAtLeast", amount: 5 },
    effect: { kind: "draw", amount: 1, target: "none" },
  }],
}));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "opponentNexusDamageDealtAtLeast", amount: 5 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(auraCard("valid_condition29_aura", {
  kind: "and",
  children: [
    { kind: "spellsCastAtLeast", amount: 2 },
    { kind: "not", child: { kind: "opponentAlliesSummonedAtLeast", amount: 4 } },
  ],
}));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.9: PASS — symmetric match-progress thresholds, real cast/summon/Nexus-damage lifecycle, negated-cast convergence, authoring and Ability Grammar certified");
'''
write("src/game/condition-2-9-match-progress-thresholds.test.ts", test)

# Documentation.
doc = '''# Condition System 2.9 — Match Progress Thresholds

## Objetivo

Condition 2.9 expõe ao contrato genérico seis contadores públicos e autoritativos que o engine já mantinha para progressão de Campeões e telemetria de partida:

```ts
{ kind: "spellsCastAtLeast", amount: N }
{ kind: "opponentSpellsCastAtLeast", amount: N }
{ kind: "alliesSummonedAtLeast", amount: N }
{ kind: "opponentAlliesSummonedAtLeast", amount: N }
{ kind: "nexusDamageDealtAtLeast", amount: N }
{ kind: "opponentNexusDamageDealtAtLeast", amount: N }
```

## Semântica autoritativa

As folhas leem diretamente `PlayerState.stats`. `spellsCast` avança quando uma Spell/Permanent/Equipment que conta como spell é efetivamente comprometida; `alliesSummoned` avança em invocações autoritativas de Unit/token; `nexusDamageDealt` avança em `damageNexus()` independentemente da origem do dano.

A orientação é controller-scoped: as variantes sem `opponent` observam o controlador da fonte, e as variantes `opponent*` observam o outro jogador. Player e IA usam exatamente a mesma regra.

Nenhum contador, cache, replay field ou lifecycle paralelo foi criado.

## Envelope de authoring

As seis folhas usam `1..2000` como envelope de segurança do sanitizer/Studio. Esse limite não é um cap de gameplay e não altera os contadores do engine; ele apenas impede payloads absurdos no authoring, seguindo o mesmo envelope já usado por `roundAtLeast`.

## Lifecycle

Os caminhos normais já convergem pelos pontos autoritativos existentes:

- `castSpell()` incrementa `spellsCast` e passa por `cleanupDead()`/recompute;
- `playUnit()` e `summonToken` incrementam `alliesSummoned` e convergem pelo cleanup/recompute do action/trigger correspondente;
- combate, Spells e habilidades usam `damageNexus()`, e seus actions convergem antes de devolver o estado.

Condition 2.9 fecha ainda uma lacuna da stack: `consumeNegatedCard()` já considerava uma Spell negada como conjurada e pagava/retirava a carta da mão, mas não reavaliava level-up nem Continuous Auras. Agora esse consumo chama `checkLevelUps()` e `recomputeContinuousAuras()` no mesmo estado. Isso também corrige a convergência de condições anteriores baseadas em mão/mana quando uma carta é negada.

## Studio e Ability Grammar

As seis folhas aparecem no Ability Composer e no editor de Continuous Aura com labels próprias, suportam `AND`, `OR` e `NOT`, e entram automaticamente no Ability Grammar pelo catálogo canônico `MECHANIC_CONDITION_KINDS` + `CONDITION_RUNTIME_SUPPORT`.

## Certificação

`condition-2-9-match-progress-thresholds.test.ts` cobre catálogo, clamps, orientação player/IA, composição, Mechanics, Aura, lifecycle real de Spell, invocação e dano de combate ao Nexus, convergência de Spell negada, level-up imediato, authoring e Ability Grammar. O total comportamental sobe de 75 para 76 targets.
'''
write("docs/CONDITION-2-9.md", doc)

# Append Aura integration note once.
aura_doc_path = "docs/AURA-2.md"
aura_doc = read(aura_doc_path)
if "## Condition System 2.9 — Match Progress Thresholds" not in aura_doc:
    aura_doc += '''\n\n## Condition System 2.9 — Match Progress Thresholds\n\nContinuous Auras podem observar feitiços conjurados, aliados invocados e dano total causado ao Nexus, tanto do controlador quanto do oponente. As folhas leem diretamente `PlayerState.stats` e reutilizam os ciclos autoritativos de cast, summon, combate e habilidades. O consumo de uma Spell negada agora também converge level-up e Auras condicionais no mesmo estado. Veja `docs/CONDITION-2-9.md`.\n'''
    write(aura_doc_path, aura_doc)

# Temporary bootstrap files must not survive in the product diff.
for temporary in [
    ROOT / "scripts/condition-2-9-bootstrap.py",
    ROOT / ".github/workflows/condition-2-9-bootstrap.yml",
]:
    if temporary.exists():
        temporary.unlink()
