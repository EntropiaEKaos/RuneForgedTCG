# FORGED Client 1.0

## Purpose

FORGED Client 1.0 replaces the website-like meta navigation with persistent game-client chrome while preserving the certified gameplay, engine, economy, Ranked and persistence authorities.

The player-facing product identity is **FORGED: THE CONVERGENCE**. New player-facing surfaces use the centralized `PRODUCT_BRAND` contract rather than inventing product names in local components.

## Client shell authority

The current URL remains the authority for which player surface is active. `SiteNav.tsx` keeps its historical technical filename for compatibility with existing pages, but now renders the FORGED Client Shell:

- persistent desktop topbar;
- persistent desktop navigation rail;
- responsive mobile bottom dock;
- direct Play, Collection, Decks, Ranked, Crônicas, Events, Market and Social destinations;
- Profile and Acesso & Segurança utilities;
- Store access in client chrome.

The shell may read `/api/client/context` to project optional player display data and admin-only Studio visibility. That context does not create a player, mutate progression, authorize gameplay, or become navigation authority.

Studio is exposed by the player client only when the safe client-context response reports an authenticated `admin` role. Ordinary players do not receive a Studio navigation entry.

## Lore

Crônicas is a first-class client destination. Player Lore reads the existing versioned `site_content` CMS and only displays published `lore` entries. Content is not hardcoded into the player client.

The admin-only Lore Studio uses the existing audited CMS write/publish path, including expected-version concurrency and immutable history.

## Telemetry and Command Center

Client telemetry is first-party and versioned. The centralized client helper emits schema version 1 events to the existing sanitized `/api/telemetry` endpoint.

The admin-only Command Center combines operational database measurements with first-party telemetry. Metrics are derived from real stored data; the UI does not fabricate values.

## Authority boundaries

FORGED Client 1.0 does not change:

- game or match authority;
- the engine transition model;
- card rules or `CardDef` authority;
- balance constants;
- Ranked MMR settlement;
- matchmaking algorithms;
- player progression/economy authority;
- payment authority;
- persistence ownership.

The client shell is presentation and navigation chrome around those certified systems.

## Accessibility and responsive behavior

The desktop rail becomes a horizontally scrollable bottom dock on narrow screens. Player destinations must remain discoverable without an unimplemented hamburger/drawer. Client transitions obey `prefers-reduced-motion`.

## Release contract

No FORGED Client 1.0 slice is promoted from static CSS or source inspection alone. The visual freeze break-glass requires full CI, production build, complete browser certification, Notebook and Mobile responsive evidence, Alpha Visual Journey evidence, artifact integrity and manual screenshot inspection before merge.
