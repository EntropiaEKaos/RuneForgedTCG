import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nav = readFileSync("src/components/SiteNav.tsx", "utf8");
const legacyCss = readFileSync("src/app/styles/visual-2-0-meta-ui.css", "utf8");
const clientCss = readFileSync("src/app/styles/client-shell-1-0.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const doc = readFileSync("docs/FORGED-CLIENT-1-0.md", "utf8");

assert.ok(nav.startsWith('"use client";'), "FORGED client navigation remains a client component for router projection");
assert.ok(nav.includes('import { usePathname } from "next/navigation";'), "FORGED client derives active state from Next.js routing");
assert.ok(nav.includes('const pathname = usePathname() || "/";'), "Current URL remains client navigation authority");
assert.ok(nav.includes('fetch("/api/client/context"'), "Client shell may read only the anonymous-safe client context for identity/admin projection");
assert.doesNotMatch(nav, /localStorage|sessionStorage|axios/, "Client navigation must not invent persistence or an alternate router state");

for (const route of [
  "/play", "/pvp", "/ranked", "/draft", "/simulate",
  "/modes", "/collection", "/collections", "/album", "/forge", "/store", "/market",
  "/community", "/friends", "/leaderboard", "/profile", "/profile/security", "/codex", "/lore",
]) {
  assert.ok(nav.includes(`\"${route}\"`), `FORGED client must preserve route discovery for ${route}`);
}

assert.ok(nav.includes('data-client-shell="true"'), "Shared chrome exposes the FORGED client-shell identity");
assert.ok(nav.includes('data-active={active ? "true" : "false"}'), "Client destinations expose stable active-state hooks");
assert.ok(nav.includes('aria-current={active ? "page" : undefined}'), "Client navigation exposes aria-current for the active route family");
assert.ok(nav.includes("{canStudio && ("), "Studio entry remains conditional rather than public");
assert.ok(nav.includes('href="/admin/studio"'), "Authorized admins retain direct Studio access from the client shell");
assert.ok(nav.includes('Acesso & Segurança'), "Identity/security remains discoverable after the client-shell migration");

assert.ok(
  layout.includes('import "./styles/visual-2-0-fx-atmosphere-polish.css";\nimport "./styles/visual-2-0-meta-ui.css";'),
  "Historical Visual 2.0 Meta UI layer remains mounted after certified FX/atmosphere layers",
);
assert.ok(
  layout.indexOf('import "./styles/client-shell-1-0.css";') > layout.indexOf('import "./styles/brand-identity-1-1-product.css";'),
  "FORGED Client 1.0 shell must mount after the certified product identity layer",
);

assert.ok(legacyCss.includes('.rf-nav-link[data-active="true"]'), "Historical Meta UI CSS remains available to untouched legacy surfaces");
assert.ok(clientCss.includes(".rf-client-topbar") && clientCss.includes("position: fixed"), "FORGED client has persistent application topbar chrome");
assert.ok(clientCss.includes(".rf-client-rail"), "FORGED client has a persistent desktop navigation rail");
assert.ok(clientCss.includes('@media (max-width: 900px)') && clientCss.includes('overflow-x: auto'), "Narrow FORGED client uses a discoverable horizontally scrollable bottom dock");
assert.ok(clientCss.includes('@media (prefers-reduced-motion: reduce)'), "FORGED client transitions obey reduced motion");
assert.doesNotMatch(clientCss, /\.rf-client-rail\s*\{[^}]*display\s*:\s*none/s, "Client navigation must never disappear behind an unimplemented drawer");

assert.ok(doc.includes("The current URL remains the authority"), "FORGED Client 1.0 documentation preserves router authority");
assert.ok(doc.includes("game or match authority") && doc.includes("player progression/economy authority") && doc.includes("CardDef"), "FORGED Client documentation preserves gameplay/content/economy boundaries");
assert.ok(doc.includes("No FORGED Client 1.0 slice is promoted from static CSS or source inspection alone"), "Full visual/browser certification remains mandatory");

console.log("FORGED CLIENT 1.0 META UI COMPATIBILITY: PASS");
