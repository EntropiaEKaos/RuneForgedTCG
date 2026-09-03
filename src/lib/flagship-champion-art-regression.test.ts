import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));
const cardArt = read("src/game/card-art.ts");
const nextConfig = read("next.config.ts");
const championGenerator = read("scripts/generate-flagship-champion-art.mjs");
const championRegistry = read("src/game/flagship-champion-art.ts");

assert.equal(pkg.scripts["flagship:art:champions"], "node scripts/generate-flagship-champion-art.mjs");
assert.equal(pkg.scripts.predev, "npm run flagship:art:champions", "dev must generate flagship Champion assets before Next starts");
assert.equal(pkg.scripts.prebuild, "npm run flagship:art:champions", "production build must generate flagship Champion assets before Next builds");

for (const contract of [
  "const WIDTH = 1536",
  "const HEIGHT = 1920",
  ".webp({ quality: 88",
  "public/art/cards/flagship/",
  "FLAGSHIP CHAMPION ART: generated",
]) {
  assert.ok(championGenerator.includes(contract), `Champion generator must preserve ${contract}`);
}

for (const [region, defId] of [
  ["emberhold", "ember_champion"],
  ["tidecall", "tide_champion"],
  ["ironwood", "wood_champion"],
  ["voidborn", "void_champion"],
  ["florestia", "forest_champion"],
  ["tempestade", "storm_champion"],
]) {
  assert.ok(championGenerator.includes(`defId: "${defId}"`), `${defId} Champion generator source missing`);
  assert.ok(championGenerator.includes(`region: "${region}"`), `${region} Champion generator identity missing`);
  assert.ok(championRegistry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} Champion runtime path missing`);
}

for (const evolution of [
  "ember_champion_2", "ember_champion_3",
  "tide_champion_2", "wood_champion_2", "void_champion_2", "forest_champion_2", "storm_champion_2",
]) {
  assert.ok(championRegistry.includes(`${evolution}:`), `${evolution} must reuse its regional Alpha Champion master`);
}

const artBatches = [
  {
    label: "Structure",
    generatorPath: "scripts/generate-flagship-structure-art.mjs",
    registryPath: "src/game/flagship-structure-art.ts",
    browserPath: "scripts/alpha-flagship-structures-browser-cert.mjs",
    workflowPath: ".github/workflows/flagship-structures.yml",
    generationMarker: "FLAGSHIP STRUCTURE ART: generated",
    browserMarker: "FLAGSHIP ART BATCH B BROWSER CERT: PASS",
    bootstrapScript: "scripts/generate-flagship-structure-art.mjs",
    uploadPattern: "artifacts/alpha-visual/11*-structure-*-art-viewer.png",
    targets: [
      ["emberhold", "rfalpha_ember_structure_forge_bastion", "11a-structure-emberhold-art-viewer.png"],
      ["tidecall", "rfalpha_tide_structure_silent_beacon", "11b-structure-tidecall-art-viewer.png"],
      ["ironwood", "rfalpha_wood_structure_root_circle", "11c-structure-ironwood-art-viewer.png"],
      ["voidborn", "rfalpha_void_structure_hollow_obelisk", "11d-structure-voidborn-art-viewer.png"],
      ["florestia", "rfalpha_forest_structure_ancestral_den", "11e-structure-florestia-art-viewer.png"],
      ["tempestade", "rfalpha_storm_structure_first_thunder", "11f-structure-tempestade-art-viewer.png"],
    ],
  },
  {
    label: "Mana Ritual",
    generatorPath: "scripts/generate-flagship-ritual-art.mjs",
    registryPath: "src/game/flagship-ritual-art.ts",
    browserPath: "scripts/alpha-flagship-rituals-browser-cert.mjs",
    workflowPath: ".github/workflows/flagship-rituals.yml",
    generationMarker: "FLAGSHIP RITUAL ART: generated",
    browserMarker: "FLAGSHIP ART BATCH C BROWSER CERT: PASS",
    bootstrapScript: "scripts/generate-flagship-ritual-art.mjs",
    uploadPattern: "artifacts/alpha-visual/12*-ritual-*-art-viewer.png",
    targets: [
      ["emberhold", "rfalpha_ember_ritual_red_rite", "12a-ritual-emberhold-art-viewer.png"],
      ["tidecall", "rfalpha_tide_ritual_memory_tide", "12b-ritual-tidecall-art-viewer.png"],
      ["ironwood", "rfalpha_wood_ritual_ancient_roots", "12c-ritual-ironwood-art-viewer.png"],
      ["voidborn", "rfalpha_void_ritual_emptiness", "12d-ritual-voidborn-art-viewer.png"],
      ["florestia", "rfalpha_forest_ritual_green_moon", "12e-ritual-florestia-art-viewer.png"],
      ["tempestade", "rfalpha_storm_ritual_eye_of_storm", "12f-ritual-tempestade-art-viewer.png"],
    ],
  },
  {
    label: "Trap",
    generatorPath: "scripts/generate-flagship-trap-art.mjs",
    registryPath: "src/game/flagship-trap-art.ts",
    browserPath: "scripts/alpha-flagship-traps-browser-cert.mjs",
    workflowPath: ".github/workflows/flagship-traps.yml",
    generationMarker: "FLAGSHIP TRAP ART: generated",
    browserMarker: "FLAGSHIP ART BATCH D BROWSER CERT: PASS",
    bootstrapScript: "scripts/generate-flagship-trap-art.mjs",
    uploadPattern: "artifacts/alpha-visual/13*-trap-*-art-viewer.png",
    targets: [
      ["emberhold", "rfalpha_ember_trap_ash_snare", "13a-trap-emberhold-art-viewer.png"],
      ["tidecall", "rfalpha_tide_trap_countercurrent", "13b-trap-tidecall-art-viewer.png"],
      ["ironwood", "rfalpha_wood_trap_emergency_bark", "13c-trap-ironwood-art-viewer.png"],
      ["voidborn", "rfalpha_void_trap_early_eclipse", "13d-trap-voidborn-art-viewer.png"],
      ["florestia", "rfalpha_forest_trap_pack_ambush", "13e-trap-florestia-art-viewer.png"],
      ["tempestade", "rfalpha_storm_trap_crosswind", "13f-trap-tempestade-art-viewer.png"],
    ],
  },
  {
    label: "Starter Signature",
    generatorPath: "scripts/generate-flagship-signature-art.mjs",
    registryPath: "src/game/flagship-signature-art.ts",
    browserPath: "scripts/alpha-flagship-signatures-browser-cert.mjs",
    workflowPath: ".github/workflows/flagship-signatures.yml",
    generationMarker: "FLAGSHIP SIGNATURE ART: generated",
    browserMarker: "FLAGSHIP ART BATCH E BROWSER CERT: PASS",
    bootstrapScript: "scripts/generate-flagship-signature-art.mjs",
    uploadPattern: "artifacts/alpha-visual/14*-signature-*-art-viewer.png",
    targets: [
      ["emberhold", "ember_ashguard", "14a-signature-emberhold-art-viewer.png"],
      ["tidecall", "tide_cloudpiercer", "14b-signature-tidecall-art-viewer.png"],
      ["ironwood", "wood_canopy_bastion", "14c-signature-ironwood-art-viewer.png"],
      ["voidborn", "void_gloom_warden", "14d-signature-voidborn-art-viewer.png"],
      ["florestia", "forest_dawn_alpha", "14e-signature-florestia-art-viewer.png"],
      ["tempestade", "storm_static_adept", "14f-signature-tempestade-art-viewer.png"],
    ],
  },
] as const;

const toolingSources: string[] = [championGenerator];
for (const batch of artBatches) {
  const generator = read(batch.generatorPath);
  const registry = read(batch.registryPath);
  const browser = read(batch.browserPath);
  const workflow = read(batch.workflowPath);
  toolingSources.push(generator, browser, workflow);

  for (const contract of [
    "const WIDTH = 1536",
    "const HEIGHT = 1920",
    ".webp({ quality: 88",
    "public/art/cards/flagship/",
    batch.generationMarker,
  ]) {
    assert.ok(generator.includes(contract), `${batch.label} generator must preserve ${contract}`);
  }

  for (const [region, defId, screenshot] of batch.targets) {
    assert.ok(generator.includes(`defId: "${defId}"`), `${defId} ${batch.label} generator source missing`);
    assert.ok(generator.includes(`region: "${region}"`), `${region} ${batch.label} generator identity missing`);
    assert.ok(registry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} ${batch.label} runtime path missing`);
    assert.ok(browser.includes(defId), `${defId} must be certified in browser`);
    assert.ok(browser.includes(screenshot), `${defId} browser screenshot contract missing: ${screenshot}`);
  }

  for (const browserContract of [
    "data-card-art-source",
    "regional-fallback",
    "data-card-art-viewer-trigger",
    "data-card-art-viewer-image",
    'backgroundSize, "contain"',
    batch.browserMarker,
  ]) {
    assert.ok(browser.includes(browserContract), `${batch.label} browser certification must preserve ${browserContract}`);
  }

  assert.ok(workflow.includes(`node ${batch.browserPath}`), `${batch.label} workflow must execute its browser certification`);
  assert.ok(workflow.includes(batch.uploadPattern), `${batch.label} workflow must upload all six screenshots`);
  assert.ok(workflow.includes("npm run build"), `${batch.label} visual workflow must certify production build output`);
  assert.ok(nextConfig.includes(`"${batch.bootstrapScript}"`), `Next bootstrap must materialize ${batch.label} WebPs`);
}

assert.ok(nextConfig.includes("execFileSync(process.execPath, [script]"), "Next bootstrap must execute additive Flagship asset generators");
for (const resolver of [
  "flagshipChampionArtUrl",
  "flagshipStructureArtUrl",
  "flagshipRitualArtUrl",
  "flagshipTrapArtUrl",
  "flagshipSignatureArtUrl",
]) {
  assert.ok(cardArt.includes(resolver), `Card art pipeline must retain ${resolver}`);
}
assert.ok(cardArt.includes("flagship-signature-art"), "Card art pipeline must import the starter signature registry");
assert.ok(cardArt.includes("const editorial = browserArt[defId] ?? getCustomCardArtCached(defId);"), "editorial/admin art must remain first priority");
assert.ok(cardArt.indexOf("const editorial") < cardArt.indexOf("const flagshipUrl"), "built-in Flagship art must never override explicit editorial art");

for (const source of toolingSources) {
  for (const forbidden of [
    "src/app/play/BattleView.tsx",
    "src/components/CardView.tsx",
    "visual-3-0-battlefield-cinematic.css",
    "visual-3-1-card-presentation.css",
    "visual-3-2-meta-world.css",
  ]) {
    assert.equal(source.includes(forbidden), false, `Flagship A-E tooling must not mutate frozen surface ${forbidden}`);
  }
}

console.log("FLAGSHIP ART BATCHES A+B+C+D+E — 30/30 SOURCE CONTRACT: PASS");
