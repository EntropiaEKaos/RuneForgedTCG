# FORGED Frames & Rarity Premium 1.5

## Boundary

Premium rarity presentation is a rendering concern. `CardDef.rarity` remains the authoritative gameplay/catalog classification and is never written by this layer.

Cosmetic printings remain independent. `variantId`, `frameId`, `finish`, art, animation and cosmetic prestige continue to describe a collectible appearance. A Legend card can therefore use the Standard appearance or any published cosmetic printing without changing its gameplay rarity.

## Deterministic rarity identity

| Rarity | Presentation | FX ceiling |
| --- | --- | --- |
| Common | restrained base frame | none |
| Rare | refined metallic accent | subtle |
| Epic | arcane premium ornament | standard |
| Legend | signature premium halo | cinematic |

`src/game/card-rarity-presentation.ts` is the presentation contract. It maps the four existing rarity values to stable CSS/ornament identities and an FX ceiling. It does not inspect or mutate game state.

## Integration rule

Card surfaces should compose three independent inputs in this order:

1. regional/card identity;
2. authoritative rarity presentation;
3. optional collectible cosmetic appearance (`frameId`, `finish`, variant art/animation).

A cosmetic may enhance or replace frame styling, but it must not rewrite rarity, costs, stats, keywords, legality, targeting or state transitions.

## Accessibility and performance

Animated Legend ornamentation must respect `prefers-reduced-motion`. Future GPU/particle enhancements must continue through the existing adaptive FX budget rather than adding an unbounded parallel animation path.

## Certification

Promotion requires exact-head typecheck/lint, behavioral tests, build/browser E2E, repository workflow matrix and representative visual evidence. Existing static rendering remains the fallback.
