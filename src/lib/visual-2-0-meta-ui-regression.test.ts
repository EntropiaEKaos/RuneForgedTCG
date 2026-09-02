import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nav = readFileSync("src/components/SiteNav.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-2-0-meta-ui.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const doc = readFileSync("docs/VISUAL-2-0-META-UI.md", "utf8");

assert.ok(nav.startsWith('"use client";'), "Meta UI navigation must remain a client component for router projection");
assert.ok(nav.includes('import { usePathname } from "next/navigation";'), "Meta UI must derive active state from Next.js routing");
assert.ok(nav.includes("const pathname = usePathname() || \"/\";"), "Current URL must remain the only Meta UI state signal");
assert.doesNotMatch(nav, /fetch\s*\(|axios|localStorage|sessionStorage|useState\s*\(/, "Meta UI must not invent API, persistence or parallel navigation state");

for (const section of ["play", "modes", "collection", "forge", "community"]) {
  assert.ok(nav.includes(`id: \"${section}\"`), `Primary Meta UI section ${section} must remain declared`);
}

for (const route of [
  "/play", "/pvp", "/ranked", "/draft", "/simulate",
  "/modes", "/collection", "/collections", "/album", "/forge", "/store",
  "/community", "/friends", "/leaderboard", "/profile", "/codex", "/admin",
]) {
  assert.ok(nav.includes(`\"${route}\"`), `Meta UI must preserve route discovery for ${route}`);
}

assert.ok(nav.includes('data-meta-section={activeSection?.id ?? "home"}'), "Shared chrome must expose the resolved route family for presentation only");
assert.ok(nav.includes('data-active={active ? "true" : "false"}'), "Primary/context links must expose stable active-state hooks");
assert.ok(nav.includes('aria-current={pathname === section.href ? "page" : undefined}'), "Primary aria-current must be exact rather than family-wide");
assert.ok(nav.includes('aria-current={pathname === link.href ? "page" : undefined}'), "Context aria-current must be exact rather than prefix-wide");
assert.ok(nav.includes('aria-label={`Atalhos — ${context.contextLabel}`}'), "Context rail must remain an independently labeled navigation landmark");

assert.ok(
  layout.includes('import "./styles/visual-2-0-fx-atmosphere-polish.css";\nimport "./styles/visual-2-0-meta-ui.css";'),
  "Meta UI must load after certified FX/atmosphere layers",
);

assert.ok(css.includes('.rf-nav-link[data-active="true"]'), "Primary active section treatment must exist");
assert.ok(css.includes('.rf-context-link[data-active="true"]'), "Context active destination treatment must exist");
assert.ok(css.includes('.rf-meta-action[data-active="true"]'), "Utility active treatment must exist");
assert.ok(css.includes('@media (max-width: 920px)') && css.includes('overflow-x: auto'), "Narrow Meta UI must preserve discoverability through horizontal scrolling");
assert.ok(css.includes('.rf-context-links::-webkit-scrollbar { display: none; }'), "Context rail scrolling must remain visually quiet without removing navigation");
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), "Meta UI transitions must obey reduced motion");
assert.doesNotMatch(css, /\.rf-nav\s*\{[^}]*display\s*:\s*none/s, "Primary navigation must never disappear behind an unimplemented drawer");
assert.doesNotMatch(css, /\.rf-context-links\s*\{[^}]*display\s*:\s*none/s, "Context navigation must remain present at supported widths");

assert.ok(doc.includes("The current URL is the only state used by this slice"), "Documentation must preserve router authority");
assert.ok(doc.includes("all existing 85 behavioral targets unchanged"), "Documentation must preserve behavioral baseline");
assert.ok(doc.includes("game or match authority") && doc.includes("player progression/economy") && doc.includes("CardDef"), "Documentation must preserve gameplay/content/economy boundaries");
assert.ok(doc.includes("No Meta UI slice is merged from static CSS inspection alone"), "Visual browser certification must remain mandatory");

console.log("RUNE FORGE VISUAL 2.0 META UI: PASS");
