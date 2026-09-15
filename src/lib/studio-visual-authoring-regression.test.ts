import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const frameApi = read("src/app/api/admin/studio/frames/route.ts");
assert.match(frameApi, /card-frame-presets/);
assert.match(frameApi, /adminRoleAllowed\(actor\.role, "publisher"\)/, "live frame publishing must remain publisher-gated");
assert.match(frameApi, /cosmetic-usage-exists/, "used frame presets must archive instead of disappearing");

const frameBuilder = read("src/app/admin/studio/frames/FrameBuilderClient.tsx");
for (const token of ["Frame Builder", "primaryColor", "secondaryColor", "accentColor", "cornerStyle", "ornament", "foilIntensity", "Duplicar", "Publicar + habilitar"]) {
  assert.ok(frameBuilder.includes(token), `Frame Builder must expose ${token}`);
}

const cosmetics = read("src/app/admin/studio/cards/CardCosmeticsTab.tsx");
assert.match(cosmetics, /data-studio-visual-authoring="1\.0"/);
assert.match(cosmetics, /\/api\/admin\/assets\/upload/);
assert.match(cosmetics, /\/api\/admin\/studio\/frames/);
assert.match(cosmetics, /artCrop: form\.artCrop/, "variant crop/zoom must persist instead of being reset");
for (const axis of ["Foco X", "Foco Y", "Zoom"]) assert.ok(cosmetics.includes(axis), `variant art authoring must expose ${axis}`);

const upload = read("src/app/api/admin/assets/upload/route.ts");
assert.match(upload, /adminRoleAllowed\(actor\.role, "designer"\)/, "designers may upload sanitized media assets");
assert.match(upload, /detectAssetType\(bytes\)/);
assert.match(upload, /validateAssetPayload\(bytes, detected\)/);
assert.match(upload, /MAX_ASSET_BYTES = 12_000_000/);

const catalog = read("src/app/api/catalog/route.ts");
assert.match(catalog, /framePresets/);
assert.match(catalog, /FRAME_PRESET_DOMAIN/);
assert.match(catalog, /card-frame-presets/);

const bootstrap = read("src/components/CatalogBootstrap.tsx");
assert.match(bootstrap, /replaceRegisteredCardFramePresets/);
assert.match(bootstrap, /cardFramePresetCss/);
assert.match(bootstrap, /studio-card-frame-presets/);

const cardView = read("src/components/CardView.tsx");
assert.match(cardView, /cosmeticClassNames\(appearance\)/, "authoritative card renderer continues to consume cosmetics through its existing presentation boundary");
assert.doesNotMatch(cardView, /card-frame-presets|FrameBuilder/, "frame authoring must not be coupled into CardView structure");

const artPipeline = read("src/app/admin/studio/art/ArtPipelineClient.tsx");
assert.match(artPipeline, /PRODUCT_BRAND\.displayName/);
assert.match(artPipeline, /\/admin\/studio\/frames/);

console.log("STUDIO VISUAL AUTHORING 1.0 CONTRACTS: PASS");
