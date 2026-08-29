# Alpha Visual Journey Certification

The playable Alpha is certified at three complementary levels:

1. `scripts/alpha-player-journey.ts` certifies the persisted server journey: account → catalog → Forge → authoritative PvE → exactly-once rewards → progression → recovery.
2. `scripts/alpha-visual-journey.mjs` certifies the real single-player browser journey and produces screenshots for human visual review.
3. `scripts/alpha-casual-pvp-journey.mjs` certifies the real Casual PvP browser journey with two isolated player sessions sharing one server-authoritative room.

## Browser journey

The visual certifications run against the production Next.js build with fresh Chrome profiles and the same PostgreSQL-backed application used by HTTP E2E. They deliberately use the product UI rather than calling presentation-layer internals.

The single-player journey covers:

1. first-run Alpha onboarding;
2. deck selection;
3. mulligan;
4. first-match guide;
5. live battlefield;
6. rich card intelligence inspection;
7. collection;
8. Forge;
9. PvE modes;
10. profile/progression;
11. Codex/help;
12. return-to-play loop, proving the one-time onboarding is not shown again;
13. complete browser-driven PvE match result with confirmed rewards;
14. post-match return and persisted profile progression.

`scripts/alpha-runtime-tooltip-cert.mjs` adds a dedicated runtime-modifier battlefield checkpoint (`05c`) proving that a live unit tooltip explains genuine in-match stat/equipment/ability changes.

## Casual PvP journey

The Casual PvP gate launches two independent Chrome processes with separate profiles, cookies and stable player identities. It then exercises the same `/pvp → room → /play?pvpRoom=...` flow exposed to Alpha players.

Captured PvP checkpoints:

15. host waiting room created through the real Casual PvP lobby;
16. guest lobby seeing the host's public room;
17. host mulligan;
18. guest mulligan;
19. host authoritative battlefield;
20. guest authoritative battlefield;
21. guest battlefield after leaving the app, missing a committed server action and reconnecting to the current room version;
22. host result after the guest concedes through the in-battle UI;
23. guest result after the same authoritative settlement.

Between captures, the gate also verifies that:

- host and guest are distinct stable server identities;
- both participant DTOs have the same room lifecycle/version/round while using opposite local player orientation;
- Nexus, mana, hand/deck sizes and board-zone counts mirror correctly between the two participant views;
- server-only seed, RNG state and instance counters remain redacted from both browsers;
- mulligan completion is authoritative and orientation-safe;
- both browsers submit genuine versioned actions and observe the other participant's committed state;
- a disconnected participant recovers the latest committed version instead of falling back to local game authority;
- in-battle concession uses the normal PvP leave/forfeit contract and settles both clients to consistent victory/defeat results.

Every capture also checks that the viewport does not have horizontal page overflow and that meaningful visible text rendered. Unhandled browser runtime exceptions fail the certification.

## Why CDP instead of another browser dependency

The CI runner already provides Chrome. The scripts talk directly to the Chrome DevTools Protocol through Node 22's WebSocket implementation, so the Alpha gate does not add Playwright/Puppeteer packages or modify the dependency lock solely for screenshots.

## CI artifact

The main CI job runs the browser journeys after the authoritative HTTP E2E suites while the production build is still serving on `127.0.0.1:3000`.

Screenshots plus `manifest.json`, runtime-tooltip evidence and `casual-pvp-manifest.json` are uploaded as the `alpha-visual-journey-<commit>` artifact and retained for 14 days. This artifact is the evidence set for screen-by-screen Alpha polish and multiplayer release reviews.

## Local execution

With PostgreSQL prepared and the production app already running:

```bash
E2E_BASE_URL=http://127.0.0.1:3000 node scripts/alpha-visual-journey.mjs
E2E_BASE_URL=http://127.0.0.1:3000 node scripts/alpha-runtime-tooltip-cert.mjs
E2E_BASE_URL=http://127.0.0.1:3000 node scripts/alpha-casual-pvp-journey.mjs
```

Optional environment variables:

- `CHROME_BIN`: explicit Chrome/Chromium executable;
- `ALPHA_VISUAL_DIR`: screenshot output directory;
- `ALPHA_VISUAL_DEBUG=1`: print Chrome stderr after the run.

The default output directory is `artifacts/alpha-visual`.

## Alpha boundary

This certification does not expand Alpha scope. Casual PvP is part of the playable Alpha requirement; public Ranked, real-money payments and large-scale Live Ops remain outside the launch requirement. The purpose is to prove that the current Alpha journey is understandable, navigable, multiplayer-authoritative and visually reviewable before external players receive it.
