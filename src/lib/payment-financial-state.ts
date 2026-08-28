export const MERCADO_PAGO_ADVERSE_STATUSES = new Set(["refunded", "charged_back"]);

export interface FulfilledPaymentEventDecision {
  requiresReview: boolean;
  preserveOrderStatus: boolean;
  duplicateProviderPayment: boolean;
  canonicalAdverseEvent: boolean;
}

/**
 * Decide how a provider event may affect an order that has already delivered
 * its grants. The approved payment id is canonical after fulfillment:
 * - benign delayed events never downgrade the local order status;
 * - review is sticky once raised;
 * - a second approved payment is a financial incident, not another grant;
 * - refund/chargeback from a non-canonical payment attempt cannot claim that
 *   the canonical purchase itself was refunded.
 */
export function decideFulfilledPaymentEvent(input: {
  providerStatus: string;
  eventPaymentId: string;
  canonicalPaymentId: string | null;
  previousRequiresReview: boolean;
}): FulfilledPaymentEventDecision {
  const adverse = MERCADO_PAGO_ADVERSE_STATUSES.has(input.providerStatus);
  const hasCanonical = Boolean(input.canonicalPaymentId);
  const duplicateProviderPayment = Boolean(
    hasCanonical && input.eventPaymentId !== input.canonicalPaymentId,
  );

  if (input.providerStatus === "approved") {
    return {
      requiresReview: input.previousRequiresReview || duplicateProviderPayment,
      preserveOrderStatus: true,
      duplicateProviderPayment,
      canonicalAdverseEvent: false,
    };
  }

  if (adverse) {
    const canonicalAdverseEvent = !hasCanonical || !duplicateProviderPayment;
    return {
      requiresReview: true,
      preserveOrderStatus: !canonicalAdverseEvent,
      duplicateProviderPayment,
      canonicalAdverseEvent,
    };
  }

  return {
    requiresReview: input.previousRequiresReview,
    preserveOrderStatus: true,
    duplicateProviderPayment,
    canonicalAdverseEvent: false,
  };
}
