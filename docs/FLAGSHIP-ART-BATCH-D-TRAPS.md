# Flagship Art Batch D — Traps

## Goal

Ship six dedicated Alpha masters for the six semantic Trap cards, one per region, while preserving the certified Alpha Visual Feature Freeze and the existing gameplay contract.

## Cards

- Emberhold — `rfalpha_ember_trap_ash_snare` — Cilada de Brasas
- Tidecall — `rfalpha_tide_trap_countercurrent` — Selo da Contramaré
- Ironwood — `rfalpha_wood_trap_emergency_bark` — Casca de Emergência
- Voidborn — `rfalpha_void_trap_early_eclipse` — Eclipse Prematuro
- Florestia — `rfalpha_forest_trap_pack_ambush` — Emboscada da Alcateia
- Tempestade — `rfalpha_storm_trap_crosswind` — Contravento Súbito

## Art direction

Trap art must read as reaction and interruption rather than permanence or deliberate channeling. The shared grammar is a broken/reaction seal, crossing trajectories, ambush pressure and a high-contrast interruption focal point. Regional palettes remain authoritative.

The masters are generated deterministically at 1536×1920 WebP and live under `public/art/cards/flagship/<region>/` at runtime.

## Runtime priority

`getCardArt` keeps the release order:

1. Admin/editorial art
2. Champion flagship master
3. Structure flagship master
4. Mana Ritual flagship master
5. Trap flagship master
6. normal CardView regional fallback

No built-in Flagship asset may override an explicit Admin/editorial assignment.

## Certification

The existing Flagship behavioral contract now certifies A+B+C+D and requires all six Trap cards to remain `Spell + archetypeKey=trap` while resolving their dedicated masters.

The source-contract is data-driven across Structure, Mana Ritual and Trap and validates generator dimensions/format, runtime registry paths, Next bootstrap, browser scripts, dedicated workflows, VER ARTE contracts and the Alpha Visual Feature Freeze boundary.

`alpha-flagship-traps-browser-cert.mjs` requires all six Trap WebPs to be served by the production build, rendered by CardView without regional fallback, opened through `VER ARTE` using `background-size: contain`, and captured as `13a`–`13f` evidence.

## Freeze boundary

Batch D does not modify BattleView, CardView, ArenaIdentity or any Visual 3.x stylesheet. It changes no rules, stats, decklists, networking, economy or reaction semantics. It is an editorial art rollout only.
