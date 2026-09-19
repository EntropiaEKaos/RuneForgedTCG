import type { GeneralZoneLocation } from "./four-player-general-zone";

export type GeneralAbilityScope = "command" | "presence";

export interface GeneralAbilityDefinition {
  key: string;
  scope: GeneralAbilityScope;
  description: string;
}

export interface GeneralAbilityContext {
  location: GeneralZoneLocation;
}

/** Command abilities are live only in General Zone; Presence abilities only on battlefield. */
export function isGeneralAbilityActive(
  ability: GeneralAbilityDefinition,
  context: GeneralAbilityContext,
): boolean {
  if (ability.scope === "command") return context.location === "general_zone";
  return context.location === "battlefield";
}

export function activeGeneralAbilities(
  abilities: readonly GeneralAbilityDefinition[],
  context: GeneralAbilityContext,
): GeneralAbilityDefinition[] {
  return abilities.filter((ability) => isGeneralAbilityActive(ability, context));
}
