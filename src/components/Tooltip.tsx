"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent as ReactMouseEvent, ReactNode, TouchEvent as ReactTouchEvent } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  panelWidth?: number;
  panelHeightEstimate?: number;
}

const LONG_PRESS_MS = 320;
const MOVE_CANCEL_PX = 12;
const VIEWPORT_GUTTER = 12;
const HOVER_CLOSE_MS = 100;

export default function Tooltip({ content, children, disabled, panelWidth = 280, panelHeightEstimate = 260 }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [touchPinned, setTouchPinned] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClick = useRef(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearCloseTimer();
    setPos(null);
    setTouchPinned(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    if (touchPinned) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setPos(null), HOVER_CLOSE_MS);
  }, [clearCloseTimer, touchPinned]);

  useEffect(() => {
    if (!touchPinned) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-tooltip-panel="true"]')) return;
      if (rootRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, touchPinned]);

  useEffect(() => () => {
    clearPressTimer();
    clearCloseTimer();
  }, [clearCloseTimer, clearPressTimer]);

  if (disabled) return <>{children}</>;

  const handleTouchStart = (event: ReactTouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    const { clientX, clientY } = touch;
    touchOrigin.current = { x: clientX, y: clientY };
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      setPos({ x: clientX, y: clientY });
      setTouchPinned(true);
      suppressNextClick.current = true;
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (event: ReactTouchEvent) => {
    if (touchPinned) return;
    const touch = event.touches[0];
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
    if (!touchPinned) setPos(null);
  };

  const handleClickCapture = (event: ReactMouseEvent) => {
    if (suppressNextClick.current) {
      event.preventDefault();
      event.stopPropagation();
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
    return { left, top, width, maxHeight: window.innerHeight - VIEWPORT_GUTTER * 2 };
  };

  return (
    <span
      ref={rootRef}
      className="inline-block"
      onMouseMove={(event) => { if (!touchPinned) setPos({ x: event.clientX, y: event.clientY }); }}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={endTouch}
      onClickCapture={handleClickCapture}
    >
      {children}
      {pos && typeof window !== "undefined" && createPortal(
        <div
          data-tooltip-panel="true"
          className="fixed z-[100] overflow-y-auto overscroll-contain"
          style={positionStyle()}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
}
