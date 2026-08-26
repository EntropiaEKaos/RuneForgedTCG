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
function withFlavor(cards: Record<string, CardDef>): Record<string, CardDef> {
  const out: Record<string, CardDef> = {};
  for (const [defId, card] of Object.entries(cards)) {
    const n = Number(defId.match(/(\d+)$/)?.[1] || 1);
    const lines = REGION_LORE[card.region] || ["Vanilla registra o primeiro capítulo de RuneForge."];
    out[defId] = { ...card, flavor: card.flavor || `${lines[(n - 1) % lines.length]} — ${card.name}` };
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
