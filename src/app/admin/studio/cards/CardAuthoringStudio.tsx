"use client";
import Link from "next/link";
import { StudioCommandPalette, StudioBreadcrumb } from "../StudioChrome";
import { useCardAuthoringModel } from "./useCardAuthoringModel";
import { CardCatalogSidebar, CardStudioHeader, CardWorkspaceHeader, Panel, Preview } from "./CardAuthoringFields";
import CardIdentityTab from "./CardIdentityTab";
import CardClassificationTab from "./CardClassificationTab";
import CardRulesTab from "./CardRulesTab";
import CardReleaseTab from "./CardReleaseTab";
import CardQaStudio from "./CardQaStudio";
import { hasStudioUiCapability } from "@/lib/admin-studio-access";

export default function CardAuthoringStudio({ role }: { role: string }) {
const model = useCardAuthoringModel();
const {
  auth, rows, card, cm, id, tab, setTab, msg, busy, val, edit, reset, save, sandbox, impact, balance,
  validate, pipe, status, powerBudget, collectionIdentity, collectionForDefId, progress,
} = model;
  const canUseProductionActions = hasStudioUiCapability(role, "production");
  const canUseBalanceLab = hasStudioUiCapability(role, "balance");
  if (!auth)
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070c] text-white">
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-10 text-center shadow-2xl">
          <div className="text-4xl">🃏</div>
          <h1 className="mt-3 text-2xl font-black">Card Authoring Studio</h1>
          <Link href="/admin/studio" className="btn-primary mt-5 inline-flex">
            Control Room
          </Link>
        </div>
      </div>
    );
  const tabs = [
    ["identity", "Identity", "01"],
    ["classification", "Combat", "02"],
    ["rules", "Rules", "03"],
    ["tests", "QA Tests", "04"],
    ["collection", "Release", "05"],
    ["preview", "Preview", "06"],
  ];
  return (
    <div className="studio-shell min-h-screen">
      <StudioCommandPalette role={role} />
      {canUseProductionActions ? <CardStudioHeader /> : <DesignerCardStudioHeader />}
      <div className="studio-layout">
        <CardCatalogSidebar rows={rows} id={id} reset={reset} edit={edit} collectionForDefId={collectionForDefId} />
        <main className="studio-main">
          <StudioBreadcrumb section="Authoring" current="Card Studio" />
          <CardWorkspaceHeader
            card={card} powerBudget={powerBudget} status={status} collectionIdentity={collectionIdentity}
            progress={progress} tabs={tabs} tab={tab} setTab={setTab}
          />
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" /> Changes
              stay in Draft until QA/Publish.
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={validate} disabled={!id}>
                ✓ Validate
              </button>
              {canUseProductionActions && <>
                <button className="btn-ghost" onClick={() => pipe("qa")} disabled={!id || busy}>
                  QA
                </button>
                <button
                  className="btn-primary"
                  onClick={() => pipe("publish")}
                  disabled={!id || busy || val?.ok === false}
                >
                  Publish
                </button>
              </>}
            </div>
          </div>
          {msg && (
            <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.07] p-4 text-xs text-amber-100">
              {msg}
            </div>
          )}
          {tab === "identity" && <CardIdentityTab model={model} />}
          {tab === "classification" && <CardClassificationTab model={model} />}
          {tab === "rules" && <CardRulesTab model={model} />}
          {tab === "tests" && <CardQaStudio model={model} />}
          {tab === "collection" && <CardReleaseTab model={model} />}
          {tab === "preview" && (
            <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
              <div>
                <Preview card={card} status={status} collection={collectionIdentity} large />
              </div>
              <Panel title="Production Snapshot" eyebrow="DEBUG / REVIEW">
                <pre className="max-h-[620px] overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-[11px] leading-5 text-slate-400">
                  {JSON.stringify({ card, metadata: cm, validation: val }, null, 2)}
                </pre>
              </Panel>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.025] p-3">
            <div className="text-[10px] text-slate-500">Engine-safe · Draft-first · Versioned on publish</div>
              <button className="btn-secondary" disabled={busy} onClick={sandbox}>🎮 Testar no jogo</button>
              <button className="btn-secondary" disabled={busy} onClick={()=>void impact()}>🔎 Impacto</button>
              {canUseBalanceLab && <button className="btn-secondary" disabled={busy} onClick={()=>void balance()}>⚖️ Balance Lab</button>}
            <button className="btn-primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save Card + Metadata"}
            </button>
          </div>
          {val && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <div className="font-black">{val.ok ? "✓ Validation passed" : "✕ Validation blocked"}</div>
              {(val.checks || []).map((c: any) => (
                <div key={c.key} className="mt-2 text-xs text-slate-400">
                  {c.passed ? "✓" : "✕"} {c.label}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DesignerCardStudioHeader() {
  return (
    <header className="studio-topbar">
      <div className="studio-topbar-inner flex items-center justify-between gap-4">
        <div className="studio-brand">
          <div className="studio-brand-mark">🃏</div>
          <div>
            <div className="studio-kicker">RUNEFORGE // CONTENT ENGINEERING</div>
            <div className="studio-title">Card Authoring Studio <span className="text-amber-300">4.2.1</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300 md:inline">● ENGINE CONNECTED</span>
          <Link href="/admin/studio" className="btn-ghost text-xs">Control Room</Link>
        </div>
      </div>
    </header>
  );
}
