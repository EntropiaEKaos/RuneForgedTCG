# Graveyard Effects 1.0 — PR Notes

This branch converts the certified public graveyard from passive match history into a reusable gameplay resource while preserving deterministic authoritative state.

Core additions:

- public graveyard targeting by `GraveyardEntry.instanceId`;
- `returnGraveyardToHand`;
- `reanimateUnit`;
- `banishGraveyardCard`;
- fail-closed stale/capacity validation;
- normal summon/onSummon semantics for reanimated Units;
- deterministic AI graveyard valuation;
- public graveyard targeting trays in gameplay;
- Studio sandbox graveyard seeding without card duplication;
- Card Studio canonical authoring vocabulary and unsupported-surface rejection;
- dedicated behavioral and source-contract certifications.

No production cards or deck recipes are added in this PR. `Ecos do Abismo` remains a separate content/balance PR after this mechanic is merge-certified.
