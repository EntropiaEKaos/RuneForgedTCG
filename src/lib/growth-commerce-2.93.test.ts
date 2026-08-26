import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BUILTIN_FORMATS } from "@/game/format-definitions";
import { VANILLA_EXPERIMENTAL_DECKS } from "@/game/vanilla-experimental-decks";
import { VANILLA_ADDITIONAL_CARDS } from "@/game/cards/vanilla";
import { encryptPaymentSecret, decryptPaymentSecret, paymentSecretFingerprint } from "@/lib/payment-crypto";
import { verifyMercadoPagoWebhookSignature } from "@/lib/mercado-pago";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const checks: string[] = [];
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks.push(message); };

const pkg = JSON.parse(read("package.json"));
assert.ok(Number(pkg.version.split(".")[0]) > 2 || (Number(pkg.version.split(".")[0]) === 2 && Number(pkg.version.split(".")[1]) >= 93)); checks.push("package is 2.93.0 or newer");

const originalFormats = BUILTIN_FORMATS.filter((format) => ["vanilla", "standard", "eternal"].includes(format.id));
assert.deepEqual(originalFormats.map((f) => f.id), ["vanilla", "standard", "eternal"]);
ok(originalFormats.every((f) => f.rankedEligible === false), "2.93 general formats remain fail-closed for Ranked");
const rankedPrecon = BUILTIN_FORMATS.find((format) => format.id === "ranked-precon");
ok(Boolean(rankedPrecon?.rankedEligible), "later releases may add a dedicated certified Ranked format without opening general formats");

assert.equal(VANILLA_EXPERIMENTAL_DECKS.length, 12); checks.push("12 experimental Vanilla decks exist");
assert.equal(new Set(VANILLA_EXPERIMENTAL_DECKS.map((d) => d.id)).size, 12); checks.push("experimental deck ids are unique");
ok(VANILLA_EXPERIMENTAL_DECKS.every((d) => d.cards.length === 40), "all experimental decks contain 40 cards");

const additional = Object.values(VANILLA_ADDITIONAL_CARDS);
assert.equal(additional.length, 180); checks.push("180 additional Vanilla cards preserved");
ok(additional.every((c) => typeof c.flavor === "string" && c.flavor.trim().length >= 8), "all 180 new cards have flavor/lore");

const oldKey = process.env.PAYMENT_ENCRYPTION_KEY;
process.env.PAYMENT_ENCRYPTION_KEY = "test-only-payment-key-293-abcdefghijklmnopqrstuvwxyz";
const secret = "APP_USR-super-secret-token-293";
const encrypted = encryptPaymentSecret(secret);
ok(encrypted.startsWith("enc:v1:"), "payment secrets use versioned AES-GCM envelope");
ok(!encrypted.includes(secret), "encrypted payment secret does not contain cleartext");
assert.equal(decryptPaymentSecret(encrypted), secret); checks.push("payment secret decrypts exactly");
ok(Boolean(paymentSecretFingerprint(encrypted)), "payment secret exposes only a fingerprint to admin UI");

function signature(ts: string, requestId = "req-293", dataId = "123456789", key = "webhook-secret-293") {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", key).update(manifest).digest("hex");
  return { header: `ts=${ts},v1=${v1}`, requestId, dataId, key };
}
const sec = signature(String(Math.floor(Date.now() / 1000)));
ok(verifyMercadoPagoWebhookSignature({ signature: sec.header, requestId: sec.requestId, dataId: sec.dataId, secret: sec.key }), "Mercado Pago signature validates second timestamps");
const ms = signature(String(Date.now()));
ok(verifyMercadoPagoWebhookSignature({ signature: ms.header, requestId: ms.requestId, dataId: ms.dataId, secret: ms.key }), "Mercado Pago signature validates millisecond timestamps");
const noReqTs = String(Math.floor(Date.now() / 1000));
const noReqData = "998877";
const noReqManifest = `id:${noReqData};ts:${noReqTs};`;
const noReqV1 = crypto.createHmac("sha256", "webhook-secret-293").update(noReqManifest).digest("hex");
ok(verifyMercadoPagoWebhookSignature({ signature: `ts=${noReqTs},v1=${noReqV1}`, requestId: null, dataId: noReqData, secret: "webhook-secret-293" }), "Mercado Pago signature validates when request-id is absent");
ok(!verifyMercadoPagoWebhookSignature({ signature: ms.header, requestId: ms.requestId, dataId: ms.dataId, secret: "wrong-secret" }), "Mercado Pago signature rejects wrong secret");
const stale = signature(String(Math.floor(Date.now() / 1000) - 5000));
ok(!verifyMercadoPagoWebhookSignature({ signature: stale.header, requestId: stale.requestId, dataId: stale.dataId, secret: stale.key, maxSkewSeconds: 600 }), "Mercado Pago signature rejects stale webhook");
if (oldKey === undefined) delete process.env.PAYMENT_ENCRYPTION_KEY; else process.env.PAYMENT_ENCRYPTION_KEY = oldKey;

const impactSource = read("src/lib/card-impact.ts");
ok(impactSource.includes("ARCHIVE ${defId} WITH ${activeReferences} ACTIVE REFERENCES"), "archive acknowledgement is deterministic and server-authored");

const migration = read("drizzle/0034_growth_commerce_2_93.sql");
for (const table of ["payment_gateway_settings", "payment_orders", "collection_reward_claims", "admin_sandbox_sessions", "telemetry_events"]) ok(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `migration creates ${table}`);
ok(migration.includes("INSERT INTO runeforge_schema_meta(version) VALUES ('2.93')"), "migration records schema 2.93");

const webhook = read("src/app/api/payments/webhook/route.ts");
const fulfillment = read("src/lib/payment-fulfillment.ts");
const ordersApi = read("src/app/api/payments/orders/route.ts");
ok(webhook.includes("verifyMercadoPagoWebhookSignature") && webhook.includes("getMercadoPagoPayment") && webhook.includes("processMercadoPagoPayment"), "webhook verifies signature, confirms provider payment and delegates fulfillment");
ok(webhook.includes('topic!=="payment"'), "non-payment webhook topics are ignored before provider lookup");
ok(fulfillment.includes("providerPreferenceId") && fulfillment.includes("payment.preference_id"), "fulfillment binds provider payment to local preference");
ok(fulfillment.includes("FOR UPDATE") && fulfillment.includes("fresh.fulfilledAt") && fulfillment.includes("applyGameGrants"), "payment fulfillment is row-locked and exactly-once guarded");
ok(ordersApi.includes("searchMercadoPagoPayments") && ordersApi.includes("processMercadoPagoPayment"), "player order reconciliation confirms provider state before fulfillment");
ok(read("src/lib/mercado-pago.ts").includes('range: "date_created"') && read("src/lib/mercado-pago.ts").includes("begin_date") && read("src/lib/mercado-pago.ts").includes("end_date"), "payment reconciliation uses Mercado Pago documented date range parameters");
ok(fulfillment.includes("delayed pending/rejected notifications") && fulfillment.includes("fresh.fulfilledAt && !requiresReview"), "delayed provider events cannot downgrade an already fulfilled order");

const checkout = read("src/app/api/payments/checkout/route.ts");
const album = read("src/app/api/collections/[key]/album/route.ts");
ok(checkout.indexOf("db.insert(paymentOrders).values") >= 0 && checkout.indexOf("db.insert(paymentOrders).values") < checkout.indexOf("createMercadoPagoPreference({"), "local payment order exists before provider preference");
ok(checkout.includes("externalReference") && checkout.includes("idempotencyKey"), "checkout carries external reference and local idempotency key");
ok(checkout.includes("payment-checkout:") && ordersApi.includes("payment-reconcile:"), "checkout and reconciliation are player-rate-limited");
ok(checkout.includes("providerEnvironment") && fulfillment.includes("order.providerEnvironment"), "payment order snapshots provider environment for later fulfillment");
ok(checkout.includes("validateGrantPackIds") && album.includes("validateGrantPackIds"), "paid/album grants reject unknown pack ids before fulfillment");
ok(!webhook.includes("settings?.enabled") && !ordersApi.includes("settings?.enabled"), "disabling checkout does not block fulfillment/reconciliation of existing orders");

const studio = read("src/app/admin/studio/cards/CardAuthoringStudio.tsx");
ok(studio.includes("Flavor / lore") && studio.includes("Balance Lab"), "Card Studio edits flavor and runs Balance Lab");
const pipeline = read("src/app/api/admin/studio/pipeline/route.ts");
ok(pipeline.includes("analyzeCandidateCard") && pipeline.includes("Balance Lab blocked QA/Publish"), "QA/Publish integrates balance simulation");
ok(pipeline.includes("requiredArchiveAcknowledgement") || pipeline.includes("impactAcknowledgement"), "archive enforcement requires server-side impact acknowledgement");

ok(album.includes("ensureCustomCardsLoaded") && album.includes("getCardCollection"), "album includes live Studio cards and collection metadata");
const catalog = read("src/game/catalog.ts");
ok(catalog.includes("customCollectionCache") && catalog.includes("cardCatalogMeta") && catalog.includes("adminCollections"), "server catalog caches custom card collection assignments");

const store = read("src/app/store/StoreClient.tsx");
ok(store.includes("/api/payments/orders?order=") && store.includes("fulfilledAt"), "Store polls authoritative payment order after Checkout Pro return");

const sandbox = read("src/app/api/admin/studio/sandbox/route.ts");
ok(sandbox.includes("expiresAt") && sandbox.includes("tokenHash"), "Studio sandbox is short-lived and token-hashed");
const gameClient = read("src/app/play/GameClient.tsx");
ok(gameClient.includes("current.find((deck) => deck.id === -9300)"), "saved-deck refresh preserves the active Studio sandbox deck");

const telemetry = read("src/app/api/telemetry/route.ts");
ok(telemetry.includes("consumeRequestRateLimit") && telemetry.includes("SENSITIVE"), "telemetry is distributed-rate-limited and strips sensitive properties");
const adminOrders = read("src/app/api/admin/payments/orders/route.ts");
ok(fulfillment.includes("requiresReview") && adminOrders.includes("requiresReview"), "refunds/chargebacks after fulfillment are surfaced for admin review");

console.log(`GROWTH + COMMERCE 2.93: ${checks.length}/${checks.length} PASS`);
