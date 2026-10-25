import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("card tooltip waits two seconds before opening on mouse hover", () => {
  const tooltip = source("src/components/Tooltip.tsx");
  assert.match(tooltip, /HOVER_OPEN_MS = 2000/);
  assert.match(tooltip, /setTimeout\(\(\) => \{[\s\S]*?setPos\(hoverPoint\.current\)[\s\S]*?HOVER_OPEN_MS\)/);
  assert.match(tooltip, /onMouseLeave=\{\(\) => \{ clearHoverTimer\(\); scheduleClose\(\); \}\}/);
});

test("targeting can be canceled using Escape", () => {
  const hud = source("src/components/game/TargetingHud.tsx");
  assert.match(hud, /event\.key !== "Escape"/);
  assert.match(hud, /onCancel\(\)/);
});

test("combat event narration queues results and does not block board input", () => {
  const narration = source("src/components/game/BattleNarration.tsx");
  assert.match(narration, /setQueue\(\(current\) => \[\.\.\.current, \.\.\.fresh\]/);
  assert.match(narration, /pointer-events-none/);
  assert.match(narration, /seen\.current = new Set\(events\.map/);
});

test("small unit stat badges retain fixed room inside card", () => {
  const css = source("src/app/styles/alpha-battlefield.css");
  assert.match(css, /\.tcg-arena \.card-shell \.card-stats/);
  assert.match(css, /min-width: max-content/);
  assert.match(css, /\.tcg-arena \.card-shell \.stat-power/);
});

test("cinematic choreography derives cues from confirmed FX without changing game authority", () => {
  const choreography = source("src/components/game/CombatChoreography.tsx");
  for (const event of ["impact", "summon", "death", "levelup", "dmg", "heal", "barrier", "barrierbreak", "frost", "stun", "poison", "nexushit"]) {
    assert.match(choreography, new RegExp(`\\b${event}: \\{ kicker:`));
  }
  assert.match(choreography, /data-cinematic-cue="true"/);
  assert.match(choreography, /data-pace=\{pace\}/);
  assert.match(choreography, /events\]\.reverse\(\)\.find/);
  assert.doesNotMatch(choreography, /dispatch\(|setState\(|fetch\(/);
});
