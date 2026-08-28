import type { GameState } from "../types";

export interface MatchMastery { score: number; grade: "S" | "A" | "B" | "C"; title: string; highlights: string[] }

export function evaluateMatchMastery(state: GameState): MatchMastery {
  const player = state.players.player;
  const victory = state.winner === "player";
  const efficiency = Math.max(0, 18 - state.round) * 2;
  const score = Math.max(0, Math.min(100,
    (victory ? 38 : 10) + Math.min(24, player.stats.nexusDamageDealt) + Math.min(15, player.nexusHealth) + Math.min(12, player.stats.spellsCast + player.stats.alliesSummoned) + efficiency,
  ));
  const grade = score >= 85 ? "S" : score >= 70 ? "A" : score >= 50 ? "B" : "C";
  const highlights: string[] = [];
  if (player.stats.nexusDamageDealt >= 20) highlights.push("Pressão máxima");
  if (player.nexusHealth >= 15) highlights.push("Nexus preservado");
  if (player.stats.spellsCast >= 6) highlights.push("Mestre da pilha");
  if (player.stats.alliesSummoned >= 8) highlights.push("Comandante de campo");
  if (state.round <= 10) highlights.push("Vitória veloz");
  if (!highlights.length) highlights.push(victory ? "Batalha consistente" : "Experiência conquistada");
  return { score, grade, title: grade === "S" ? "Domínio do Nexus" : grade === "A" ? "Execução superior" : grade === "B" ? "Plano consistente" : "Aprendizado de batalha", highlights: highlights.slice(0, 3) };
}
