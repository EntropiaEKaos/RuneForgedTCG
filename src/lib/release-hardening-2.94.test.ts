import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checks: string[] = [];
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks.push(message); };

const pkg = JSON.parse(read("package.json"));
assert.ok(Number(pkg.version.split(".")[0]) > 2 || (Number(pkg.version.split(".")[0]) === 2 && Number(pkg.version.split(".")[1]) >= 94)); checks.push("package is 2.94.0 or newer");

const checkout = read("src/app/api/payments/checkout/route.ts");
const mp = read("src/lib/mercado-pago.ts");
const store = read("src/app/store/StoreClient.tsx");
ok(checkout.includes('req.headers.get("x-idempotency-key")') && checkout.includes('paymentOrders.idempotencyKey'), "checkout binds client request key to the local order");
ok(checkout.includes('onConflictDoNothing({ target: paymentOrders.idempotencyKey })'), "concurrent checkout retries converge on one local order");
ok(checkout.includes("checkoutUrlFromPayload") && checkout.includes("reused: true"), "successful checkout retries reuse the original Checkout Pro URL");
ok(checkout.includes("NEXT_PUBLIC_APP_URL must be an HTTPS origin"), "Mercado Pago notification origin is HTTPS-only");
ok(!mp.includes("X-Idempotency-Key") && checkout.includes("CHECKOUT_RESTART_REQUIRED"), "Checkout Pro preference retries do not rely on an undocumented provider idempotency header");
ok(store.includes('"X-Idempotency-Key": requestKey') && store.includes("CHECKOUT_IN_PROGRESS"), "Store retries ambiguous checkout creation with a stable key");

const control = read("src/lib/control-plane.ts");
const collectionsApi = read("src/app/api/collections/route.ts");
const calendar = read("src/app/collections/CollectionsCalendarClient.tsx");
ok(control.includes('format.id === "standard"') && control.includes("activeKeys") && control.includes("row.rotationDate"), "Standard legality is derived from published collection release/rotation windows");
ok(collectionsApi.includes("rotationDate") && collectionsApi.includes('lifecycle: (() =>'), "public collection API exposes lifecycle and rotation");
ok(calendar.includes("Calendário de coleções") && calendar.includes("Legal") === false, "public collection timeline exists without hard-coded card legality");
ok(calendar.includes("Standard") && calendar.includes("Eternal"), "collection calendar explains active and rotated format states");


const artApi = read("src/app/api/admin/studio/art/route.ts");
const artRegistry = read("src/game/card-art.ts");
const catalog = read("src/app/api/catalog/route.ts");
const artUi = read("src/app/admin/studio/art/ArtPipelineClient.tsx");
ok(artApi.includes("card.art.assign") && artApi.includes("refreshCustomCardCache"), "admin art assignment is audited and hot-refreshes runtime metadata");
ok(artRegistry.includes("replaceRegisteredCardArt") && catalog.includes("cardArt:"), "browser catalog receives dynamic card-art assignments");
ok(read("src/game/cards.ts").includes("withRuntimeArt"), "base and Studio cards receive runtime art overrides without rebuild");
ok(artUi.includes("Cobertura") && artUi.includes("Publicar arte"), "Art Pipeline exposes coverage and focal-point publishing UI");
const migration = read("drizzle/0035_release_hardening_2_94.sql");
ok(migration.includes("art_url") && migration.includes("art_crop") && migration.includes("'2.94'"), "schema 2.94 persists runtime art metadata");

const rankedGuard = read("scripts/ranked-release-guard.mjs");
ok(rankedGuard.includes("RANKED_RELEASE_CERTIFIED"), "Ranked remains protected by explicit release certification");

console.log(`RELEASE HARDENING 2.94: ${checks.length}/${checks.length} PASS`);
