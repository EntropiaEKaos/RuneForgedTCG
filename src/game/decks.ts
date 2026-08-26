import { getCard } from "./cards";
import type { CardRegionIdentity, Region } from "./types";
import { getRuntimeDeckRules, type RuntimeDeckRules } from "./runtime-config";
import { regionsFromCardIds } from "./region-identity";

export interface DeckDef {
  id: string;
  name: string;
  regions: CardRegionIdentity;
  description: string;
  emoji: string;
  cards: string[];
}

export const DECK_MIN = 20;
export const DECK_MAX = 40;
export const MAX_COPIES = 3;
export const MAX_REGIONS = 3;

export const DECKS: DeckDef[] = [
  {
    id: "ember_aggro",
    name: "Emberhold Blitz",
    regions: ["Emberhold"],
    description: "Fast, aggressive burn. Overwhelm through blockers and finish with direct damage.",
    emoji: "🔥",
    cards: [
      "ember_whelp", "ember_whelp", "ember_whelp",
      "ember_drake", "ember_drake", "ember_drake",
      "ember_herald", "ember_herald",
      "ember_raider", "ember_raider",
      "ember_duelist", "ember_duelist",
      "ember_zealot", "ember_zealot",
      "ember_sire", "ember_ashguard",
      "ember_tide_wyrm", "ember_tide_wyrm",
      "ember_bolt", "ember_bolt", "ember_bolt",
      "ember_face", "ember_face",
      "ember_blade", "ember_blade",
      "ember_soulblade",
      "ember_shatter", "ember_flare_line",
      "ember_hearth",
      "ember_anvil",
      "ember_phantom", "ember_phantom",
      "ember_lastbreath", "ember_lastbreath",
      "ember_stun",
      "ember_sprinter", "ember_sprinter",
      "ember_swarmlord",
      "ember_champion", "ember_champion",
    ],
  },
  {
    id: "tide_control",
    name: "Tidecall Control",
    regions: ["Tidecall"],
    description: "Outlast the enemy with tough blockers, card draw, healing and evasive threats.",
    emoji: "🌊",
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
    id: "wood_midrange",
    name: "Ironwood Grove",
    regions: ["Tidecall", "Ironwood"],
    description: "Sturdy, resilient units that regenerate and grow into overwhelming threats.",
    emoji: "🌲",
    cards: [
      "wood_cub", "wood_cub", "wood_cub",
      "wood_caller", "wood_caller",
      "wood_stag", "wood_stag",
      "wood_ent", "wood_ent",
      "wood_champion", "wood_champion",
      "wood_growth", "wood_growth", "wood_growth",
      "wood_mend", "wood_mend", "wood_seed_of_return",
      "wood_ward", "wood_ward",
      "wood_packalpha", "wood_canopy_bastion",
      "wood_void_pack", "wood_void_pack",
      "wood_claw", "wood_claw",
      "wood_heartwood",
      "wood_wither", "wood_wither",
      "wood_pact",
      "wood_martyr", "wood_martyr",
      "wood_recall", "wood_recall",
      "wood_webweaver", "wood_webweaver",
      "tide_guard",
      "wood_root_prison", "wood_root_prison",
      "wood_bark_rupture", "wood_bark_rupture",
    ],
  },
  {
    id: "void_shadow",
    name: "Voidborn Dread",
    regions: ["Voidborn"],
    description: "Evasive Fearsome units and Lifesteal to grind the enemy down while you heal.",
    emoji: "☠️",
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
      "void_toxomancer",
      "void_wither",
      "void_venom",
      "void_giantkiller",
    ],
  },
  {
    id: "florestia_tribal",
    name: "Matilha da Florestia",
    regions: ["Ironwood", "Florestia"],
    description: "Tribal Besta — cada invocação fortalece a matilha inteira. Constrói o bando e domina o campo.",
    emoji: "🐾",
    cards: [
      "forest_cub", "forest_cub", "forest_cub",
      "forest_packrunner", "forest_packrunner", "forest_packrunner",
      "forest_stalker", "forest_stalker",
      "forest_thornfang", "forest_thornfang",
      "forest_alpha", "forest_alpha",
      "forest_champion", "forest_champion",
      "forest_pack_howl", "forest_pack_howl",
      "forest_summon_pack", "forest_summon_pack",
      "forest_entangle", "forest_entangle", "forest_entangle",
      "forest_enchantment", "forest_enchantment",
      "wood_growth", "wood_growth",
      "wood_mend", "wood_mend",
      "wood_ward", "wood_ward",
      "forest_ambush",
      "forest_canopy_warden", "wood_webweaver",
      "forest_dawn_alpha",
      "forest_pack_shelter",
      "forest_moon_snare", "forest_moon_snare",
      "forest_predator_pounce", "forest_predator_pounce",
      "forest_primal_recall", "forest_primal_recall",
    ],
  },
  {
    id: "tempestade_rush",
    name: "Tempestade Iminente",
    regions: ["Emberhold", "Tempestade"],
    description: "Velocidade e poder aéreo — Tempesteiros com Ímpeto e Anjos com Voo. Domine o ar e encerre rápido.",
    emoji: "⚡",
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
    id: "convergence_dual",
    name: "Aliança da Forja do Trovão",
    regions: ["Emberhold", "Tempestade"],
    description: "Deck de identidade dupla que ativa Maestria e combina pressão terrestre, velocidade e domínio aéreo.",
    emoji: "🔥⚡",
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
  {
    id: "convergence_triad",
    name: "Memória do Abismo Vivo",
    regions: ["Tidecall", "Ironwood", "Voidborn"],
    description: "Tríade de controle e resistência. A flexibilidade de três regiões é convertida em valor tardio pela Maestria.",
    emoji: "🌊🌿☠",
    cards: [
      "convergence_abyss_memory", "convergence_abyss_memory", "convergence_abyss_memory",
      "convergence_abyss_grove_warden",
      "convergence_rootwater_sage", "convergence_rootwater_sage", "convergence_rootwater_sage",
      "convergence_drowned_eclipse", "convergence_drowned_eclipse", "convergence_drowned_eclipse",
      "convergence_duskbloom_warden", "convergence_duskbloom_warden", "convergence_duskbloom_warden",
      "tide_guard", "tide_guard", "tide_guard",
      "tide_sprite",
      "tide_memory_tide", "tide_memory_tide",
      "tide_stun", "tide_stun",
      "wood_webweaver", "wood_webweaver", "wood_webweaver",
      "wood_cub",
      "wood_growth", "wood_growth",
      "void_stalker", "void_stalker", "void_stalker",
      "void_imp",
      "void_drain", "void_drain",
      "void_gloom_warden", "void_gloom_warden", "void_gloom_warden",
      "void_champion", "void_champion",
      "wood_canopy_bastion", "wood_canopy_bastion",
    ],
  },
];

export function listDecks(): DeckDef[] { return DECKS; }

export function getDeck(id: string): DeckDef {
  const d = DECKS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown deck: ${id}`);
  return d;
}

export function tryGetDeck(id: string): DeckDef | undefined {
  return DECKS.find((x) => x.id === id);
}

export function deckRegions(cards: string[]): Region[] {
  return regionsFromCardIds(cards);
}

export type DeckRules = RuntimeDeckRules;

export function currentDeckRules(): DeckRules {
  return getRuntimeDeckRules();
}

export function validateDeck(cards: string[], rules: DeckRules = currentDeckRules()): { ok: boolean; errors: string[]; regions: Region[] } {
  const errors: string[] = [];
  const { deckMin, deckMax, maxCopies, maxRegions } = rules;
  if (cards.length < deckMin) errors.push(`Need at least ${deckMin} cards (have ${cards.length}).`);
  if (cards.length > deckMax) errors.push(`At most ${deckMax} cards (have ${cards.length}).`);

  const counts = new Map<string, number>();
  for (const id of cards) {
    let def;
    try {
      def = getCard(id);
    } catch {
      errors.push(`Unknown card: ${id}`);
      continue;
    }
    if (def.collectible === false) errors.push(`${def.name} cannot be added to a deck.`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > maxCopies) {
      try {
        errors.push(`${getCard(id).name}: max ${maxCopies} copies (have ${n}).`);
      } catch {
        errors.push(`${id}: max ${maxCopies} copies.`);
      }
    }
  }

  const regions = deckRegions(cards);
  if (regions.length > maxRegions) {
    errors.push(`At most ${maxRegions} regions (have ${regions.join(", ")}).`);
  }

  return { ok: errors.length === 0, errors, regions };
}
