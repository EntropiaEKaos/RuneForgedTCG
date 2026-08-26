import type { CardEffect, EffectKind, TargetKind } from "@/game/types";
import { CARD_EFFECT_KINDS, CARD_TARGETS, sanitizeCardEffect } from "@/game/card-authoring";

export type RuleGraphNode = { id:string; kind:"trigger"|"condition"|"target"|"effect"|"followup"; label:string; data:Record<string, any> };
export type RuleDsl = {
  sourceType: "class" | "race" | "keyword" | "collection" | "card" | "any";
  sourceKey: string;
  event: "onPlay" | "onSummon" | "onSpellCast" | "onAttack" | "onStrike" | "onDeath" | "onRoundStart" | "always";
  targetType: "self" | "allies" | "enemy" | "race" | "class" | "card" | "anyUnit";
  targetKey: string;
  effectKind: EffectKind;
  amount: number;
  buffPower: number;
  buffHealth: number;
  target: TargetKind;
  keyword?: string;
  graph?: { nodes: RuleGraphNode[]; edges: [string,string][] };
};

const EFFECTS: readonly EffectKind[] = CARD_EFFECT_KINDS;
const TARGETS: readonly TargetKind[] = CARD_TARGETS;
const EVENTS = ["onPlay","onSummon","onSpellCast","onAttack","onStrike","onDeath","onRoundStart","always"] as const;
const SOURCES = ["class","race","keyword","collection","card","any"] as const;
const TARGET_TYPES = ["self","allies","enemy","race","class","card","anyUnit"] as const;

function makeEffect(data:any, fallback:RuleDsl): CardEffect | null {
  const kind = String(data?.effectKind || fallback.effectKind) as EffectKind;
  const target = String(data?.target || fallback.target) as TargetKind;
  if (!EFFECTS.includes(kind) || !TARGETS.includes(target)) return null;
  return { kind, amount:Number.isFinite(Number(data?.amount))?Number(data.amount):0, target, buffPower:Number.isFinite(Number(data?.buffPower))?Number(data.buffPower)||undefined:undefined, buffHealth:Number.isFinite(Number(data?.buffHealth))?Number(data.buffHealth)||undefined:undefined, keyword:data?.keyword?String(data.keyword) as any:undefined };
}

export function compileRuleDsl(input: Partial<RuleDsl>): { ok:true; effect:CardEffect; normalized:RuleDsl } | { ok:false; error:string } {
  const effectKind = String(input.effectKind || "buffUnit") as EffectKind;
  const target = String(input.target || "allyUnit") as TargetKind;
  if (!EFFECTS.includes(effectKind)) return {ok:false,error:`Unsupported effect: ${effectKind}`};
  if (!TARGETS.includes(target)) return {ok:false,error:`Unsupported target: ${target}`};
  const sourceType = (input.sourceType || "any") as RuleDsl["sourceType"];
  const event = (input.event || "onPlay") as RuleDsl["event"];
  const targetType = (input.targetType || "allies") as RuleDsl["targetType"];
  if (!SOURCES.includes(sourceType)) return {ok:false,error:`Unsupported source type: ${sourceType}`};
  if (!EVENTS.includes(event)) return {ok:false,error:`Unsupported event: ${event}`};
  if (!TARGET_TYPES.includes(targetType)) return {ok:false,error:`Unsupported target type: ${targetType}`};
  const sourceKey=String(input.sourceKey||"").trim();
  if(sourceType!=="any"&&!sourceKey)return {ok:false,error:"Source key is required unless source type is any."};
  const normalized:RuleDsl={sourceType,sourceKey,event,targetType,targetKey:String(input.targetKey||"").trim(),effectKind,amount:Number.isFinite(Number(input.amount))?Number(input.amount):0,buffPower:Number.isFinite(Number(input.buffPower))?Number(input.buffPower):0,buffHealth:Number.isFinite(Number(input.buffHealth))?Number(input.buffHealth):0,target,keyword:input.keyword?String(input.keyword):undefined,graph:input.graph};
  if(["race","class","card"].includes(targetType)&&!normalized.targetKey&&target!=="none"&&target!=="self")return {ok:false,error:`Target key is required for target type ${targetType}.`};
  let effect=makeEffect(normalized,normalized);
  if(!effect)return {ok:false,error:"Could not compile primary effect."};
  const followups=(normalized.graph?.nodes||[]).filter(n=>n.kind==="followup");
  let tail=effect;
  for(const node of followups){const next=makeEffect(node.data,normalized);if(!next)return {ok:false,error:`Invalid follow-up effect: ${node.id}`};tail.also=next;tail=next;}
  if(effect.kind===normalized.effectKind && normalized.targetType==="class")effect.classKey=normalized.targetKey||undefined;
  if(effect.kind===normalized.effectKind && normalized.targetType==="race")effect.race=(normalized.targetKey||undefined) as any;
  return {ok:true,effect,normalized};
}
