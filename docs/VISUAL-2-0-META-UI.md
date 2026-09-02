# RuneForge Visual 2.0 — Meta UI

## Objective

Turn the player-facing chrome into a reliable map of RuneForge without redesigning every page independently.

The current visual language is already coherent across deck selection, Collection, Forge, Modes, Profile and Codex. The highest-value gap is orientation and discovery: several real product routes exist outside the primary navigation and the old chrome does not communicate which product family the player is currently using.

Meta UI therefore starts at the shared shell.

## Route authority

The current URL is the only state used by this slice. `SiteNav` uses Next.js `usePathname()` to project an active product section and contextual links.

There is deliberately:

- no new API request;
- no player-data cache;
- no inferred progression state;
- no gameplay state;
- no navigation store parallel to the router.

If the route changes, the router remains authoritative and the chrome follows it.

## Product sections

### Jogar

Owns the preparation and duel loop:

- Deck selection / PvE — `/play`
- Casual PvP — `/pvp`
- Ranked — `/ranked`
- Draft — `/draft`
- Simulator — `/simulate`

### Modos

Keeps the PvE mode archive as a first-class destination while cross-linking the major competitive/limited modes.

### Coleção

Connects the collection surfaces:

- Cards — `/collection`
- Collections — `/collections`
- Album — `/album`
- Codex — `/codex`

### Forja

Connects deck construction and supplies:

- Forge — `/forge`
- Store — `/store`
- Collection — `/collection`

### Comunidade

Connects social and competitive discovery:

- Community hub — `/community`
- Friends — `/friends`
- Leaderboard — `/leaderboard`
- Casual PvP rooms — `/pvp`

### Identity & system utilities

Profile, Codex and Studio remain visible as quick actions without competing with the five player-product sections.

## Navigation semantics

Primary section links expose `data-active` when any route in their family owns the current pathname. Exact destination matches additionally expose `aria-current="page"`.

The context rail is not a second router. It is a visible projection of routes that already exist.

This distinction matters for nested routes such as replay/admin descendants and for PvP `/play` query-string sessions: the URL remains the source of truth.

## Visual hierarchy

The chrome now has three levels:

1. **RuneForge identity** — immutable brand anchor.
2. **Primary product family** — the five activities a player should understand immediately.
3. **Context rail** — nearby destinations inside the current family.

Profile/Codex/Studio are utilities. The Play Alpha CTA remains the strongest global action.

Active state uses material/light instead of extra motion. The rail carries a restrained per-section micro-accent while forged gold remains the global brand language.

## Shared page headings

Existing `rf-app-heading` surfaces gain a common bottom rule and bounded descriptive width. Page-owned buttons, counts, filters and data remain untouched.

This makes the already-consistent screens feel like one application without moving their domain logic into a new shell component.

## Responsive contract

Meta navigation must remain discoverable at every supported width.

- Wide desktop: primary sections + labeled utility actions + Play CTA.
- Medium desktop/tablet: utility labels collapse but their controls remain.
- Narrow layouts: brand/actions remain on the first row, primary navigation becomes a horizontal scroll row.
- Context rail becomes horizontal-scroll navigation instead of disappearing.
- Very small widths collapse the Play CTA label to its arrow while preserving the destination and accessible name from the link content/context.

No breakpoint replaces known routes with an unimplemented hamburger drawer.

## Accessibility

- exact current destinations use `aria-current="page"`;
- primary and contextual navs have distinct accessible labels;
- quick actions remain text-labeled on larger screens and retain link destinations/icons when compact;
- keyboard focus continues to use the global RuneForge focus ring;
- reduced motion disables Meta UI transitions.

## Engineering boundary

Meta UI must not change:

- game or match authority;
- matchmaking, PvP or Ranked state;
- player progression/economy;
- CardDef or deck legality;
- persistence or authentication semantics;
- Card Studio permissions or content authoring;
- route destinations or API contracts.

The slice changes navigation presentation and route discovery only.

## Certification

The integration gate requires:

- source-contract proof of route group ownership and router-only state;
- all existing 85 behavioral targets unchanged;
- browser E2E for Alpha, PvP/reconnect, Studio and route surfaces;
- visual artifact inspection of onboarding, deck selection, Collection, Forge, Modes, Profile and Codex;
- no viewport/root horizontal overflow introduced by the two-level chrome.

No Meta UI slice is merged from static CSS inspection alone.
