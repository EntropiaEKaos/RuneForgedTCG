"use client";
import Link from "next/link";
import RuleBuilder from "./RuleBuilder";
import { defaults, resources, type Resource, type Row, type StudioResource } from "./SuperAdminModel";
import { hasStudioUiCapability } from "@/lib/admin-studio-access";

const text = (value: unknown) => value == null ? "" : typeof value === "string" || typeof value === "number" ? String(value) : "";

export function Overview({ onTab, visibleResources }: { onTab: (resource: Resource) => void; visibleResources: StudioResource[] }) {
  const cards = visibleResources.filter((item) => item.id !== "overview");
  const hasLiveOps = visibleResources.some((item) => item.capability === "liveops");
  const hasPlayerOps = visibleResources.some((item) => item.capability === "players");
  return <div>
    <section className="studio-hero mb-6">
      <p className="studio-kicker">Operations / Content Command Center</p>
      <h2>One control plane for the work you own.</h2>
      <p>{hasLiveOps || hasPlayerOps ? "Build cards, define content primitives, wire interactions, identify collections and operate the authorized game surfaces without touching gameplay data directly." : "Build cards, define content primitives, wire interactions and identify collections while QA, publishing and live operations remain on their dedicated role surfaces."}</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="studio-pill live">● Engine authoritative</span><span className="studio-pill">Content pipeline online</span><span className="studio-command">Quick actions <kbd>⌘K</kbd></span></div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map((item) => <button key={item.id} onClick={() => onTab(item.id)} className="studio-section p-5 text-left transition hover:-translate-y-0.5 hover:border-amber-400/30"><div className="text-2xl">{item.icon}</div><div className="mt-3 font-black">{item.label}</div><div className="mt-1 text-xs text-slate-500">Open workspace →</div></button>)}</div>
    <div className="mt-8 grid gap-4 lg:grid-cols-3">
      <ArchitectureCard title="Content Graph" body="Card → Collection → Race/Class → Keyword → Effect → Interaction. Every content primitive has a stable key." />
      {hasLiveOps && <ArchitectureCard title="Live Ops" body="Events and promotions are time-bounded objects with rules, rewards, offers and metadata." />}
      {hasPlayerOps && <ArchitectureCard title="Player Ops" body="Moderate profiles, cosmetics, economy balances and ranked values through a restricted admin surface." />}
      {!hasLiveOps && !hasPlayerOps && <ArchitectureCard title="Four-eyes delivery" body="Authoring remains draft-first. QA certification and publishing stay outside the designer surface and retain independent authority." />}
    </div>
  </div>;
}

function ArchitectureCard({ title, body }: { title: string; body: string }) { return <div className="studio-section p-5"><div className="font-black text-amber-200">{title}</div><p className="mt-2 text-xs leading-5 text-slate-400">{body}</p></div>; }

export function CardStudioLink({ role }: { role?: string | null }) {
  const canProduction = hasStudioUiCapability(role, "production");
  const canLiveOps = hasStudioUiCapability(role, "liveops");
  const canOperations = hasStudioUiCapability(role, "operations");
  return <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-8"><div className="text-4xl">🃏</div><h2 className="mt-3 text-3xl font-black">Card Studio</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">The full card creator remains the canonical editor for CardDef. Use it for stats, spells, triggers, equipment, level-up and Sentinela definitions. This studio owns the content graph around those cards.</p><Link href="/admin/studio/cards" className="btn-primary mt-5 inline-flex">Open Card Studio</Link>{canProduction && <Link href="/admin/studio/production" className="btn-ghost mt-5 ml-2 inline-flex">Production</Link>}{canLiveOps && <Link href="/admin/studio/ops" className="btn-ghost mt-5 ml-2 inline-flex">Live Ops + Analytics</Link>}{canOperations && <Link href="/admin/studio/4" className="btn-primary mt-5 ml-2 inline-flex">Content Studio 4.0</Link>}</div>;
}
export function MechanicsStudioLink() { return <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[.05] p-8"><div className="text-4xl">⚙️</div><h2 className="mt-3 text-3xl font-black">Mechanics Studio 1.0</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">Compose safe custom keywords, reusable effect macros and semantic card types/archetypes from audited engine primitives.</p><Link href="/admin/studio/mechanics" className="btn-primary mt-5 inline-flex">Open Mechanics Studio</Link></div>; }

export function ResourceStudio(props: { tab: Resource; rows: Row[]; editing: Row | null; setEditing: (row: Row | null) => void; search: string; setSearch: (value: string) => void; save: () => void; remove: (row: Row) => void; busy: boolean; canDelete: boolean }) {
  const { tab, rows, editing, setEditing, search, setSearch, save, remove, busy, canDelete } = props;
  const title = resources.find((item) => item.id === tab)?.label || tab;
  return <div><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-slate-500">Studio</p><h2 className="text-3xl font-black">{title}</h2></div><div className="flex gap-2"><input className="input !w-56" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" /><button className="btn-primary" onClick={() => setEditing({ ...(defaults[tab] || {}) })}>+ New</button></div></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_430px]"><div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40"><div className="border-b border-white/10 px-4 py-3 text-xs font-bold text-slate-400">{rows.length} records</div><div className="divide-y divide-white/5">{rows.map((row) => <div key={String(row.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[.025]"><div className="min-w-0"><div className="truncate text-sm font-bold">{text(row.name || row.key || row.defId || `#${row.id}`)}</div><div className="truncate text-[10px] text-slate-500">{text(row.key || row.defId || row.status || row.releaseState)}</div></div><div className="flex gap-1"><button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => setEditing({ ...row })}>Edit</button>{canDelete && tab !== "players" && <button className="btn-ghost !px-2 !py-1 text-[10px] text-red-300" onClick={() => remove(row)}>Delete</button>}</div></div>)}{!rows.length && <div className="p-8 text-center text-xs text-slate-500">No records yet.</div>}</div></div><Editor tab={tab} value={editing} setValue={setEditing} save={save} busy={busy} /></div>
  </div>;
}

function Editor({ tab, value, setValue, save, busy }: { tab: Resource; value: Row | null; setValue: (row: Row | null) => void; save: () => void; busy: boolean }) {
  if (!value) return <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Select a record or create a new one.</div>;
  const set = (key: string, next: unknown) => setValue({ ...value, [key]: next });
  const json = (key: string) => JSON.stringify(value[key] ?? {}, null, 2);
  const setJson = (key: string, source: string) => { try { set(key, JSON.parse(source)); } catch {} };
  const field = (key: string, label: string, wide = false) => <label className={wide ? "block mt-3" : "block"}><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span><input className="input" value={text(value[key])} onChange={(event) => set(key, event.target.value)} /></label>;
  const jsonField = (key: string, label: string) => <label className="block mt-3"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label} (JSON)</span><textarea className="input min-h-[130px] font-mono text-[11px]" value={json(key)} onChange={(event) => setJson(key, event.target.value)} /></label>;
  return <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"><div className="flex items-center justify-between"><div className="font-black">{value.id ? "Edit record" : "Create record"}</div><button className="text-xs text-slate-500" onClick={() => setValue(null)}>×</button></div>
    {tab === "keywords" && <>{field("key", "Key")}{field("name", "Display name")}{field("icon", "Icon")}{field("engineKeyword", "Engine mapping")}{field("description", "Description", true)}{jsonField("behavior", "Behavior / runtime contract")}</>}
    {tab === "effects" && <>{field("key", "Key")}{field("name", "Display name")}{field("kind", "Engine effect kind")}{field("description", "Description", true)}{jsonField("schema", "Parameter schema")}</>}
    {(tab === "races" || tab === "classes") && <>{field("key", "Key")}{field("name", "Display name")}{field("icon", "Icon")}{field("color", "Color")}{tab === "races" && field("region", "Region")}{field("description", "Description", true)}</>}
    {tab === "interactions" && <><div className="mb-4">{field("name", "Rule name")}</div><RuleBuilder value={value} setValue={setValue} /><div className="mt-4 grid gap-3 sm:grid-cols-2">{field("priority", "Priority")}{field("enabled", "Enabled")}</div></>}
    {tab === "collections" && <>{field("key", "Key")}{field("name", "Name")}{field("code", "Collection code")}{field("symbol", "Symbol")}{field("banner", "Banner URL")}{field("status", "Status")}{field("releaseDate", "Release date")}{field("rotationDate", "Rotation date")}{field("description", "Description", true)}{jsonField("metadata", "Metadata")}</>}
    {tab === "card-meta" && <>{field("defId", "Card defId")}{field("collectionId", "Collection ID")}{field("releaseState", "Release state")}{field("notes", "Notes", true)}{jsonField("tags", "Tags")}{jsonField("classKeys", "Class keys")}{jsonField("raceKeys", "Race keys")}</>}
    {tab === "events" && <>{field("key", "Key")}{field("name", "Name")}{field("type", "Type")}{field("status", "Status")}{field("startsAt", "Starts at")}{field("endsAt", "Ends at")}{field("description", "Description", true)}{jsonField("rules", "Rules")}{jsonField("rewards", "Rewards")}{jsonField("metadata", "Metadata")}</>}
    {tab === "promotions" && <>{field("key", "Key")}{field("name", "Name")}{field("type", "Type")}{field("status", "Status")}{field("startsAt", "Starts at")}{field("endsAt", "Ends at")}{field("description", "Description", true)}{jsonField("conditions", "Conditions")}{jsonField("offers", "Offers")}{jsonField("metadata", "Metadata")}</>}
    {tab === "players" && <><div className="grid gap-3 sm:grid-cols-2">{field("name", "Name")}{field("status", "Status")}{field("avatar", "Avatar")}{field("cardBack", "Card back")}{field("title", "Title")}{field("banner", "Banner")}{field("gold", "Gold")}{field("dust", "Dust")}{field("xp", "XP")}{field("level", "Level")}{field("mmr", "MMR")}{field("peakMmr", "Peak MMR")}</div>{field("bio", "Bio", true)}{field("moderatorNote", "Moderator note", true)}{jsonField("badges", "Badges")}</>}
    <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setValue(null)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button></div>
  </div>;
}
