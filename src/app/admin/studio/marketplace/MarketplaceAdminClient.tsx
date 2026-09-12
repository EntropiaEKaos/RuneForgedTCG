"use client";

import { useCallback, useEffect, useState } from "react";
import { StudioBreadcrumb } from "../StudioChrome";

type Settings = {
  enabled: boolean;
  feeBps: number;
  minPriceGold: number;
  maxPriceGold: number;
  maxActiveListings: number;
  listingDurationHours: number;
  tradeDurationHours: number;
  maxTradeCardsPerSide: number;
  minPlayerLevel: number;
  minAccountAgeHours: number;
};

type Stats = {
  listings?: { active?: number; sold?: number; grossGold?: number; sunkFees?: number };
  trades?: { active?: number; accepted?: number };
};

const fields: Array<{ key: keyof Settings; label: string; min: number; max: number }> = [
  { key: "feeBps", label: "Taxa (basis points; 500 = 5%)", min: 0, max: 5000 },
  { key: "minPriceGold", label: "Preço mínimo em Gold", min: 1, max: 1_000_000 },
  { key: "maxPriceGold", label: "Preço máximo em Gold", min: 1, max: 10_000_000 },
  { key: "maxActiveListings", label: "Máximo de anúncios ativos por jogador", min: 1, max: 200 },
  { key: "listingDurationHours", label: "Duração do anúncio (horas)", min: 1, max: 720 },
  { key: "tradeDurationHours", label: "Duração da troca direta (horas)", min: 1, max: 720 },
  { key: "maxTradeCardsPerSide", label: "Máximo de cartas por lado da troca", min: 1, max: 20 },
  { key: "minPlayerLevel", label: "Nível mínimo", min: 1, max: 1000 },
  { key: "minAccountAgeHours", label: "Idade mínima da conta (horas)", min: 0, max: 8760 },
];

export default function MarketplaceAdminClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/marketplace", { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao carregar marketplace");
    setSettings(data.settings);
    setStats(data.stats || {});
  }, []);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar marketplace"));
  }, [load]);

  async function save() {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...settings, currentPassword: password, currentTotp: totp || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Alteração recusada");
      setSettings(data.settings);
      setPassword("");
      setTotp("");
      setMessage("Configuração do marketplace atualizada e auditada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-workspace">
      <StudioBreadcrumb section="Economy" current="Marketplace" />
      <div className="studio-page-header">
        <div><p className="studio-kicker">P2P ECONOMY CONTROL</p><h1>Marketplace Control</h1><p>Controle o mercado de Gold, limites de escrow e trocas diretas. Alterações exigem step-up administrativo.</p></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="studio-card p-4"><small>ANÚNCIOS ATIVOS</small><strong className="block text-2xl">{stats.listings?.active ?? 0}</strong></div>
        <div className="studio-card p-4"><small>VENDAS</small><strong className="block text-2xl">{stats.listings?.sold ?? 0}</strong></div>
        <div className="studio-card p-4"><small>GOLD NEGOCIADO</small><strong className="block text-2xl">{stats.listings?.grossGold ?? 0}</strong></div>
        <div className="studio-card p-4"><small>GOLD REMOVIDO EM TAXAS</small><strong className="block text-2xl">{stats.listings?.sunkFees ?? 0}</strong></div>
      </div>

      {settings && <div className="studio-card mt-6 p-5">
        <label className="flex items-center gap-3"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /><b>Marketplace habilitado</b></label>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map((field) => <label key={field.key} className="block"><span className="mb-1 block text-sm opacity-70">{field.label}</span><input className="studio-input w-full" type="number" min={field.min} max={field.max} value={Number(settings[field.key])} onChange={(event) => setSettings({ ...settings, [field.key]: Math.trunc(Number(event.target.value)) })} /></label>)}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <label><span className="mb-1 block text-sm opacity-70">Senha atual (obrigatória)</span><input className="studio-input w-full" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label><span className="mb-1 block text-sm opacity-70">TOTP/MFA, se configurado</span><input className="studio-input w-full" inputMode="numeric" value={totp} onChange={(event) => setTotp(event.target.value)} /></label>
        </div>
        <button className="studio-button primary mt-5" disabled={busy || !password} onClick={() => void save()}>Salvar controles econômicos</button>
      </div>}

      <div className="studio-card mt-6 p-5">
        <h2 className="font-bold">Trocas diretas</h2>
        <p className="mt-1 opacity-70">Ativas: {stats.trades?.active ?? 0} · Aceitas: {stats.trades?.accepted ?? 0}</p>
      </div>
      {message && <div className="studio-card mt-4 p-4">{message}</div>}
    </div>
  );
}
