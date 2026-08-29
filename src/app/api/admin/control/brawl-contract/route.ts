import { NextRequest } from "next/server";
import { adminRoleAllowed, getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { BRAWL_RULE_CONTRACT, BRAWL_UNSUPPORTED_LEGACY_RULES } from "@/lib/brawl-control-contract";
import { validateControlDefinition } from "@/lib/control-plane";

export const dynamic = "force-dynamic";

async function authorized(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return null;
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, "designer")) return null;
  return actor;
}

function contractPayload() {
  return {
    fields: BRAWL_RULE_CONTRACT,
    unsupportedLegacyRules: BRAWL_UNSUPPORTED_LEGACY_RULES,
    authority: "validateControlDefinition",
    runtimeNote: "Somente regras efetivamente aplicadas pelo launcher autoritativo podem ser publicadas.",
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return unauthorized();
  return Response.json({ ok: true, contract: contractPayload() });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return unauthorized();
  try {
    const body = await req.json();
    const key = String(body?.key || "").trim().toLowerCase();
    const name = String(body?.name || key || "Brawl").trim().slice(0, 120);
    const description = String(body?.description || "").trim().slice(0, 2000);
    const schemaVersion = Math.max(1, Math.min(1000, Number(body?.schemaVersion) || 1));
    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload as Record<string, unknown> : {};
    const validation = validateControlDefinition({
      domain: "brawls",
      key,
      name,
      description,
      dangerLevel: "elevated",
      schemaVersion,
      payload,
    });
    return Response.json({ ok: true, validation, contract: contractPayload() });
  } catch {
    return Response.json({ ok: false, error: "Invalid Brawl contract payload" }, { status: 400 });
  }
}
