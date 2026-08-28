import type { EffectKind, TargetKind } from "@/game/types";
import { CARD_EFFECT_KINDS, CARD_TARGETS } from "@/game/card-authoring";
import type { GraphNode, NodeKind } from "./RuleBuilderParts";

export type CardFixture = {
  defId: string;
  name: string;
  emoji: string;
  region: string;
  race?: string;
  classes: string[];
  power: number;
  health: number;
  keywords: string[];
};

export type Rule = {
  sourceType: string;
  sourceKey: string;
  event: string;
  targetType: string;
  targetKey: string;
  effectKind: EffectKind;
  amount: number;
  buffPower: number;
  buffHealth: number;
  target: TargetKind;
  keyword: string;
  graph?: { nodes: GraphNode[]; edges: [string, string][] };
  fixture?: { sourceDefId: string; targetDefId: string; enemyDefId: string; seed: number; mana: number };
};

export const effects: readonly EffectKind[] = CARD_EFFECT_KINDS;
export const targets: readonly TargetKind[] = CARD_TARGETS;
export const events = ["onPlay", "onSummon", "onSpellCast", "onAttack", "onStrike", "onDeath", "onRoundStart", "always"] as const;
export const sources = ["any", "class", "race", "keyword", "collection", "card"] as const;
export const targetTypes = ["self", "allies", "enemy", "race", "class", "card", "anyUnit"] as const;

export const emptyRule: Rule = {
  sourceType: "class",
  sourceKey: "mage",
  event: "onPlay",
  targetType: "allies",
  targetKey: "mage",
  effectKind: "buffClass",
  amount: 0,
  buffPower: 1,
  buffHealth: 1,
  target: "allyUnit",
  keyword: "",
  fixture: { sourceDefId: "ember_whelp", targetDefId: "ember_whelp", enemyDefId: "ember_drake", seed: 424242, mana: 5 },
};

export const kindStyle: Record<NodeKind, string> = {
  trigger: "border-cyan-400/30 bg-cyan-400/[.07]",
  condition: "border-violet-400/30 bg-violet-400/[.07]",
  target: "border-sky-400/30 bg-sky-400/[.07]",
  effect: "border-amber-400/30 bg-amber-400/[.07]",
  followup: "border-emerald-400/30 bg-emerald-400/[.07]",
};
export const kindDot: Record<NodeKind, string> = {
  trigger: "bg-cyan-300",
  condition: "bg-violet-300",
  target: "bg-sky-300",
  effect: "bg-amber-300",
  followup: "bg-emerald-300",
};
