import { db } from "@/db";
import { authProviderSettings } from "@/db/schema";
import { AUTH_PROVIDERS, providerReady } from "@/lib/identity-auth";
import { ensureIdentityAuthSchema } from "@/lib/identity-auth-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureIdentityAuthSchema();
  const rows = await db.select().from(authProviderSettings);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return Response.json({
    ok: true,
    providers: AUTH_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider) ?? null;
      return { provider, enabled: providerReady(row) };
    }),
  }, { headers: { "cache-control": "no-store" } });
}
