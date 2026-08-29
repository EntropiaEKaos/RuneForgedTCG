# Alpha Visual Journey Certification

The playable Alpha is certified at two complementary levels:

1. `scripts/alpha-player-journey.ts` certifies the persisted server journey: account → catalog → Forge → authoritative PvE → exactly-once rewards → progression → recovery.
2. `scripts/alpha-visual-journey.mjs` certifies the real browser journey and produces screenshots for human visual review.

## Browser journey

The visual certification runs against the production Next.js build with a fresh Chrome profile and the same PostgreSQL-backed application used by HTTP E2E. It deliberately uses the product UI rather than calling presentation-layer internals.

Captured checkpoints:

1. first-run Alpha onboarding;
2. deck selection;
3. mulligan;
4. first-match guide;
5. live battlefield;
6. collection;
7. Forge;
8. PvE modes;
9. profile/progression;
10. Codex/help;
11. return-to-play loop, proving the one-time onboarding is not shown again.

Every capture also checks that the viewport does not have horizontal page overflow and that meaningful visible text rendered. Unhandled browser runtime exceptions fail the certification.

## Why CDP instead of another browser dependency

The CI runner already provides Chrome. The script talks directly to the Chrome DevTools Protocol through Node 22's WebSocket implementation, so the Alpha gate does not add Playwright/Puppeteer packages or modify the dependency lock solely for screenshots.

## CI artifact

The main CI job runs the browser journey after the authoritative HTTP E2E suites while the production build is still serving on `127.0.0.1:3000`.

Screenshots and `manifest.json` are uploaded as the `alpha-visual-journey-<commit>` artifact and retained for 14 days. This artifact is the evidence set for screen-by-screen Alpha polish reviews.

## Local execution

With PostgreSQL prepared and the production app already running:

```bash
E2E_BASE_URL=http://127.0.0.1:3000 node scripts/alpha-visual-journey.mjs
```

Optional environment variables:

- `CHROME_BIN`: explicit Chrome/Chromium executable;
- `ALPHA_VISUAL_DIR`: screenshot output directory;
- `ALPHA_VISUAL_DEBUG=1`: print Chrome stderr after the run.

The default output directory is `artifacts/alpha-visual`.

## Alpha boundary

This certification does not expand Alpha scope. Ranked, real-money payments and large-scale Live Ops remain outside the launch requirement. The purpose is to prove that the current Alpha journey is understandable, navigable and visually reviewable before external players receive it.
