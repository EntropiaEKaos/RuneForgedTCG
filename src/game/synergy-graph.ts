import { collectibleCards, getCard } from "./cards";
import { cardRegions } from "./region-identity";
import type { CardDef } from "./types";

export interface SynergyEdge { defId:string; name:string; score:number; reasons:string[]; }
function overlap<T>(a:T[] = [], b:T[] = []) { const s=new Set(a); return b.filter(x=>s.has(x)).length; }
function effectKinds(card:CardDef): string[] { return [card.spell?.kind, card.trigger?.effect.kind, ...(card.mechanics||[]).map(m=>m.effect.kind)].filter(Boolean) as string[]; }
export function synergyScore(a:CardDef,b:CardDef): SynergyEdge {
  let score=0; const reasons:string[]=[];
  const race=overlap([a.race,...(a.secondaryRaces||[])].filter(Boolean) as string[], [b.race,...(b.secondaryRaces||[])].filter(Boolean) as string[]); if(race){score+=race*4;reasons.push("mesma raça");}
  const classes=overlap(a.classes||[],b.classes||[]); if(classes){score+=classes*3;reasons.push("classe compartilhada");}
  const keywords=overlap(a.keywords||[],b.keywords||[]); if(keywords){score+=Math.min(3,keywords*1.5);reasons.push("keywords compartilhadas");}
  const regions=overlap(cardRegions(a),cardRegions(b)); if(regions){score+=regions*2;reasons.push("identidade regional");}
  const doctrines=overlap(a.doctrineAffinities||[],b.doctrineAffinities||[]); if(doctrines){score+=doctrines*4;reasons.push("mesma doutrina");}
  if(overlap(effectKinds(a),effectKinds(b))){score+=2;reasons.push("plano de efeitos");}
  if(Math.abs(a.cost-b.cost)<=1){score+=1;reasons.push("curva próxima");}
  return {defId:b.defId,name:b.name,score:Math.round(score*10)/10,reasons};
}
export function recommendSynergies(defId:string, limit=8): SynergyEdge[] {
  const card=getCard(defId); return collectibleCards().filter(c=>c.defId!==defId).map(c=>synergyScore(card,c)).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,limit);
}
export function analyzeDeckSynergy(cards:string[]) {
  const unique=[...new Set(cards)]; const links:SynergyEdge[]=[];
  for(let i=0;i<unique.length;i++) for(let j=i+1;j<unique.length;j++){const edge=synergyScore(getCard(unique[i]),getCard(unique[j])); if(edge.score>=5) links.push(edge);}
  const score=cards.length ? Math.min(100,Math.round(links.reduce((s,e)=>s+e.score,0)/Math.max(unique.length,1)*4)) : 0;
  return {score,links:links.sort((a,b)=>b.score-a.score).slice(0,12)};
}
