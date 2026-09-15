import { DECKS } from "./decks";
import { FLAGSHIP_ART_TARGETS } from "./flagship-art";
import { ALPHA_P0_ACTIVE_IDS } from "./alpha-p0-art";

export const ALPHA_ART_STARTER_IDS = [
  "ember_aggro",
  "tide_control",
  "wood_midrange",
  "void_shadow",
  "florestia_tribal",
  "tempestade_rush",
] as const;

export type AlphaArtPriority = "P0" | "P1" | "P2" | "backlog" | "covered";

export interface AlphaArtExposure {
  defId: string;
  copies: number;
  deckCount: number;
  deckIds: string[];
  deckNames: string[];
  priority: AlphaArtPriority;
  score: number;
  knownDedicatedArt: boolean;
}

const starterIds = new Set<string>(ALPHA_ART_STARTER_IDS);
const knownDedicatedArt = new Set<string>([
  ...FLAGSHIP_ART_TARGETS.map((target) => target.defId),
  ...ALPHA_P0_ACTIVE_IDS,
]);
const exposure = new Map<string, { copies: number; deckIds: Set<string>; deckNames: Set<string> }>();

for (const deck of DECKS) {
  if (!starterIds.has(deck.id)) continue;
  for (const defId of deck.cards) {
    const current = exposure.get(defId) ?? { copies: 0, deckIds: new Set<string>(), deckNames: new Set<string>() };
    current.copies += 1;
    current.deckIds.add(deck.id);
    current.deckNames.add(deck.name);
    exposure.set(defId, current);
  }
}

function priorityFor(copies: number, deckCount: number, dedicated: boolean): AlphaArtPriority {
  if (dedicated) return "covered";
  if (copies < 1) return "backlog";
  if (deckCount >= 2 || copies >= 3) return "P0";
  if (copies === 2) return "P1";
  return "P2";
}

export function alphaArtExposure(defId: string): AlphaArtExposure {
  const row = exposure.get(defId);
  const copies = row?.copies ?? 0;
  const deckIds = row ? [...row.deckIds].sort() : [];
  const deckNames = row ? [...row.deckNames].sort() : [];
  const dedicated = knownDedicatedArt.has(defId);
  const deckCount = deckIds.length;
  return {
    defId,
    copies,
    deckCount,
    deckIds,
    deckNames,
    priority: priorityFor(copies, deckCount, dedicated),
    score: deckCount * 100 + copies * 10,
    knownDedicatedArt: dedicated,
  };
}

export function alphaArtBacklogSnapshot() {
  const rows = [...exposure.keys()].map(alphaArtExposure);
  const covered = rows.filter((row) => row.knownDedicatedArt).length;
  const missing = rows.length - covered;
  const byPriority = {
    P0: rows.filter((row) => row.priority === "P0").length,
    P1: rows.filter((row) => row.priority === "P1").length,
    P2: rows.filter((row) => row.priority === "P2").length,
  };
  return {
    starterDecks: ALPHA_ART_STARTER_IDS.length,
    starterSlots: ALPHA_ART_STARTER_IDS.reduce((sum, id) => sum + (DECKS.find((deck) => deck.id === id)?.cards.length ?? 0), 0),
    uniqueStarterCards: rows.length,
    covered,
    missing,
    byPriority,
  };
}

export function alphaArtPriorityQueue(limit?: number): AlphaArtExposure[] {
  const rows = [...exposure.keys()]
    .map(alphaArtExposure)
    .filter((row) => !row.knownDedicatedArt)
    .sort((a, b) => b.score - a.score || a.defId.localeCompare(b.defId));
  return typeof limit === "number" ? rows.slice(0, Math.max(0, limit)) : rows;
}
