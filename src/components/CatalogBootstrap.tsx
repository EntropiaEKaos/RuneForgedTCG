"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { replaceRegisteredCustomCards } from "@/game/custom-registry";
import { replaceRegisteredCardCollections } from "@/game/card-collections";
import { replaceRegisteredCardArt } from "@/game/card-art";
import { hydrateClientGameConfig } from "@/game/settings";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { CatalogRevisionContext } from "./CatalogContext";
import { ensurePlayerSession } from "@/lib/client-player-session";

interface PromoItem {
  key: string;
  name: string;
  description: string;
  type: string;
  kind: "event" | "promotion";
  endsAt: string | null;
}

function timeLeft(endsAt: string | null): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return `${Math.floor(hours / 24)}d restantes`;
  if (hours >= 1) return `${hours}h restantes`;
  return `${Math.max(1, Math.floor(ms / 60_000))}min restantes`;
}

/**
 * Loads custom cards + game banners from /api/catalog into the browser registry
 * so client-side getCard()/CardView can resolve admin-created cards.
 */
export default function CatalogBootstrap({ children }: { children: React.ReactNode }) {
  const [announcement, setAnnouncement] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);

  useDeferredEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").catch(() => null);
    const saved = localStorage.getItem("runeforge_colorblind_mode") === "1";
    setColorblindMode(saved);
    document.documentElement.classList.toggle("colorblind-mode", saved);
  }, []);

  const toggleColorblindMode = () => {
    setColorblindMode((prev) => {
      const next = !prev;
      localStorage.setItem("runeforge_colorblind_mode", next ? "1" : "0");
      document.documentElement.classList.toggle("colorblind-mode", next);
      return next;
    });
  };

  const lastCatalogRevision = useRef<string>("");
  const refreshCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      const data = await response.json();
      if (!data.ok) return;
      const revision = String(data.catalogRevision || "empty");
      if (revision !== lastCatalogRevision.current) {
        if (Array.isArray(data.custom)) replaceRegisteredCustomCards(data.custom);
        if (Array.isArray(data.cardCollections)) replaceRegisteredCardCollections(data.cardCollections);
        if (Array.isArray(data.cardArt)) replaceRegisteredCardArt(data.cardArt);
        lastCatalogRevision.current = revision;
        setCatalogRevision((current) => current + 1);
      }
      if (data.config && typeof data.config === "object") await hydrateClientGameConfig(data.config);
      if (data.presentation?.defaultBoard) document.documentElement.dataset.boardTheme = String(data.presentation.defaultBoard);
      const tokens = data.visualTheme?.tokens;
      if (tokens && typeof tokens === "object") {
        const tokenMap: Record<string, string> = { accent: "--rf-gold", danger: "--rf-danger", success: "--rf-success" };
        for (const [key, cssVar] of Object.entries(tokenMap)) {
          const value = (tokens as Record<string, unknown>)[key];
          if (typeof value === "string" && /^(#[0-9a-f]{3,8}|rgb[a]?\(|hsl[a]?\()/i.test(value.trim())) document.documentElement.style.setProperty(cssVar, value.trim());
        }
      }
      if (data.localization?.defaultLocale) document.documentElement.lang = String(data.localization.defaultLocale);
      if (data.localization?.fallbackLocale) document.documentElement.dataset.fallbackLocale = String(data.localization.fallbackLocale);
      setAnnouncement(data.config?.announcement || "");
      setMaintenance(Boolean(data.config?.maintenanceMode));
    } catch {}
  }, []);

  useEffect(() => {
    void refreshCatalog();
    const catalogTimer = window.setInterval(() => void refreshCatalog(), 15_000);
    fetch("/api/active-promotions")
      .then((r) => r.json())
      .then((data) => { if (data.ok && Array.isArray(data.items)) setPromos(data.items); })
      .catch(() => {});
    return () => window.clearInterval(catalogTimer);
  }, [refreshCatalog]);

  // Alterna entre vários eventos/promoções ativos ao mesmo tempo, se houver mais de um.
  useEffect(() => {
    if (promos.length < 2) return;
    const id = setInterval(() => setPromoIndex((i) => (i + 1) % promos.length), 6000);
    return () => clearInterval(id);
  }, [promos.length]);

  const activePromo = promos[promoIndex];

  return (
    <CatalogRevisionContext.Provider value={catalogRevision}>
      {maintenance && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white">
          🚧 Manutenção ativa — novas ações de gameplay e economia estão bloqueadas temporariamente.
        </div>
      )}
      {announcement && !maintenance && (
        <div className="bg-amber-500/90 px-4 py-2 text-center text-sm font-semibold text-slate-950">
          📢 {announcement}
        </div>
      )}
      {activePromo && !maintenance && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600/90 via-purple-600/90 to-indigo-600/90 px-4 py-2 text-center text-sm font-semibold text-white">
          <span>{activePromo.kind === "event" ? "🎉" : "🛍️"}</span>
          <span>
            {activePromo.name}
            {activePromo.description ? ` — ${activePromo.description}` : ""}
          </span>
          {timeLeft(activePromo.endsAt) && (
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">{timeLeft(activePromo.endsAt)}</span>
          )}
        </div>
      )}
      {children}
      <button
        type="button"
        onClick={toggleColorblindMode}
        title="Alternar modo de acessibilidade a cores — destaca o símbolo de cada região em vez de depender só da cor"
        aria-pressed={colorblindMode}
        className={`fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border text-lg shadow-lg transition ${
          colorblindMode
            ? "border-amber-300 bg-amber-400 text-slate-950"
            : "border-white/20 bg-slate-900/80 text-white/80 hover:bg-slate-800"
        }`}
      >
        👁️
      </button>
    </CatalogRevisionContext.Provider>
  );
}
