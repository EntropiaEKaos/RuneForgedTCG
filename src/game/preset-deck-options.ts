import type { CardRegionIdentity } from "./types";

/**
 * Browser-safe metadata for the built-in preset deck selector.
 *
 * Authoritative deck contents and validation remain in decks.ts/server paths.
 * Keeping the selector metadata isolated prevents client components from
 * pulling server runtime settings and PostgreSQL into the browser bundle.
 */
export interface PresetDeckOption {
  id: string;
  name: string;
  regions: CardRegionIdentity;
  emoji: string;
}

export const PRESET_DECK_OPTIONS: readonly PresetDeckOption[] = [
  { id: "ember_aggro", name: "Emberhold Blitz", regions: ["Emberhold"], emoji: "🔥" },
  { id: "tide_control", name: "Tidecall Control", regions: ["Tidecall"], emoji: "🌊" },
  { id: "wood_midrange", name: "Ironwood Grove", regions: ["Tidecall", "Ironwood"], emoji: "🌲" },
  { id: "void_shadow", name: "Voidborn Dread", regions: ["Voidborn"], emoji: "☠️" },
  { id: "florestia_tribal", name: "Matilha da Florestia", regions: ["Ironwood", "Florestia"], emoji: "🐾" },
  { id: "tempestade_rush", name: "Tempestade Iminente", regions: ["Emberhold", "Tempestade"], emoji: "⚡" },
  { id: "convergence_dual", name: "Aliança da Forja do Trovão", regions: ["Emberhold", "Tempestade"], emoji: "🔥⚡" },
  { id: "convergence_triad", name: "Memória do Abismo Vivo", regions: ["Tidecall", "Ironwood", "Voidborn"], emoji: "🌊🌿☠" },
] as const;
