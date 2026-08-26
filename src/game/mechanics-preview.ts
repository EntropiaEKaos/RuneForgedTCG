import type { CardEffect, CardMechanic, MechanicCondition } from "./types";
import { sanitizeCardEffect, sanitizeMechanicCondition } from "./card-authoring";

export type MechanicPreview = { valid:boolean; errors:string[]; effectChain:string[]; conditionTree:string[] };

function conditionLines(c: MechanicCondition, depth=0): string[] {
  const pad="  ".repeat(depth);
  if (c.kind === "and" || c.kind === "or") return [`${pad}${c.kind.toUpperCase()}`, ...c.children.flatMap(x=>conditionLines(x, depth+1))];
  if (c.kind === "not") return [`${pad}NOT`, ...conditionLines(c.child, depth+1)];
  return [`${pad}${c.kind}`];
}
function effectLines(effect: CardEffect): string[] { const out:string[]=[]; let cursor:CardEffect|undefined=effect; let guard=0; while(cursor && guard++<13){ out.push(`${cursor.kind}:${cursor.target}:${cursor.amount}`); cursor=cursor.also; } return out; }

export function previewMechanic(raw: Partial<CardMechanic>): MechanicPreview {
  const errors:string[]=[];
  const condition=sanitizeMechanicCondition(raw.condition ?? {kind:"always"});
  const effect=sanitizeCardEffect(raw.effect);
  if(!condition) errors.push("Invalid condition tree");
  if(!effect) errors.push("Invalid effect chain");
  return { valid:errors.length===0, errors, conditionTree:condition?conditionLines(condition):[], effectChain:effect?effectLines(effect):[] };
}
