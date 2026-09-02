# Visual 3.1 — Card Art / Presentation

Visual 3.1 improves how RuneForge cards read across the battlefield, Collection, Codex, deck surfaces and Card Studio without changing card rules, engine authority, hitboxes or card geometry.

## Goals

- Make card art resilient when a dedicated asset is missing or returns an error.
- Keep regional identity visible under every primary/editorial art source.
- Give certified semantic types an immediate visual grammar before rules text is read.
- Extend premium card presentation beyond the battlefield into Codex, Collection, deck and Studio surfaces.
- Preserve mobile, reduced-motion and existing interaction contracts.

## Resilient art stack

`CardView` now treats art as a layered stack rather than a single fragile URL:

1. Card Studio/editorial assignment, when present.
2. Code-authored `CardDef.art`, when present.
3. Configured client fallback, when present.
4. Shipped regional SVG identity as the permanent bottom layer.

If a primary image fails to load, the browser still has the regional art underneath it. Cards without dedicated/editorial art keep the existing emoji + regional sigil fallback treatment. `data-card-art-source` exposes the source for presentation and regression checks without changing game state.

This also prevents legacy champion references such as `/images/champs/*.jpg` from visually blanking a card while the future flagship art set is produced.

## Semantic visual grammar

The presentation reads the authoritative contracts from `src/game/semantic-card-types.ts` and exposes `data-card-semantic-type` on the shared card shell.

- **Estrutura** — fortified bronze/material language, rigid geometry and reinforced frame cues.
- **Ritual** — cyan/mana language with circular arcane energy and an emphasized mana gem.
- **Armadilha** — crimson reaction language with diagonal tension and reaction-speed emphasis.

The semantic name shown in the frame uses `semanticCardTypeLabel`; no presentation-specific copy duplicates the gameplay contract.

## Scope boundary

Visual 3.1 intentionally does **not**:

- change costs, stats, effects, targeting, timing or reaction rules;
- change card dimensions or battlefield hitboxes;
- add new card definitions;
- alter deck legality, matchmaking, persistence or networking;
- replace the future individual art-production pipeline.

## Certification

`src/lib/visual-3-1-card-presentation-regression.test.ts` fail-closes the following contracts:

- global stylesheet loading;
- primary art layered above regional fallback;
- semantic identity sourced from the central certified contract;
- distinct Structure/Ritual/Trap presentation;
- shared presentation on Codex, Collection, deck, Studio and battlefield surfaces;
- mobile and reduced-motion fallbacks;
- presentation-only boundary against gameplay/network/storage behavior and geometry overrides.

The PR must still pass the complete repository CI and the real-browser Alpha visual artifact inspection before merge.

## Next visual slice

After Visual 3.1 certification, the next visual program is the **Meta UI World Pass**, followed by visual feature freeze and a focused **Flagship Art Set** for Champions, the 18 semantic Alpha cards and key starter-deck cards.
