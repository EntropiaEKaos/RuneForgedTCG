import assert from "node:assert/strict";
import { createMercadoPagoPreference, getMercadoPagoPayment, getMercadoPagoPreference, searchMercadoPagoPayments, searchMercadoPagoPreferences } from "@/lib/mercado-pago";
import { decideFulfilledPaymentEvent } from "@/lib/payment-financial-state";
import { canBindApprovedProviderPayment } from "@/lib/payment-provider-link";

async function main() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url:string; init:RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const payload = url.includes("/checkout/preferences/search")
      ? { total: 1, elements: [{ id: "pref-recovered-293" }] }
      : url.includes("/checkout/preferences/pref-recovered-293")
        ? { id: "pref-recovered-293", external_reference: "rf_test_293", init_point: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-recovered-293", sandbox_init_point: "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref-recovered-293", items: [{ id: "rf_test_293" }] }
        : url.endsWith("/checkout/preferences")
          ? { id: "pref-293", init_point: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-293", sandbox_init_point: "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref-293" }
          : url.includes("/v1/payments/search")
            ? { paging: { total: 1 }, results: [{ id: 293, external_reference: "rf_test_293", status: "approved" }] }
            : { id: 293, external_reference: "rf_test_293", status: "approved" };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const preference = await createMercadoPagoPreference({
      accessToken: "APP_USR_TEST_293",
      title: "RuneForge Vanilla Starter",
      unitPrice: 9.9,
      currency: "BRL",
      externalReference: "rf_test_293",
      notificationUrl: "https://runeforge.example.com/api/payments/webhook",
      successUrl: "https://runeforge.example.com/store?payment=success",
      failureUrl: "https://runeforge.example.com/store?payment=failure",
      pendingUrl: "https://runeforge.example.com/store?payment=pending",
      statementDescriptor: "RUNEFORGE",
    });
    assert.equal(preference.id, "pref-293");
    const prefCall = calls.at(-1)!;
    assert.equal(prefCall.url, "https://api.mercadopago.com/checkout/preferences");
    assert.equal((prefCall.init.headers as Record<string,string>).Authorization, "Bearer APP_USR_TEST_293");
    const body = JSON.parse(String(prefCall.init.body));
    assert.equal(body.external_reference, "rf_test_293");
    assert.equal(body.notification_url, "https://runeforge.example.com/api/payments/webhook");
    assert.equal(body.back_urls.success, "https://runeforge.example.com/store?payment=success");
    assert.equal(body.items[0].currency_id, "BRL");
    assert.equal(body.items[0].unit_price, 9.9);

    const preferenceSearch = await searchMercadoPagoPreferences("APP_USR_TEST_293", "rf_test_293");
    assert.equal(preferenceSearch.elements[0].id, "pref-recovered-293");
    const preferenceSearchCall = calls.at(-1)!;
    const preferenceSearchUrl = new URL(preferenceSearchCall.url);
    assert.equal(preferenceSearchUrl.pathname, "/checkout/preferences/search");
    assert.equal(preferenceSearchUrl.searchParams.get("external_reference"), "rf_test_293");
    assert.equal((preferenceSearchCall.init.headers as Record<string,string>).Authorization, "Bearer APP_USR_TEST_293");

    const recoveredPreference = await getMercadoPagoPreference("APP_USR_TEST_293", "pref-recovered-293");
    assert.equal(recoveredPreference.id, "pref-recovered-293");
    assert.equal(calls.at(-1)!.url, "https://api.mercadopago.com/checkout/preferences/pref-recovered-293");

    const search = await searchMercadoPagoPayments("APP_USR_TEST_293", "rf_test_293");
    assert.equal(search.results[0].id, 293);
    const searchCall = calls.at(-1)!;
    const searchUrl = new URL(searchCall.url);
    assert.equal(searchUrl.pathname, "/v1/payments/search");
    assert.equal(searchUrl.searchParams.get("external_reference"), "rf_test_293");
    assert.equal(searchUrl.searchParams.get("range"), "date_created");
    assert.ok(searchUrl.searchParams.get("begin_date"));
    assert.ok(searchUrl.searchParams.get("end_date"));
    assert.equal((searchCall.init.headers as Record<string,string>).Authorization, "Bearer APP_USR_TEST_293");

    const payment = await getMercadoPagoPayment("APP_USR_TEST_293", "293");
    assert.equal(payment.id, 293);
    assert.equal(calls.at(-1)!.url, "https://api.mercadopago.com/v1/payments/293");

    assert.equal(canBindApprovedProviderPayment({ providerPaymentId: "pending-1", status: "pending", fulfilledAt: null }, "approved-2"), true, "a retry approval may replace a non-approved attempt id");
    assert.equal(canBindApprovedProviderPayment({ providerPaymentId: "approved-1", status: "approved", fulfilledAt: null }, "approved-2"), false, "an approved binding must not be replaced by another payment id");
    assert.equal(canBindApprovedProviderPayment({ providerPaymentId: "approved-1", status: "approved", fulfilledAt: new Date() }, "approved-2"), false, "a fulfilled order must never rebind its canonical provider payment");

    const duplicateApproval = decideFulfilledPaymentEvent({ providerStatus: "approved", eventPaymentId: "approved-2", canonicalPaymentId: "approved-1", previousRequiresReview: false });
    assert.equal(duplicateApproval.duplicateProviderPayment, true, "a second approved payment must be identified");
    assert.equal(duplicateApproval.requiresReview, true, "a second approved payment must require financial review");
    assert.equal(duplicateApproval.preserveOrderStatus, true, "a second approved payment must not replace canonical order status");

    const canonicalRefund = decideFulfilledPaymentEvent({ providerStatus: "refunded", eventPaymentId: "approved-1", canonicalPaymentId: "approved-1", previousRequiresReview: false });
    assert.equal(canonicalRefund.canonicalAdverseEvent, true, "canonical refund must be authoritative");
    assert.equal(canonicalRefund.preserveOrderStatus, false, "canonical refund may transition the order to refunded");
    assert.equal(canonicalRefund.requiresReview, true, "canonical refund must require review");

    const delayedPending = decideFulfilledPaymentEvent({ providerStatus: "pending", eventPaymentId: "retry-3", canonicalPaymentId: "approved-1", previousRequiresReview: true });
    assert.equal(delayedPending.preserveOrderStatus, true, "delayed pending must not downgrade a fulfilled order");
    assert.equal(delayedPending.requiresReview, true, "a later benign event must not clear an existing financial review");

    const duplicateRefund = decideFulfilledPaymentEvent({ providerStatus: "refunded", eventPaymentId: "approved-2", canonicalPaymentId: "approved-1", previousRequiresReview: false });
    assert.equal(duplicateRefund.duplicateProviderPayment, true, "adverse event on a second payment must retain duplicate identity");
    assert.equal(duplicateRefund.preserveOrderStatus, true, "refund of a non-canonical payment must not mark the canonical purchase refunded");
    assert.equal(duplicateRefund.requiresReview, true, "refund of a duplicate payment still requires review");

    console.log("MERCADO PAGO 2.93 API + 2.97.9 FINANCIAL STATE: 35/35 PASS");
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
