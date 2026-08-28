import type { GameState, PlayerId, UnitInstance, PermanentInstance, SentinelaInstance, Region } from "@/game/types";

export interface SpectatorPlayerState {
  id: PlayerId;
  name: string;
  nexusHealth: number;
  mana: number;
  maxMana: number;
  spellMana: number;
  handCount: number;
  deckCount: number;
  bench: UnitInstance[];
  permanents: PermanentInstance[];
  sentinelas: SentinelaInstance[];
  deckName: string;
  deckRegions?: Region[];
  poisonCounters: number;
}

export interface SpectatorGameState {
  players: Record<PlayerId, SpectatorPlayerState>;
  attackToken: PlayerId;
  activePlayer: PlayerId;
  round: number;
  phase: GameState["phase"];
  hasAttackedThisTurn: boolean;
  combat: GameState["combat"];
  winner: PlayerId | null;
  log: string[];
}

export function toSpectatorGameState(state: GameState): SpectatorGameState {
  const player = (pid: PlayerId): SpectatorPlayerState => {
    const p = state.players[pid];
    return {
      id: p.id, name: p.name, nexusHealth: p.nexusHealth, mana: p.mana, maxMana: p.maxMana,
      spellMana: p.spellMana, handCount: p.hand.length, deckCount: p.deck.length,
      bench: structuredClone(p.bench), permanents: structuredClone(p.permanents), sentinelas: structuredClone(p.sentinelas),
      deckName: p.deckName, deckRegions: p.deckRegions, poisonCounters: p.poisonCounters,
    };
  };
  return {
    players: { player: player("player"), ai: player("ai") }, attackToken: state.attackToken,
    activePlayer: state.activePlayer, round: state.round, phase: state.phase,
    hasAttackedThisTurn: state.hasAttackedThisTurn, combat: structuredClone(state.combat), winner: state.winner,
    log: [...state.log],
  };
}
