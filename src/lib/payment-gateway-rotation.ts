/**
 * Provider credentials/environment cannot be changed while an unfulfilled order
 * may still receive Mercado Pago events. A rejected/cancelled payment attempt is
 * not enough to prove that its Checkout Pro preference can no longer be retried.
 *
 * Keep this query shared by the admin route and the PostgreSQL certification so
 * the operational guard is executed, not merely asserted as source text.
 */
export const MERCADO_PAGO_ROTATION_BLOCKERS_SQL = `
SELECT count(*)::int n
FROM payment_orders
WHERE provider='mercadopago'
  AND fulfilled_at IS NULL
  AND (
    provider_preference_id IS NOT NULL
    OR status IN ('creating','preference_ambiguous')
  )
`;

export function mercadoPagoRotationBlockerCount(result: unknown) {
  const rows = (result as { rows?: Array<{ n?: number | string }> } | null)?.rows;
  const value = Number(rows?.[0]?.n ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
