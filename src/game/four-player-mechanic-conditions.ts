import type { FourPlayerBattlefieldObject } from "./four-player-battlefield";
import type { FourPlayerMatchState } from "./four-player-match";
import type { MechanicCondition } from "./types";

export interface FourPlayerMechanicConditionResult {
  supported: boolean;
  matches: boolean;
}

function liveObject(object: FourPlayerBattlefieldObject): boolean {
  if (object.combat && object.combat.health <= 0) return false;
  if (object.durability && object.durability.health <= 0) return false;
  if (object.kind === "sentinela" && object.loyalty !== undefined && object.loyalty <= 0) return false;
  return true;
}

function alliedObjects(match: FourPlayerMatchState, source: FourPlayerBattlefieldObject) {
  return (match.battlefield?.objects ?? []).filter(
    (object) => object.controllerSeat === source.controllerSeat && liveObject(object),
  );
}

function unsupported(): FourPlayerMechanicConditionResult {
  return { supported: false, matches: false };
}

function supported(matches: boolean): FourPlayerMechanicConditionResult {
  return { supported: true, matches };
}

export function fourPlayerMechanicConditionMatches(
  match: FourPlayerMatchState,
  source: FourPlayerBattlefieldObject,
  condition: MechanicCondition | undefined,
): FourPlayerMechanicConditionResult {
  if (!condition || condition.kind === "always") return supported(true);
  if (!source.combat) return unsupported();

  if (condition.kind === "selfDamaged") return supported(source.combat.health < source.combat.maxHealth);

  if (condition.kind === "and" || condition.kind === "or") {
    const children = condition.children.map((child) => fourPlayerMechanicConditionMatches(match, source, child));
    if (children.some((child) => !child.supported)) return unsupported();
    return supported(condition.kind === "and"
      ? children.every((child) => child.matches)
      : children.some((child) => child.matches));
  }
  if (condition.kind === "not") {
    const child = fourPlayerMechanicConditionMatches(match, source, condition.child);
    return child.supported ? supported(!child.matches) : unsupported();
  }

  const allies = alliedObjects(match, source);
  const alliedUnits = allies.filter((object) => object.combat && ["unit", "general", "token"].includes(object.kind));
  const alliedPermanents = allies.filter((object) => object.kind === "permanent" && object.durability);
  const alliedSentinelas = allies.filter((object) => object.kind === "sentinela" && (object.loyalty ?? 0) > 0);
  const seat = match.seats[source.controllerSeat];

  if (condition.kind === "allyRace") {
    return supported(alliedUnits.filter((object) => object.combat?.races.includes(condition.race)).length >= condition.min);
  }
  if (condition.kind === "allyClass") {
    return supported(alliedUnits.filter((object) => object.combat?.classes.includes(condition.classKey)).length >= condition.min);
  }
  if (condition.kind === "allyUnitsAtLeast") return supported(alliedUnits.length >= condition.min);
  if (condition.kind === "allyPermanentsAtLeast") return supported(alliedPermanents.length >= condition.min);
  if (condition.kind === "allySentinelasAtLeast") return supported(alliedSentinelas.length >= condition.min);
  if (condition.kind === "nexusBelow") return supported(seat.life <= condition.amount);
  if (condition.kind === "manaAtLeast") return supported(seat.mana >= condition.amount);
  if (condition.kind === "spellManaAtLeast") return supported(seat.spellMana >= condition.amount);
  if (condition.kind === "spellsCastAtLeast") return supported((seat.stats?.spellsCast ?? 0) >= condition.amount);
  if (condition.kind === "alliesSummonedAtLeast") return supported((seat.stats?.alliesSummoned ?? 0) >= condition.amount);
  if (condition.kind === "nexusDamageDealtAtLeast") return supported((seat.stats?.nexusDamageDealt ?? 0) >= condition.amount);
  if (condition.kind === "roundAtLeast") return supported(match.turn.round >= condition.amount);

  // Multiplayer semantics for singular "opponent" are intentionally not guessed,
  // and private hand thresholds require authoritative zone context outside match.
  return unsupported();
}
