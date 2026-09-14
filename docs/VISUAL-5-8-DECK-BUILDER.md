# Visual 5.8 — Deck Builder Premium

## Objective

Turn the existing `/forge` experience into a premium deck-construction workbench without changing deck rules, format legality, persistence, sharing, codes or gameplay authority.

## Product direction

The Forge is treated as a tactical workbench rather than a generic form. Cards remain the protagonists, while deck composition, identity, diagnosis and synergy become readable at a glance.

### Premium surfaces

- Forge summary cards gain forged accent rails and stronger information hierarchy.
- Deck configuration becomes a dedicated workbench surface with a luminous construction gauge.
- Regional identity receives a distinct Nexus identity treatment.
- Saved decks become a private arsenal with clearer selected/hover state.
- Format catalog stays visible on desktop while filtering a large card pool.
- Real `CardTip` / `CardView` cards receive restrained elevation only inside the Forge catalog.
- The sticky composition tray becomes a premium deck vault.
- Existing strategic diagnosis and synergy surfaces receive clearer hierarchy.
- Mobile removes sticky behavior and motion-heavy hover treatments.
- Reduced-motion users retain the complete hierarchy without transitions.

## Authority boundaries

Visual 5.8 is product CSS-only.

`src/app/forge/ForgeClient.tsx` remains byte-for-byte pinned at Git blob:

`8ea0d68997dfc4173dce1ad3374633dea8d8c006`

Therefore Visual 5.8 does not change:

- `/api/decks` loading, creation or update behavior;
- `/api/decks/:id` delete behavior;
- `/api/decks/share` community publication;
- deck code generation;
- `validateDeck` legality;
- runtime deck minimum/maximum/copy limits;
- format eligibility or `cardLegalInFormat`;
- region identity constraints;
- synergy or recommendation computation;
- engine, battle state, PvP, Ranked or database schema.

## Browser evidence

`scripts/alpha-deck-builder-visual-cert.mjs` uses an isolated public player session and never saves a deck. It:

1. opens the real `/forge` route;
2. verifies the summary, editor, saved-deck library, catalog, composition tray, diagnosis and progress surfaces;
3. captures `36-deck-builder-workbench.png`;
4. clicks three distinct real cards from the existing client catalog;
5. confirms three local composition rows appear and the Forge summary updates;
6. captures `37-deck-builder-composition.png`;
7. writes `deck-builder-visual-manifest.json`.

No deck/server mutation is performed by the Visual 5.8 browser certificate.

## Promotion rule

Do not merge Visual 5.8 until the exact PR head is green across the full gate matrix and screenshots 36/37 plus the manifest have been manually inspected. After merge, repeat certification on the exact resulting `main` SHA before considering the pass consolidated.
