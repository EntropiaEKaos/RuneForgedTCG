import { registerCustomCards, clearRegisteredCustomCards } from "./custom-registry";
import { createCustomGame, addCardsToHand, playUnit } from "./engine";
import type { CardDef } from "./types";
import { sanitizeKeywordBehavior, sanitizeCompositeEffectDefinition, sanitizeArchetypeDefinition, mechanicFromKeyword, applyArchetype } from "./mechanics-authoring";
import { CARD_EFFECT_KINDS } from "./card-authoring";
import { compileRuleDsl } from "../lib/rule-dsl";

let pass=0, fail=0;
function ok(name:string, value:boolean){ if(value){pass++; console.log(`✅ ${name}`)} else {fail++; console.error(`❌ ${name}`)} }

const behavior = sanitizeKeywordBehavior({ version:1, trigger:"onSummon", condition:{kind:"always"}, effect:{kind:"damageNexus",amount:2,target:"none"} });
ok("custom keyword behavior compiles", !!behavior);
ok("unsafe/unknown trigger is rejected", !sanitizeKeywordBehavior({trigger:"hack",effect:{kind:"draw",amount:1,target:"none"}}));
const macro = sanitizeCompositeEffectDefinition({ version:1, effect:{kind:"damageUnit",amount:2,target:"enemyUnit",also:{kind:"draw",amount:1,target:"none"}} });
ok("composite effect macro preserves follow-up", !!macro?.effect.also && macro.effect.also.kind === "draw");
ok("unknown primitive effect is rejected", !sanitizeCompositeEffectDefinition({effect:{kind:"evalJs",amount:1,target:"none"}}));
const location = sanitizeArchetypeDefinition({version:1,defaults:{maxHealth:5}}, "Enchantment");
ok("Location-style archetype compiles on permanent base", !!location && location.zone === "permanent" && location.defaults?.maxHealth === 5);
ok("unknown structural card type is rejected", !sanitizeArchetypeDefinition({}, "Location"));

const mechanic = mechanicFromKeyword("bloodthirst", "Bloodthirst", behavior!);
const custom: CardDef = {
  defId:"test_dynamic_mechanic", name:"Dynamic Mechanic Test", region:"Emberhold", type:"Unit", cost:0,
  power:1, health:1, rarity:"Common", emoji:"🧪", description:"test", mechanics: mechanic ? [mechanic] : [], customKeywords:["bloodthirst"]
};
registerCustomCards([custom]);
let state=createCustomGame("Tester",{id:"t",name:"T",cards:[custom.defId]},{id:"a",name:"A",cards:["ember_whelp"]},{skipMulligan:true,playerStartingMana:10,aiStartingMana:0,playerGoesFirst:true,seed:123});
state=addCardsToHand(state,"player",[custom.defId]);
const inst=state.players.player.hand.find(x=>x.defId===custom.defId)!;
const before=state.players.ai.nexusHealth;
state=playUnit(state,"player",inst.instanceId);
ok("embedded custom keyword executes in production engine trigger path", state.players.ai.nexusHealth === before - 2);
clearRegisteredCustomCards();

const baseCard: CardDef={defId:"arch_test",name:"Arch Test",region:"Ironwood",type:"Unit",cost:1,power:1,health:1,rarity:"Common",emoji:"A",description:"A"};
const applied=applyArchetype(baseCard,"location","Location",{version:1,defaults:{maxHealth:4}},"Enchantment");
ok("archetype changes semantic card type through audited baseType", !!applied && applied.type === "Enchantment" && applied.archetypeName === "Location" && applied.maxHealth === 4);

const mill=compileRuleDsl({sourceType:"any",sourceKey:"",event:"onPlay",targetType:"enemy",targetKey:"",effectKind:"mill",amount:3,buffPower:0,buffHealth:0,target:"none"});
ok("Rule Graph consumes canonical mill effect", mill.ok && mill.effect.kind === "mill");
ok("all native EffectKinds remain exposed", CARD_EFFECT_KINDS.length >= 26 && CARD_EFFECT_KINDS.includes("mill"));
const selfMill=compileRuleDsl({sourceType:"any",sourceKey:"",event:"onPlay",targetType:"self",targetKey:"",effectKind:"selfMill",amount:2,buffPower:0,buffHealth:0,target:"none"});
ok("Rule Graph consumes canonical selfMill effect", selfMill.ok && selfMill.effect.kind === "selfMill");
ok("selfMill remains exposed through native EffectKinds", CARD_EFFECT_KINDS.includes("selfMill"));

console.log(`MECHANICS STUDIO 1.0: ${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
