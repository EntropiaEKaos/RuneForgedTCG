import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Visual Feature Freeze baseline certified by CI #632 on main SHA
 * 9fb9575831e603664070f04caea68e5c70c9e057.
 *
 * These are Git blob SHAs, not arbitrary checksums. A deliberate structural
 * visual change must update this baseline and explain the freeze break in the PR.
 * Editorial card art under /public/art/cards/flagship is intentionally outside it.
 */
const FROZEN_VISUAL_BLOBS: Record<string, string> = {
  "src/app/layout.tsx": "44674faeb04fbbea589f3b871ae70ae61a92d03f",
  "src/app/play/BattleView.tsx": "262fa96ccf79c59027d19b9b2baf404f9bbc5e7c",
  "src/components/CardView.tsx": "aefb06413aaf9927fa435579ee39a717ff9d38d7",
  "src/components/game/ArenaIdentity.tsx": "6cf2a95b90f6fa49ed3ebd6b90938e07f1368cbb",
  "src/app/styles/visual-3-0-battlefield-cinematic.css": "3bf86d3b3729265db77b7ec8c92f58ae8a6bb04b",
  "src/app/styles/visual-3-1-card-presentation.css": "d5e6cafb58ce0aa759d249d2332b7753294042bd",
  "src/app/styles/visual-3-2-meta-world.css": "7c521b595c2614ad6914c8648815fe9c1c34a102",
};

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

for (const [path, certifiedSha] of Object.entries(FROZEN_VISUAL_BLOBS)) {
  assert.equal(
    gitBlobSha(path),
    certifiedSha,
    `${path} changed after Alpha Visual Feature Freeze. Treat this as a freeze break: document why, rerun full CI/browser artifacts and update the certified blob intentionally.`,
  );
}

const layout = readFileSync("src/app/layout.tsx", "utf8");
const orderedLayers = [
  'import "./styles/visual-3-0-battlefield-cinematic.css";',
  'import "./styles/visual-3-1-card-presentation.css";',
  'import "./styles/visual-3-2-meta-world.css";',
];
let previous = -1;
for (const layer of orderedLayers) {
  const index = layout.indexOf(layer);
  assert.ok(index > previous, `certified visual layer order changed or disappeared: ${layer}`);
  previous = index;
}

assert.equal(
  /visual-3-[3-9][^\n]*\.css/.test(layout),
  false,
  "Alpha Visual Feature Freeze forbids another structural Visual 3.x pass before release; ship editorial art or use the documented break-glass process instead",
);

console.log("RUNE FORGE ALPHA VISUAL FEATURE FREEZE: 7 certified structural blobs PASS");
