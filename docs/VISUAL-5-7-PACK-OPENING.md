# Visual 5.7 — Pack Opening Premium

## Objective

Turn the existing authoritative `/store` pack reveal into a premium RuneForge ceremony without changing pack economics, odds, RNG, inventory mutation, cosmetic minting or gameplay identity.

## Product surface

Visual 5.7 reuses the already-certified pack opening dialog rendered by `StoreClient.tsx` after the real `/api/packs` open action succeeds. The product code remains unchanged; the new final CSS layer only styles semantic/structural selectors already present in the reveal.

The presentation adds:

- a forged obsidian reveal stage with restrained gold, cyan and violet atmosphere;
- clearer rarity hierarchy across Common, Rare, Epic and Legend cards;
- staged sheen and glow that preserve card readability;
- stronger integration with the Visual 5.6 cosmetic prestige highlight surface;
- improved duplicate-dust and Continue-action hierarchy;
- responsive/mobile handling and reduced-motion behavior.

## Authority boundaries

Visual 5.7 is product CSS-only.

- `src/app/store/StoreClient.tsx` remains byte-for-byte unchanged.
- `src/app/api/packs/route.ts` remains byte-for-byte unchanged.
- `/api/packs` remains the authority for purchase/open mutations.
- `X-Operation-Id` / economy idempotency remain unchanged.
- pack inventory consumption remains unchanged.
- pack RNG, `packSeed`, rarity rates and guaranteed-rarity behavior remain unchanged.
- card-definition `Rarity` remains gameplay/content identity.
- cosmetic variant minting remains owned by the existing cosmetic service.
- duplicate conversion to dust remains unchanged.
- Visual 5.6 cosmetic prestige remains presentation-only and layers underneath/inside this ceremony.

## Browser evidence

The dedicated real-browser certificate `scripts/alpha-pack-opening-visual-cert.mjs`:

1. bootstraps a normal public player session;
2. buys one real Basic pack through `/api/packs` using an idempotent operation ID;
3. navigates to `/store`;
4. activates the real `ABRIR PACOTE` control so the existing Store client performs the authoritative open action;
5. verifies the real reveal dialog, five Basic-pack cards, Continue action and horizontal-fit contract;
6. captures `35-pack-opening-premium.png` and writes `pack-opening-visual-manifest.json`;
7. emits `35-pack-opening-diagnostic.png` on failure.

The browser certificate deliberately does not use admin endpoints, Ranked, matchmaking or deletion shortcuts.

## Accessibility and resilience

The final layer includes:

- a no-backdrop-filter fallback;
- mobile layout protection at `max-width: 720px`;
- `prefers-reduced-motion: reduce` disabling reveal-stage/card animations and transitions;
- no change to the existing dialog semantics, heading association or explicit Continue/close controls.

## Certification base

Base exact `main` SHA: `e73d1fdd4d6a840618539e1b84800b35cb783779`.

Promotion requires the exact PR head to pass full CI and browser evidence, followed by manual inspection of screenshot 35 and its manifest before merge.
