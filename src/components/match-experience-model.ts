import type { UnitInstance } from "@/game/types";

export type MatchPhase = "opponent" | "main" | "combat" | "response" | "gameover";

export const POST_MATCH_DESTINATIONS = [
  { href: "/profile", label: "Perfil e missões", description: "Veja nível, saldo, missões e conquistas." },
  { href: "/collection", label: "Coleção Vanilla", description: "Confira o que você possui e o que falta descobrir." },
  { href: "/forge", label: "Forjar deck", description: "Transforme sua coleção em uma nova estratégia." },
] as const;

export function postMatchProgressionMessage(rewardConfirmed: boolean, leveledUp = false): string {
  if (!rewardConfirmed) return "A batalha terminou. Escolha seu próximo passo no Nexus.";
  if (leveledUp) return "Recompensas confirmadas e novo nível alcançado. Continue sua progressão no Nexus.";
  return "Recompensas confirmadas no seu perfil. Use o ganho para evoluir sua próxima batalha.";
}

export function matchGuidance(phase: MatchPhase, selectedAttackers: number, pendingTarget: boolean): string {
  if (phase === "gameover") return "Partida concluída — revise os números e escolha o próximo desafio.";
  if (phase === "response") return "Prioridade aberta: responda com uma carta válida ou resolva a pilha.";
  if (pendingTarget) return "Selecione o alvo destacado para concluir a ação.";
  if (phase === "combat") return selectedAttackers > 0
    ? "Ataque preparado. Revise a pressão potencial e confirme."
    : "Defina bloqueadores e confirme antes que o combate resolva.";
  if (phase === "main") return "Sua prioridade: jogue uma carta, prepare atacantes ou encerre o turno.";
  return "O adversário está agindo. Observe mana, mesa e possíveis respostas.";
}

export function potentialAttackPressure(units: UnitInstance[], selectedIds: string[]): number {
  const selected = new Set(selectedIds);
  return units.filter((unit) => selected.has(unit.instanceId)).reduce((sum, unit) => sum + Math.max(0, unit.power), 0);
}
