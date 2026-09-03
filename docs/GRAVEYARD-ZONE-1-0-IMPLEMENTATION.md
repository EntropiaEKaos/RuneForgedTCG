# Graveyard Zone 1.0 — Implementation Scope

This PR is the authoritative zone foundation for the future RuneForge Discard/Reanimator archetype.

## Included

- public per-player graveyard state with deterministic zone instance ids;
- backwards-compatible access for historical states without a graveyard field;
- hand overflow to graveyard;
- selected activated-ability discard costs to graveyard;
- selected reaction-ability discard costs to graveyard;
- mill to graveyard in original deck order;
- dead collectible Units to graveyard;
- attached collectible Equipment to graveyard when its bearer dies;
- destroyed Artifacts/Enchantments to graveyard;
- destroyed Sentinelas to graveyard;
- resolved Spells/Rituals/Traps to graveyard through the canonical semantic action path;
- countered stack cards to graveyard;
- public spectator/PvP graveyard projection;
- deterministic behavioral certification in `src/game/graveyard-zone.test.ts`.

## Fail-closed rule

Definitions with `collectible === false` do not produce graveyard entries in Graveyard 1.0. This prevents generated tokens or transformed representations from becoming ambiguous physical cards before canonical transformation ownership is implemented.

## Explicitly not included

- no `reanimateUnit` effect yet;
- no return-from-graveyard effect yet;
- no graveyard-targeting action grammar yet;
- no graveyard banish/hate effect yet;
- no new cards or deck recipes;
- no changes to the six Alpha starter decks;
- no changes to the Alpha Starter Balance baseline.

Those mechanics belong to the next isolated PR after this zone foundation is certified on `main`.
