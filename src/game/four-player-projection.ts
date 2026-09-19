import type { FourPlayerBattlefieldObject, FourPlayerDurability } from "./four-player-battlefield";
import type { FourPlayerCardInstance } from "./four-player-card-zones";
import type { FourPlayerCombatBody } from "./four-player-combat-body";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState, FourPlayerMatchStatus, FourPlayerPhase } from "./four-player-match";

export interface FourPlayerPrivateSeatState {
  seat: FourPlayerSeat;
  hand: readonly FourPlayerCardInstance[];
  deck: readonly FourPlayerCardInstance[];
  graveyard: readonly FourPlayerCardInstance[];
  publicBoard: readonly string[];
  nexusHealth: number;
  eliminated: boolean;
}

export interface FourPlayerProjectedCardInstance {
  instanceId: string;
  defId: string;
}

export interface FourPlayerProjectedBattlefieldObject {
  id: string;
  defId: string;
  kind: FourPlayerBattlefieldObject["kind"];
  ownerSeat: FourPlayerSeat;
  controllerSeat: FourPlayerSeat;
  enteredTurn: number;
  keywords: readonly string[];
  combat?: FourPlayerCombatBody;
  durability?: FourPlayerDurability;
  stunned: boolean;
  attackedThisTurn: boolean;
}

export interface FourPlayerProjectedSeatState {
  seat: FourPlayerSeat;
  handCount: number;
  deckCount: number;
  graveyard: readonly FourPlayerProjectedCardInstance[];
  publicBoard: readonly string[];
  nexusHealth: number;
  eliminated: boolean;
  life?: number;
  mana?: number;
  maxMana?: number;
  poisonCounters?: number;
  generalDamageReceived?: Partial<Record<FourPlayerSeat, number>>;
  battlefield?: readonly FourPlayerProjectedBattlefieldObject[];
  hand?: readonly FourPlayerProjectedCardInstance[];
}

export interface FourPlayerPublicMatchFlow {
  activeSeat: FourPlayerSeat;
  round: number;
  phase: FourPlayerPhase;
  priorityHolder: FourPlayerSeat;
  status: FourPlayerMatchStatus;
  winner?: FourPlayerSeat;
}

export interface FourPlayerSeatProjection {
  viewer: FourPlayerSeat;
  seats: Record<FourPlayerSeat, FourPlayerProjectedSeatState>;
  match?: FourPlayerPublicMatchFlow;
}

/**
 * Security boundary for clients. A viewer receives identities for its current hand only.
 * Future deck identities/order remain server-only for every seat, including the owner.
 * Match flow contains public authoritative metadata only and is safe for reconnect snapshots.
 */
export function projectFourPlayerStateForSeat(
  states: Record<FourPlayerSeat, FourPlayerPrivateSeatState>,
  viewer: FourPlayerSeat,
  match?: FourPlayerMatchState,
): FourPlayerSeatProjection {
  const projected = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => {
    const source = states[seat];
    const own = seat === viewer;
    const battlefield = match
      ? (match.battlefield?.objects ?? [])
        .filter((object) => object.controllerSeat === seat)
        .map((object) => ({
          id: object.id,
          defId: object.defId,
          kind: object.kind,
          ownerSeat: object.ownerSeat,
          controllerSeat: object.controllerSeat,
          enteredTurn: object.enteredTurn,
          keywords: [...object.keywords],
          ...(object.combat ? {
            combat: {
              ...object.combat,
              races: [...object.combat.races],
              classes: [...object.combat.classes],
            },
          } : {}),
          ...(object.durability ? { durability: { ...object.durability } } : {}),
          stunned: object.stunned,
          attackedThisTurn: object.attackedThisTurn,
        }))
      : undefined;
    const value: FourPlayerProjectedSeatState = {
      seat,
      handCount: source.hand.length,
      deckCount: source.deck.length,
      graveyard: source.graveyard.map((card) => ({ instanceId: card.instanceId, defId: card.defId })),
      publicBoard: [...source.publicBoard],
      nexusHealth: match ? match.seats[seat].life : source.nexusHealth,
      eliminated: match ? match.seats[seat].eliminated : source.eliminated,
      ...(match ? {
        life: match.seats[seat].life,
        mana: match.seats[seat].mana,
        maxMana: match.seats[seat].maxMana,
        poisonCounters: match.seats[seat].poisonCounters,
        generalDamageReceived: { ...match.seats[seat].generalDamageReceived },
        battlefield,
      } : {}),
      ...(own ? { hand: source.hand.map((card) => ({ instanceId: card.instanceId, defId: card.defId })) } : {}),
    };
    return [seat, value];
  })) as Record<FourPlayerSeat, FourPlayerProjectedSeatState>;

  const publicMatch: FourPlayerPublicMatchFlow | undefined = match ? {
    activeSeat: match.turn.activeSeat,
    round: match.turn.round,
    phase: match.phase,
    priorityHolder: match.resolution.priority.holder,
    status: match.status,
    ...(match.winner ? { winner: match.winner } : {}),
  } : undefined;

  return { viewer, seats: projected, ...(publicMatch ? { match: publicMatch } : {}) };
}
