export type TargetingMode = "spell" | "reaction" | "sentinela" | "challenge" | "block";

const COPY: Record<TargetingMode, { icon: string; kicker: string; title: string; detail: string }> = {
  spell: { icon: "✦", kicker: "ALVO DE FEITIÇO", title: "Escolha o alvo destacado", detail: "Alvos válidos brilham em dourado." },
  reaction: { icon: "↯", kicker: "RESPOSTA NA PILHA", title: "Escolha um alvo para responder", detail: "A resposta será colocada no topo da pilha." },
  sentinela: { icon: "◆", kicker: "HABILIDADE DE SENTINELA", title: "Defina o alvo da habilidade", detail: "Confira lealdade e validade antes de confirmar." },
  challenge: { icon: "⚔", kicker: "DESAFIO", title: "Force um rival a bloquear", detail: "Selecione uma unidade inimiga destacada." },
  block: { icon: "🛡", kicker: "BLOQUEIO", title: "Vincule o bloqueador a um atacante", detail: "Escolha uma linha de combate disponível." },
};

export function TargetingHud({ mode, onCancel }: { mode: TargetingMode | null; onCancel: () => void }) {
  if (!mode) return null;
  const copy = COPY[mode];
  return (
    <aside className="targeting-hud" data-targeting-mode={mode} role="status" aria-live="polite">
      <span className="targeting-hud-icon">{copy.icon}</span>
      <div><small>{copy.kicker}</small><b>{copy.title}</b><p>{copy.detail}</p></div>
      <button onClick={onCancel} className="btn-ghost" aria-label="Cancelar seleção">Esc · Cancelar</button>
    </aside>
  );
}
