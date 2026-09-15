"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import {
  CARD_FRAME_CORNERS,
  CARD_FRAME_MATERIALS,
  CARD_FRAME_ORNAMENTS,
  DEFAULT_CARD_FRAME_CONFIG,
  framePresetSlug,
  type CardFramePreset,
  type CardFramePresetConfig,
} from "@/game/card-frame-presets";
import { PRODUCT_BRAND } from "@/lib/product-brand";

const EMPTY: CardFramePreset = {
  key: "",
  name: "",
  description: "",
  config: { ...DEFAULT_CARD_FRAME_CONFIG },
  status: "draft",
  enabled: false,
};

const MATERIAL_LABEL: Record<string,string> = {
  obsidian: "Obsidiana",
  forged: "Metal forjado",
  silver: "Prata",
  gold: "Ouro",
  arcane: "Arcano",
  organic: "Orgânico",
};
const CORNER_LABEL: Record<string,string> = {
  round: "Arredondado",
  cut: "Corte chanfrado",
  notch: "Entalhe central",
  crown: "Coroa",
  claw: "Garra",
  storm: "Raio / Tempestade",
};
const ORNAMENT_LABEL: Record<string,string> = {
  none: "Sem ornamento",
  runes: "Runas",
  rivets: "Rebites",
  roots: "Raízes",
  waves: "Ondas",
  lightning: "Relâmpagos",
  eclipse: "Eclipse",
};

function rgba(hex:string, alpha:number) {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "ffffff";
  const r = parseInt(clean.slice(0,2),16), g = parseInt(clean.slice(2,4),16), b = parseInt(clean.slice(4,6),16);
  return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,alpha))})`;
}

function clipPath(style:string) {
  if (style === "cut") return "polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px),0 14px)";
  if (style === "notch") return "polygon(0 0,42% 0,50% 10px,58% 0,100% 0,100% 100%,58% 100%,50% calc(100% - 10px),42% 100%,0 100%)";
  if (style === "crown") return "polygon(12px 0,38% 0,43% 10px,50% 0,57% 10px,62% 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)";
  if (style === "claw") return "polygon(16px 0,100% 0,100% 58%,calc(100% - 8px) 64%,100% 70%,100% 100%,0 100%,0 18px,8px 12px,0 6px)";
  if (style === "storm") return "polygon(10px 0,100% 0,100% 56%,calc(100% - 10px) 64%,100% 72%,100% 100%,0 100%,0 42%,10px 34%,0 26%,0 10px)";
  return undefined;
}

function previewBackground(c:CardFramePresetConfig) {
  const material = c.material === "organic"
    ? `radial-gradient(circle at 20% 85%,${rgba(c.primaryColor,.28)},transparent 35%),radial-gradient(circle at 80% 12%,${rgba(c.accentColor,.18)},transparent 34%)`
    : c.material === "arcane"
      ? `radial-gradient(circle at 50% 18%,${rgba(c.accentColor,.34)},transparent 32%),linear-gradient(${c.gradientAngle}deg,${rgba(c.primaryColor,.26)},transparent 48%,${rgba(c.secondaryColor,.35)})`
      : `linear-gradient(${c.gradientAngle}deg,${rgba(c.accentColor,.32)},transparent 28%,${rgba(c.primaryColor,.18)} 58%,${rgba(c.secondaryColor,.38)})`;
  const ornament = c.ornament === "runes" ? `,repeating-linear-gradient(45deg,transparent 0 18px,${rgba(c.primaryColor,.22)} 19px 20px,transparent 21px 36px)`
    : c.ornament === "rivets" ? `,radial-gradient(circle at 10px 10px,${rgba(c.accentColor,.3)} 0 2px,transparent 2.5px)`
    : c.ornament === "lightning" ? `,repeating-linear-gradient(118deg,transparent 0 24px,${rgba(c.accentColor,.25)} 25px 27px,transparent 28px 46px)`
    : c.ornament === "waves" ? `,repeating-radial-gradient(ellipse at 50% 100%,transparent 0 16px,${rgba(c.accentColor,.22)} 17px 19px,transparent 20px 34px)`
    : c.ornament === "roots" ? `,repeating-radial-gradient(ellipse at 0 100%,transparent 0 18px,${rgba(c.primaryColor,.22)} 19px 21px,transparent 22px 37px)`
    : c.ornament === "eclipse" ? `,radial-gradient(circle at 50% 9%,transparent 0 18px,${rgba(c.primaryColor,.26)} 19px 21px,transparent 22px 38px)`
    : "";
  return `${material}${ornament}`;
}

export default function FrameBuilderClient() {
  const [rows,setRows] = useState<CardFramePreset[]>([]);
  const [form,setForm] = useState<CardFramePreset>({ ...EMPTY, config:{...EMPTY.config} });
  const [editingId,setEditingId] = useState<number|null>(null);
  const [role,setRole] = useState("");
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");

  const load = useCallback(async()=>{
    const r = await fetch("/api/admin/studio/frames",{cache:"no-store",credentials:"include"});
    const d = await r.json();
    if (d.ok) { setRows(Array.isArray(d.rows)?d.rows:[]); setRole(String(d.role||"")); }
  },[]);
  useDeferredEffect(()=>{ void load(); },[load]);

  const canPublish = role === "admin" || role === "publisher";
  const patch = <K extends keyof CardFramePreset>(key:K,value:CardFramePreset[K]) => setForm(current=>({...current,[key]:value}));
  const patchConfig = <K extends keyof CardFramePresetConfig>(key:K,value:CardFramePresetConfig[K]) => setForm(current=>({...current,config:{...current.config,[key]:value}}));

  const previewStyle = useMemo(()=>({
    borderColor: form.config.primaryColor,
    borderWidth: `${form.config.borderWidth}px`,
    borderRadius: `${form.config.radius}px`,
    boxShadow: `0 0 ${form.config.glow}px ${rgba(form.config.primaryColor,.55)}, inset 0 0 0 1px ${rgba(form.config.accentColor,form.config.innerLineOpacity)}`,
    clipPath: clipPath(form.config.cornerStyle),
  }),[form.config]);

  const newPreset = () => {
    setEditingId(null);
    setForm({ ...EMPTY, config:{...DEFAULT_CARD_FRAME_CONFIG} });
    setNotice("");
  };
  const edit = (row:CardFramePreset) => {
    setEditingId(Number(row.id)||null);
    setForm({ ...row, config:{...DEFAULT_CARD_FRAME_CONFIG,...row.config} });
    setNotice("");
  };
  const duplicate = (row:CardFramePreset) => {
    setEditingId(null);
    setForm({ ...row, id:undefined, key:`${row.key}-copy`, name:`${row.name} Copy`, status:"draft", enabled:false, config:{...row.config} });
    setNotice("Cópia criada no editor. Ajuste o ID e salve como novo Draft.");
  };
  const save = async(publish=false) => {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const payload:any = {
        ...(editingId?{id:editingId}:{}),
        key: framePresetSlug(form.key),
        name: form.name.trim(),
        description: String(form.description||"").trim(),
        config: form.config,
        ...(editingId&&publish?{status:"published",enabled:true}:{}),
      };
      const r=await fetch("/api/admin/studio/frames",{method:editingId?"PATCH":"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!d.ok){setNotice(`❌ ${d.error||"Falha ao salvar frame."}`);return;}
      const row=d.row as CardFramePreset;
      setEditingId(Number(row.id)||null);setForm({...row,config:{...row.config}});
      setNotice(publish?"✅ Frame publicado e habilitado no catálogo runtime.":"✅ Frame salvo como Draft.");
      await load();
    } finally { setBusy(false); }
  };
  const toggleLive = async(row:CardFramePreset) => {
    if(!canPublish||busy||!row.id)return; setBusy(true);
    try{
      const r=await fetch("/api/admin/studio/frames",{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:row.id,name:row.name,description:row.description,config:row.config,status:"published",enabled:!row.enabled})});
      const d=await r.json();setNotice(d.ok?`✅ ${row.name} ${row.enabled?"desabilitado":"habilitado"}.`:`❌ ${d.error||"Falha."}`);await load();
    }finally{setBusy(false);}
  };
  const remove = async(row:CardFramePreset) => {
    if(!canPublish||busy||!row.id)return; setBusy(true);
    try{
      const r=await fetch(`/api/admin/studio/frames?id=${row.id}`,{method:"DELETE",credentials:"include"});const d=await r.json();
      setNotice(d.ok?`✅ ${row.name} ${d.archived?"arquivado porque está em uso":"removido"}.`:`❌ ${d.error||"Falha."}`);if(editingId===row.id)newPreset();await load();
    }finally{setBusy(false);}
  };

  return <main className="min-h-screen bg-[#06101a] p-5 text-slate-100" data-studio-frame-builder="true">
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-amber-400">{PRODUCT_BRAND.displayName} // VISUAL AUTHORING 1.0</p><h1 className="text-3xl font-black">Frame Builder</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Crie molduras reutilizáveis sem alterar gameplay. Presets publicados entram no catálogo e são aplicados por <code>frameId</code>.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/admin/studio/art" className="btn-ghost">Art Pipeline</Link><Link href="/admin/studio/cards" className="btn-ghost">Card Studio</Link><button className="btn-primary" onClick={newPreset}>＋ Novo frame</button></div>
      </header>
      {notice&&<div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100" role="status">{notice}</div>}
      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)_390px]">
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Presets · {rows.length}</div>
          <div className="max-h-[76vh] space-y-2 overflow-auto pr-1">{rows.length===0?<p className="text-sm text-slate-500">Nenhum frame customizado ainda.</p>:rows.map(row=><article key={row.id} className={`rounded-xl border p-3 ${editingId===row.id?"border-amber-300/50 bg-amber-300/[.05]":"border-white/10 bg-black/20"}`}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-black">{row.name}</div><div className="truncate font-mono text-[10px] text-slate-500">{row.key}</div></div><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${row.enabled?"bg-emerald-400/15 text-emerald-300":row.status==="published"?"bg-sky-400/15 text-sky-300":"bg-slate-600/30 text-slate-300"}`}>{row.enabled?"LIVE":row.status}</span></div>
            <div className="mt-2 flex gap-2"><button className="btn-ghost text-[10px]" onClick={()=>edit(row)}>Editar</button><button className="btn-ghost text-[10px]" onClick={()=>duplicate(row)}>Duplicar</button>{canPublish&&row.status==="published"&&<button className="btn-ghost text-[10px]" onClick={()=>void toggleLive(row)}>{row.enabled?"Off":"On"}</button>}{canPublish&&<button className="btn-ghost text-[10px] text-rose-300" onClick={()=>void remove(row)}>Arquivar</button>}</div>
          </article>)}</div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="mb-5 grid gap-3 md:grid-cols-2"><Field label="Frame ID"><input className="input w-full" value={form.key} disabled={Boolean(editingId)} onChange={e=>patch("key",framePresetSlug(e.target.value))} placeholder="ember-royal"/></Field><Field label="Nome"><input className="input w-full" value={form.name} onChange={e=>patch("name",e.target.value)} placeholder="Ember Royal"/></Field><div className="md:col-span-2"><Field label="Descrição"><input className="input w-full" value={form.description||""} onChange={e=>patch("description",e.target.value)} placeholder="Frame premium da primeira coleção"/></Field></div></div>
          <div className="grid gap-4 md:grid-cols-3"><Color label="Primária" value={form.config.primaryColor} set={v=>patchConfig("primaryColor",v)}/><Color label="Secundária" value={form.config.secondaryColor} set={v=>patchConfig("secondaryColor",v)}/><Color label="Acento" value={form.config.accentColor} set={v=>patchConfig("accentColor",v)}/></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3"><Field label="Material"><select className="input w-full" value={form.config.material} onChange={e=>patchConfig("material",e.target.value as any)}>{CARD_FRAME_MATERIALS.map(v=><option key={v} value={v}>{MATERIAL_LABEL[v]}</option>)}</select></Field><Field label="Cantos"><select className="input w-full" value={form.config.cornerStyle} onChange={e=>patchConfig("cornerStyle",e.target.value as any)}>{CARD_FRAME_CORNERS.map(v=><option key={v} value={v}>{CORNER_LABEL[v]}</option>)}</select></Field><Field label="Ornamento"><select className="input w-full" value={form.config.ornament} onChange={e=>patchConfig("ornament",e.target.value as any)}>{CARD_FRAME_ORNAMENTS.map(v=><option key={v} value={v}>{ORNAMENT_LABEL[v]}</option>)}</select></Field></div>
          <div className="mt-5 grid gap-x-6 md:grid-cols-2"><Range label="Espessura" value={form.config.borderWidth} min={1} max={6} step={1} suffix="px" set={v=>patchConfig("borderWidth",v)}/><Range label="Raio" value={form.config.radius} min={4} max={28} step={1} suffix="px" set={v=>patchConfig("radius",v)}/><Range label="Glow" value={form.config.glow} min={0} max={36} step={1} suffix="px" set={v=>patchConfig("glow",v)}/><Range label="Linha interna" value={form.config.innerLineOpacity} min={0} max={.8} step={.02} set={v=>patchConfig("innerLineOpacity",v)}/><Range label="Inset da arte" value={form.config.artInset} min={0} max={12} step={1} suffix="px" set={v=>patchConfig("artInset",v)}/><Range label="Opacidade nameplate" value={form.config.nameplateOpacity} min={.25} max={.98} step={.01} set={v=>patchConfig("nameplateOpacity",v)}/><Range label="Foil / sheen" value={form.config.foilIntensity} min={0} max={1} step={.02} set={v=>patchConfig("foilIntensity",v)}/><Range label="Ângulo gradiente" value={form.config.gradientAngle} min={0} max={360} step={5} suffix="°" set={v=>patchConfig("gradientAngle",v)}/></div>
          <div className="mt-6 flex flex-wrap justify-end gap-2"><button className="btn-secondary" disabled={busy} onClick={()=>void save(false)}>{editingId?"Salvar alterações":"Criar Draft"}</button>{editingId&&canPublish&&<button className="btn-primary" disabled={busy} onClick={()=>void save(true)}>Publicar + habilitar</button>}</div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Live preview</div>
          <div className="mt-4 mx-auto aspect-[2/3] w-full max-w-[300px] overflow-hidden bg-[#090c11] p-[3px]" style={previewStyle} data-frame-preview={form.key||"draft"}>
            <div className="relative h-full w-full overflow-hidden" style={{borderRadius:`${Math.max(2,form.config.radius-form.config.artInset)}px`,backgroundImage:`linear-gradient(rgba(2,6,23,.05),rgba(2,6,23,.72)),url('/art/regions/emberhold.svg')`,backgroundSize:"cover",backgroundPosition:"center"}}>
              <div className="absolute inset-0" style={{backgroundImage:previewBackground(form.config),opacity:.9}}/>
              <div className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border font-black" style={{borderColor:form.config.accentColor,color:form.config.accentColor,background:rgba(form.config.secondaryColor,.75)}}>3</div>
              <div className="absolute inset-x-3 bottom-3 rounded-xl border p-3" style={{borderColor:rgba(form.config.accentColor,.3),background:`linear-gradient(90deg,${rgba(form.config.secondaryColor,form.config.nameplateOpacity)},${rgba(form.config.primaryColor,.5)},${rgba(form.config.secondaryColor,form.config.nameplateOpacity)})`}}><div className="text-[9px] font-black uppercase tracking-[.18em]" style={{color:form.config.accentColor}}>FRAME PREVIEW</div><div className="mt-1 text-lg font-black text-white">Vanguarda da Convergência</div><div className="mt-2 text-[10px] text-white/70">Unidade · Lendária</div></div>
              <div className="pointer-events-none absolute inset-0" style={{background:`linear-gradient(${form.config.gradientAngle}deg,transparent 12%,${rgba(form.config.accentColor,form.config.foilIntensity)} 42%,transparent 65%)`}}/>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[.05] p-3 text-xs leading-5 text-slate-300"><b className="text-cyan-200">Engine-safe:</b> o preset não contém custo, poder, vida, keyword, regra ou raridade de gameplay. Ele gera somente estilos para <code>card-frame-{framePresetSlug(form.key||"draft")}</code>.</div>
        </aside>
      </div>
    </div>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>}
function Color({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <Field label={label}><div className="flex gap-2"><input type="color" className="h-10 w-14 rounded border border-white/10 bg-black" value={value} onChange={e=>set(e.target.value)}/><input className="input min-w-0 flex-1 font-mono" value={value} onChange={e=>set(e.target.value)}/></div></Field>}
function Range({label,value,min,max,step,suffix="",set}:{label:string;value:number;min:number;max:number;step:number;suffix?:string;set:(v:number)=>void}){return <label className="mb-3 block"><span className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><b>{label}</b><i>{Number(value).toFixed(step<1?2:0)}{suffix}</i></span><input className="w-full accent-amber-400" type="range" value={value} min={min} max={max} step={step} onChange={e=>set(Number(e.target.value))}/></label>}
