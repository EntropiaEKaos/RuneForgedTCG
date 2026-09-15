import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { authLoginTokens } from "@/db/schema";
import { decryptAuthSecret } from "@/lib/auth-secret-vault";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { getAuthProviderSetting, normalizeEmail, providerReady, safeAuthReturnTo } from "@/lib/identity-auth";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";

export const dynamic = "force-dynamic";
const MAX_BODY = 8 * 1024;

export async function POST(req: NextRequest) {
  const rate = await consumeRequestRateLimit(req, "auth-email-start", 6, 15 * 60_000);
  if (!rate.allowed) return Response.json({ ok: false, error: "Too many requests" }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJson<Record<string, unknown>>(req, MAX_BODY);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ ok: false, error: "E-mail inválido" }, { status: 400 });
  const setting = await getAuthProviderSetting("email");
  if (!setting || !providerReady(setting)) return Response.json({ ok: false, error: "Login por e-mail indisponível" }, { status: 503 });

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const returnTo = safeAuthReturnTo(typeof body.returnTo === "string" ? body.returnTo : "/play");
  const callback = new URL("/api/auth/email/callback", req.nextUrl.origin);
  callback.searchParams.set("token", token);
  callback.searchParams.set("returnTo", returnTo);
  await db.insert(authLoginTokens).values({ tokenHash, provider: "email", subject: email, expiresAt: new Date(Date.now() + 15 * 60_000) });

  const metadata = setting.metadata && typeof setting.metadata === "object" ? setting.metadata as Record<string, unknown> : {};
  const senderName = String(metadata.senderName || "RuneForge").trim().slice(0, 80) || "RuneForge";
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${decryptAuthSecret(setting.secretEncrypted)}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${senderName} <${setting.clientId}>`, to: [email], subject: "Entre na Forja — RuneForge",
      html: `<div style="font-family:Arial,sans-serif;background:#090b10;color:#f8fafc;padding:32px"><h1>Entre na Forja</h1><p>Use o botão abaixo para entrar na sua conta RuneForge. Este link expira em 15 minutos e só pode ser usado uma vez.</p><p><a href="${callback.toString().replace(/&/g, "&amp;")}" style="display:inline-block;padding:12px 18px;background:#d9a441;color:#090b10;text-decoration:none;font-weight:700;border-radius:8px">ENTRAR NO RUNEFORGE</a></p><p style="color:#94a3b8;font-size:12px">Se você não solicitou este acesso, ignore esta mensagem.</p></div>`,
    }),
    cache: "no-store",
  });
  if (!send.ok) {
    console.error("[identity-auth] Resend delivery failed", send.status);
    return Response.json({ ok: false, error: "Não foi possível enviar o link de acesso" }, { status: 502 });
  }
  return Response.json({ ok: true, sent: true });
}
