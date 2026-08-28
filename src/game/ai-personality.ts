import type { AiDifficulty } from "./types";

export const AI_DIFFICULTIES: Record<AiDifficulty, { label: string; icon: string; description: string }> = {
  apprentice: { label: "Aprendiz", icon: "◇", description: "Desenvolve a mesa de forma simples e hesita em bloqueios não letais." },
  tactician: { label: "Tático", icon: "◆", description: "Prioriza ameaças, valor de mana e trocas favoráveis." },
  overlord: { label: "Soberano", icon: "✦", description: "Pressiona sem medo e explora respostas, remoções e janelas de ataque." },
};

export function aiPersonaForDeck(deckId: string): { title: string; intent: string } {
  if (deckId.includes("ember") || deckId.includes("storm")) return { title: "Vanguarda", intent: "pressão e dano explosivo" };
  if (deckId.includes("tide")) return { title: "Oráculo", intent: "controle, recursos e respostas" };
  if (deckId.includes("wood") || deckId.includes("forest")) return { title: "Guardião", intent: "mesa resiliente e crescimento" };
  if (deckId.includes("void")) return { title: "Predador", intent: "remoção, evasão e desgaste" };
  return { title: "Tático", intent: "jogo adaptativo" };
}
