import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const experience = readFileSync("src/components/MatchExperience.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-4-4-battlefield-ux.css", "utf8");

const responsiveImport = 'import "./styles/visual-4-0-responsive-battlefield.css";';
const uxImport = 'import "./styles/visual-4-4-battlefield-ux.css";';
assert.ok(layout.includes(uxImport), "Visual 4.4 stylesheet must be loaded");
assert.ok(layout.indexOf(uxImport) > layout.indexOf(responsiveImport), "Visual 4.4 must load after responsive battlefield CSS");

for (const contract of [
  'data-phase={phase}',
  'data-phase-id={item.id}',
  'aria-current={item.id === phase ? "step" : undefined}',
  'data-pressure-band={pressureBand}',
]) {
  assert.ok(experience.includes(contract), `Visual 4.4 semantic contract missing: ${contract}`);
}

for (const contract of [
  '.match-command-rail[data-phase="main"]',
  '.match-command-rail[data-phase="combat"]',
  '.match-command-rail[data-phase="response"]',
  '.targeting-hud[data-targeting-mode="reaction"]',
  '[data-activated-ability-tray] button:not(:disabled)',
  '.attack-forecast[data-pressure-band="critical"]',
  ':focus-visible',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(css.includes(contract), `Visual 4.4 presentation contract missing: ${contract}`);
}

assert.ok(experience.includes("antes dos bloqueios"), "attack forecast must remain explicitly pre-block pressure");
assert.equal(/letal|lethal/i.test(css), false, "Visual 4.4 must not visually claim lethal damage from pre-block pressure");

console.log("RUNE FORGE VISUAL 4.4 BATTLEFIELD UX: source contract PASS");
