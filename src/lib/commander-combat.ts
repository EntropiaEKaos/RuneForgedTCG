import { ensureCustomCardsLoaded } from "@/game/catalog";
import { acceptAuthoritativeFourPlayerCommand, processAuthoritativeFourPlayerCommand, assertPriorityHolder } from "@/game/four-player-authority";
import { stageFourPlayerCardCast } from "@/game/four-player-card-play";
import { returnGeneralToZone } from "@/game/four-player-general-zone";
import { fourPlayerStackActionKind, fourPlayerStackItemIsUncounterable } from "@/game/four-player-reactions";
import { parseFourPlayerTargetRef } from "@/game/four-player-targeting";
import { settleFourPlayerEffectDraws, settleFourPlayerEffectZoneActions } from "@/game/four-player-effect-zones";
import { submitFourPlayerAction } from "@/game/four-player-flow";
import { pumpFourPlayerServer } from "@/game/four-player-server-pump";
import {
  createFourPlayerCardZones,
  putFourPlayerCardInGraveyard,
  type FourPlayerCardZones,
} from "@/game/four-player-card-zones";
import {
  FOUR_PLAYER_SEATS,
  type FourPlayerSeat,
} from "@/game/four-player-general";
import {
  createFourPlayerMatchStateFromCatalog,
  updateMatchGeneral,
  type FourPlayerGeneralSelection,
  type FourPlayerMatchState,
} from "@/game/four-player-match";
import {
  projectFourPlayerStateForSeat,
  type FourPlayerPrivateSeatState,
} from "@/game/four-player-projection";
import {
  createFourPlayerProtocolState,
  type FourPlayerClientCommand,
  type FourPlayerCommandType,
  type FourPlayerProtocolState,
} from "@/game/four-player-protocol";
import {
  bindFourPlayerSession,
  createFourPlayerSessionRegistry,
} from "@/game/four-player-session";
import { settleFourPlayerTurnStart } from "@/game/four-player-turn-start";
import { seededShuffle } from "@/game/rng";
import { COMMANDER_ALPHA_RULES, type CommanderSeatIndex } from "@/lib/commander-rules";

export const COMMANDER_COMBAT_ENGINE_KIND = "commander_4p_combat_v1" as const;
export const COMMANDER_COMBAT_ENGINE_VERSION = 3 as const;

export interface CommanderCombatSeatInput {
  seat: CommanderSeatIndex;
  playerId: number;
  playerName: string;
  deckCards: string[];
  generalDefId: string;
}

export interface CommanderCombatEnvelope {
  kind: typeof COMMANDER_COMBAT_ENGINE_KIND;
  engineVersion: typeof COMMANDER_COMBAT_ENGINE_VERSION;
  rngSeed: number;
  startingSeat: FourPlayerSeat;
  match: FourPlayerMatchState;
  protocol: FourPlayerProtocolState;
  zones: FourPlayerCardZones;
}

export interface CommanderCombatCommandInput {
  commandId: string;
  expectedRevision: number;
  type: FourPlayerCommandType;
  payload?: unknown;
}

const EXPOSED_COMMANDS = new Set<FourPlayerCommandType>([
  "pass_priority",
  "cast_general",
  "play_card",
  "declare_attacker",
  "declare_blocker",
  "end_turn",
  "concede",
]);

export function commanderSeatKey(seat: CommanderSeatIndex): FourPlayerSeat {
  return FOUR_PLAYER_SEATS[seat];
}

export function commanderSeatIndex(seat: FourPlayerSeat): CommanderSeatIndex {
  const index = FOUR_PLAYER_SEATS.indexOf(seat);
  if (index < 0) throw new Error(`Unknown four-player seat ${seat}.`);
  return index as CommanderSeatIndex;
}

function assertFourSeats(seats: readonly CommanderCombatSeatInput[]): void {
  if (seats.length !== COMMANDER_ALPHA_RULES.playerCount) {
    throw new Error("Commander combat requires exactly four seats.");
  }
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].seat !== i) throw new Error("Commander combat seats must be exactly 0,1,2,3.");
    if (sorted[i].deckCards.length !== COMMANDER_ALPHA_RULES.deckSize) {
      throw new Error(`Commander seat ${i} must snapshot exactly ${COMMANDER_ALPHA_RULES.deckSize} cards.`);
    }
  }
}

function seatSeed(seed: number, seat: CommanderSeatIndex): number {
  return (seed ^ Math.imul(seat + 1, 0x9e3779b9)) >>> 0;
}

export async function createCommanderCombatEnvelope(
  matchId: string,
  roomVersion: number,
  rngSeed: number,
  seats: readonly CommanderCombatSeatInput[],
): Promise<CommanderCombatEnvelope> {
  if (!matchId) throw new Error("Commander match id is required.");
  if (!Number.isInteger(roomVersion) || roomVersion < 0) throw new Error("Commander room version must be a non-negative integer.");
  assertFourSeats(seats);
  await ensureCustomCardsLoaded();

  const bySeat = [...seats].sort((a, b) => a.seat - b.seat);
  const generalSelection = Object.fromEntries(bySeat.map((entry) => [
    commanderSeatKey(entry.seat),
    entry.generalDefId,
  ])) as FourPlayerGeneralSelection;
  const decks = Object.fromEntries(bySeat.map((entry) => [
    commanderSeatKey(entry.seat),
    seededShuffle([...entry.deckCards], seatSeed(rngSeed, entry.seat)),
  ])) as Record<FourPlayerSeat, string[]>;

  const match = createFourPlayerMatchStateFromCatalog("p1", generalSelection, 0);
  const protocol = { ...createFourPlayerProtocolState(matchId), revision: roomVersion };
  const zones = createFourPlayerCardZones(decks, COMMANDER_ALPHA_RULES.startingHand);

  return {
    kind: COMMANDER_COMBAT_ENGINE_KIND,
    engineVersion: COMMANDER_COMBAT_ENGINE_VERSION,
    rngSeed: rngSeed >>> 0,
    startingSeat: "p1",
    match,
    protocol,
    zones,
  };
}

export function isCommanderCombatEnvelope(value: unknown): value is CommanderCombatEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.kind === COMMANDER_COMBAT_ENGINE_KIND
    && row.engineVersion === COMMANDER_COMBAT_ENGINE_VERSION
    && !!row.match
    && !!row.protocol
    && !!row.zones;
}

function privateStates(envelope: CommanderCombatEnvelope): Record<FourPlayerSeat, FourPlayerPrivateSeatState> {
  const states = {} as Record<FourPlayerSeat, FourPlayerPrivateSeatState>;
  for (const seat of FOUR_PLAYER_SEATS) {
    const general = envelope.match.generals[seat];
    const physicalBoard = (envelope.match.battlefield?.objects ?? [])
      .filter((object) => object.controllerSeat === seat)
      .map((object) => object.defId);
    states[seat] = {
      seat,
      hand: [...envelope.zones[seat].hand],
      deck: [...envelope.zones[seat].deck],
      graveyard: [...envelope.zones[seat].graveyard],
      publicBoard: physicalBoard.length > 0
        ? physicalBoard
        : general.location === "battlefield" ? [general.defId] : [],
      nexusHealth: envelope.match.seats[seat].life,
      eliminated: envelope.match.seats[seat].eliminated,
    };
  }
  return states;
}

export function projectCommanderCombatState(
  envelope: CommanderCombatEnvelope,
  viewerSeat: CommanderSeatIndex,
) {
  const viewer = commanderSeatKey(viewerSeat);
  const projection = projectFourPlayerStateForSeat(privateStates(envelope), viewer, envelope.match);
  return {
    kind: envelope.kind,
    engineVersion: envelope.engineVersion,
    revision: envelope.protocol.revision,
    viewerSeat,
    activeSeat: commanderSeatIndex(envelope.match.turn.activeSeat),
    prioritySeat: commanderSeatIndex(envelope.match.resolution.priority.holder),
    round: envelope.match.turn.round,
    turn: envelope.match.turn.turn,
    phase: envelope.match.phase,
    status: envelope.match.status,
    winnerSeat: envelope.match.winner ? commanderSeatIndex(envelope.match.winner) : null,
    stack: envelope.match.resolution.stack.items.map((item) => {
      const payload = item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
        ? item.payload as Record<string, unknown>
        : {};
      return {
        id: item.id,
        kind: item.kind,
        actionKind: fourPlayerStackActionKind(item),
        controllerSeat: commanderSeatIndex(item.controller),
        defId: typeof payload.defId === "string" ? payload.defId : null,
        cardType: typeof payload.cardType === "string" ? payload.cardType : null,
        speed: payload.speed === "Fast" || payload.speed === "Burst" ? payload.speed : null,
        uncounterable: fourPlayerStackItemIsUncounterable(item),
      };
    }),
    combat: {
      attackers: envelope.match.combat.attackers.map((attacker) => ({
        unitId: attacker.unitId,
        controllerSeat: commanderSeatIndex(attacker.controller),
        defendingSeat: commanderSeatIndex(attacker.defendingSeat),
      })),
      blockers: envelope.match.combat.blockers.map((blocker) => ({
        unitId: blocker.unitId,
        controllerSeat: commanderSeatIndex(blocker.controller),
        attackerId: blocker.attackerId,
      })),
    },
    seats: FOUR_PLAYER_SEATS.map((seat) => ({
      ...projection.seats[seat],
      seat: commanderSeatIndex(seat),
      general: {
        defId: envelope.match.generals[seat].defId,
        zone: envelope.match.generals[seat].location,
        castCount: envelope.match.generals[seat].castsFromGeneralZone,
      },
    })),
  };
}

function validateExposedCommand(match: FourPlayerMatchState, command: FourPlayerClientCommand): void {
  if (!EXPOSED_COMMANDS.has(command.type)) {
    throw new Error(`Commander combat command ${command.type} is not exposed by the PostgreSQL bridge yet.`);
  }
  if (
    command.type === "pass_priority"
    || command.type === "cast_general"
    || command.type === "declare_attacker"
    || command.type === "declare_blocker"
  ) {
    assertPriorityHolder(match, command.seat);
  }
}

function settleIncomingTurn(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  startingSeat: FourPlayerSeat,
): { match: FourPlayerMatchState; zones: FourPlayerCardZones } {
  let currentMatch = match;
  let currentZones = zones;
  for (let guard = 0; guard < FOUR_PLAYER_SEATS.length && currentMatch.status === "active"; guard += 1) {
    const result = settleFourPlayerTurnStart(currentMatch, currentZones, startingSeat);
    currentMatch = result.match;
    currentZones = result.zones;
    if (!result.deckOut) break;
  }
  return { match: currentMatch, zones: currentZones };
}

export function processCommanderCombatCommand(
  envelope: CommanderCombatEnvelope,
  playerId: number,
  seatIndex: CommanderSeatIndex,
  input: CommanderCombatCommandInput,
): CommanderCombatEnvelope {
  if (envelope.protocol.revision !== input.expectedRevision) {
    throw new Error(`Expected Commander revision ${envelope.protocol.revision}.`);
  }
  const commandId = String(input.commandId || "").trim();
  if (!commandId) throw new Error("Commander commandId is required.");
  const seat = commanderSeatKey(seatIndex);
  let sanitizedPayload: unknown = input.payload ?? {};
  if (input.type === "declare_attacker") {
    const row = sanitizedPayload && typeof sanitizedPayload === "object" ? sanitizedPayload as Record<string, unknown> : {};
    const unitId = typeof row.unitId === "string" ? row.unitId.trim() : "";
    const rawDefender = row.defendingSeat;
    const defendingSeat = typeof rawDefender === "number"
      ? commanderSeatKey(rawDefender as CommanderSeatIndex)
      : rawDefender;
    sanitizedPayload = { unitId, defendingSeat };
  } else if (input.type === "declare_blocker") {
    const row = sanitizedPayload && typeof sanitizedPayload === "object" ? sanitizedPayload as Record<string, unknown> : {};
    sanitizedPayload = {
      unitId: typeof row.unitId === "string" ? row.unitId.trim() : "",
      attackerId: typeof row.attackerId === "string" ? row.attackerId.trim() : "",
    };
  }

  const command: FourPlayerClientCommand = {
    commandId,
    matchId: envelope.protocol.matchId,
    seat,
    expectedRevision: input.expectedRevision,
    type: input.type,
    payload: sanitizedPayload,
  };

  let sessions = createFourPlayerSessionRegistry();
  const sessionId = `player:${playerId}`;
  sessions = bindFourPlayerSession(sessions, sessionId, seat);
  const authority = { match: envelope.match, protocol: envelope.protocol, sessions };
  const previousActiveSeat = envelope.match.turn.activeSeat;
  if (command.type === "play_card") {
    const accepted = acceptAuthoritativeFourPlayerCommand(
      authority,
      sessionId,
      command,
      validateExposedCommand,
    );
    const payload = command.payload as { instanceId?: unknown; target?: unknown; stackTargetId?: unknown };
    const instanceId = typeof payload.instanceId === "string" ? payload.instanceId.trim() : "";
    const target = parseFourPlayerTargetRef(payload.target);
    const stackTargetId = typeof payload.stackTargetId === "string" ? payload.stackTargetId.trim() : undefined;
    if (!instanceId) throw new Error("Commander play_card requires a card instanceId.");
    const staged = stageFourPlayerCardCast(
      envelope.match,
      envelope.zones,
      seat,
      instanceId,
      accepted.event.eventId,
      target,
      stackTargetId,
    );
    const reducedMatch: FourPlayerMatchState = {
      ...staged.match,
      resolution: submitFourPlayerAction(staged.match.resolution, staged.stackItem),
    };
    const pumped = pumpFourPlayerServer(reducedMatch);
    return {
      ...envelope,
      match: pumped.match,
      zones: staged.zones,
      protocol: accepted.state.protocol,
    };
  }

  const accepted = processAuthoritativeFourPlayerCommand(
    authority,
    sessionId,
    1,
    command,
    validateExposedCommand,
  );

  let match = accepted.state.match;
  let zones = envelope.zones;
  for (const resolved of accepted.pump?.resolved ?? []) {
    if (resolved.kind !== "spell_cast") continue;
    const payload = resolved.payload as { instanceId?: unknown; defId?: unknown; ownerSeat?: unknown };
    if (
      typeof payload.instanceId === "string"
      && typeof payload.defId === "string"
      && typeof payload.ownerSeat === "string"
      && FOUR_PLAYER_SEATS.includes(payload.ownerSeat as FourPlayerSeat)
    ) {
      zones = putFourPlayerCardInGraveyard(zones, {
        instanceId: payload.instanceId,
        defId: payload.defId,
        ownerSeat: payload.ownerSeat as FourPlayerSeat,
      });
    }
  }
  for (const countered of accepted.pump?.counteredStackItems ?? []) {
    if (countered.kind === "general_cast") {
      const general = match.generals[countered.controller];
      if (general.location === "stack") {
        match = updateMatchGeneral(match, countered.controller, returnGeneralToZone(general));
      }
      continue;
    }
    if (countered.kind !== "spell_cast" && countered.kind !== "card_cast") continue;
    const payload = countered.payload as { instanceId?: unknown; defId?: unknown; ownerSeat?: unknown };
    if (
      typeof payload.instanceId === "string"
      && typeof payload.defId === "string"
      && typeof payload.ownerSeat === "string"
      && FOUR_PLAYER_SEATS.includes(payload.ownerSeat as FourPlayerSeat)
    ) {
      zones = putFourPlayerCardInGraveyard(zones, {
        instanceId: payload.instanceId,
        defId: payload.defId,
        ownerSeat: payload.ownerSeat as FourPlayerSeat,
      });
    }
  }
  for (const destroyed of accepted.pump?.destroyedObjects ?? []) {
    if (destroyed.destination !== "graveyard") continue;
    zones = putFourPlayerCardInGraveyard(zones, {
      instanceId: destroyed.id,
      defId: destroyed.defId,
      ownerSeat: destroyed.ownerSeat,
    });
  }
  if (accepted.pump?.zoneActions?.length) {
    const settledZones = settleFourPlayerEffectZoneActions(match, zones, accepted.pump.zoneActions);
    match = settledZones.match;
    zones = settledZones.zones;
  } else if (accepted.pump?.drawRequests) {
    const settledDraws = settleFourPlayerEffectDraws(match, zones, accepted.pump.drawRequests);
    match = settledDraws.match;
    zones = settledDraws.zones;
  }
  if (match.status === "active" && match.turn.activeSeat !== previousActiveSeat) {
    const settled = settleIncomingTurn(match, zones, envelope.startingSeat);
    match = settled.match;
    zones = settled.zones;
  }

  return {
    ...envelope,
    match,
    zones,
    protocol: accepted.state.protocol,
  };
}

export function commanderCombatPersistence(envelope: CommanderCombatEnvelope) {
  return {
    state: envelope.match.status === "completed" ? "finished" : "playing",
    activeSeat: commanderSeatIndex(envelope.match.turn.activeSeat),
    round: envelope.match.turn.round,
    version: envelope.protocol.revision,
    gameState: envelope,
  };
}