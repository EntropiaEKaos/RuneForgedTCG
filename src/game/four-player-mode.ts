import { aliveSeats, FOUR_PLAYER_RULESET_V0, generalZoneCost, nextAliveSeat, passPriority, type FourPlayerSeat } from "./four-player-rules";

export type FourPlayerPhase = "main" | "combat" | "end" | "gameover";
export type GeneralZone = "general" | "stack" | "battlefield" | "graveyard";

export interface FourPlayerRuntimeObject {
  id: string;
  defId: string;
  ownerSeat: FourPlayerSeat;
  controllerSeat: FourPlayerSeat;
  zone: "battlefield" | "stack" | "delayed";
}

export interface FourPlayerStackItem {
  id: string;
  sourceDefId: string;
  ownerSeat: FourPlayerSeat;
  controllerSeat: FourPlayerSeat;
  kind: "card" | "ability" | "trigger";
}

export interface FourPlayerAttackAssignment {
  attackerId: string;
  controllerSeat: FourPlayerSeat;
  defenderSeat: FourPlayerSeat;
}

export interface FourPlayerRuntimeSeatState {
  seat: FourPlayerSeat;
  playerId: number;
  playerName: string;
  nexusHealth: number;
  eliminated: boolean;
  hand: string[];
  deck: string[];
  graveyard: string[];
  general: {
    defId: string;
    zone: GeneralZone;
    castCount: number;
  };
}

export interface FourPlayerRuntimeState {
  rulesetId: typeof FOUR_PLAYER_RULESET_V0.id;
  seed: number;
  turnNumber: number;
  activeSeat: FourPlayerSeat;
  prioritySeat: FourPlayerSeat;
  consecutivePasses: number;
  phase: FourPlayerPhase;
  seats: Record<FourPlayerSeat, FourPlayerRuntimeSeatState>;
  stack: FourPlayerStackItem[];
  objects: FourPlayerRuntimeObject[];
  combat: FourPlayerAttackAssignment[];
  winnerSeat: FourPlayerSeat | null;
  firstTurnDrawConsumed: boolean;
}

export interface FourPlayerParticipantInput {
  seat: FourPlayerSeat;
  playerId: number;
  playerName: string;
  deck: string[];
  generalDefId: string;
}

function lcg(value: number): number {
  return (Math.imul(value, 1664525) + 1013904223) >>> 0;
}

function shuffled(values: string[], seed: number): string[] {
  const result = [...values];
  let state = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    state = lcg(state);
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createFourPlayerMode(input: {
  participants: FourPlayerParticipantInput[];
  startingLife: number;
  startHand: number;
  seed: number;
}): FourPlayerRuntimeState {
  if (input.participants.length !== FOUR_PLAYER_RULESET_V0.players) throw new Error("FOUR_PLAYER_REQUIRES_FOUR_PARTICIPANTS");
  const seats = new Set(input.participants.map((participant) => participant.seat));
  const players = new Set(input.participants.map((participant) => participant.playerId));
  if (seats.size !== FOUR_PLAYER_RULESET_V0.players || players.size !== FOUR_PLAYER_RULESET_V0.players) {
    throw new Error("FOUR_PLAYER_PARTICIPANTS_MUST_BE_UNIQUE");
  }

  const seatRecord = {} as Record<FourPlayerSeat, FourPlayerRuntimeSeatState>;
  for (const participant of input.participants) {
    if (participant.deck.length !== FOUR_PLAYER_RULESET_V0.mainDeckCards) throw new Error("FOUR_PLAYER_DECK_SIZE_INVALID");
    const deck = shuffled(participant.deck, (input.seed ^ ((participant.seat + 1) * 0x9e3779b9)) >>> 0);
    const handSize = Math.max(0, Math.min(deck.length, Math.trunc(input.startHand)));
    seatRecord[participant.seat] = {
      seat: participant.seat,
      playerId: participant.playerId,
      playerName: participant.playerName,
      nexusHealth: Math.max(1, Math.trunc(input.startingLife)),
      eliminated: false,
      hand: deck.slice(0, handSize),
      deck: deck.slice(handSize),
      graveyard: [],
      general: { defId: participant.generalDefId, zone: "general", castCount: 0 },
    };
  }

  return {
    rulesetId: FOUR_PLAYER_RULESET_V0.id,
    seed: input.seed >>> 0,
    turnNumber: 1,
    activeSeat: 0,
    prioritySeat: 0,
    consecutivePasses: 0,
    phase: "main",
    seats: seatRecord,
    stack: [],
    objects: [],
    combat: [],
    winnerSeat: null,
    firstTurnDrawConsumed: false,
  };
}

export function shouldDrawAtTurnStart(state: FourPlayerRuntimeState): boolean {
  return !(FOUR_PLAYER_RULESET_V0.firstPlayerSkipsFirstDraw && state.turnNumber === 1 && state.activeSeat === 0 && !state.firstTurnDrawConsumed);
}

export function drawForActiveSeat(state: FourPlayerRuntimeState): FourPlayerRuntimeState {
  if (state.phase === "gameover") return state;
  const seat = state.seats[state.activeSeat];
  if (!shouldDrawAtTurnStart(state)) return { ...state, firstTurnDrawConsumed: true };
  if (!seat.deck.length) return eliminateFourPlayerSeat(state, state.activeSeat);
  const [card, ...deck] = seat.deck;
  return {
    ...state,
    firstTurnDrawConsumed: true,
    seats: { ...state.seats, [state.activeSeat]: { ...seat, hand: [...seat.hand, card], deck } },
  };
}

export function registerFourPlayerAction(state: FourPlayerRuntimeState, actorSeat: FourPlayerSeat): FourPlayerRuntimeState {
  if (state.phase === "gameover") throw new Error("FOUR_PLAYER_GAME_OVER");
  if (state.seats[actorSeat].eliminated) throw new Error("FOUR_PLAYER_ACTOR_ELIMINATED");
  if (state.prioritySeat !== actorSeat) throw new Error("FOUR_PLAYER_NO_PRIORITY");
  return {
    ...state,
    prioritySeat: nextAliveSeat(actorSeat, eliminatedSeats(state)),
    consecutivePasses: 0,
  };
}

export function passFourPlayerPriority(state: FourPlayerRuntimeState, actorSeat: FourPlayerSeat): {
  state: FourPlayerRuntimeState;
  resolved: FourPlayerStackItem | null;
  advancePhaseAllowed: boolean;
} {
  if (state.phase === "gameover") return { state, resolved: null, advancePhaseAllowed: false };
  if (state.prioritySeat !== actorSeat) throw new Error("FOUR_PLAYER_NO_PRIORITY");
  const pass = passPriority(actorSeat, state.consecutivePasses, eliminatedSeats(state));
  if (!pass.resolved) {
    return { state: { ...state, prioritySeat: pass.seat, consecutivePasses: pass.consecutivePasses }, resolved: null, advancePhaseAllowed: false };
  }
  if (state.stack.length) {
    const resolved = state.stack[state.stack.length - 1];
    return {
      state: {
        ...state,
        stack: state.stack.slice(0, -1),
        prioritySeat: state.activeSeat,
        consecutivePasses: 0,
      },
      resolved,
      advancePhaseAllowed: false,
    };
  }
  return {
    state: { ...state, prioritySeat: state.activeSeat, consecutivePasses: 0 },
    resolved: null,
    advancePhaseAllowed: true,
  };
}

export function pushFourPlayerStackItem(state: FourPlayerRuntimeState, actorSeat: FourPlayerSeat, item: FourPlayerStackItem): FourPlayerRuntimeState {
  const next = registerFourPlayerAction(state, actorSeat);
  if (item.controllerSeat !== actorSeat) throw new Error("FOUR_PLAYER_STACK_CONTROLLER_MISMATCH");
  return { ...next, stack: [...next.stack, item] };
}

export function declareFourPlayerAttack(
  state: FourPlayerRuntimeState,
  actorSeat: FourPlayerSeat,
  assignments: FourPlayerAttackAssignment[],
): FourPlayerRuntimeState {
  if (state.activeSeat !== actorSeat) throw new Error("FOUR_PLAYER_ONLY_ACTIVE_PLAYER_ATTACKS");
  if (state.seats[actorSeat].eliminated) throw new Error("FOUR_PLAYER_ACTOR_ELIMINATED");
  const attackerIds = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.controllerSeat !== actorSeat) throw new Error("FOUR_PLAYER_ATTACKER_CONTROLLER_MISMATCH");
    if (assignment.defenderSeat === actorSeat) throw new Error("FOUR_PLAYER_CANNOT_ATTACK_SELF");
    if (state.seats[assignment.defenderSeat].eliminated) throw new Error("FOUR_PLAYER_DEFENDER_ELIMINATED");
    if (attackerIds.has(assignment.attackerId)) throw new Error("FOUR_PLAYER_ATTACKER_ASSIGNED_TWICE");
    attackerIds.add(assignment.attackerId);
  }
  return { ...state, phase: "combat", combat: assignments.map((assignment) => ({ ...assignment })), consecutivePasses: 0, prioritySeat: actorSeat };
}

export function generalCastCost(state: FourPlayerRuntimeState, seat: FourPlayerSeat, baseCost: number): number {
  return generalZoneCost(baseCost, state.seats[seat].general.castCount);
}

export function moveGeneralToStack(state: FourPlayerRuntimeState, seat: FourPlayerSeat): FourPlayerRuntimeState {
  const player = state.seats[seat];
  if (player.eliminated) throw new Error("FOUR_PLAYER_ACTOR_ELIMINATED");
  if (player.general.zone !== "general") throw new Error("FOUR_PLAYER_GENERAL_NOT_IN_ZONE");
  return {
    ...state,
    seats: {
      ...state.seats,
      [seat]: {
        ...player,
        general: { ...player.general, zone: "stack", castCount: player.general.castCount + 1 },
      },
    },
  };
}

export function returnGeneralToZone(state: FourPlayerRuntimeState, seat: FourPlayerSeat): FourPlayerRuntimeState {
  const player = state.seats[seat];
  return { ...state, seats: { ...state.seats, [seat]: { ...player, general: { ...player.general, zone: "general" } } } };
}

export function endFourPlayerTurn(state: FourPlayerRuntimeState): FourPlayerRuntimeState {
  if (state.phase === "gameover") return state;
  const next = nextAliveSeat(state.activeSeat, eliminatedSeats(state));
  return {
    ...state,
    activeSeat: next,
    prioritySeat: next,
    turnNumber: state.turnNumber + 1,
    consecutivePasses: 0,
    phase: "main",
    combat: [],
    firstTurnDrawConsumed: false,
  };
}

export function eliminatedSeats(state: FourPlayerRuntimeState): FourPlayerSeat[] {
  return ([0, 1, 2, 3] as FourPlayerSeat[]).filter((seat) => state.seats[seat].eliminated);
}

/**
 * Atomic elimination semantics for the mode-owned generic object model:
 * - objects owned by the eliminated player leave the game;
 * - borrowed objects revert to their living owner;
 * - owned stack/delayed items leave the game, controlled-only items revert;
 * - turn/priority skip the eliminated seat immediately.
 */
export function eliminateFourPlayerSeat(state: FourPlayerRuntimeState, seat: FourPlayerSeat): FourPlayerRuntimeState {
  if (state.seats[seat].eliminated) return state;
  const seats = { ...state.seats, [seat]: { ...state.seats[seat], eliminated: true, nexusHealth: 0 } };
  const remaining = ([0, 1, 2, 3] as FourPlayerSeat[]).filter((candidate) => !seats[candidate].eliminated);
  const objects = state.objects
    .filter((object) => object.ownerSeat !== seat)
    .map((object) => object.controllerSeat === seat ? { ...object, controllerSeat: object.ownerSeat } : object);
  const stack = state.stack
    .filter((item) => item.ownerSeat !== seat)
    .map((item) => item.controllerSeat === seat ? { ...item, controllerSeat: item.ownerSeat } : item);
  const combat = state.combat.filter((assignment) => assignment.controllerSeat !== seat && assignment.defenderSeat !== seat);

  if (remaining.length === 1) {
    return {
      ...state,
      seats,
      objects,
      stack,
      combat: [],
      phase: "gameover",
      winnerSeat: remaining[0],
      activeSeat: remaining[0],
      prioritySeat: remaining[0],
      consecutivePasses: 0,
    };
  }

  const gone = ([0, 1, 2, 3] as FourPlayerSeat[]).filter((candidate) => seats[candidate].eliminated);
  const activeSeat = state.activeSeat === seat ? nextAliveSeat(seat, gone) : state.activeSeat;
  const prioritySeat = state.prioritySeat === seat ? nextAliveSeat(seat, gone) : state.prioritySeat;
  return { ...state, seats, objects, stack, combat, activeSeat, prioritySeat, consecutivePasses: 0 };
}

export function projectFourPlayerState(state: FourPlayerRuntimeState, viewerSeat: FourPlayerSeat) {
  return {
    rulesetId: state.rulesetId,
    turnNumber: state.turnNumber,
    activeSeat: state.activeSeat,
    prioritySeat: state.prioritySeat,
    consecutivePasses: state.consecutivePasses,
    phase: state.phase,
    stack: state.stack,
    objects: state.objects,
    combat: state.combat,
    winnerSeat: state.winnerSeat,
    seats: ([0, 1, 2, 3] as FourPlayerSeat[]).map((seat) => {
      const player = state.seats[seat];
      return {
        seat,
        playerId: player.playerId,
        playerName: player.playerName,
        nexusHealth: player.nexusHealth,
        eliminated: player.eliminated,
        general: player.general,
        hand: seat === viewerSeat ? [...player.hand] : undefined,
        handCount: player.hand.length,
        deckCount: player.deck.length,
        graveyard: [...player.graveyard],
      };
    }),
  };
}
