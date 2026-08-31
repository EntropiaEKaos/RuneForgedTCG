import { getCard } from "./cards";
import type { CardDef, Keyword, UnitInstance } from "./types";

export type CardInspectionTone = "buff" | "debuff" | "state";

export interface CardInspectionStatus {
  id: string;
  tone: CardInspectionTone;
  label: string;
  detail: string;
}

export interface CardRuntimeInspection {
  printedPower: number;
  currentPower: number;
  powerDelta: number;
  equipmentPower: number;
  auraPower: number;
  otherPowerModifier: number;
  printedHealth: number;
  currentHealth: number;
  currentMaxHealth: number;
  maxHealthDelta: number;
  equipmentHealth: number;
  auraHealth: number;
  otherHealthModifier: number;
  permanentHealthModifier: number;
  damageTaken: number;
  gainedKeywords: Keyword[];
  lostKeywords: Keyword[];
  statuses: CardInspectionStatus[];
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export function inspectRuntimeCard(def: CardDef, unit?: UnitInstance): CardRuntimeInspection | null {
  if (!unit) return null;

  const printedPower = Number(def.power ?? 0);
  const printedHealth = Number(def.type === "Enchantment" || def.type === "Artifact" ? def.maxHealth ?? def.health ?? 0 : def.health ?? 0);
  let equipmentPower = 0;
  let equipmentHealth = 0;
  for (const equipment of unit.equipment) {
    const equipmentDef = getCard(equipment.defId);
    equipmentPower += Number(equipmentDef.equipment?.buffPower ?? 0);
    equipmentHealth += Number(equipmentDef.equipment?.buffHealth ?? 0);
  }
  const auraPower = Number(unit.auraPowerBonus ?? 0);
  const auraHealth = Number(unit.auraHealthBonus ?? 0);

  const printedKeywords = new Set(def.keywords ?? []);
  const runtimeKeywords = new Set(unit.keywords);
  const gainedKeywords = unit.keywords.filter((keyword) => !printedKeywords.has(keyword));
  const lostKeywords = (def.keywords ?? []).filter((keyword) => !runtimeKeywords.has(keyword));
  const statuses: CardInspectionStatus[] = [];
  const add = (id: string, tone: CardInspectionTone, label: string, detail: string) => statuses.push({ id, tone, label, detail });

  if (unit.powerBuffs !== 0) add("power-modifier", unit.powerBuffs > 0 ? "buff" : "debuff", `Poder ${signed(unit.powerBuffs)}`, "Modificador de poder aplicado ao estado atual da unidade.");
  if (unit.healthBuffs !== 0) add("health-modifier", unit.healthBuffs > 0 ? "buff" : "debuff", `Vida máxima ${signed(unit.healthBuffs)}`, "Modificador de vida aplicado ao estado atual da unidade.");
  if (auraPower !== 0 || auraHealth !== 0) add("continuous-aura", "buff", `Aura contínua ${signed(auraPower)}/${signed(auraHealth)}`, "Bônus derivado de Encantamentos ou Artefatos aliados enquanto as fontes permanecem em campo.");
  if (unit.permanentHealthModifier !== 0) add("permanent-health", unit.permanentHealthModifier > 0 ? "buff" : "debuff", `Vida permanente ${signed(unit.permanentHealthModifier)}`, "Alteração permanente da vida máxima desta instância.");
  if (equipmentPower !== 0 || equipmentHealth !== 0) add("equipment", equipmentPower >= 0 && equipmentHealth >= 0 ? "buff" : "state", `Equipamentos ${signed(equipmentPower)}/${signed(equipmentHealth)}`, `${unit.equipment.length} equipamento(s) contribuindo para os atributos atuais.`);
  if (unit.frostbitten) add("frostbitten", "debuff", "❄ Congelado", "O poder atual está reduzido a 0 enquanto o efeito de congelamento estiver ativo.");
  if (unit.stunned) add("stunned", "debuff", "✦ Atordoado", "Esta unidade não pode ser declarada como atacante enquanto estiver atordoada.");
  if (unit.barrier) add("barrier", "buff", "🛡 Barreira ativa", "O próximo dano que esta unidade sofreria será negado.");
  else if (runtimeKeywords.has("Barrier")) add("barrier-spent", "state", "🛡 Barreira consumida", "Esta unidade possui Barreira, mas a proteção desta instância já foi gasta.");
  if (unit.summonedThisTurn && !runtimeKeywords.has("Haste")) add("summoning-sickness", "state", "Recém-invocada", "Ainda não está pronta para atacar neste turno.");
  if (unit.hasAttackedThisTurn) add("attacked", "state", "Ataque utilizado", "Esta unidade já atacou neste turno.");
  if (unit.hasStruck) add("struck", "state", "Já golpeou", `${unit.strikes} golpe(s) total(is); ${unit.nexusStrikes} atingiram o Nexus.`);
  if (unit.poisonCounters > 0) add("poison", "debuff", `🧪 Veneno ×${unit.poisonCounters}`, "Contadores de veneno atualmente acumulados nesta unidade.");
  if (unit.leveled) add("leveled", "buff", "✨ Campeão evoluído", "Esta instância já completou sua condição de evolução.");
  for (const keyword of gainedKeywords) add(`gained-${keyword}`, "buff", `Habilidade ganha: ${keyword}`, "Esta habilidade não fazia parte da carta impressa e foi adquirida durante a partida.");
  for (const keyword of lostKeywords) add(`lost-${keyword}`, "debuff", `Habilidade perdida: ${keyword}`, "Esta habilidade fazia parte da carta impressa, mas não está ativa nesta instância.");

  return {
    printedPower,
    currentPower: unit.power,
    powerDelta: unit.power - printedPower,
    equipmentPower,
    auraPower,
    otherPowerModifier: unit.powerBuffs,
    printedHealth,
    currentHealth: unit.health,
    currentMaxHealth: unit.maxHealth,
    maxHealthDelta: unit.maxHealth - printedHealth,
    equipmentHealth,
    auraHealth,
    otherHealthModifier: unit.healthBuffs,
    permanentHealthModifier: unit.permanentHealthModifier,
    damageTaken: Math.max(0, unit.maxHealth - unit.health),
    gainedKeywords,
    lostKeywords,
    statuses,
  };
}
