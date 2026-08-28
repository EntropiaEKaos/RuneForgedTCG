import { useMemo, useState } from "react";
import type { CardCollectionIdentity } from "@/game/card-collections";
import { identityForRegions } from "@/game/region-identity";
import { estimateCardPower } from "@/game/balance-health";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

const FALLBACK_CLASSES = ["guardian", "mage", "assassin", "warrior", "ranger", "cleric", "arcane", "beastmaster"];
export const EMPTY: any = {
  defId: "",
  name: "",
  region: "Emberhold",
  regions: ["Emberhold"],
  regionalPerk: "convergence",
  type: "Unit",
  rarity: "Common",
  cost: 1,
  emoji: "🃏",
  description: "",
  collectible: true,
  power: 1,
  health: 1,
  classes: [],
  keywords: [],
};
export type Row = { id: number; defId: string; name: string; enabled: boolean; data: any };
export function useCardAuthoringModel() {
  const [auth, setAuth] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [cols, setCols] = useState<any[]>([]),
    [meta, setMeta] = useState<any[]>([]),
    [classRows, setClassRows] = useState<any[]>([]),
    [card, setCard] = useState<any>({ ...EMPTY }),
    [cm, setCm] = useState<any>({ collectionId: "", tags: [], releaseState: "draft", notes: "" }),
    [id, setId] = useState<number | null>(null),
    [tab, setTab] = useState("identity"),
    [tests, setTests] = useState<any[]>([]),
    [testBusy, setTestBusy] = useState(false),
    [testName, setTestName] = useState(""),
    [testResult, setTestResult] = useState<any>(null),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [val, setVal] = useState<any>(null),
    [mechanicsCatalog, setMechanicsCatalog] = useState<any>({ keywords: [], effects: [], archetypes: [] });
  const set = (k: string, v: any) => setCard((x: any) => ({ ...x, [k]: v }));
  const setPrimaryRegion = (region: string) => setCard((current: any) => ({
    ...current,
    region,
    regions: [region, ...(current.regions || [current.region]).filter((item: string) => item !== region)].slice(0, 3),
  }));
  const toggleAuthoredRegion = (region: string) => setCard((current: any) => {
    const regions = [...new Set(current.regions || [current.region])] as string[];
    if (region === current.region) return current;
    const next = regions.includes(region) ? regions.filter((item) => item !== region) : regions.length < 3 ? [...regions, region] : regions;
    return { ...current, regions: [current.region, ...next.filter((item) => item !== current.region)].slice(0, 3) };
  });
  const toggle = (k: string, key: string) =>
    setCard((x: any) => {
      const a = x[k] || [];
      return { ...x, [k]: a.includes(key) ? a.filter((z: string) => z !== key) : [...a, key] };
    });
  async function load() {
    const r = await Promise.all([
      fetch("/api/admin/studio/cards?limit=300", { credentials: "include" }),
      fetch("/api/admin/studio/collections?limit=300", { credentials: "include" }),
      fetch("/api/admin/studio/card-meta?limit=1000", { credentials: "include" }),
      fetch("/api/admin/studio/classes?limit=300", { credentials: "include" }),
      fetch("/api/admin/cards", { credentials: "include" }),
      fetch("/api/admin/studio/mechanics/catalog", { credentials: "include" }),
    ]);
    if (!r[4].ok) {
      setAuth(false);
      return;
    }
    const d = await Promise.all(r.slice(0, 4).map((x) => x.json()));
    const mechanics = r[5]?.ok ? await r[5].json() : { keywords: [], effects: [], archetypes: [] };
    const collectionRows = d[1].rows || [];
    setRows(d[0].rows || []);
    setCols(collectionRows);
    if (!id) {
      const vanilla = collectionRows.find((collection: any) => collection.key === "vanilla" || collection.code === "VAN");
      if (vanilla) setCm((current: any) => current.collectionId ? current : { ...current, collectionId: vanilla.id });
    }
    setMeta(d[2].rows || []);
    setClassRows(d[3].rows || []);
    setMechanicsCatalog(mechanics);
    setAuth(true);
  }
  useDeferredEffect(() => {
    load().catch(() => {});
  }, []);
  function edit(r: Row) {
    setId(r.id);
    setCard({ ...EMPTY, ...r.data, regions: r.data?.regions?.length ? r.data.regions : [r.data?.region || "Emberhold"], defId: r.defId });
    const m = meta.find((x) => x.defId === r.defId);
    setCm(
      m
        ? {
            collectionId: m.collectionId || "",
            tags: m.tags || [],
            releaseState: r.enabled ? "published" : m.releaseState || "draft",
            notes: m.notes || "",
          }
        : { collectionId: "", tags: [], releaseState: r.enabled ? "published" : "draft", notes: "" },
    );
    setVal(null);
    setTestResult(null);
    setTab("identity");
    loadTests(r.id).catch(() => {});
  }
  async function loadTests(cardId: number | null) {
    if (!cardId) {
      setTests([]);
      return;
    }
    const r = await fetch(`/api/admin/studio/card-tests?cardId=${cardId}`, { credentials: "include" });
    const d = await r.json();
    setTests(d.tests || []);
  }
  function reset() {
    const vanilla = cols.find((collection: any) => collection.key === "vanilla" || collection.code === "VAN");
    setId(null);
    setCard({ ...EMPTY });
    setCm({ collectionId: vanilla?.id || "", tags: [], releaseState: "draft", notes: "" });
    setVal(null);
    setTests([]);
    setTestResult(null);
    setMsg("");
  }
  function toggleCustomKeyword(item: any) {
    setCard((current: any) => {
      const customKeywords = [...(current.customKeywords || [])];
      const mechanics = [...(current.mechanics || [])].filter((m: any) => m.key !== item.key);
      if (customKeywords.includes(item.key)) return { ...current, customKeywords: customKeywords.filter((x: string) => x !== item.key), mechanics };
      const behavior = item.behavior;
      if (!behavior) return current;
      return { ...current, customKeywords: [...customKeywords, item.key], mechanics: [...mechanics, { key: item.key, name: item.name, trigger: behavior.trigger, condition: behavior.condition, effect: behavior.effect }] };
    });
  }
  function applyArchetypeItem(item: any) {
    if (!item) return setCard((c:any)=>({ ...c, archetypeKey: undefined, archetypeName: undefined }));
    setCard((c:any)=>({ ...c, type: item.baseType, archetypeKey: item.key, archetypeName: item.name, ...(item.definition?.defaults || {}) }));
  }
  async function save() {
    setBusy(true);
    try {
      const payload = { ...card, classes: card.classes || [], keywords: card.keywords || [] };
      const metadata = { collectionId: cm.collectionId ? Number(cm.collectionId) : null, tags: cm.tags, classKeys: payload.classes || [], raceKeys: payload.race ? [payload.race] : [], notes: cm.notes || null };
      const r = await fetch(id ? `/api/admin/cards/${id}` : "/api/admin/cards", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ card: payload, metadata }) });
      const d = await r.json(); if (!d.ok) throw Error(d.error || "Card save failed");
      const c = d.card; setCard(c); setId(c.dbId || id); setMsg("Saved atomically · CardDef and catalog metadata share one transaction."); await load(); if (c.dbId) await loadTests(c.dbId);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  }
  async function sandbox() {
    setBusy(true); try { const r=await fetch("/api/admin/studio/sandbox",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({card:{...card,classes:card.classes||[],keywords:card.keywords||[]},metadata:cm})}); const d=await r.json(); if(!d.ok) throw Error(d.error||"Sandbox failed"); window.open(`/play?sandbox=${encodeURIComponent(d.token)}`,"_blank","noopener,noreferrer"); setMsg("Sandbox created · unpublished snapshot opened in the real game client."); } catch(e){setMsg(e instanceof Error?e.message:"Sandbox failed");} finally {setBusy(false);} 
  }
  async function impact() {
    if(!card.defId){setMsg("Set defId before impact analysis.");return null;} const r=await fetch(`/api/admin/studio/impact?defId=${encodeURIComponent(card.defId)}`,{credentials:"include"}); const d=await r.json(); if(d.ok){setMsg(`Impact · ${d.totalActiveReferences} active references · ${d.historicalReferences} historical references`); return d;} setMsg(d.error||"Impact analysis failed"); return null;
  }
  async function balance() {
    setBusy(true); try { const r=await fetch("/api/admin/studio/balance/card",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({card:{...card,classes:card.classes||[],keywords:card.keywords||[]},games:30})}); const d=await r.json(); if(!d.ok)throw Error(d.error||"Balance analysis failed"); setVal((v:any)=>({...v,balance:d.analysis})); setMsg(`Balance Lab · ${d.analysis.severity} · avg Δ ${d.analysis.avgDelta}% · ${d.analysis.totalSimulatedGames} jogos`); return d.analysis; } catch(e){setMsg(e instanceof Error?e.message:"Balance analysis failed");return null;} finally {setBusy(false);} 
  }
  async function validate() {
    if (!id) {
      setMsg("Save the card before validation.");
      return;
    }
    const row = rows.find((x) => x.id === id);
    const r = await fetch("/api/admin/studio/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resource: "cards", row }),
      }),
      d = await r.json();
    setVal(d);
    setMsg(d.ok ? "Validation passed · ready for QA." : "Validation blocked · resolve the checks below.");
  }
  async function pipe(action: string) {
    if (!id) return;
    let impactAcknowledgement: string | undefined;
    if (action === "archive") { const report = await impact(); if (report?.totalActiveReferences > 0) { if (!window.confirm(`Esta carta possui ${report.totalActiveReferences} referências ativas. O servidor exigirá confirmação exata e os decks/eventos afetados poderão ficar inválidos. Continuar?`)) return; impactAcknowledgement = report.requiredArchiveAcknowledgement; } }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/studio/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            resource: "cards",
            resourceId: id,
            action,
            changeNote: `${action} from Card Studio 4.2.1`,
            impactAcknowledgement,
          }),
        }),
        d = await r.json();
      setMsg(
        d.ok
          ? `${action.toUpperCase()} completed${d.version ? ` · v${d.version}` : ""}.`
          : d.error || "Pipeline failed",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }
  const classes = classRows.length ? classRows.map((x: any) => x.key || x.name).filter(Boolean) : FALLBACK_CLASSES;
  const status = cm.releaseState || "draft";
  const authoredRegions = [...new Set(card.regions?.length ? card.regions : [card.region])] as any[];
  const regionIdentity = identityForRegions(authoredRegions);
  const powerBudget = estimateCardPower(card);
  const selectedCollection = cols.find((collection) => Number(collection.id) === Number(cm.collectionId));
  const collectionIdentity: CardCollectionIdentity | null = selectedCollection ? {
    id: selectedCollection.id,
    key: selectedCollection.key,
    code: selectedCollection.code,
    name: selectedCollection.name,
    symbol: selectedCollection.symbol,
  } : null;
  const collectionForDefId = (defId: string) => {
    const metadata = meta.find((item) => item.defId === defId);
    return cols.find((collection) => Number(collection.id) === Number(metadata?.collectionId));
  };
  const progress = useMemo(
    () =>
      [
        !!card.name && !!card.defId,
        !!card.type && !!card.region && !!card.rarity,
        !!cm.collectionId,
        Array.isArray(card.keywords),
        !!card.description,
      ].filter(Boolean).length,
    [card, cm],
  );

  return {
    auth, rows, cols, meta, card, cm, setCm, id, tab, setTab, tests, testBusy, setTestBusy,
    testName, setTestName, testResult, setTestResult, msg, busy, setBusy, val, mechanicsCatalog,
    set, setPrimaryRegion, toggleAuthoredRegion, toggle, edit, loadTests, reset, toggleCustomKeyword,
    applyArchetypeItem, save, sandbox, impact, balance, validate, pipe, classes, status, authoredRegions, regionIdentity, powerBudget,
    collectionIdentity, collectionForDefId, progress,
  };
}
