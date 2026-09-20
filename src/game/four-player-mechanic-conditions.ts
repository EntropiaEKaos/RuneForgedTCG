import type { FourPlayerBattlefieldObject } from "./four-player-battlefield";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
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

function livingOpponentSeats(match: FourPlayerMatchState, sourceSeat: FourPlayerSeat): FourPlayerSeat[] {
  return FOUR_PLAYER_SEATS.filter(
    (seat) => seat !== sourceSeat && !match.seats[seat].eliminated,
  );
}

function nextLivingOpponent(match: FourPlayerMatchState, sourceSeat: FourPlayerSeat): FourPlayerSeat | undefined {
  const start = FOUR_PLAYER_SEATS.indexOf(sourceSeat);
  for (let offset = 1; offset < FOUR_PLAYER_SEATS.length; offset += 1) {
    const seat = FOUR_PLAYER_SEATS[(start + offset) % FOUR_PLAYER_SEATS.length]!;
    if (!match.seats[seat].eliminated) return seat;
  }
  return undefined;
}

function enemyObjects(match: FourPlayerMatchState, source: FourPlayerBattlefieldObject) {
  const enemies = new Set(livingOpponentSeats(match, source.controllerSeat));
  return (match.battlefield?.objects ?? []).filter(
    (object) => enemies.has(object.controllerSeat) && liveObject(object),
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
  const enemies = enemyObjects(match, source);
  const enemyUnits = enemies.filter((object) => object.combat && ["unit", "general", "token"].includes(object.kind));
  const enemyPermanents = enemies.filter((object) => object.kind === "permanent" && object.durability);
  const enemySentinelas = enemies.filter((object) => object.kind === "sentinela" && (object.loyalty ?? 0) > 0);
  const seat = match.seats[source.controllerSeat];
  const opponentSeat = nextLivingOpponent(match, source.controllerSeat);
  const opponent = opponentSeat ? match.seats[opponentSeat] : undefined;

  if (condition.kind === "allyRace") {
    return supported(alliedUnits.filter((object) => object.combat?.races.includes(condition.race)).length >= condition.min);
  }
  if (condition.kind === "allyClass") {
    return supported(alliedUnits.filter((object) => object.combat?.classes.includes(condition.classKey)).length >= condition.min);
  }
  if (condition.kind === "enemyRace") {
    return supported(enemyUnits.filter((object) => object.combat?.races.includes(condition.race)).length >= condition.min);
  }
  if (condition.kind === "enemyClass") {
    return supported(enemyUnits.filter((object) => object.combat?.classes.includes(condition.classKey)).length >= condition.min);
  }
  if (condition.kind === "allyUnitsAtLeast") return supported(alliedUnits.length >= condition.min);
  if (condition.kind === "enemyUnitsAtLeast") return supported(enemyUnits.length >= condition.min);
  if (condition.kind === "allyPermanentsAtLeast") return supported(alliedPermanents.length >= condition.min);
  if (condition.kind === "enemyPermanentsAtLeast") return supported(enemyPermanents.length >= condition.min);
  if (condition.kind === "allySentinelasAtLeast") return supported(alliedSentinelas.length >= condition.min);
  if (condition.kind === "enemySentinelasAtLeast") return supported(enemySentinelas.length >= condition.min);
  if (condition.kind === "nexusBelow") return supported(seat.life <= condition.amount);
  if (condition.kind === "opponentNexusBelow") return supported(Boolean(opponent && opponent.life <= condition.amount));
  if (condition.kind === "manaAtLeast") return supported(seat.mana >= condition.amount);
  if (condition.kind === "opponentManaAtLeast") return supported(Boolean(opponent && opponent.mana >= condition.amount));
  if (condition.kind === "spellManaAtLeast") return supported(seat.spellMana >= condition.amount);
  if (condition.kind === "opponentSpellManaAtLeast") return supported(Boolean(opponent && opponent.spellMana >= condition.amount));
  if (condition.kind === "spellsCastAtLeast") return supported((seat.stats?.spellsCast ?? 0) >= condition.amount);
  if (condition.kind === "opponentSpellsCastAtLeast") {
    return supported(Boolean(opponent && (opponent.stats?.spellsCast ?? 0) >= condition.amount));
  }
  if (condition.kind === "alliesSummonedAtLeast") return supported((seat.stats?.alliesSummoned ?? 0) >= condition.amount);
  if (condition.kind === "opponentAlliesSummonedAtLeast") {
    return supported(Boolean(opponent && (opponent.stats?.alliesSummoned ?? 0) >= condition.amount));
  }
  if (condition.kind === "nexusDamageDealtAtLeast") return supported((seat.stats?.nexusDamageDealt ?? 0) >= condition.amount);
  if (condition.kind === "opponentNexusDamageDealtAtLeast") {
    return supported(Boolean(opponent && (opponent.stats?.nexusDamageDealt ?? 0) >= condition.amount));
  }
  if (condition.kind === "roundAtLeast") return supported(match.turn.round >= condition.amount);

  // Hand thresholds stay fail-closed until the trigger evaluator receives
  // authoritative zone counts without leaking private card identities.
  return unsupported();
}
