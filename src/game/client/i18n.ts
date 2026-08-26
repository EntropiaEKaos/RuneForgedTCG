export const ptBR = {
  liveMatch: "Partida ao vivo",
  round: "Rodada",
  enemyField: "Campo rival",
  playerField: "Seu campo",
  endTurn: "Encerrar turno",
  confirmBlocks: "Confirmar bloqueios",
  waitingOpponent: "Aguardando o adversário…",
  battleLog: "Registro da batalha",
  playerHand: "Sua mão",
} as const;

export type ClientMessage = keyof typeof ptBR;
export function t(message: ClientMessage): string { return ptBR[message]; }
