import type { GameState, Region } from "./types";
import { getCard } from "./cards";

export interface ArchetypeProfile {
  deckId: string;
  name: string;
  region: Region;
  icon: string;
  fantasy: string;
  plan: [string, string, string];
  victory: string;
  weakness: string;
  signatures: string[];
  meterLabel: string;
}

export const ARCHETYPES: Record<string, ArchetypeProfile> = {
  ember_aggro: {
    deckId: "ember_aggro", name: "Fúria da Forja", region: "Emberhold", icon: "🔥",
    fantasy: "Transforme cada ponto de mana em pressão antes que o rival estabilize.",
    plan: ["Ocupe a mesa cedo", "Abra caminho com dano", "Finalize pelo Nexus"],
    victory: "Vencer entre as rodadas 6 e 10 com dano direto ou Atropelar.",
    weakness: "Cura, barreiras e trocas que prolongam a partida.",
    signatures: ["ember_ashguard", "ember_flare_line", "ember_champion"], meterLabel: "NEXUS QUEBRADO",
  },
  tide_control: {
    deckId: "tide_control", name: "Maré Inevitável", region: "Tidecall", icon: "🌊",
    fantasy: "Sobreviva ao impacto inicial e vença pela vantagem de recursos.",
    plan: ["Proteja o Nexus", "Negue ameaças-chave", "Vire a maré com valor"],
    victory: "Chegar ao jogo tardio com cartas, cura e ameaças evasivas.",
    weakness: "Pressão ampla que força várias respostas na mesma rodada.",
    signatures: ["tide_memory_tide", "tide_cloudpiercer", "tide_champion"], meterLabel: "CONTROLE DA MARÉ",
  },
  wood_midrange: {
    deckId: "wood_midrange", name: "Coração Ancestral", region: "Ironwood", icon: "🌿",
    fantasy: "Construa a mesa mais resistente e transforme sobrevivência em poder.",
    plan: ["Curve unidades sólidas", "Cure e regenere", "Ataque com massa crítica"],
    victory: "Dominar o campo com corpos eficientes e crescimento permanente.",
    weakness: "Recalls, remoções limpas e ameaças evasivas.",
    signatures: ["wood_canopy_bastion", "wood_seed_of_return", "wood_champion"], meterLabel: "FORÇA DA COPA",
  },
  void_shadow: {
    deckId: "void_shadow", name: "Predação do Vazio", region: "Voidborn", icon: "☠",
    fantasy: "Remova defesas, atravesse a mesa e converta desgaste em vida.",
    plan: ["Desmonte a defesa", "Ataque por evasão", "Feche com drenagem"],
    victory: "Criar diferença de Nexus com Fearsome, Lifesteal e remoções.",
    weakness: "Mesas largas e ameaças protegidas contra alvo.",
    signatures: ["void_gloom_warden", "void_soul_tax", "void_champion"], meterLabel: "FOME DO VAZIO",
  },
  florestia_tribal: {
    deckId: "florestia_tribal", name: "Juramento da Matilha", region: "Florestia", icon: "🐺",
    fantasy: "Cada fera torna a próxima mais perigosa; a matilha vence unida.",
    plan: ["Reúna Bestas", "Proteja o bando", "Ataque em formação"],
    victory: "Atingir uma mesa larga e amplificar múltiplos atacantes.",
    weakness: "Dano em área e remoção do líder da matilha.",
    signatures: ["forest_dawn_alpha", "forest_pack_shelter", "forest_champion"], meterLabel: "MATILHA REUNIDA",
  },
  tempestade_rush: {
    deckId: "tempestade_rush", name: "Céu em Ruptura", region: "Tempestade", icon: "⚡",
    fantasy: "Jogue no ritmo do relâmpago e ataque onde bloqueadores não alcançam.",
    plan: ["Ganhe iniciativa", "Pressione pelo ar", "Encadeie ataques rápidos"],
    victory: "Manter o tempo com Ímpeto, Voo e Ataque Rápido.",
    weakness: "Defesas com Alcance, Barreira e remoção eficiente.",
    signatures: ["storm_static_adept", "storm_tempered_winds", "storm_champion"], meterLabel: "CARGA DA TEMPESTADE",
  },
  ecos_do_abismo: {
    deckId: "ecos_do_abismo", name: "Ecos do Abismo", region: "Voidborn", icon: "🌊☠",
    fantasy: "Transforme mão e Cemitério em duas metades do mesmo recurso e faça ameaças impossíveis voltarem cedo demais.",
    plan: ["Prepare o Cemitério", "Proteja a recursão", "Reanime antes da curva"],
    victory: "Trocar tempo e seleção por uma ameaça de custo alto antecipada, então reciclar valor caso ela seja respondida.",
    weakness: "Banish de Cemitério, negação da recursão e pressão que não concede uma rodada de preparação.",
    signatures: ["rfalpha_reanimator_memory_smuggler", "rfalpha_reanimator_second_pulse", "rfalpha_reanimator_hollow_rift_colossus"], meterLabel: "ECOS DESPERTOS",
  },
  convergence_dual: {
    deckId: "convergence_dual", name: "Aliança da Forja do Trovão", region: "Emberhold", icon: "🔥⚡",
    fantasy: "Comprometa-se com duas regiões e converta identidade exata em eficiência de Maestria.",
    plan: ["Estabeleça as duas cores", "Ative Maestria", "Ataque por terra e ar"],
    victory: "Manter pressão com unidades eficientes e finalizar antes da estabilização rival.",
    weakness: "Decks que removem as ameaças de Maestria e vencem a disputa de recursos.",
    signatures: ["convergence_stormforge_vanguard", "storm_champion", "ember_champion"], meterLabel: "CONVERGÊNCIA DUPLA",
  },
  convergence_triad: {
    deckId: "convergence_triad", name: "Memória do Abismo Vivo", region: "Tidecall", icon: "🌊🌿☠",
    fantasy: "Una três tradições e sobreviva até a convergência transformar flexibilidade em valor.",
    plan: ["Cubra todas as ameaças", "Preserve recursos", "Domine o jogo tardio"],
    victory: "Ganhar por cartas, cura e ameaças resilientes depois que a tríade estabiliza.",
    weakness: "Pressão muito rápida antes que as três regiões encontrem a curva correta.",
    signatures: ["convergence_abyss_memory", "convergence_abyss_grove_warden", "convergence_duskbloom_warden"], meterLabel: "CONVERGÊNCIA TRÍPLICE",
  },
};

export function archetypeForDeck(deckId: string): ArchetypeProfile | null {
  return ARCHETYPES[deckId] ?? null;
}

/** Resolve an authored doctrine for custom decks from the cards' Studio 4.1 affinity tags. */
export function archetypeForCards(cards: string[]): ArchetypeProfile | null {
  const scores = new Map<string, number>();
  for (const defId of cards) {
    let card;
    try { card = getCard(defId); } catch { continue; }
    for (const doctrineId of card.doctrineAffinities ?? []) {
      if (ARCHETYPES[doctrineId]) scores.set(doctrineId, (scores.get(doctrineId) ?? 0) + 1);
    }
  }
  const winner = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return winner ? ARCHETYPES[winner] : null;
}

export function isArchetypeSignature(defId: string, profile: ArchetypeProfile): boolean {
  if (profile.signatures.includes(defId)) return true;
  try { return getCard(defId).doctrineAffinities?.includes(profile.deckId) ?? false; }
  catch { return false; }
}

export function archetypeMomentum(state: GameState, deckId: string): { value: number; detail: string } {
  const me = state.players.player;
  const enemy = state.players.ai;
  let raw = 0;
  let detail = "Plano em formação";
  switch (deckId) {
    case "ember_aggro":
      raw = me.stats.nexusDamageDealt * 4 + Math.max(0, 10 - state.round) * 2;
      detail = `${me.stats.nexusDamageDealt} de dano ao Nexus`;
      break;
    case "tide_control":
      raw = me.hand.length * 7 + me.nexusHealth * 2 + me.stats.spellsCast * 3;
      detail = `${me.hand.length} cartas · ${me.nexusHealth} de Nexus`;
      break;
    case "wood_midrange": {
      const endurance = me.bench.reduce((sum, unit) => sum + Math.max(0, unit.health), 0);
      raw = endurance * 5 + me.bench.length * 6;
      detail = `${endurance} de resistência em campo`;
      break;
    }
    case "void_shadow":
      raw = Math.max(0, 20 - enemy.nexusHealth) * 3 + me.stats.spellsCast * 5 + Math.max(0, me.nexusHealth - enemy.nexusHealth) * 2;
      detail = `${me.stats.spellsCast} feitiços · diferença ${me.nexusHealth - enemy.nexusHealth}`;
      break;
    case "florestia_tribal":
      raw = me.bench.length * 13 + me.stats.alliesSummoned * 4;
      detail = `${me.bench.length}/6 aliados na mesa`;
      break;
    case "tempestade_rush":
      raw = me.stats.nexusDamageDealt * 3 + me.bench.filter((unit) => unit.keywords.includes("Flying") || unit.keywords.includes("Haste") || unit.keywords.includes("QuickAttack")).length * 12;
      detail = `${me.stats.nexusDamageDealt} de dano · pressão aérea`;
      break;
    case "ecos_do_abismo": {
      const premiumGraveyardUnits = (me.graveyard ?? []).filter((entry) => {
        try {
          const card = getCard(entry.defId);
          return card.type === "Unit" && card.cost >= 6;
        } catch {
          return false;
        }
      }).length;
      const revivedThreats = me.bench.filter((unit) => getCard(unit.defId).cost >= 6).length;
      raw = premiumGraveyardUnits * 18 + revivedThreats * 24 + me.stats.spellsCast * 3;
      detail = `${premiumGraveyardUnits} alvo(s) no Cemitério · ${revivedThreats} ameaça(s) grande(s) em campo`;
      break;
    }
    default:
      raw = me.bench.length * 10 + me.stats.nexusDamageDealt * 3;
  }
  return { value: Math.max(0, Math.min(100, Math.round(raw))), detail };
}

export function mulliganPlan(hand: string[], deckId: string): { keep: string[]; replace: string[]; reason: string } {
  const profile = archetypeForDeck(deckId);
  const keep: string[] = [];
  const replace: string[] = [];
  for (const defId of hand) {
    const card = getCard(defId);
    let recommended = card.cost <= 2;
    if (deckId === "tide_control") recommended = card.cost <= 3 && (card.type === "Unit" || ["negateSpell", "healNexus", "frostbite", "stun"].includes(card.spell?.kind ?? ""));
    if (deckId === "wood_midrange") recommended = card.type === "Unit" && card.cost <= 3;
    if (deckId === "void_shadow") recommended = card.cost <= 3 || ["damageUnit", "poison"].includes(card.spell?.kind ?? "");
    if (deckId === "florestia_tribal") recommended = card.type === "Unit" && card.cost <= 3;
    if (deckId === "tempestade_rush") recommended = card.cost <= 3 && (card.type === "Unit" || (card.keywords ?? []).some((keyword) => ["Haste", "Flying", "QuickAttack"].includes(keyword)));
    if (deckId === "ecos_do_abismo") {
      const discardOutlet = card.activatedAbilities?.some((ability) => (ability.cost?.discardFromHand ?? 0) > 0) ?? false;
      const setupSpell = ["returnGraveyardToHand", "damageUnit", "stun", "recall"].includes(card.spell?.kind ?? "");
      const baselineReanimation = card.spell?.kind === "reanimateUnit" && card.cost <= 5;
      recommended = discardOutlet || baselineReanimation || (card.cost <= 3 && (card.type === "Unit" || setupSpell));
    }
    (recommended ? keep : replace).push(defId);
  }
  return {
    keep,
    replace,
    reason: profile ? `${profile.name}: ${profile.plan[0].toLowerCase()} e ${profile.plan[1].toLowerCase()}.` : "Priorize uma curva inicial jogável.",
  };
}
