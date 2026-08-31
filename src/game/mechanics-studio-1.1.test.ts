import { sanitizeMechanicCondition } from "./card-authoring";
import {
  CONDITION_MAX_GROUP_CHILDREN,
  CONDITION_MAX_SUPPORTED_DEPTH,
  conditionCanAddChild,
  conditionKindsAtDepth,
  conditionTreeSupported,
} from "./condition-contract";
import { sanitizeKeywordBehavior } from "./mechanics-authoring";
import { previewMechanic } from "./mechanics-preview";
import type { MechanicCondition } from "./types";
const checks:string[]=[]; const ok=(x:boolean,m:string)=>{if(!x)throw new Error(m); checks.push(m)};
const tree=sanitizeMechanicCondition({kind:"and",children:[{kind:"manaAtLeast",amount:3},{kind:"not",child:{kind:"selfDamaged"}}]});
ok(!!tree && tree.kind==="and","nested AND/NOT condition compiles");
ok(!sanitizeMechanicCondition({kind:"and",children:[]}),"empty condition group rejected");
ok(!sanitizeMechanicCondition({kind:"not",child:{kind:"wat"}}),"invalid NOT child rejected");
ok(CONDITION_MAX_SUPPORTED_DEPTH===6,"condition contract derives server max depth 6");
ok(CONDITION_MAX_GROUP_CHILDREN===8,"condition contract derives server max group width 8");
const wrapNot=(levels:number):MechanicCondition=>{let condition:MechanicCondition={kind:"always"}; for(let i=0;i<levels;i+=1) condition={kind:"not",child:condition}; return condition;};
ok(conditionTreeSupported(wrapNot(CONDITION_MAX_SUPPORTED_DEPTH)),"deepest valid recursive condition remains authorable");
ok(!conditionTreeSupported(wrapNot(CONDITION_MAX_SUPPORTED_DEPTH+1)),"condition deeper than server contract is rejected");
ok(conditionKindsAtDepth(CONDITION_MAX_SUPPORTED_DEPTH-1).includes("not"),"composite condition remains available one level before boundary");
ok(!conditionKindsAtDepth(CONDITION_MAX_SUPPORTED_DEPTH).some((kind)=>kind==="and"||kind==="or"||kind==="not"),"depth boundary exposes only leaf conditions");
const sevenChildren={kind:"and",children:Array.from({length:CONDITION_MAX_GROUP_CHILDREN-1},()=>({kind:"always"} as MechanicCondition))} as Extract<MechanicCondition,{kind:"and"}>;
const eightChildren={kind:"and",children:Array.from({length:CONDITION_MAX_GROUP_CHILDREN},()=>({kind:"always"} as MechanicCondition))} as Extract<MechanicCondition,{kind:"and"}>;
ok(conditionCanAddChild(sevenChildren),"condition group can add its final legal child");
ok(!conditionCanAddChild(eightChildren),"condition group cannot exceed authoritative child limit");
const behavior={version:1,trigger:"onAttack",condition:{kind:"always"},effect:{kind:"draw",target:"none",amount:1}};
ok(!!sanitizeKeywordBehavior(behavior),"keyword behavior accepts executable Unit trigger");
ok(!sanitizeKeywordBehavior({...behavior,trigger:"onPermanentSummon"}),"keyword behavior rejects permanent-only trigger for Unit mechanics");
const p=previewMechanic({condition:{kind:"or",children:[{kind:"always"},{kind:"selfDamaged"}]},effect:{kind:"draw",target:"none",amount:1,also:{kind:"healNexus",target:"none",amount:2}}});
ok(p.valid,"mechanic preview valid"); ok(p.effectChain.length===2,"preview preserves effect chain"); ok(p.conditionTree.length===3,"preview renders condition tree");
console.log(`MECHANICS STUDIO 1.1: ${checks.length}/${checks.length} PASS · Trigger Source + Condition Contracts certified`);
