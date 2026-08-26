import type { CardDef, CardEffect } from "./types";

export type DependencyKind = "card"|"keyword"|"archetype"|"equipment"|"token";
export type ContentDependency = { from:string; to:string; kind:DependencyKind; path:string };
export type DependencyGraphResult = { nodes:string[]; edges:ContentDependency[]; cycles:string[][] };

function effectRefs(from:string, effect:CardEffect|undefined, path:string, out:ContentDependency[]){
  let e=effect; let depth=0;
  while(e && depth++<13){ if(e.tokenDefId) out.push({from,to:e.tokenDefId,kind:"token",path:`${path}.tokenDefId`}); if(e.equipmentDefId) out.push({from,to:e.equipmentDefId,kind:"equipment",path:`${path}.equipmentDefId`}); e=e.also; path += ".also"; }
}
export function dependenciesForCard(card:CardDef):ContentDependency[]{
  const out:ContentDependency[]=[]; const from=card.defId;
  for(const k of card.customKeywords??[]) out.push({from,to:k,kind:"keyword",path:"customKeywords"});
  if(card.archetypeKey) out.push({from,to:card.archetypeKey,kind:"archetype",path:"archetypeKey"});
  effectRefs(from,card.spell,"spell",out); effectRefs(from,card.trigger?.effect,"trigger.effect",out);
  if(card.levelUp?.toDefId) out.push({from,to:card.levelUp.toDefId,kind:"card",path:"levelUp.toDefId"});
  for(const [i,a] of (card.sentinela?.abilities??[]).entries()) effectRefs(from,a.effect,`sentinela.abilities.${i}.effect`,out);
  for(const [i,m] of (card.mechanics??[]).entries()) effectRefs(from,m.effect,`mechanics.${i}.effect`,out);
  return out;
}
export function buildCardDependencyGraph(cards:CardDef[]):DependencyGraphResult{
  const edges=cards.flatMap(dependenciesForCard); const ids=new Set(cards.map(c=>c.defId));
  const cardEdges=edges.filter(e=>e.kind==="card"||e.kind==="token"||e.kind==="equipment").filter(e=>ids.has(e.to));
  const adj=new Map<string,string[]>(); for(const id of ids)adj.set(id,[]); for(const e of cardEdges)adj.get(e.from)?.push(e.to);
  const cycles:string[][]=[]; const visiting=new Set<string>(), done=new Set<string>();
  function dfs(n:string,stack:string[]){ if(visiting.has(n)){ const i=stack.indexOf(n); cycles.push([...stack.slice(i),n]); return; } if(done.has(n))return; visiting.add(n); stack.push(n); for(const x of adj.get(n)??[])dfs(x,stack); stack.pop(); visiting.delete(n); done.add(n); }
  for(const id of ids)dfs(id,[]);
  return {nodes:[...ids],edges,cycles};
}
