# RuneForge changelog

## 2.97.0 — Ranked Certification & Production Hardening

- Replaced open/custom Ranked deck acceptance with an immutable server-authoritative `season-zero-r1` preconstructed pool.
- Added four certified Ranked precons and server-side fingerprint verification; custom decks remain Casual-only.
- Added dedicated 2.97 balance certification: 4,800 games, health 100, 6/6 healthy, 0 watch, 0 critical, 6/6 stable.
- Added immutable Ranked season provenance (`rankedSeasonId`) and ranked rules/deck-pool provenance to settlement/replay records.
- Added complete PvP content snapshots and content hashes so in-flight matches cannot change when Studio/runtime definitions are published.
- Ensured initial PvP/Ranked game creation also executes inside the exact frozen content snapshot.
- Added behavioral tests for immutable PvP content and participant-state redaction.
- Centralized participant public-state projection so hands, future deck order and server RNG/instance counters remain private.
- Added Ranked rematch cooldown protection against immediate repeat-opponent farming.
- Added authoritative PvP action rate limiting.
- Sanitized HTTP 500 responses from critical admin Studio endpoints while retaining full server-side error logs.
- Fixed top-tier resolution so MMR above the configured ceiling remains Grão-Mestre instead of falling back to Bronze.
- Made the initial Ranked season migration create-only so operator-disabled seasons are not silently reactivated.
- Hardened 2.97 database upgrade/production verification for Ranked season/content snapshot columns, FKs and active-room invariants.
- Added migrations `0039_ranked_certification_2_97.sql` and `0040_pvp_content_snapshot_2_97.sql`; schema metadata is now 2.97.
- Kept production Ranked fail-closed until the clean dependency/PostgreSQL/build gate passes and `RANKED_RELEASE_CERTIFIED=true` is explicitly set.

## 2.96.3 — Test Trust & Maintainability Hardening

- Separated behavioral tests from source-text/regex audits.
- Added an explicit test taxonomy manifest and guard.
- Reclassified legacy source-reading `.test.ts` files as source-contract audits rather than behavioral evidence.
- Added `engineering-integrity-2.96.3.test.ts` with executable checks for recovery expiry policy, safe player DTOs, trusted-proxy origin behavior and content-addressed asset ownership semantics.
- Replaced the misleading `engineering-integrity-2.96.2.mjs` release gate with an explicitly named `source-contracts-2.96.3.mjs` static audit.
- Relabeled schema regex/SQL parser output as static parity, with PostgreSQL runtime verification documented as authoritative.
- Reformatted critical admin authentication/MFA code for human reviewability.
- Removed probabilistic rate-limit cleanup from request paths and moved cleanup into scheduled/runtime maintenance.
- Consolidated root documentation and archived historical generated audit artifacts.
- Updated CI so static audits, behavioral tests, PostgreSQL verification and build are distinct steps.
- Application version bumped to 2.96.3; database schema remains 2.96.2 because this patch has no schema mutation.

## 2.96.2 — Engineering Integrity

Security/account recovery, public DTO hardening, admin step-up, content reverse-dependency protection, asset rollback fixes, economy idempotency, payment recovery/error sanitization, provenance fixes and cleanup hardening.

Historical detailed release notes are preserved in `docs/archive/root-history/`.

## 2.96.1 — Schema / Replay hotfix

Repaired Drizzle/SQL replay provenance drift, the `admin_sessions.actor_id` index bug and missing `matches.engine_rules` / `matches.ai_rules` bootstrap columns.

## 2.96 — Sentinelas & Convergence

Expanded Sentinelas and multi-region content, improved Sentinela engine behavior and reduced critical competitive matchups while keeping Ranked fail-closed.
