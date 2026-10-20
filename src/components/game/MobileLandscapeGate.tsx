"use client";

/**
 * The legacy 1v1 arena remains mounted while the device is upright.
 * This overlay only blocks interaction on narrow portrait viewports;
 * rotating back to landscape resumes the same match state.
 */
export function MobileLandscapeGate() {
  return (
    <div
      className="forged-mobile-landscape-gate"
      role="dialog"
      aria-modal="true"
      aria-label="Gire seu dispositivo para jogar FORGED"
    >
      <div className="forged-mobile-landscape-gate__content">
        <span className="forged-mobile-landscape-gate__icon" aria-hidden="true">↻</span>
        <strong>FORGED</strong>
        <h2>Gire seu dispositivo</h2>
        <p>Para jogar, coloque seu celular na horizontal. Sua partida continuará de onde parou.</p>
      </div>
    </div>
  );
}
