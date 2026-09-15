"use client";
import { useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { StudioBreadcrumb } from "../StudioChrome";

type Provider = "google" | "discord" | "email";
type ProviderRow = { provider:Provider; enabled:boolean; clientId:string; metadata:Record<string,unknown>; revision:number; secretConfigured:boolean; secretFingerprint?:string|null; updatedAt?:string|null };
type Draft = { enabled:boolean; clientId:string; secret:string; senderName:string };
const labels:Record<Provider,{title:string;copy:string;publicLabel:string;secretLabel:string}> = {
  google:{title:"Google",copy:"OAuth 2.0 + PKCE. Login rápido com conta Google.",publicLabel:"Google Client ID",secretLabel:"Google Client Secret"},
  discord:{title:"Discord",copy:"OAuth 2.0 + PKCE. Ideal para a comunidade e torneios.",publicLabel:"Discord Client ID",secretLabel:"Discord Client Secret"},
  email:{title:"E-mail / Magic Link",copy:"Login sem senha por link único de 15 minutos via Resend.",publicLabel:"E-mail remetente verificado",secretLabel:"Resend API Key"},
};

export default function IdentitySettingsClient(){
  const [rows,setRows]=useState<ProviderRow[]>([]),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[password,setPassword]=useState(""),[totp,setTotp]=useState(""),[busy,setBusy]=useState<string|null>(null),[msg,setMsg]=useState("");
  const load=async()=>{const r=await fetch("/api/admin/auth/providers",{credentials:"include",cache:"no-store"});const d=await r.json();if(!d.ok){setMsg(d.error||"Unauthorized");return;}const next:Record<string,Draft>={};for(const row of d.providers as ProviderRow[]) next[row.provider]={enabled:row.enabled,clientId:row.clientId,secret:"",senderName:String(row.metadata?.senderName||"RuneForge")};setRows(d.providers);setDrafts(next);};
  useDeferredEffect(()=>{load().catch(()=>setMsg("Falha ao carregar provedores."));},[]);
  const update=(provider:Provider,patch:Partial<Draft>)=>setDrafts(v=>({...v,[provider]:{...v[provider],...patch}}));
  const save=async(row:ProviderRow)=>{const draft=drafts[row.provider];if(!draft)return;setBusy(row.provider);setMsg("");try{const r=await fetch("/api/admin/auth/providers",{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:row.provider,enabled:draft.enabled,clientId:draft.clientId,secret:draft.secret,secretConfigured:row.secretConfigured,expectedRevision:row.revision,metadata:row.provider==="email"?{senderName:draft.senderName}:{},currentPassword:password,currentTotp:totp})});const d=await r.json();if(!d.ok){setMsg(`❌ ${d.error||"Falha ao salvar"}`);return;}setMsg(`✅ ${labels[row.provider].title} atualizado com step-up, auditoria e segredo criptografado.`);await load();}finally{setPassword("");setTotp("");setBusy(null);}};
  if(!rows.length)return <main className="studio-shell"><StudioBreadcrumb section="Security" current="Identity & Auth"/><div className="panel">{msg||"Carregando provedores…"}</div></main>;
  return <main className="studio-shell"><StudioBreadcrumb section="Security" current="Identity & Auth"/><div className="mb-6"><div className="text-xs font-black tracking-[.25em] text-cyan-300">IDENTITY CONTROL PLANE</div><h1 className="mt-1 text-3xl font-black">Autenticação & Provedores</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Controle Google, Discord e magic link sem expor segredos novamente ao navegador. Alterações exigem reautenticação administrativa e ficam no audit log.</p></div>
  {msg&&<div className="mb-4 rounded-xl border border-white/10 p-3 text-sm">{msg}</div>}
  <div className="grid gap-4 xl:grid-cols-3">{rows.map(row=>{const d=drafts[row.provider];const meta=labels[row.provider];return <section className="panel space-y-4" key={row.provider}><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">{meta.title}</div><p className="mt-2 text-xs leading-5 text-slate-400">{meta.copy}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.enabled?"bg-emerald-400/10 text-emerald-200":"bg-white/5 text-slate-400"}`}>{row.enabled?"ATIVO":"OFF"}</span></div>
  <label className="flex items-center gap-2"><input type="checkbox" checked={d?.enabled||false} onChange={e=>update(row.provider,{enabled:e.target.checked})}/><b>Provedor habilitado</b></label>
  <label><span className="label">{meta.publicLabel}</span><input className="input" value={d?.clientId||""} onChange={e=>update(row.provider,{clientId:e.target.value})} placeholder={row.provider==="email"?"login@seudominio.com":"Client ID"}/></label>
  {row.provider==="email"&&<label><span className="label">Nome do remetente</span><input className="input" value={d?.senderName||"RuneForge"} onChange={e=>update(row.provider,{senderName:e.target.value})}/></label>}
  <label><span className="label">Novo {meta.secretLabel} {row.secretConfigured?`(configurado · ${row.secretFingerprint||"fingerprint"})`:"(não configurado)"}</span><input className="input" type="password" autoComplete="new-password" value={d?.secret||""} onChange={e=>update(row.provider,{secret:e.target.value})} placeholder={row.secretConfigured?"deixe vazio para manter":"cole o segredo"}/></label>
  {row.provider!=="email"&&<div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">Callback: <code>{typeof location!=="undefined"?`${location.origin}/api/auth/oauth/${row.provider}/callback`:`/api/auth/oauth/${row.provider}/callback`}</code></div>}
  {row.provider==="email"&&<div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">O domínio do remetente precisa estar validado na Resend. A API key nunca é devolvida após salvar.</div>}
  <button className="btn-primary w-full" disabled={busy!==null||!password} onClick={()=>save(row)}>{busy===row.provider?"Salvando…":"Salvar / rotacionar"}</button></section>})}</div>
  <section className="panel mt-6 max-w-3xl space-y-3 border-red-400/20"><div><div className="text-xs font-black uppercase tracking-wider text-red-200">Step-up administrativo</div><p className="mt-1 text-xs text-slate-400">Digite sua senha atual e MFA antes de salvar qualquer provedor. Os campos são limpos após cada operação.</p></div><label><span className="label">Senha atual</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label><span className="label">MFA / TOTP (se habilitado)</span><input className="input" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,"").slice(0,8))}/></label></section>
  </main>;
}
