"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";

type Op = { id: number; username: string; role: string; enabled: boolean; mfaEnabled: boolean };
const roles = ["designer", "qa", "liveops", "publisher", "admin"];

export default function OperatorsClient() {
  const router = useRouter();
  const [rows, setRows] = useState<Op[]>([]), [currentUserId, setCurrentUserId] = useState(0), [form, setForm] = useState({ username: "", password: "", role: "designer", requireMfa: true }), [secret, setSecret] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = () => fetch("/api/admin/operators", { credentials: "include" }).then((response) => response.json()).then((data) => { if (!data.ok) throw new Error(data.error); setRows(data.rows || []); setCurrentUserId(data.currentUserId || 0); });
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);
  async function create() { setError(""); const currentPassword = prompt("Confirme sua senha de administrador para criar o operador:") || ""; if (!currentPassword) return setError("Confirmação de senha cancelada."); const currentTotp = prompt("Código MFA atual (deixe vazio apenas se sua conta ainda não usa MFA):") || ""; const response = await fetch("/api/admin/operators", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...form, currentPassword, currentTotp }) }); const data = await response.json(); if (!data.ok) return setError(data.error); if (data.mfaSecret) setSecret(data.mfaSecret); setNotice("Operador criado."); setForm({ username: "", password: "", role: "designer", requireMfa: true }); await load(); }
  async function update(row: Op, patch: Record<string, any>) {
    setError("");
    const currentPassword = prompt("Confirme a senha do administrador atual:") || "";
    if (!currentPassword) return setError("Confirmação de senha cancelada.");
    const currentTotp = prompt("Código MFA atual (deixe vazio apenas se sua conta ainda não usa MFA):") || "";
    const securedPatch = { ...patch, currentPassword, currentTotp };
    const response = await fetch("/api/admin/operators", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: row.id, ...securedPatch }) });
    const data = await response.json();
    if (!data.ok) return setError(data.error);
    if (data.mfaSecret) setSecret(data.mfaSecret);
    if (data.reauthRequired) { setNotice("Credenciais alteradas. Todas as sessões foram revogadas; faça login novamente."); window.setTimeout(() => { router.push("/admin"); }, 700); return; }
    setNotice("Operador atualizado; sessões antigas foram revogadas quando necessário.");
    await load();
  }
  const resetPassword = (row: Op) => { const password = prompt(`Nova senha para ${row.username} (mínimo 12 caracteres):`) || ""; if (password) void update(row, { newPassword: password }); };
  return <main className="studio-shell min-h-screen"><StudioCommandPalette /><div className="studio-main mx-auto max-w-6xl p-8"><StudioBreadcrumb section="Security" current="Admin Operators" /><div className="studio-kicker">RBAC // MFA // SESSION REVOCATION</div><h1 className="studio-title">Admin Operators</h1>{notice && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200">{notice}</div>}{error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
    <div className="studio-section mt-6 p-5"><h2 className="font-black">Criar operador</h2><div className="mt-3 grid gap-3 lg:grid-cols-4"><input className="input" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}/><input className="input" type="password" placeholder="senha com 12+ caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select><button className="btn-primary" onClick={create}>Criar + MFA</button></div>{secret && <div className="mt-4 rounded-xl border border-amber-400/20 p-3 text-sm"><b>Segredo MFA exibido uma única vez:</b> <code className="ml-2 select-all">{secret}</code><button className="ml-3 text-xs text-slate-400" onClick={() => setSecret("")}>ocultar</button></div>}</div>
    <div className="studio-section mt-5 overflow-hidden"><div className="border-b border-white/10 px-5 py-3 text-xs font-bold text-slate-400">{rows.length} operadores</div>{rows.map((row) => <div key={row.id} className="border-b border-white/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><b>{row.username}{row.id === currentUserId ? " (você)" : ""}</b><div className="text-xs text-slate-400">MFA {row.mfaEnabled ? "ativo" : "desativado"}</div></div><div className="flex flex-wrap items-center gap-2"><select className="input !w-32 !py-1 text-xs" value={row.role} disabled={row.id === currentUserId} onChange={(e) => update(row, { role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select><button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => update(row, { mfaAction: row.mfaEnabled ? "rotate" : "enable" })}>{row.mfaEnabled ? "Girar MFA" : "Ativar MFA"}</button>{row.mfaEnabled && <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => update(row, { mfaAction: "disable" })}>Remover MFA</button>}<button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => resetPassword(row)}>Nova senha</button><button className={`btn-ghost !px-2 !py-1 text-xs ${row.enabled ? "text-red-300" : "text-emerald-300"}`} disabled={row.id === currentUserId} onClick={() => update(row, { enabled: !row.enabled })}>{row.enabled ? "Desativar" : "Ativar"}</button><span className={row.enabled ? "text-xs text-emerald-300" : "text-xs text-red-300"}>{row.enabled ? "ENABLED" : "DISABLED"}</span></div></div></div>)}</div><Link href="/admin/studio" className="btn-ghost mt-5 inline-flex">Voltar</Link></div></main>;
}
