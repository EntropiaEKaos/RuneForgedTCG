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
 * The six regional Vanilla legends are intentionally outside the eight
 * certified Alpha decklists. They are therefore the safest native cards on
 * which to expose the generic activated-ability system without silently
 * rebalance-patching starter/Ranked decks.
 */
const VANILLA_ACTIVATED_IDENTITIES: Record<string, VanillaActivatedIdentity> = {
  van_ember_u18: {
    reminder: "Ativada — 2 Mana, Exaurir: cause 3 de dano ao Nexus inimigo.",
    activatedAbilities: [{
      description: "Coração da Forja — cause 3 de dano ao Nexus inimigo.",
      cost: { mana: 2, exhaustSelf: true },
      effect: { kind: "damageNexus", amount: 3, target: "none" },
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
  van_wood_u18: {
    reminder: "Ativada — 2 Mana: conceda Regeneração a uma unidade aliada.",
    activatedAbilities: [{
      description: "Raiz Inquebrável — conceda Regeneração a uma unidade aliada.",
      cost: { mana: 2 },
      effect: { kind: "grantKeyword", amount: 0, keyword: "Regeneration", target: "allyUnit" },
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
  van_forest_u18: {
    reminder: "Ativada — 2 Mana: invoque dois Filhotes da Matilha.",
    activatedAbilities: [{
      description: "Primeiro Uivo — invoque dois Filhotes da Matilha.",
      cost: { mana: 2 },
      effect: { kind: "summonToken", amount: 2, tokenDefId: "forest_cub_token", target: "none" },
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
