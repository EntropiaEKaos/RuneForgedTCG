import assert from "node:assert/strict";
import { createMercadoPagoPreference, getMercadoPagoPayment, searchMercadoPagoPayments } from "@/lib/mercado-pago";
import { canBindApprovedProviderPayment } from "@/lib/payment-provider-link";

async function main() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url:string; init:RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const payload = url.includes("/checkout/preferences")
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
    console.log("MERCADO PAGO 2.93 API CONTRACT: 18/18 PASS");
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
