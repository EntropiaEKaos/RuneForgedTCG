import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentGatewaySettings } from "@/db/schema";
import { decryptPaymentSecret } from "@/lib/payment-crypto";

export async function getMercadoPagoSettings(includeSecrets = false) {
  const [row] = await db.select().from(paymentGatewaySettings).where(eq(paymentGatewaySettings.provider, "mercadopago")).limit(1);
  if (!row) return null;
  return {
    ...row,
    accessToken: includeSecrets ? decryptPaymentSecret(row.accessTokenEncrypted) : undefined,
    webhookSecret: includeSecrets ? decryptPaymentSecret(row.webhookSecretEncrypted) : undefined,
    accessTokenConfigured: Boolean(row.accessTokenEncrypted),
    webhookSecretConfigured: Boolean(row.webhookSecretEncrypted),
  };
}
