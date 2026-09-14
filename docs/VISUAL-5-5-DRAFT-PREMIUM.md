# Visual 5.5 — Draft Premium

## Objective

Turn the existing Arena Draft flow into a premium limited-format experience without changing Draft authority, pool generation, pick validation, deck constraints, player identity, persistence or API behavior.

## Product surfaces

Visual 5.5 works only through semantic contracts already rendered by `DraftClient.tsx`:

- `aria-label="Estado do Draft"` — session command strip.
- `aria-labelledby="draft-pick-heading"` — current authoritative pick chamber.
- `aria-label="Regiões da identidade atual"` — regional identity tags.
- `button[aria-label^="Escolher "]` — the three server-provided choices.
- `aria-label="Progresso do Draft"` — deck construction progress.
- `aria-labelledby="draft-deck-heading"` — current drafted deck / forge tray.
- `aria-labelledby="draft-complete-heading"` — completion ceremony.

## Visual direction

The Draft is treated as a Nexus selection table rather than a generic form:

- forged obsidian shell with restrained gold/ember/violet/cyan accents;
- status cards read like a live limited-event command strip;
- the three choices are the visual protagonist and gain material depth, hover lift and controlled sheen;
- the progress bar reads as an active forge channel;
- the drafted deck becomes a compact forge tray;
- completion gains a dedicated ceremony without changing completion logic;
- mobile, backdrop-filter fallback and reduced-motion behavior are explicit.

## Authority boundary

`src/app/draft/DraftClient.tsx` is intentionally frozen byte-for-byte for this pass. The Visual 5.5 source contract pins its Git blob SHA and also checks that the existing `/api/draft` GET/POST authority snippets remain present.

Visual 5.5 does **not** change:

- `/api/draft` GET or POST;
- random pool generation;
- rare/bomb slot behavior;
- max copies or region limits;
- immutable Draft rules snapshot;
- server-side pick validation;
- custom-deck persistence;
- player session establishment;
- engine, battle, Ranked or Casual PvP surfaces.

## Browser evidence

`scripts/alpha-draft-visual-cert.mjs` uses the shared Chrome DevTools bootstrap and an isolated public player session. It observes a fresh authoritative Draft, verifies exactly three server-provided choices, captures the premium pick chamber, performs one valid authoritative first pick, then captures the resulting forge tray.

Expected artifact files:

- `31-draft-pick-chamber.png`
- `32-draft-forge-tray.png`
- `draft-visual-manifest.json`
- `31-draft-diagnostic.png` on failure

The certificate must remain attached to the full CI browser gate before merge.

## Promotion gate

Visual 5.5 is not considered promoted until the exact PR head has passed the repository gates, browser evidence has been manually inspected, and the merge SHA has passed the post-merge main certification.
