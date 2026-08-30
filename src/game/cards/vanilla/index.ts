import type { ActivatedAbility } from "../../activated-ability-types";
import type { CardDef } from "../../types";
import { VANILLA_EMBERHOLD_CARDS } from "./ember";
import { VANILLA_TIDECALL_CARDS } from "./tide";
import { VANILLA_IRONWOOD_CARDS } from "./wood";
import { VANILLA_VOIDBORN_CARDS } from "./void";
import { VANILLA_FLORESTIA_CARDS } from "./forest";
import { VANILLA_TEMPESTADE_CARDS } from "./storm";

const REGION_LORE: Record<string, string[]> = {
  Emberhold: ["A primeira chama não pediu permissão para existir.", "Toda forja lembra o fogo que a despertou.", "Cinzas antigas ainda conhecem o nome dos valentes."],
  Tidecall: ["A maré guarda memórias que nenhum mapa alcança.", "O oceano ensina paciência antes de ensinar poder.", "Toda corrente retorna, mas nunca da mesma forma."],
  Ironwood: ["Raízes antigas sustentam juramentos mais velhos que reis.", "A floresta cresce em silêncio e vence pelo tempo.", "Cada anel do tronco é uma batalha sobrevivida."],
  Voidborn: ["No vazio, até o medo aprende a escutar.", "Algumas sombras nasceram antes da primeira luz.", "O abismo cobra memória como preço de passagem."],
  Florestia: ["A matilha reconhece quem protege o primeiro lar.", "Sob a lua antiga, instinto e honra são a mesma lei.", "Nenhuma trilha pertence a quem caminha sozinho."],
  Tempestade: ["Antes do trovão existe um instante de absoluta coragem.", "O céu não pede desculpas por mudar o mundo.", "Todo raio escolhe um caminho apenas uma vez."],
};

interface VanillaActivatedIdentity {
  reminder: string;
  activatedAbilities: ActivatedAbility[];
}

/**
 * Late-game Vanilla units are intentionally outside the eight certified Alpha
 * decklists. They are therefore the safest native cards on which to deepen the
 * generic activated-ability system without silently rebalance-patching starter
 * or certified decks.
 */
const VANILLA_ACTIVATED_IDENTITIES: Record<string, VanillaActivatedIdentity> = {
  van_ember_u15: {
    reminder: "Ativada — 2 Mana, Exaurir: conceda +2/+0 a uma unidade aliada.",
    activatedAbilities: [{
      description: "Ordem da Forja — conceda +2/+0 a uma unidade aliada.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "buffUnit", amount: 0, buffPower: 2, buffHealth: 0, target: "allyUnit" },
    }],
  },
  van_ember_u16: {
    reminder: "Ativada — 2 Mana, Exaurir: cause 2 de dano a uma unidade inimiga.",
    activatedAbilities: [{
      description: "Punho de Obsidiana — cause 2 de dano a uma unidade inimiga.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" },
    }],
  },
  van_ember_u17: {
    reminder: "Ativada — 3 Mana, Exaurir: cause 2 de dano ao Nexus inimigo.",
    activatedAbilities: [{
      description: "Clarão de Guerra — cause 2 de dano ao Nexus inimigo.",
      cost: { mana: 3, exhaustSelf: true },
      effect: { kind: "damageNexus", amount: 2, target: "none" },
    }],
  },
  van_ember_u18: {
    reminder: "Ativada — 2 Mana, Exaurir: cause 3 de dano ao Nexus inimigo.",
    activatedAbilities: [{
      description: "Coração da Forja — cause 3 de dano ao Nexus inimigo.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "damageNexus", amount: 3, target: "none" },
    }],
  },

  van_tide_u15: {
    reminder: "Ativada — 2 Mana, Exaurir: compre 1 carta.",
    activatedAbilities: [{
      description: "Leitura das Correntes — compre 1 carta.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "draw", amount: 1, target: "none" },
    }],
  },
  van_tide_u16: {
    reminder: "Ativada — 2 Mana: conceda Barreira a uma unidade aliada.",
    activatedAbilities: [{
      description: "Horizonte Protetor — conceda Barreira a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantBarrier", amount: 0, target: "allyUnit" },
    }],
  },
  van_tide_u17: {
    reminder: "Ativada — 3 Mana, Exaurir: retorne uma unidade inimiga para a mão.",
    activatedAbilities: [{
      description: "Dilúvio Reverso — retorne uma unidade inimiga para a mão.",
      cost: { mana: 3, exhaustSelf: true },
      effect: { kind: "recall", amount: 0, target: "enemyUnit" },
    }],
  },
  van_tide_u18: {
    reminder: "Ativada — 2 Mana: compre 1 carta e cure 2 do seu Nexus.",
    activatedAbilities: [{
      description: "Memória do Oceano — compre 1 carta e cure 2 do seu Nexus.",
      cost: { mana: 2 },
      effect: {
        kind: "draw",
        amount: 1,
        target: "none",
        also: { kind: "healNexus", amount: 2, target: "none" },
      },
    }],
  },

  van_wood_u15: {
    reminder: "Ativada — 2 Mana, Exaurir: cure 3 de uma unidade aliada.",
    activatedAbilities: [{
      description: "Seiva Ancestral — cure 3 de uma unidade aliada.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "healUnit", amount: 3, target: "allyUnit" },
    }],
  },
  van_wood_u16: {
    reminder: "Ativada — 2 Mana: conceda Resistente a uma unidade aliada.",
    activatedAbilities: [{
      description: "Casca Profunda — conceda Resistente a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantKeyword", amount: 0, keyword: "Tough", target: "allyUnit" },
    }],
  },
  van_wood_u17: {
    reminder: "Ativada — 3 Mana, Exaurir: Bestas e Feras aliadas recebem +1/+1.",
    activatedAbilities: [{
      description: "Pulso do Bosque — Bestas e Feras aliadas recebem +1/+1.",
      cost: { mana: 3, exhaustSelf: true },
      effect: { kind: "buffRace", amount: 0, buffPower: 1, buffHealth: 1, target: "none", races: ["Beast", "Besta"] },
    }],
  },
  van_wood_u18: {
    reminder: "Ativada — 2 Mana: conceda Regeneração a uma unidade aliada.",
    activatedAbilities: [{
      description: "Raiz Inquebrável — conceda Regeneração a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantKeyword", amount: 0, keyword: "Regeneration", target: "allyUnit" },
    }],
  },

  van_void_u15: {
    reminder: "Ativada — pague 2 de vida do Nexus: compre 1 carta.",
    activatedAbilities: [{
      description: "Conhecimento da Desolação — compre 1 carta.",
      cost: { nexusHealth: 2 },
      effect: { kind: "draw", amount: 1, target: "none" },
    }],
  },
  van_void_u16: {
    reminder: "Ativada — Sacrifique esta unidade: destrua uma unidade inimiga.",
    activatedAbilities: [{
      description: "Nome Apagado — destrua uma unidade inimiga.",
      cost: { sacrificeSelf: true },
      effect: { kind: "killUnit", amount: 0, target: "enemyUnit" },
    }],
  },
  van_void_u17: {
    reminder: "Ativada — 2 Mana: conceda Murchar a uma unidade aliada.",
    activatedAbilities: [{
      description: "Profecia do Fim — conceda Murchar a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantKeyword", amount: 0, keyword: "Wither", target: "allyUnit" },
    }],
  },
  van_void_u18: {
    reminder: "Ativada — pague 2 de vida do Nexus: cause 3 de dano a uma unidade inimiga.",
    activatedAbilities: [{
      description: "Olhar do Vazio — cause 3 de dano a uma unidade inimiga.",
      cost: { nexusHealth: 2 },
      effect: { kind: "damageUnit", amount: 3, target: "enemyUnit" },
    }],
  },

  van_forest_u15: {
    reminder: "Ativada — 2 Mana, Exaurir: invoque um Filhote da Matilha.",
    activatedAbilities: [{
      description: "Chamado Dourado — invoque um Filhote da Matilha.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "summonToken", amount: 1, tokenDefId: "forest_cub_token", target: "none" },
    }],
  },
  van_forest_u16: {
    reminder: "Ativada — 2 Mana: conceda Alcance a uma unidade aliada.",
    activatedAbilities: [{
      description: "Instinto da Copa — conceda Alcance a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantKeyword", amount: 0, keyword: "Reach", target: "allyUnit" },
    }],
  },
  van_forest_u17: {
    reminder: "Ativada — 3 Mana, Exaurir: Bestas e Feras aliadas recebem +1/+1.",
    activatedAbilities: [{
      description: "Uivo da Grande Caçada — Bestas e Feras aliadas recebem +1/+1.",
      cost: { mana: 3, exhaustSelf: true },
      effect: { kind: "buffRace", amount: 0, buffPower: 1, buffHealth: 1, target: "none", races: ["Beast", "Besta"] },
    }],
  },
  van_forest_u18: {
    reminder: "Ativada — 2 Mana: invoque dois Filhotes da Matilha.",
    activatedAbilities: [{
      description: "Primeiro Uivo — invoque dois Filhotes da Matilha.",
      cost: { mana: 2 },
      effect: {
        kind: "summonToken",
        amount: 1,
        tokenDefId: "forest_cub_token",
        target: "none",
        also: { kind: "summonToken", amount: 1, tokenDefId: "forest_cub_token", target: "none" },
      },
    }],
  },

  van_storm_u15: {
    reminder: "Ativada — 2 Mana, Exaurir: cause 2 de dano a uma unidade inimiga.",
    activatedAbilities: [{
      description: "Trovão Conduzido — cause 2 de dano a uma unidade inimiga.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" },
    }],
  },
  van_storm_u16: {
    reminder: "Ativada — 2 Mana: conceda Ímpeto a uma unidade aliada.",
    activatedAbilities: [{
      description: "Ruptura Instantânea — conceda Ímpeto a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantKeyword", amount: 0, keyword: "Haste", target: "allyUnit" },
    }],
  },
  van_storm_u17: {
    reminder: "Ativada — 3 Mana, Exaurir: atordoe uma unidade inimiga.",
    activatedAbilities: [{
      description: "Céu Partido — atordoe uma unidade inimiga.",
      cost: { mana: 3, exhaustSelf: true },
      effect: { kind: "stun", amount: 0, target: "enemyUnit" },
    }],
  },
  van_storm_u18: {
    reminder: "Ativada — 2 Mana: atordoe uma unidade inimiga.",
    activatedAbilities: [{
      description: "Olho da Tormenta — atordoe uma unidade inimiga.",
      cost: { mana: 2 },
      effect: { kind: "stun", amount: 0, target: "enemyUnit" },
    }],
  },
};

function withFlavor(cards: Record<string, CardDef>): Record<string, CardDef> {
  const out: Record<string, CardDef> = {};
  for (const [defId, card] of Object.entries(cards)) {
    const n = Number(defId.match(/(\d+)$/)?.[1] || 1);
    const lines = REGION_LORE[card.region] || ["Vanilla registra o primeiro capítulo de RuneForge."];
    const identity = VANILLA_ACTIVATED_IDENTITIES[defId];
    out[defId] = {
      ...card,
      ...(identity ? {
        description: `${card.description} ${identity.reminder}`,
        activatedAbilities: identity.activatedAbilities,
      } : {}),
      flavor: card.flavor || `${lines[(n - 1) % lines.length]} — ${card.name}`,
    };
  }
  return out;
}

export const VANILLA_ADDITIONAL_CARDS = withFlavor({
  ...VANILLA_EMBERHOLD_CARDS,
  ...VANILLA_TIDECALL_CARDS,
  ...VANILLA_IRONWOOD_CARDS,
  ...VANILLA_VOIDBORN_CARDS,
  ...VANILLA_FLORESTIA_CARDS,
  ...VANILLA_TEMPESTADE_CARDS,
});
