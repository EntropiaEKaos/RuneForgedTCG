import { compileRuleDsl } from "./rule-dsl";

const rule = compileRuleDsl({sourceType:"class",sourceKey:"mage",event:"onSummon",targetType:"class",targetKey:"mage",effectKind:"buffClass",amount:0,buffPower:1,buffHealth:1,target:"allyUnit"});
if(!rule.ok) throw new Error(rule.error);
if(rule.effect.kind!=="buffClass"||rule.effect.classKey!=="mage") throw new Error("Rule compiler regression");
console.log("Content Studio 3.0 regression: PASS");
