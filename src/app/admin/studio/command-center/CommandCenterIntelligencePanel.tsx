"use client";

type Signal = { id:string; label:string; value:number; unit:"percent"|"count"; status:"healthy"|"watch"|"critical"|"neutral"; detail:string };
type Trend = { id:string; label:string; current:number; previous:number; delta:number|null; direction:"up"|"down"|"flat"|"neutral"; unit:"count"|"currency" };
type FunnelStage = { id:string; label:string; value:number; stepConversion:number; overallConversion:number; dropOff:number };
export type CommandCenterIntelligenceData = { funnel:FunnelStage[]; largestDrop:{stageId:string;stageLabel:string;players:number;conversion:number}|null; signals:Signal[]; trends24h:Trend[] };

const statusClass: Record<Signal["status"], string> = {
  healthy:"border-emerald-300/20 bg-emerald-300/[.035] text-emerald-200",
  watch:"border-amber-300/20 bg-amber-300/[.035] text-amber-100",
  critical:"border-red-300/20 bg-red-300/[.035] text-red-200",
  neutral:"border-white/8 bg-white/[.02] text-slate-300",
};

function number(value:number) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits:1 }).format(value || 0); }
function currency(cents:number) { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format((cents || 0) / 100); }
function trendValue(trend:Trend, value:number) { return trend.unit === "currency" ? currency(value) : new Intl.NumberFormat("pt-BR").format(value || 0); }
function deltaLabel(delta:number|null) { if (delta == null) return "sem base anterior"; const sign = delta > 0 ? "+" : ""; return `${sign}${number(delta)}%`; }

export function CommandCenterIntelligencePanel({ intelligence }: { intelligence:CommandCenterIntelligenceData }) {
  return <section className="border border-amber-200/12 bg-[#080d14]/90">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 px-5 py-4">
      <div><p className="text-[8px] font-bold uppercase tracking-[.24em] text-amber-200/45">INTELLIGENCE 1.7 · SERVER PROJECTION</p><h2 className="mt-1 font-[var(--font-display)] text-lg font-bold text-[#eadfc7]">Saúde operacional e movimento do funil</h2></div>
      <span className="text-[9px] uppercase tracking-[.14em] text-slate-600">24h atuais × 24h anteriores · sem reconstrução no client</span>
    </div>
    <div className="grid gap-5 p-5 xl:grid-cols-[1.05fr_1.4fr]">
      <div className="space-y-4">
        <div className="border border-white/8 bg-black/20 p-4">
          <div className="text-[8px] font-black uppercase tracking-[.18em] text-slate-600">Maior vazamento absoluto</div>
          {intelligence.largestDrop ? <><div className="mt-2 font-[var(--font-display)] text-2xl font-black text-[#f1dfb5]">{intelligence.largestDrop.stageLabel}</div><div className="mt-1 text-xs text-slate-400">{new Intl.NumberFormat("pt-BR").format(intelligence.largestDrop.players)} jogadores não avançaram para esta etapa · conversão {number(intelligence.largestDrop.conversion)}%</div></> : <div className="mt-2 text-sm text-slate-500">Sem base suficiente para identificar abandono.</div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {intelligence.signals.map(signal => <div key={signal.id} className={`border p-4 ${statusClass[signal.status]}`}><div className="flex items-center justify-between gap-3"><span className="text-[8px] font-black uppercase tracking-[.16em] opacity-70">{signal.label}</span><span className="text-[8px] font-bold uppercase tracking-[.12em]">{signal.status}</span></div><div className="mt-2 font-[var(--font-display)] text-xl font-black">{signal.unit === "percent" ? `${number(signal.value)}%` : number(signal.value)}</div><p className="mt-2 text-[9px] leading-4 opacity-65">{signal.detail}</p></div>)}
        </div>
      </div>
      <div>
        <div className="grid gap-2">
          {intelligence.trends24h.map(trend => <div key={trend.id} className="grid gap-2 border border-white/8 bg-black/20 px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">{trend.label}</span><span className="text-xs font-bold text-slate-200">{trendValue(trend, trend.current)}</span><span className="text-[9px] text-slate-600">antes {trendValue(trend, trend.previous)}</span><span className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">{trend.direction === "up" ? "↑ " : trend.direction === "down" ? "↓ " : trend.direction === "flat" ? "→ " : "· "}{deltaLabel(trend.delta)}</span></div>)}
          {!intelligence.trends24h.length && <p className="text-xs text-slate-500">Comparativo temporal indisponível.</p>}
        </div>
        <p className="mt-3 text-[9px] leading-4 text-slate-600">Setas descrevem direção matemática, não julgamento. Aumento de uma métrica pode ser positivo, neutro ou exigir investigação dependendo do contexto operacional.</p>
      </div>
    </div>
  </section>;
}
