"use client";
import CollectionSymbolMark from "@/components/CollectionSymbolMark";
import Link from "next/link";
import type { CardDef } from "@/game/types";
import { strategicRoleForCard, STRATEGIC_ROLE_IDENTITIES } from "@/game/card-role";
import RuleBuilder from "../RuleBuilder";
import { StudioCommandPalette, StudioBreadcrumb } from "../StudioChrome";
import { EMPTY, useCardAuthoringModel } from "./useCardAuthoringModel";
import { CardCatalogSidebar, CardStudioHeader, CardTests, CardWorkspaceHeader, Check, EffectEditor, F, Json, Panel, Preview, ToggleField } from "./CardAuthoringFields";
import {
  CARD_REGIONS as REGIONS, CARD_TYPES as TYPES, CARD_RARITIES as RARITIES,
  CARD_RACES as RACES, CARD_KEYWORDS as KWS, CARD_EFFECT_KINDS as EFFECT_KINDS,
  CARD_EFFECT_CONTRACTS as EFFECT_CONTRACTS, CARD_TRIGGERS as TRIGGERS, CARD_LEVEL_UP_TYPES as LEVEL_UP_TYPES,
  CARD_STRATEGIC_ROLES as STRATEGIC_ROLES, CARD_DOCTRINES as DOCTRINES,
  CARD_REGIONAL_PERKS as REGIONAL_PERKS,
} from "@/game/card-authoring";
import { REGION_IDENTITY_STYLE } from "@/game/region-identity";

export default function CardAuthoringStudio() {
  const {
    auth, rows, cols, card, cm, setCm, id, tab, setTab, tests, testBusy, setTestBusy, testName, setTestName,
    testResult, setTestResult, msg, busy, setBusy, val, mechanicsCatalog, set, setPrimaryRegion,
    toggleAuthoredRegion, toggle, edit, loadTests, reset, toggleCustomKeyword, applyArchetypeItem, save, sandbox, impact, balance, validate,
    pipe, classes, status, authoredRegions, regionIdentity, powerBudget, collectionIdentity, collectionForDefId, progress,
  } = useCardAuthoringModel();
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
      <StudioCommandPalette />
      <CardStudioHeader />
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
            </div>
          </div>
          {msg && (
            <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.07] p-4 text-xs text-amber-100">
              {msg}
            </div>
          )}
          {tab === "identity" && (
            <Panel title="Identity" eyebrow="CARD DEFINITION">
              <div className="grid gap-3 md:grid-cols-3">
                <F l="Name">
                  <input
                    className="input"
                    value={card.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Fire Drake"
                  />
                </F>
                <F l="defId">
                  <input
                    className="input font-mono"
                    value={card.defId}
                    disabled={id !== null}
                    onChange={(e) => set("defId", e.target.value)}
                    placeholder="fire_drake"
                  />
                </F>
                <F l="Emoji">
                  <input className="input" value={card.emoji} onChange={(e) => set("emoji", e.target.value)} />
                </F>
                <F l="Region">
                  <select className="input" value={card.region} onChange={(e) => setPrimaryRegion(e.target.value)}>
                    {REGIONS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </F>
                <F l="Regional identity" x="md:col-span-2">
                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[.04] p-4">
                    <div className="flex flex-wrap gap-2">
                      {REGIONS.map((region) => {
                        const active = authoredRegions.includes(region);
                        const primary = card.region === region;
                        return <button type="button" key={region} onClick={() => toggleAuthoredRegion(region)} disabled={primary}
                          className={["rounded-full border px-3 py-1.5 text-[10px] font-black transition", active ? "border-cyan-300/50 bg-cyan-400 text-slate-950" : "border-white/10 bg-white/[.03] text-slate-400"].join(" ")}>
                          {REGION_IDENTITY_STYLE[region].sigil} {region}{primary ? " · PRIMARY" : ""}
                        </button>;
                      })}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                      <div><small className="font-black tracking-[.15em] text-cyan-300">{regionIdentity.tier.toUpperCase()} IDENTITY</small><b className="mt-1 block text-sm text-white">{regionIdentity.sigils} {regionIdentity.name}</b><p className="mt-1 text-[10px] text-slate-400">{regionIdentity.description}</p></div>
                      <label className="text-[10px] font-black text-slate-400">MASTERY REWARD<select className="input mt-1" value={card.regionalPerk || "convergence"} onChange={(event) => set("regionalPerk", event.target.value)} disabled={authoredRegions.length < 2}>{REGIONAL_PERKS.map((perk) => <option key={perk} value={perk}>{perk === "convergence" ? "Cost -1" : perk === "assault" ? "+1 Power" : "+1 Health"}</option>)}</select></label>
                    </div>
                    <p className="mt-3 text-[9px] text-amber-200/80">A Maestria só ativa quando a identidade completa do deck coincide exatamente com a identidade desta carta.</p>
                  </div>
                </F>
                <F l="Type">
                  <select className="input" value={card.type} onChange={(e) => set("type", e.target.value)}>
                    {TYPES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </F>
                <F l="Rarity">
                  <select className="input" value={card.rarity} onChange={(e) => set("rarity", e.target.value)}>
                    {RARITIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </F>
                <F l="Cost">
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="20"
                    value={card.cost}
                    onChange={(e) => set("cost", Number(e.target.value))}
                  />
                </F>
                <F l="Art URL">
                  <input
                    className="input"
                    value={card.art || ""}
                    onChange={(e) => set("art", e.target.value)}
                    placeholder="https://…"
                  />
                </F>
              </div>
              <F l="Description" x="mt-4">
                <textarea
                  className="input min-h-28"
                  value={card.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe what the player sees and what the card does."
                />
              </F>
              <F l="Flavor / lore" x="mt-4">
                <textarea
                  className="input min-h-20 italic"
                  value={card.flavor || ""}
                  maxLength={280}
                  onChange={(e) => set("flavor", e.target.value)}
                  placeholder="Texto narrativo da carta — não altera regras."
                />
              </F>
            </Panel>
          )}
          {tab === "classification" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Combat Profile" eyebrow="STATS & IDENTITY">
                <F l="Card archetype / custom type">
                  <select className="input mb-4" value={card.archetypeKey || ""} onChange={(e) => applyArchetypeItem(mechanicsCatalog.archetypes?.find((x:any)=>x.key===e.target.value))}>
                    <option value="">Native type ({card.type})</option>
                    {(mechanicsCatalog.archetypes || []).map((x:any)=><option key={x.key} value={x.key}>{x.name} → {x.baseType}</option>)}
                  </select>
                </F>
                <div className="grid gap-3 md:grid-cols-3">
                  <F l="Power">
                    <input
                      className="input"
                      type="number"
                      value={card.power ?? 0}
                      onChange={(e) => set("power", Number(e.target.value))}
                    />
                  </F>
                  <F l="Health">
                    <input
                      className="input"
                      type="number"
                      value={card.health ?? 1}
                      onChange={(e) => set("health", Number(e.target.value))}
                    />
                  </F>
                  <F l="Race">
                    <select
                      className="input"
                      value={card.race || ""}
                      onChange={(e) => set("race", e.target.value || undefined)}
                    >
                      <option value="">None</option>
                      {RACES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </F>
                  <F l="Max health / Permanent HP">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={card.maxHealth ?? ""}
                      onChange={(e) => set("maxHealth", e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  </F>
                </div>
                <div className="mt-5 label">Secondary races</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {RACES.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => toggle("secondaryRaces", x)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${(card.secondaryRaces || []).includes(x) ? "border-violet-300/40 bg-violet-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300"}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <ToggleField label="Collectible" checked={card.collectible !== false} onChange={(v) => set("collectible", v)} />
                  <ToggleField label="Legendary" checked={!!card.isLegend} onChange={(v) => set("isLegend", v)} />
                  <ToggleField label="Champion" checked={!!card.isChampion} onChange={(v) => set("isChampion", v)} />
                  <F l="Spell speed">
                    <select className="input" value={card.speed || ""} onChange={(e) => set("speed", e.target.value || undefined)}>
                      <option value="">Normal</option><option value="Fast">Fast</option><option value="Burst">Burst</option>
                    </select>
                  </F>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <F l="Strategic role">
                    <select className="input" value={card.strategicRole || ""} onChange={(e) => set("strategicRole", e.target.value || undefined)}>
                      <option value="">Automatic · {strategicRoleForCard({ ...EMPTY, ...card } as CardDef).label}</option>
                      {STRATEGIC_ROLES.map((role) => <option key={role} value={role}>{STRATEGIC_ROLE_IDENTITIES[role].icon} {STRATEGIC_ROLE_IDENTITIES[role].label}</option>)}
                    </select>
                  </F>
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-[10px] leading-4 text-slate-400">
                    <b className="text-slate-200">Automático por padrão.</b> Use o override somente quando a intenção estratégica não puder ser inferida pelos efeitos, custo ou palavras-chave.
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="label">Cost reduction / Affinity</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    <select className="input" value={card.costReduction?.kind || ""} onChange={(e) => set("costReduction", e.target.value ? { ...(card.costReduction || {}), kind: e.target.value } : undefined)}>
                      <option value="">None</option><option value="creatures">Creatures</option><option value="power">Power</option>
                    </select>
                    <input className="input" type="number" placeholder="per" value={card.costReduction?.per ?? ""} onChange={(e) => set("costReduction", { ...(card.costReduction || { kind: "creatures" }), per: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    <input className="input" type="number" placeholder="threshold" value={card.costReduction?.threshold ?? ""} onChange={(e) => set("costReduction", { ...(card.costReduction || { kind: "power" }), threshold: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    <input className="input" type="number" placeholder="max" value={card.costReduction?.max ?? ""} onChange={(e) => set("costReduction", { ...(card.costReduction || { kind: "creatures" }), max: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  </div>
                </div>
                <div className="mt-5 label">Classes</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {classes.map((x: string) => (
                    <button
                      key={x}
                      onClick={() => toggle("classes", x)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${(card.classes || []).includes(x) ? "border-amber-300/40 bg-amber-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300 hover:bg-white/10"}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Keywords" eyebrow="RULE TAGS">
                <div className="flex flex-wrap gap-2">
                  {KWS.map((x) => (
                    <button
                      key={x}
                      onClick={() => toggle("keywords", x)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${(card.keywords || []).includes(x) ? "border-cyan-300/40 bg-cyan-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300 hover:bg-white/10"}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                {!!(mechanicsCatalog.keywords || []).length && <><div className="mt-5 label">Custom mechanics keywords</div><div className="mt-2 flex flex-wrap gap-2">{mechanicsCatalog.keywords.map((x:any)=><button type="button" key={x.key} onClick={()=>toggleCustomKeyword(x)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${(card.customKeywords||[]).includes(x.key)?"border-fuchsia-300/40 bg-fuchsia-400 text-slate-950":"border-white/10 bg-white/[.04] text-slate-300"}`}>{x.icon||"✦"} {x.name}</button>)}</div></>}
                <div className="mt-6 label">Deck doctrine affinity</div>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Marque em quais doutrinas oficiais esta carta atua como suporte ou assinatura.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DOCTRINES.map((doctrine) => <button type="button" key={doctrine.id} onClick={() => toggle("doctrineAffinities", doctrine.id)} className={`rounded-xl border p-3 text-left text-[10px] transition ${(card.doctrineAffinities || []).includes(doctrine.id) ? "border-amber-300/40 bg-amber-400/15 text-amber-100" : "border-white/10 bg-white/[.025] text-slate-400 hover:bg-white/[.05]"}`}><b className="mr-2 text-base">{doctrine.icon}</b><span className="font-black">{doctrine.name}</span><small className="mt-1 block text-[8px] uppercase tracking-wider opacity-70">{doctrine.region}</small></button>)}
                </div>
              </Panel>
            </div>
          )}
          {tab === "rules" && (
            <div className="space-y-4">
              {card.type === "Sentinela" && (
                <Panel title="Sentinela (Planeswalker)" eyebrow="LOYALTY & ABILITIES">
                  <p className="mb-4 text-xs leading-5 text-slate-400">
                    Sentinelas ativam habilidades gastando lealdade em vez de mana. É obrigatório definir a lealdade
                    inicial e pelo menos uma habilidade antes de conseguir publicar este tipo de carta.
                  </p>
                  <F l="Lealdade Inicial">
                    <input
                      type="number"
                      className="input max-w-[140px]"
                      min={1}
                      max={20}
                      value={card.sentinela?.startingLoyalty ?? 3}
                      onChange={(e) => {
                        const sen = card.sentinela || {};
                        set("sentinela", { startingLoyalty: Number(e.target.value) || 1, abilities: sen.abilities ?? [] });
                      }}
                    />
                  </F>
                  <div className="mt-5 label">Habilidades (custo de lealdade + efeito)</div>
                  <div className="mt-2 space-y-2">
                    {(card.sentinela?.abilities ?? []).map((ab: any, i: number) => (
                      <div
                        key={i}
                        className="grid items-end gap-2 rounded-xl border border-white/10 bg-white/[.02] p-3 sm:grid-cols-[80px_1fr_1fr_90px_auto]"
                      >
                        <F l="Custo">
                          <input
                            type="number"
                            className="input"
                            value={ab.cost}
                            onChange={(e) => {
                              const sen = card.sentinela || {};
                              const abilities = [...(sen.abilities ?? [])];
                              abilities[i] = { ...abilities[i], cost: Number(e.target.value) || 0 };
                              set("sentinela", { ...sen, abilities });
                            }}
                          />
                        </F>
                        <F l="Descrição">
                          <input
                            className="input"
                            value={ab.description}
                            onChange={(e) => {
                              const sen = card.sentinela || {};
                              const abilities = [...(sen.abilities ?? [])];
                              abilities[i] = { ...abilities[i], description: e.target.value };
                              set("sentinela", { ...sen, abilities });
                            }}
                          />
                        </F>
                        <F l="Efeito (kind)">
                          <select
                            className="input"
                            value={ab.effect?.kind || "draw"}
                            onChange={(e) => {
                              const sen = card.sentinela || {};
                              const abilities = [...(sen.abilities ?? [])];
                              abilities[i] = { ...abilities[i], effect: { ...abilities[i].effect, kind: e.target.value } };
                              set("sentinela", { ...sen, abilities });
                            }}
                          >
                            {EFFECT_KINDS.map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </F>
                        <F l="Qtd">
                          <input
                            type="number"
                            className="input"
                            value={ab.effect?.amount ?? 0}
                            onChange={(e) => {
                              const sen = card.sentinela || {};
                              const abilities = [...(sen.abilities ?? [])];
                              abilities[i] = { ...abilities[i], effect: { ...abilities[i].effect, amount: Number(e.target.value) || 0 } };
                              set("sentinela", { ...sen, abilities });
                            }}
                          />
                        </F>
                        <button
                          onClick={() => {
                            const sen = card.sentinela || {};
                            const abilities = [...(sen.abilities ?? [])];
                            abilities.splice(i, 1);
                            set("sentinela", { ...sen, abilities });
                          }}
                          className="rounded bg-red-500/20 px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/30"
                        >
                          ✕
                        </button>
                        <div className="sm:col-span-5">
                          <EffectEditor
                            value={ab.effect || { kind: "draw", amount: 1, target: "none" }}
                            classes={classes}
                            onChange={(effect: any) => {
                              const sen = card.sentinela || {};
                              const abilities = [...(sen.abilities ?? [])];
                              abilities[i] = { ...abilities[i], effect };
                              set("sentinela", { ...sen, abilities });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {!(card.sentinela?.abilities ?? []).length && (
                      <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
                        Nenhuma habilidade ainda. Adicione ao menos uma para poder publicar.
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const sen = card.sentinela || {};
                      const abilities = [...(sen.abilities ?? [])];
                      abilities.push({ cost: 1, description: "Nova habilidade", effect: { kind: "draw", amount: 1, target: "none" } });
                      set("sentinela", { startingLoyalty: sen.startingLoyalty ?? 3, abilities });
                    }}
                    className="mt-3 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-300"
                  >
                    + Adicionar habilidade
                  </button>
                </Panel>
              )}
              {card.type === "Spell" && (
                <Panel title="Spell Contract" eyebrow="VISUAL EFFECT AUTHORING">
                  <EffectEditor value={card.spell || { kind: "damageUnit", amount: 1, target: "enemyUnit" }} classes={classes} onChange={(v: any) => set("spell", v)} />
                </Panel>
              )}
              <Panel title="Trigger Contract" eyebrow="VISUAL TRIGGER AUTHORING">
                <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                  <F l="Trigger event">
                    <select className="input" value={card.trigger?.when || "onSummon"} onChange={(e) => set("trigger", { when: e.target.value, effect: card.trigger?.effect || { kind: "buffUnit", amount: 0, target: "allyUnit" } })}>
                      {TRIGGERS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </F>
                  <div>
                    <EffectEditor value={card.trigger?.effect || { kind: "buffUnit", amount: 0, target: "allyUnit" }} classes={classes} onChange={(effect: any) => set("trigger", { when: card.trigger?.when || "onSummon", effect })} />
                  </div>
                </div>
                <button type="button" className="btn-ghost mt-3 text-xs" onClick={() => set("trigger", undefined)}>Remove trigger</button>
              </Panel>
              {card.type === "Equipment" && (
                <Panel title="Equipment Contract" eyebrow="VISUAL EQUIPMENT AUTHORING">
                  <div className="grid gap-3 md:grid-cols-2">
                    <F l="Power bonus"><input className="input" type="number" value={card.equipment?.buffPower ?? 0} onChange={(e) => set("equipment", { ...(card.equipment || {}), buffPower: Number(e.target.value), buffHealth: card.equipment?.buffHealth ?? 0, keywords: card.equipment?.keywords || [] })} /></F>
                    <F l="Health bonus"><input className="input" type="number" value={card.equipment?.buffHealth ?? 0} onChange={(e) => set("equipment", { ...(card.equipment || {}), buffPower: card.equipment?.buffPower ?? 0, buffHealth: Number(e.target.value), keywords: card.equipment?.keywords || [] })} /></F>
                  </div>
                  <div className="mt-3 label">Granted keywords</div>
                  <div className="mt-2 flex flex-wrap gap-2">{KWS.map((x) => <button type="button" key={x} onClick={() => { const a=card.equipment?.keywords || []; set("equipment", { ...(card.equipment || { buffPower:0,buffHealth:0 }), keywords: a.includes(x) ? a.filter((k:string)=>k!==x) : [...a,x] }); }} className={`rounded-full border px-2 py-1 text-[10px] ${card.equipment?.keywords?.includes(x) ? "bg-cyan-400 text-slate-950" : "border-white/10"}`}>{x}</button>)}</div>
                </Panel>
              )}
              {card.isChampion && (
                <Panel title="Champion Level Up" eyebrow="VISUAL LEVEL-UP AUTHORING">
                  <div className="grid gap-3 md:grid-cols-4">
                    <F l="Condition"><select className="input" value={card.levelUp?.type || "nexusDamage"} onChange={(e) => set("levelUp", { ...(card.levelUp || { amount:1,toDefId:"",hint:"" }), type:e.target.value })}>{LEVEL_UP_TYPES.map(x=><option key={x}>{x}</option>)}</select></F>
                    <F l="Amount"><input className="input" type="number" min={1} value={card.levelUp?.amount ?? 1} onChange={(e)=>set("levelUp",{...(card.levelUp||{type:"nexusDamage",toDefId:"",hint:""}),amount:Number(e.target.value)})}/></F>
                    <F l="Transforms to defId"><input className="input font-mono" value={card.levelUp?.toDefId || ""} onChange={(e)=>set("levelUp",{...(card.levelUp||{type:"nexusDamage",amount:1,hint:""}),toDefId:e.target.value})}/></F>
                    <F l="Hint"><input className="input" value={card.levelUp?.hint || ""} onChange={(e)=>set("levelUp",{...(card.levelUp||{type:"nexusDamage",amount:1,toDefId:""}),hint:e.target.value})}/></F>
                  </div>
                </Panel>
              )}
              <Panel title="Card Rule Composer" eyebrow="ENGINE-BACKED AUTHORING">
                <p className="mb-4 text-xs leading-5 text-slate-400">
                  Compose the behavior using the same Rule Graph contract used by Interaction Studio. The preview is
                  editorial; execution remains authoritative inside the Runeforge engine.
                </p>
                <RuleBuilder
                  value={{
                    name: card.name,
                    sourceType: "card",
                    sourceKey: card.defId,
                    event: card.trigger?.when || "onSummon",
                    targetType: "anyUnit",
                    targetKey: "",
                    condition: {},
                    effect: card.trigger?.effect || { kind: "buffUnit", target: "allyUnit", amount: 0 },
                    testFixture: { sourceDefId: card.defId, targetDefId: card.defId, enemyDefId: "ember_drake" },
                  }}
                  setValue={(v: any) => {
                    if (v?.effect?.kind) set("trigger", { when: v.event || "onSummon", effect: { ...v.effect } });
                  }}
                />
              </Panel>
              {!!(mechanicsCatalog.effects || []).length && <Panel title="Effect Library" eyebrow="COMPOSITE MACROS"><p className="mb-3 text-xs text-slate-400">Macros são expandidas para CardEffect nativos antes de salvar; replay e engine não dependem do nome da macro.</p><div className="flex flex-wrap gap-2">{mechanicsCatalog.effects.map((x:any)=><div key={x.key} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="text-xs font-black">{x.name}</div><div className="mt-2 flex gap-2">{card.type==="Spell"&&<button className="btn-ghost text-[10px]" onClick={()=>set("spell",structuredClone(x.definition.effect))}>Use as Spell</button>}<button className="btn-ghost text-[10px]" onClick={()=>set("trigger",{when:card.trigger?.when||"onSummon",effect:structuredClone(x.definition.effect)})}>Use as Trigger</button></div></div>)}</div></Panel>}
              <Panel title="Raw Contracts" eyebrow="EXPERT / ROUND-TRIP FALLBACK">
                <Json title="Spell" value={card.spell} onChange={(v) => set("spell", v)} />
                <Json title="Trigger" value={card.trigger} onChange={(v) => set("trigger", v)} />
                <Json title="Equipment" value={card.equipment} onChange={(v) => set("equipment", v)} />
                <Json title="Level Up" value={card.levelUp} onChange={(v) => set("levelUp", v)} />
              </Panel>
            </div>
          )}
          {tab === "tests" && (
            <CardTests
              cardId={id}
              tests={tests}
              busy={testBusy}
              setBusy={setTestBusy}
              name={testName}
              setName={setTestName}
              result={testResult}
              setResult={setTestResult}
              reload={() => loadTests(id)}
            />
          )}
          {tab === "collection" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Release Identity" eyebrow="COLLECTION & LIVE STATE">
                <F l="Collection">
                  <select
                    className="input"
                    value={cm.collectionId}
                    onChange={(e) => setCm({ ...cm, collectionId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {cols.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.code} · {c.status}
                      </option>
                    ))}
                  </select>
                </F>
                {collectionIdentity && <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[.06] p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-black/20 text-xl"><CollectionSymbolMark symbol={collectionIdentity.symbol} name={collectionIdentity.name} className="h-9 w-9 rounded-full object-cover" /></span><div><small className="text-[8px] font-black tracking-[.16em] text-cyan-300">COLEÇÃO DE LANÇAMENTO</small><b className="block text-sm text-white">{collectionIdentity.name}</b><span className="font-mono text-[10px] text-slate-400">{collectionIdentity.code}</span></div></div></div>}
                <F l="Release state" x="mt-4">
                  <div className="input flex items-center justify-between"><span className="font-mono text-xs uppercase">{status}</span><span className="text-[9px] text-slate-500">Use Validate → QA → Publish; estado não é editável diretamente.</span></div>
                </F>
                <F l="Tags" x="mt-4">
                  <input
                    className="input"
                    value={(cm.tags || []).join(", ")}
                    onChange={(e) =>
                      setCm({
                        ...cm,
                        tags: e.target.value
                          .split(",")
                          .map((x: string) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </F>
                <F l="Notes" x="mt-4">
                  <textarea
                    className="input min-h-24"
                    value={cm.notes || ""}
                    onChange={(e) => setCm({ ...cm, notes: e.target.value })}
                  />
                </F>
              </Panel>
              <Panel title="Release Checklist" eyebrow="PRODUCTION GATE">
                <Check ok={!!(card.name && card.defId)} t="Stable identity" />
                <Check ok={!!(card.type && card.region && card.rarity)} t="Ruleset classification" />
                <Check ok={!!cm.collectionId} t="Collection assigned" />
                <Check ok={!!card.description} t="Player-facing description" />
                <Check ok={!!tests.length} t="Automated regression coverage" />
                {card.type === "Sentinela" && (
                  <Check ok={!!(card.sentinela?.abilities?.length)} t="Sentinela loyalty & abilities defined" />
                )}
              </Panel>
            </div>
          )}
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
              <button className="btn-secondary" disabled={busy} onClick={()=>void balance()}>⚖️ Balance Lab</button>
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
