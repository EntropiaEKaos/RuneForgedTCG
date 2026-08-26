import { getCard } from "./cards";
import type { GameState, UnitInstance } from "./types";

export interface ChampionProgressView {
  current: number;
  goal: number;
  hint: string;
  leveled: boolean;
}

/**
 * Browser-safe champion level progress projection.
 *
 * This intentionally depends only on immutable card metadata plus the game
 * state already available to the UI. It must not import the authoritative
 * engine facade, runtime configuration, deck services or database code.
 */
export function championProgressView(
  state: GameState,
  unit: UnitInstance,
): ChampionProgressView | null {
  const def = getCard(unit.defId);
  if (!def.levelUp) return null;

  const player = state.players[unit.owner];
  let current = 0;

  switch (def.levelUp.type) {
    case "nexusDamage":
      current = player.stats.nexusDamageDealt;
      break;
    case "spellsCast":
      current = player.stats.spellsCast;
      break;
    case "alliesSummoned":
      current = player.stats.alliesSummoned;
      break;
    case "nexusStrikes":
      current = unit.nexusStrikes;
      break;
  }

  return {
    current: Math.min(current, def.levelUp.amount),
    goal: def.levelUp.amount,
    hint: def.levelUp.hint,
    // Once evolved, unit.defId points at the next-stage definition. The
    // current definition having a levelUp field therefore means this stage
    // still has progress to display, matching the authoritative engine logic.
    leveled: false,
  };
}
