"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  panelWidth?: number;
  panelHeightEstimate?: number;
}

// Tempo de toque-e-segure antes de considerar "quero inspecionar a carta"
// em vez de "quero jogar/selecionar a carta". Sem isso, o tooltip nunca
// aparecia em telas de toque — só havia onMouseMove/onMouseLeave.
const LONG_PRESS_MS = 320;
// Distância (px) que o dedo pode se mover antes de cancelarmos o preview —
// evita abrir a inspeção durante um scroll/arraste.
const MOVE_CANCEL_PX = 12;
const VIEWPORT_GUTTER = 12;

export default function Tooltip({ content, children, disabled, panelWidth = 280, panelHeightEstimate = 260 }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClick = useRef(false);

  if (disabled) return <>{children}</>;

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const { clientX, clientY } = touch;
    touchOrigin.current = { x: clientX, y: clientY };
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      setPos({ x: clientX, y: clientY });
      // Um press-and-hold é para inspecionar, não para jogar a carta — o
      // clique sintético que o navegador dispara depois do touchend deve
      // ser ignorado desta vez, para não também jogar/selecionar a carta.
      suppressNextClick.current = true;
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const origin = touchOrigin.current;
    if (!touch || !origin) return;
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearPressTimer();
      setPos(null);
    }
  };

  const endTouch = () => {
    clearPressTimer();
    touchOrigin.current = null;
    if (pos) setPos(null);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (suppressNextClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressNextClick.current = false;
    }
  };

  const positionStyle = () => {
    if (!pos || typeof window === "undefined") return undefined;
    const width = Math.min(panelWidth, window.innerWidth - VIEWPORT_GUTTER * 2);
    const rightSideLeft = pos.x + 16;
    const left = rightSideLeft + width <= window.innerWidth - VIEWPORT_GUTTER
      ? rightSideLeft
      : Math.max(VIEWPORT_GUTTER, pos.x - width - 16);
    const height = Math.min(panelHeightEstimate, window.innerHeight - VIEWPORT_GUTTER * 2);
    const top = Math.max(VIEWPORT_GUTTER, Math.min(pos.y + 16, window.innerHeight - height - VIEWPORT_GUTTER));
    return { left, top, maxWidth: width, maxHeight: window.innerHeight - VIEWPORT_GUTTER * 2 };
  };

  return (
    <span
      className="inline-block"
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={endTouch}
      onClickCapture={handleClickCapture}
    >
      {children}
      {pos &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            data-tooltip-panel="true"
            className="pointer-events-none fixed z-[100] overflow-hidden"
            style={positionStyle()}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
