import type { CardDef, StrategicRole } from "./types";

export interface StrategicRoleIdentity {
  id: StrategicRole;
  label: string;
  icon: string;
}

export const STRATEGIC_ROLE_IDENTITIES: Record<StrategicRole, StrategicRoleIdentity> = {
  finisher: { id: "finisher", label: "FINALIZADOR", icon: "◆" },
  removal: { id: "removal", label: "INTERAÇÃO", icon: "✕" },
  defense: { id: "defense", label: "DEFESA", icon: "◇" },
  tempo: { id: "tempo", label: "PRESSÃO", icon: "↯" },
  engine: { id: "engine", label: "MOTOR", icon: "✦" },
  utility: { id: "utility", label: "UTILIDADE", icon: "•" },
};

const REMOVAL_EFFECTS = new Set(["damageUnit", "damagePermanent", "destroyPermanent", "recall", "stun", "aoeEnemy", "killUnit", "poison", "frostbite", "negateSpell"]);
const DEFENSE_EFFECTS = new Set(["healNexus", "healUnit", "grantBarrier"]);

/** Shared by CardView and Forge so visual labels and deck diagnostics cannot drift. */
export function strategicRoleForCard(def: CardDef): StrategicRoleIdentity {
  if (def.strategicRole) return STRATEGIC_ROLE_IDENTITIES[def.strategicRole];
  const effects = [def.spell?.kind, def.trigger?.effect.kind].filter((effect): effect is NonNullable<typeof effect> => Boolean(effect));
  if (def.isChampion || def.cost >= 7) return STRATEGIC_ROLE_IDENTITIES.finisher;
  if (effects.some((effect) => REMOVAL_EFFECTS.has(effect))) return STRATEGIC_ROLE_IDENTITIES.removal;
  if (effects.some((effect) => DEFENSE_EFFECTS.has(effect))) return STRATEGIC_ROLE_IDENTITIES.defense;
  if ((def.keywords ?? []).some((keyword) => ["Haste", "QuickAttack", "Elusive", "Flying", "Challenger"].includes(keyword))) return STRATEGIC_ROLE_IDENTITIES.tempo;
  if (def.trigger || def.type === "Enchantment" || def.type === "Artifact" || def.type === "Sentinela") return STRATEGIC_ROLE_IDENTITIES.engine;
  if ((def.keywords ?? []).some((keyword) => ["Barrier", "Tough", "Reach", "Regeneration", "Lifesteal"].includes(keyword))) return { ...STRATEGIC_ROLE_IDENTITIES.defense, label: "GUARDIÃO", icon: "⬡" };
  if (def.type === "Unit") return { ...STRATEGIC_ROLE_IDENTITIES.utility, label: "UNIDADE" };
  return STRATEGIC_ROLE_IDENTITIES.utility;
}
