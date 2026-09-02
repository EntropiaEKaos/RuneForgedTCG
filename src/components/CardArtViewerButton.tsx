"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function safeArtUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^\/(?!\/)/.test(value) || /^https:\/\//i.test(value)) return value;
  return null;
}

function cssBackgroundUrl(value: string): string {
  return `url(${JSON.stringify(value)})`;
}

export default function CardArtViewerButton({ defId, name, artUrl, onOpen }: {
  defId: string;
  name: string;
  artUrl?: string | null;
  onOpen: () => void;
}) {
  const resolvedArt = safeArtUrl(artUrl);
  if (!resolvedArt) return null;

  return (
    <button
      type="button"
      data-card-art-viewer-trigger={defId}
      aria-label={`Ver arte ampliada de ${name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100 shadow-lg shadow-black/20 transition hover:border-amber-200/55 hover:bg-amber-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
    >
      <span aria-hidden="true">◈</span>
      Ver arte
    </button>
  );
}

export function CardArtViewerDialog({ defId, name, artUrl, open, onClose }: {
  defId: string;
  name: string;
  artUrl?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const resolvedArt = safeArtUrl(artUrl);

  useEffect(() => {
    if (!open || !resolvedArt) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open, resolvedArt]);

  if (!open || !resolvedArt || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-card-art-viewer={defId}
      role="dialog"
      aria-modal="true"
      aria-label={`Arte ampliada de ${name}`}
      className="fixed inset-0 z-[160] grid place-items-center bg-black/90 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="flex max-h-[94vh] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-amber-200/20 bg-slate-950/95 shadow-2xl shadow-black/70">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">Arte da carta</p>
            <h2 className="truncate text-sm font-black text-white sm:text-base">{name}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            data-card-art-viewer-close={defId}
            aria-label="Fechar arte ampliada"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-lg font-black text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 place-items-center overflow-auto bg-black/70 p-3 sm:p-5">
          <div
            data-card-art-viewer-image={defId}
            aria-label={`Ilustração de ${name}`}
            className="h-[72vh] min-h-[360px] w-[min(86vw,760px)] max-w-full rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60"
            style={{
              backgroundImage: cssBackgroundUrl(resolvedArt),
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "contain",
            }}
          />
        </div>

        <p className="border-t border-white/10 px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Arte ampliada · ESC ou clique fora para fechar
        </p>
      </div>
    </div>,
    document.body,
  );
}
