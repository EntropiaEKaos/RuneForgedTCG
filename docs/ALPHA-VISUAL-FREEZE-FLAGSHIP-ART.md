# Alpha Visual Feature Freeze + Flagship Art Set

## Certified baseline

This freeze starts from `main` SHA `9fb9575831e603664070f04caea68e5c70c9e057`, certified by CI #632 after Visual 3.0, 3.1 and 3.2.

The goal is release discipline: RuneForge has enough structural visual language for Alpha. From this point forward, visual work should overwhelmingly be **editorial content** (card art, crops, assets and accessibility fixes), not another redesign of the battlefield, card frame or meta UI.

## Structural freeze

CI verifies the Git blob SHA of seven certified surfaces:

1. `src/app/layout.tsx`
2. `src/app/play/BattleView.tsx`
3. `src/components/CardView.tsx`
4. `src/components/game/ArenaIdentity.tsx`
5. `src/app/styles/visual-3-0-battlefield-cinematic.css`
6. `src/app/styles/visual-3-1-card-presentation.css`
7. `src/app/styles/visual-3-2-meta-world.css`

A new structural `Visual 3.3` layer is forbidden before the Alpha unless the release director deliberately breaks the freeze.

### Allowed during the freeze

- new card illustrations under `/public/art/cards/flagship/`;
- editorial art assignments and crop metadata;
- optimization of new art assets;
- alt/accessibility metadata that does not restructure the certified surfaces;
- critical visual bug fixes using the break-glass procedure below;
- balance/content work and Alpha release engineering outside the frozen visual surfaces.

### Break-glass procedure

If a frozen file truly must change:

1. state the player-facing bug/release reason in the PR;
2. update the expected Git blob SHA intentionally;
3. run the entire CI chain, not a visual-only subset;
4. produce a fresh browser artifact;
5. visually inspect every surface affected by the change;
6. squash only after approval;
7. repeat full CI + artifact inspection on the definitive `main` SHA.

## Flagship Art Set: exactly 30 Alpha masters

The first public-facing art program is intentionally compact. We are not producing hundreds of generic images before real players validate the game.

Each of the six regions receives exactly five unique master illustrations:

- **1 Champion master** — reused by evolved Champion forms during Alpha;
- **1 Structure**;
- **1 Ritual of Mana**;
- **1 Trap**;
- **1 authored starter-deck signature**.

Total: **30 master artworks**.

The authoritative roster and art briefs live in `src/game/flagship-art.ts`. CI verifies that all 30 `defId`s exist, are in the expected region, that semantic art roles still match gameplay semantics and that the six signature cards remain both authored doctrine signatures and actual starter-deck cards.

### Champion masters

- Emberhold — `ember_champion`
- Tidecall — `tide_champion`
- Ironwood — `wood_champion`
- Voidborn — `void_champion`
- Florestia — `forest_champion`
- Tempestade — `storm_champion`

For Alpha, evolved forms reuse the same regional Champion identity. Dedicated evolution artwork is post-Alpha polish and must not block the release.

### Starter signatures

These are not arbitrary picks; they come from the existing archetype doctrine contracts and currently ship inside their starter decks:

- Emberhold — `ember_ashguard`
- Tidecall — `tide_cloudpiercer`
- Ironwood — `wood_canopy_bastion`
- Voidborn — `void_gloom_warden`
- Florestia — `forest_dawn_alpha`
- Tempestade — `storm_static_adept`

### Semantic wave

All 18 Alpha semantic cards are included, preserving the visual grammar already established by Visual 3.1:

- **Structure** = permanent, architectural, fortified;
- **Ritual of Mana** = deliberate mana economy/channeling, never generic spell spectacle;
- **Trap** = interruption, reaction, diagonal tension and an identifiable response moment.

## Production specification

- master composition: portrait **4:5**;
- working master: **1536 × 1920** or higher with the same ratio;
- final web delivery: **WebP**;
- preserve faces, silhouettes and critical props inside the central 70% safe zone;
- no logos, card frame, mana cost, rules text or typography baked into the illustration;
- artwork must survive CardView cover cropping on Collection, Codex, mulligan and battlefield;
- retain enough dark/quiet value range near edges for RuneForge's existing frame/readability overlays.

## Batch order

### Batch A — 6 Champions

The highest marketing leverage. These establish faces for every region and replace the perception of anonymous regional fallback art on the most important cards.

### Batch B — 18 semantic cards

Six Structures, six Mana Rituals and six Traps. This makes the new card taxonomy immediately understandable through imagery as well as UI treatment.

### Batch C — 6 starter signatures

One doctrine-defining non-Champion card per starter. This ensures every starter has at least two memorable visual anchors: its Champion plus a signature card, in addition to its semantic trio.

## Merge policy for art batches

An art batch is not complete merely because image files exist. For each batch:

1. assets must use the manifest path and WebP delivery;
2. assignments must resolve through the existing CardView art pipeline, preserving regional fallback underneath;
3. CI must stay fully green;
4. browser artifacts must prove the art in Collection/Codex and at least one gameplay surface where applicable;
5. image loading must not create clipping, broken URLs or unreadable card text;
6. merge by squash, followed by full post-merge certification.

After the three batches, visual work enters true **Alpha RC freeze**. Remaining release work is starter balance, defect closure, final journey certification and packaging/deployment—not another UI redesign.
