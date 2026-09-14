# RuneForge Alpha — Release Reports

This folder contains the certified Alpha release reports for the RuneForge project. Reports are append-only audit records: newer certifications do not erase the historical decision that was correct for an older SHA.

## Current certified baseline

- Repository: `EntropiaEKaos/RuneForgedTCG`
- Branch: `main`
- Certified SHA: `cb0274f86da146e8079037dfaf51ef58c6d2671c`
- Release: `2.97.0`
- Latest product milestone: `#176 — Visual 5.1: premium metagame surfaces`
- Post-merge CI: `#1116 — success`
- Alpha Release Candidate: `#24 — success`
- Post-merge certification matrix: `9/9 workflows — success`
- Vercel status on certified SHA: `success — Deployment has completed`
- Report date: `2026-09-14`

## Current reports

1. [`2026-09-14-alpha-engineering-report.md`](./2026-09-14-alpha-engineering-report.md) — exact-main engineering, deployment and release-candidate certification.
2. [`2026-09-14-alpha-executive-go-no-go.md`](./2026-09-14-alpha-executive-go-no-go.md) — current executive GO / NO-GO decision and rollout posture.

## Historical reports

1. [`2026-09-12-alpha-engineering-report.md`](./2026-09-12-alpha-engineering-report.md) — first consolidated engineering/certification baseline.
2. [`2026-09-12-alpha-executive-go-no-go.md`](./2026-09-12-alpha-executive-go-no-go.md) — historical decision that correctly kept public release blocked before production deployment was proven.

## Current release interpretation

The codebase and production deployment pipeline are certified for a **controlled / closed Alpha** on the current SHA. Public Ranked remains intentionally fail-closed and is not an initial Alpha requirement.

Before a broad public announcement, perform one fresh external-network smoke against the current public hostname and verify health, Alpha readiness and deployment provenance for `cb0274f86da146e8079037dfaf51ef58c6d2671c`. The certification environment used for the 2026-09-14 review could not resolve that hostname through its own DNS path, so the reports preserve this operational confirmation instead of inventing an external HTTP success.

## Audit policy

Future Alpha release reports should be added here rather than replacing prior dated records. Each report must identify its exact certified SHA and distinguish PR-head evidence, merged-main evidence, deployment-provider evidence and independently observed runtime evidence.
