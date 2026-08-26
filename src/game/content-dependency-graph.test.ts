import { buildCardDependencyGraph, dependenciesForCard } from "./content-dependency-graph";
import type { CardDef } from "./types";
const base=(id:string):CardDef=>({defId:id,name:id,region:"Emberhold",type:"Unit",cost:1,power:1,health:1,description:"x",rarity:"Common",emoji:"x"});
const a={...base("a"),levelUp:{type:"spellsCast" as const,amount:1,toDefId:"b",hint:""},customKeywords:["blood"],archetypeKey:"location"}; const b={...base("b"),levelUp:{type:"spellsCast" as const,amount:1,toDefId:"a",hint:""}};
const deps=dependenciesForCard(a); if(!deps.some(x=>x.to==="blood")||!deps.some(x=>x.to==="location"))throw new Error("mechanics dependencies missing"); const g=buildCardDependencyGraph([a,b]); if(!g.cycles.length)throw new Error("cycle not detected"); console.log("CONTENT DEPENDENCY GRAPH: PASS");
