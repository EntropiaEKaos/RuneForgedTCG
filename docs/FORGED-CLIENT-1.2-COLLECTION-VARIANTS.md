# FORGED Client 1.2 — Collection 2.0 + Variant Identity

## Objective

Turn the existing collection catalog and cosmetic wardrobe into one coherent player-facing collection experience without changing card gameplay authority, deck legality, Ranked/MMR authority, pack RNG, crafting economy, Marketplace ownership or cosmetic persistence.

## Commit A — Collection cosmetic integration

The `/collection` surface now consumes the existing player cosmetic authority from `GET /api/player/cosmetics` and combines it with the existing collection snapshot only for presentation.

Player-facing additions:

- Collection 2.0 visual-identity hero inside `/collection`;
- special-variant, equipped and Serialized counts;
- highlighted owned cosmetic copies with art/finish/edition identity;
- direct navigation to the existing Variant Atelier;
- cosmetic filter modes: all, cards with variants, equipped variants and Serialized copies;
- per-card badges showing variant count, Serialized count and active visual state;
- selected-card panel showing the equipped visual and variant inventory context;
- first-party telemetry event `collection.collection2_cosmetics_viewed`.

## Authority boundaries

This work is intentionally presentation-only.

The following remain unchanged and authoritative in their existing systems:

- card `defId`, stats, costs, rules, keywords and legal copy limits;
- crafting/disenchant economy operations and idempotency;
- cosmetic minting, ownership and equip persistence;
- pack RNG, drop tables and guaranteed-rarity behavior;
- Marketplace ownership/listing authority;
- deck serialization and deck legality;
- Ranked MMR, matchmaking and match results;
- engine/runtime gameplay behavior.

No database migration, schema change, gameplay card-definition change, package-lock change or engine change is required by Commit A.

## Product rule

A cosmetic copy can be rarer, animated, Full Art, premium or Serialized, but it never grants gameplay power. Collection completion for gameplay cards remains separate from cosmetic prestige.

## Certification

Before promotion, the branch must pass the normal exact-head certification applicable to the repository, including source contracts, typecheck, lint, behavioral tests, build/browser E2E and visual evidence. The existing FORGED Client player-experience source contract now locks the Collection 2.0 cosmetic integration and explicitly rejects UI-level MMR/card-definition mutation helpers.
