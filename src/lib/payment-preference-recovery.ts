import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders, type PaymentOrder } from "@/db/schema";
import { getMercadoPagoPreference, searchMercadoPagoPreferences } from "@/lib/mercado-pago";

interface MercadoPagoPreferenceLike {
  id?: string | number;
  external_reference?: string;
  init_point?: string;
  sandbox_init_point?: string;
  preference_expired?: boolean;
  metadata?: Record<string, unknown>;
  items?: Array<{ id?: string | number }>;
}

export interface PreferenceRecoveryResult {
  recovered: boolean;
  ambiguous: boolean;
  checkoutUrl: string | null;
  preferenceId: string | null;
  matches: number;
}

function secureUrl(value: unknown): string | null {
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : null;
}

export function preferenceBelongsToOrder(preference: MercadoPagoPreferenceLike, externalReference: string) {
  const direct = String(preference.external_reference || "").trim();
  const metadata = String(preference.metadata?.runeforge_order || "").trim();
  const itemMatch = Array.isArray(preference.items)
    && preference.items.some((item) => String(item?.id || "").trim() === externalReference);
  return direct === externalReference || metadata === externalReference || itemMatch;
}

export function preferenceCheckoutUrl(preference: MercadoPagoPreferenceLike, environment: string) {
  if (preference.preference_expired === true) return null;
  return environment === "sandbox"
    ? secureUrl(preference.sandbox_init_point || preference.init_point)
    : secureUrl(preference.init_point);
}

function recoveryPayload(order: PaymentOrder, patch: Record<string, unknown>) {
  const previous = order.providerPayload && typeof order.providerPayload === "object" && !Array.isArray(order.providerPayload)
    ? order.providerPayload as Record<string, unknown>
    : {};
  return { ...previous, ...patch, requiresReview: true, lastRecoveryAt: new Date().toISOString() };
}

export async function markPaymentPreferenceAmbiguous(order: PaymentOrder, input: {
  errorCode: string;
  preferenceId?: string | null;
  checkoutUrl?: string | null;
  requestId?: string | null;
  matches?: number;
}) {
  const providerPreferenceId = String(input.preferenceId || "").trim() || order.providerPreferenceId || null;
  const providerPayload = recoveryPayload(order, {
    errorCode: input.errorCode,
    preferenceId: providerPreferenceId,
    checkoutUrl: input.checkoutUrl || null,
    requestId: input.requestId || null,
    matches: input.matches ?? null,
  });
  const updated = await db.update(paymentOrders).set({
    status: "preference_ambiguous",
    providerPreferenceId,
    providerPayload,
    updatedAt: new Date(),
  }).where(and(
    eq(paymentOrders.id, order.id),
    inArray(paymentOrders.status, ["creating", "preference_ambiguous"]),
  )).returning({ id: paymentOrders.id });
  return updated.length === 1;
}

/**
 * Recover a Checkout Pro preference whose remote POST outcome was ambiguous.
 * We only bind when exactly one non-expired preference can be proven to belong
 * to this local external_reference. Zero/partial/multiple matches stay fail-closed.
 */
export async function recoverMercadoPagoPreference(order: PaymentOrder, input: {
  accessToken: string;
  requestId?: string | null;
}): Promise<PreferenceRecoveryResult> {
  try {
    const search = await searchMercadoPagoPreferences(input.accessToken, order.externalReference);
    const elements = Array.isArray(search?.elements) ? search.elements : [];
    const ids = [...new Set(elements.map((element: Record<string, unknown>) => String(element?.id || "").trim()).filter(Boolean))].slice(0, 10);
    const details = await Promise.all(ids.map((id) => getMercadoPagoPreference(input.accessToken, id)));
    const candidates = details.filter((preference: MercadoPagoPreferenceLike) =>
      preferenceBelongsToOrder(preference, order.externalReference)
      && Boolean(preferenceCheckoutUrl(preference, order.providerEnvironment)),
    );

    if (candidates.length !== 1) {
      await markPaymentPreferenceAmbiguous(order, {
        errorCode: candidates.length > 1 ? "MULTIPLE_REMOTE_PREFERENCES" : "PREFERENCE_RECOVERY_PENDING",
        requestId: input.requestId,
        matches: candidates.length,
      });
      return { recovered: false, ambiguous: true, checkoutUrl: null, preferenceId: null, matches: candidates.length };
    }

    const candidate = candidates[0];
    const preferenceId = String(candidate.id || "").trim();
    const checkoutUrl = preferenceCheckoutUrl(candidate, order.providerEnvironment);
    if (!preferenceId || !checkoutUrl) {
      await markPaymentPreferenceAmbiguous(order, { errorCode: "PREFERENCE_RECOVERY_INVALID", requestId: input.requestId, matches: 1 });
      return { recovered: false, ambiguous: true, checkoutUrl: null, preferenceId: null, matches: 1 };
    }

    const updated = await db.update(paymentOrders).set({
      status: "preference_created",
      providerPreferenceId: preferenceId,
      providerPayload: { preferenceId, checkoutUrl, recovered: true, requiresReview: Boolean((order.providerPayload as Record<string, unknown> | null)?.requiresReview) },
      updatedAt: new Date(),
    }).where(and(
      eq(paymentOrders.id, order.id),
      inArray(paymentOrders.status, ["creating", "preference_ambiguous"]),
    )).returning({ id: paymentOrders.id });

    if (updated.length === 1) return { recovered: true, ambiguous: false, checkoutUrl, preferenceId, matches: 1 };
    const [fresh] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id)).limit(1);
    const freshUrl = fresh && fresh.status === "preference_created" && fresh.providerPreferenceId === preferenceId
      ? secureUrl((fresh.providerPayload as Record<string, unknown> | null)?.checkoutUrl)
      : null;
    if (freshUrl) return { recovered: true, ambiguous: false, checkoutUrl: freshUrl, preferenceId, matches: 1 };
    return { recovered: false, ambiguous: true, checkoutUrl: null, preferenceId: null, matches: 1 };
  } catch {
    await markPaymentPreferenceAmbiguous(order, { errorCode: "PREFERENCE_RECOVERY_LOOKUP_FAILED", requestId: input.requestId });
    return { recovered: false, ambiguous: true, checkoutUrl: null, preferenceId: null, matches: 0 };
  }
}
