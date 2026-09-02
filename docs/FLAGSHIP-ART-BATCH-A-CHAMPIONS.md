# Flagship Art Batch A — Champions

Batch A is the first implementation batch after the Alpha Visual Feature Freeze. It adds one deterministic 4:5 master identity for each regional Champion without reopening the certified Visual 3.0/3.1/3.2 surfaces.

## Masters

- Emberhold — `ember_champion` / Pyra, the Everflame
- Tidecall — `tide_champion` / Nerida, Tide Empress
- Ironwood — `wood_champion` / Bramblehart, Grovekeeper
- Voidborn — `void_champion` / Malakar, the Hollow King
- Florestia — `forest_champion` / Kaara, Regente das Feras
- Tempestade — `storm_champion` / Zael, Senhor dos Raios

For the Alpha, every evolved form reuses the same regional master. Pyra's third stage also reuses her Emberhold master. Evolution-specific illustrations remain post-Alpha polish.

## Delivery contract

The source is deterministic and lives in `scripts/generate-flagship-champion-art.mjs`. `predev` and `prebuild` generate six 1536x1920 WebP files under `public/art/cards/flagship/<region>/` before Next starts or builds.

This keeps binary output reproducible while the repository stores the authored vector composition. The generator has no gameplay, networking, storage, CardView, battlefield or Meta UI authority.

## Runtime priority

`getCardArt` resolves art in this order:

1. browser/editorial Admin assignment;
2. cached custom/editorial assignment;
3. built-in Flagship Champion master;
4. the existing CardView definition/configured/regional fallback stack.

Therefore a future approved art upload can replace a built-in master without changing gameplay code, while deleting the editorial override safely restores the shipped master.

## Certification

`flagship-champion-art.test.ts` certifies the six real Champion chains and Admin override priority.

`flagship-champion-art-regression.test.ts` certifies generation, dimensions, WebP paths and the boundary with the frozen visual surfaces.

`alpha-flagship-champions-browser-cert.mjs` requires all six generated WebPs to be served by the built application, searches each Champion in the Codex, proves CardView is using the flagship path rather than regional fallback, and writes six visual proofs to the Alpha artifact.

The merge gate remains the normal RuneForge chain: taxonomy -> source audits -> typecheck/lint -> PostgreSQL/Studio/security -> behavioral -> coverage -> production DB -> build -> browser E2E -> artifact integrity -> visual inspection -> squash -> post-merge certification on `main`.
