import type { DeckInput } from "./types";
import { validateDeck } from "./decks";

/**
 * Ranked is intentionally launched with a small immutable certified pool.
 * Casual/Studio decks may evolve independently, but changing any list below
 * requires rerunning the Ranked balance certification before release.
 */
export const RANKED_RULESET_VERSION = "2026.08.97";
export const RANKED_DECK_POOL_VERSION = "season-zero-r1";
export const RANKED_FORMAT_ID = "ranked-precon";

export interface RankedPrecon extends DeckInput {
  emoji: string;
  certificationSeedSlot: number;
}

export const RANKED_PRECONS: readonly RankedPrecon[] = [
  {
    id: "ranked_tide_control",
    name: "Tidecall Control — Ranked",
    formatId: RANKED_FORMAT_ID,
    emoji: "🌊",
    certificationSeedSlot: 1,
    cards: [
      "tide_sprite", "tide_sprite", "tide_sprite",
      "tide_oracle", "tide_oracle",
      "tide_guard", "tide_guard",
      "tide_mystic", "tide_mystic",
      "tide_bladedancer", "tide_cloudpiercer",
      "tide_freeze", "tide_freeze",
      "tide_draw", "tide_memory_tide",
      "tide_heal", "tide_heal",
      "tide_shield", "tide_shield",
      "tide_caller", "tide_caller",
      "tide_wood_chorus", "tide_wood_chorus",
      "tide_anchor", "tide_anchor",
      "tide_mirror",
      "tide_dispel", "tide_dispel",
      "tide_tidecaller",
      "tide_guard",
      "tide_champion", "tide_champion",
      "tide_deny", "tide_deny",
      "tide_frostbite", "tide_frostbite",
      "tide_stun", "tide_stun",
      "tide_recall",
      "tide_hexspirit",
    ],
  },
  {
    id: "ranked_void_shadow",
    name: "Voidborn Dread — Ranked",
    formatId: RANKED_FORMAT_ID,
    emoji: "☠️",
    certificationSeedSlot: 3,
    cards: [
      "void_imp", "void_imp",
      "void_hexer", "void_hexer",
      "void_stalker", "void_stalker",
      "void_duelist", "void_duelist",
      "void_reaper", "void_gloom_warden",
      "void_champion", "void_champion",
      "void_drain", "void_drain", "void_drain",
      "void_veil", "void_soul_tax",
      "void_barrier", "void_barrier",
      "void_whisper", "void_whisper",
      "void_harvester", "void_harvester",
      "void_ember_herald", "void_ember_herald",
      "void_scythe",
      "void_reaper_edge",
      "void_unmake", "void_unmake",
      "void_siphon",
      "void_disrupt", "void_disrupt",
      "void_ghost", "void_ghost",
      "void_deathmark",
      "void_assassin",
      "void_toxomancer", "void_barrier",
      "void_wither",
      "void_reaper",
    ],
  },
  {
    id: "ranked_tempestade_rush",
    name: "Tempestade Iminente — Ranked",
    formatId: RANKED_FORMAT_ID,
    emoji: "⚡",
    certificationSeedSlot: 5,
    cards: [
      "storm_dashbolt", "storm_dashbolt", "storm_dashbolt",
      "storm_strikecaller", "storm_strikecaller", "storm_strikecaller",
      "storm_cyclone",
      "storm_sky_sentinel", "storm_thunder_angel",
      "storm_seraph", "storm_seraph", "storm_static_adept",
      "storm_herald", "storm_herald", "storm_herald",
      "storm_warchief",
      "storm_chain_bolt", "storm_chain_bolt",
      "storm_champion",
      "storm_eye", "storm_thunder_angel",
      "storm_lightning", "storm_lightning", "storm_lightning",
      "storm_burst", "storm_burst",
      "storm_gale", "storm_tempered_winds",
      "storm_thunder", "storm_thunder",
      "storm_anthem",
      "ember_bolt", "ember_bolt", "ember_bolt",
      "ember_face",
      "storm_eye", "storm_eye",
      "ember_sprinter",
      "storm_sky_sentinel", "storm_sky_sentinel",
    ],
  },
  {
    id: "ranked_convergence_dual",
    name: "Aliança da Forja do Trovão — Ranked",
    formatId: RANKED_FORMAT_ID,
    emoji: "🔥⚡",
    certificationSeedSlot: 6,
    cards: [
      "convergence_stormforge_vanguard", "convergence_stormforge_vanguard", "convergence_stormforge_vanguard",
      "ember_whelp", "ember_whelp", "ember_whelp",
      "ember_drake", "ember_drake", "ember_drake",
      "ember_raider", "ember_raider", "ember_raider",
      "ember_sprinter", "ember_sprinter",
      "ember_bolt", "ember_bolt", "ember_bolt",
      "ember_face", "ember_face",
      "storm_dashbolt", "storm_dashbolt", "storm_dashbolt",
      "storm_strikecaller", "storm_strikecaller", "storm_strikecaller",
      "storm_sky_sentinel", "storm_sky_sentinel",
      "storm_seraph", "storm_seraph",
      "storm_lightning", "storm_lightning",
      "storm_chain_bolt", "storm_chain_bolt",
      "storm_eye", "storm_eye",
      "storm_herald", "storm_herald",
      "ember_ashguard",
      "storm_champion",
      "ember_champion",
    ],
  },
] as const;

export function getRankedPrecon(id: string): RankedPrecon | undefined {
  return RANKED_PRECONS.find((deck) => deck.id === id);
}

export function resolveRankedPrecon(id: string): DeckInput {
  const deck = getRankedPrecon(id);
  if (!deck) throw new Error("Deck is not in the certified Ranked pool");
  return { id: deck.id, name: deck.name, cards: [...deck.cards], formatId: RANKED_FORMAT_ID };
}


export function rankedDeckFingerprint(cards: readonly string[]): string {
  return [...cards].sort().join("|");
}

export interface RankedRoomCertificationSnapshot {
  rulesVersion: string;
  deckPoolVersion: string;
  hostDeckFingerprint: string;
  guestDeckFingerprint: string;
}

export function createRankedRoomCertification(
  hostDeck: Pick<DeckInput, "cards">,
  guestDeck: Pick<DeckInput, "cards">,
): RankedRoomCertificationSnapshot {
  return {
    rulesVersion: RANKED_RULESET_VERSION,
    deckPoolVersion: RANKED_DECK_POOL_VERSION,
    hostDeckFingerprint: rankedDeckFingerprint(hostDeck.cards),
    guestDeckFingerprint: rankedDeckFingerprint(guestDeck.cards),
  };
}

export function verifyRankedRoomCertification(
  snapshot: RankedRoomCertificationSnapshot | null | undefined,
  hostDeck: Pick<DeckInput, "cards">,
  guestDeck: Pick<DeckInput, "cards">,
): boolean {
  if (!snapshot?.rulesVersion?.trim() || !snapshot?.deckPoolVersion?.trim()) return false;
  return snapshot.hostDeckFingerprint === rankedDeckFingerprint(hostDeck.cards)
    && snapshot.guestDeckFingerprint === rankedDeckFingerprint(guestDeck.cards);
}

export function isCertifiedRankedDeck(deck: Pick<DeckInput, "id" | "cards" | "formatId">): boolean {
  const certified = getRankedPrecon(deck.id);
  if (!certified || deck.formatId !== RANKED_FORMAT_ID) return false;
  return rankedDeckFingerprint(deck.cards) === rankedDeckFingerprint(certified.cards);
}

export function rankedPreconOverrides(): Record<string, DeckInput> {
  return Object.fromEntries(RANKED_PRECONS.map((deck) => [deck.id, resolveRankedPrecon(deck.id)]));
}

export function validateRankedPreconPool(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const deck of RANKED_PRECONS) {
    if (ids.has(deck.id)) errors.push(`Duplicate Ranked deck id: ${deck.id}`);
    ids.add(deck.id);
    const validation = validateDeck([...deck.cards]);
    if (!validation.ok) errors.push(`${deck.id}: ${validation.errors.join(" | ")}`);
    if (deck.cards.length !== 40) errors.push(`${deck.id}: Ranked deck must contain exactly 40 cards`);
  }
  if (RANKED_PRECONS.length < 4) errors.push("Ranked launch requires at least four certified preconstructed decks");
  return errors;
}
