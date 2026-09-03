# Flagship Art Batch E — Starter Signatures

## Goal

Complete the 30-master Alpha Flagship Art Set with one authored starter-signature unit per region. These six cards already ship in their regional starter decks and are explicitly named in the corresponding archetype doctrine contracts.

## Cards

- Emberhold — `ember_ashguard` — Guarda das Cinzas — Warrior / Tough
- Tidecall — `tide_cloudpiercer` — Quebra-Nuvens Abissal — Elemental / Reach
- Ironwood — `wood_canopy_bastion` — Bastião da Copa — Beast / Reach
- Voidborn — `void_gloom_warden` — Vigia da Penumbra — Spirit / Fearsome + Hexproof
- Florestia — `forest_dawn_alpha` — Alfa da Alvorada — Besta / Challenger
- Tempestade — `storm_static_adept` — Adepto da Estática — Tempesteiro / Reach

## Art direction

This batch sells the doctrine of each starter through a recognizable unit silhouette rather than a generic regional background:

- Ashguard is a shielded line-holder at a forge gate.
- Cloudpiercer is a vertical water elemental built around Reach and anti-air presence.
- Canopy Bastion is a massive living beast/bulwark under the forest crown.
- Gloom Warden is an armored spirit at an abyssal threshold, combining threat and untouchability.
- Dawn Alpha leads a visible pack into the first light, emphasizing Challenger leadership.
- Static Adept shapes controlled lightning through precise hand sigils while maintaining defensive Reach.

All masters are deterministic 1536×1920 WebP assets and preserve the central 4:5 crop-safe composition used by CardView and `VER ARTE`.

## Runtime priority

`getCardArt` keeps explicit editorial control above every built-in master:

1. Admin/editorial assignment
2. Champion master
3. Structure master
4. Mana Ritual master
5. Trap master
6. Starter-signature master
7. normal regional CardView fallback

## Certification

The existing 30-target roster test already proves each signature is present in the correct starter and is an authored doctrine signature.

The Flagship runtime test now certifies all 30 masters, requires all six Batch E cards to remain Units, verifies runtime art resolution and proves Admin override priority.

The source-contract is generalized across B–E and validates generator dimensions/format, runtime paths, Next bootstrap, dedicated browser evidence and the Visual Feature Freeze boundary.

`alpha-flagship-signatures-browser-cert.mjs` requires all six WebPs to be served by the production build, rendered by CardView without regional fallback and opened via `VER ARTE` using `background-size: contain`. Evidence is captured as `14a`–`14f`.

## Release boundary

Batch E changes no game rules, stats, decklists, networking, economy, BattleView, CardView, ArenaIdentity or Visual 3.x stylesheet. Once certified, the original 30-master Flagship Art Set is complete and visual work returns to release-blocking fixes only.
