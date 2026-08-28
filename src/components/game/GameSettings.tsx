"use client";

export type FxMode = "full" | "reduced";
export type UiScale = "comfortable" | "compact";
export type CombatPace = "cinematic" | "quick";

export function GameSettings({ open, soundOn, musicOn, volume, fxMode, uiScale, combatPace, performanceTier, onClose, onSound, onMusic, onVolume, onFxMode, onUiScale, onCombatPace }: {
  open: boolean;
  soundOn: boolean;
  musicOn: boolean;
  volume: number;
  fxMode: FxMode;
  uiScale: UiScale;
  combatPace: CombatPace;
  performanceTier?: "normal" | "constrained";
  onClose: () => void;
  onSound: (value: boolean) => void;
  onMusic: (value: boolean) => void;
  onVolume: (value: number) => void;
  onFxMode: (value: FxMode) => void;
  onUiScale: (value: UiScale) => void;
  onCombatPace: (value: CombatPace) => void;
}) {
  if (!open) return null;
  return (
    <div className="game-settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="game-settings" role="dialog" aria-modal="true" aria-labelledby="game-settings-title">
        <header><div><small>PREFERÊNCIAS LOCAIS</small><h2 id="game-settings-title">Experiência da partida</h2></div><button onClick={onClose} aria-label="Fechar configurações">×</button></header>
        <label className="settings-switch"><span><b>Efeitos sonoros</b><small>Ações, dano e resultado</small></span><input type="checkbox" checked={soundOn} onChange={(event) => onSound(event.target.checked)} /></label>
        <label className="settings-switch"><span><b>Ambiência adaptativa</b><small>Tom discreto conforme a fase</small></span><input type="checkbox" checked={musicOn} onChange={(event) => onMusic(event.target.checked)} /></label>
        <label className="settings-range"><span><b>Volume geral</b><output>{Math.round(volume * 100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => onVolume(Number(event.target.value))} /></label>
        <fieldset><legend>Intensidade visual</legend><button className={fxMode === "full" ? "active" : ""} onClick={() => onFxMode("full")}>Completa</button><button className={fxMode === "reduced" ? "active" : ""} onClick={() => onFxMode("reduced")}>Reduzida</button></fieldset>
        <fieldset><legend>Densidade da interface</legend><button className={uiScale === "comfortable" ? "active" : ""} onClick={() => onUiScale("comfortable")}>Confortável</button><button className={uiScale === "compact" ? "active" : ""} onClick={() => onUiScale("compact")}>Compacta</button></fieldset>
        <fieldset><legend>Ritmo da batalha</legend><button className={combatPace === "cinematic" ? "active" : ""} onClick={() => onCombatPace("cinematic")}>Cinemático</button><button className={combatPace === "quick" ? "active" : ""} onClick={() => onCombatPace("quick")}>Ágil</button></fieldset>
        <p className="settings-note">As preferências ficam salvas neste dispositivo. Proteção de desempenho: {performanceTier === "constrained" ? "ambientes simplificados" : "qualidade completa"}.</p>
      </section>
    </div>
  );
}
