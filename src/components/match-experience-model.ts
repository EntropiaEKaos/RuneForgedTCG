import type { UnitInstance } from "@/game/types";

export type MatchPhase = "opponent" | "main" | "combat" | "response" | "gameover";

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
