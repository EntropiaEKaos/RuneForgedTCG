# Visual 5.3 — Casual PvP Lobby Premium

## Objective

Visual 5.3 closes the remaining presentation gap in the certified Casual PvP journey.

The surrounding PvP experience is already covered by the current premium layers: mulligan inherits the Player Journey treatment, the live battlefield inherits the cinematic arena identity, and the match result inherits the premium result presentation. The unique Casual PvP lobby screens between those surfaces still read more like an operational control surface than the rest of the journey.

The certification targets are the existing Alpha Visual Journey screenshots:

- `15-pvp-host-lobby.png`
- `16-pvp-guest-lobby.png`

Screenshots `17` through `23` remain downstream evidence that this layer does not bleed into mulligan, battlefield, reconnect, reaction priority or settlement/result presentation.

## Scope

Visual 5.3 is CSS-only. It deepens the existing lobby without introducing product state or new behavior:

- PvP page atmosphere and heading hierarchy;
- session / connection / open-room status strip;
- lobby feedback banner;
- loadout selection surface;
- create-room and join-by-code decision pair;
- active waiting-room shell;
- host / guest participant cards;
- room code presentation;
- moderated chat console;
- public room browser cards;
- mobile and reduced-motion presentation fallbacks.

The layer is mounted after Visual 5.2 as `src/app/styles/visual-5-3-pvp-lobby.css`.

## Authority invariants

`src/app/pvp/PvpClient.tsx` is intentionally byte-for-byte unchanged by this slice. The Visual 5.3 regression contract pins its Git blob SHA.

Therefore the following existing contracts remain authoritative and unchanged:

- stable server player identity;
- catalog-backed deck selection;
- lobby polling every 3 seconds;
- `POST /api/pvp` room creation;
- versioned server room transitions;
- authenticated join, leave and chat actions;
- hidden opponent deck information in the lobby;
- server-confirmed transition from `waiting` to `playing`;
- redirect into `/play?pvpRoom=...` only from the authoritative room state;
- reconnect and settlement behavior;
- Casual PvP reaction-priority authority.

Visual 5.3 does not change engine, reducer, matchmaking, PvP protocol, API DTOs, database, persistence, economy, Ranked, replay state or battlefield geometry.

## Existing semantic contracts used by CSS

The layer scopes itself through accessibility contracts already present in the lobby rather than adding a parallel presentation state:

- `[aria-label="Estado do lobby PvP"]`
- `[aria-label="Chat da sala"]`
- `[aria-label="Mensagem do chat PvP"]`
- `[aria-label="Código da sala PvP"]`

Existing DOM structure is then used only for material hierarchy, including the active room containing the chat surface and the loadout surface containing `select.input`.

## Accessibility and resilience

The layer preserves the product's existing labels and controls. It adds:

- mobile treatment at `max-width: 720px`;
- restrained motion with a `prefers-reduced-motion` override;
- a no-backdrop-filter fallback;
- no CSS that enables disabled controls or changes pointer/interaction authority;
- no hidden required controls.

## Certification and promotion gate

Visual 5.3 is not eligible for merge until the exact final PR head passes the complete established gate:

- CI, including source contracts, typecheck, lint, PostgreSQL, behavioral suite, coverage, production build and full browser E2E;
- Alpha Starter Balance Evidence;
- Visual 4.2 Notebook Density;
- Visual 4.3 Mobile Responsive;
- Flagship Structures Visual Cert;
- Flagship Mana Rituals Visual Cert;
- Flagship Traps Visual Cert;
- Flagship Starter Signatures Visual Cert.

Before merge, manually inspect the Alpha Visual Journey artifact from that exact head. `15-pvp-host-lobby.png` and `16-pvp-guest-lobby.png` must show the intended premium hierarchy without clipping, lost controls, misleading authority cues or reduced legibility. Screenshots `17` through `23` must remain visually and functionally unaffected outside the normal inheritance of existing layers.

Promotion uses expected-head protection. After merge, the resulting `main` SHA should again complete the nine-workflow push certification, including the SHA-bound Alpha Release Candidate.
