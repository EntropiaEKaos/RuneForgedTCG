export interface PaymentProviderLinkState {
  providerPaymentId: string | null;
  status: string;
  fulfilledAt: Date | string | null;
}

/**
 * An order may see several Mercado Pago payment attempts for one preference.
 * Pending/rejected attempts are not authoritative bindings: a later approved
 * attempt can legitimately carry a different payment id. Once an order is
 * approved or fulfilled, however, the canonical provider payment id is fixed.
 */
export function canBindApprovedProviderPayment(
  state: PaymentProviderLinkState,
  approvedPaymentId: string,
): boolean {
  const current = String(state.providerPaymentId || "").trim();
  const next = String(approvedPaymentId || "").trim();
  if (!next) return false;
  if (!current || current === next) return true;
  return !state.fulfilledAt && state.status !== "approved";
}
