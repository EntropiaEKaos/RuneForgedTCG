# RuneForge Alpha — Release Reports

This folder contains the certified Alpha release reports for the RuneForge project. Reports are append-only audit records: newer certifications do not erase the historical decision that was correct for an older SHA.

## Current certified baseline

- Repository: `EntropiaEKaos/RuneForgedTCG`
- Branch: `main`
- Certified SHA: `c9153d38255692eb4cde1fbcdc7f105d3d917dc8`
- Release: `2.97.0`
- Latest product milestone: `#184 — Visual 5.8: premium deck builder workbench`
- Post-merge CI: `#1154 — success`
- Alpha Release Candidate: `#31 — success`
- Post-merge certification matrix: `9/9 workflows — success`
- Vercel status on certified SHA: `success — Deployment has completed`
- Report date: `2026-09-14`

## Current reports

1. [`2026-09-14-visual-5-8-certification.md`](./2026-09-14-visual-5-8-certification.md) — exact-main Visual 5.8 promotion, post-merge matrix, RC manifest and deployment-provider evidence.
2. [`2026-09-14-alpha-engineering-report.md`](./2026-09-14-alpha-engineering-report.md) — engineering, deployment and release-candidate certification at the earlier 2026-09-14 baseline.
3. [`2026-09-14-alpha-executive-go-no-go.md`](./2026-09-14-alpha-executive-go-no-go.md) — executive GO / NO-GO decision and rollout posture at the earlier 2026-09-14 baseline.

## Historical reports

1. [`2026-09-12-alpha-engineering-report.md`](./2026-09-12-alpha-engineering-report.md) — first consolidated engineering/certification baseline.
2. [`2026-09-12-alpha-executive-go-no-go.md`](./2026-09-12-alpha-executive-go-no-go.md) — historical decision that correctly kept public release blocked before production deployment was proven.

## Current release interpretation

The codebase and deployment pipeline are certified for a **controlled / closed Alpha** on `c9153d38255692eb4cde1fbcdc7f105d3d917dc8`. Public Ranked remains intentionally fail-closed and is not an initial Alpha requirement.

Before a broad public announcement, perform one fresh external-network smoke against the current public hostname and verify health, Alpha readiness, exact deployment provenance and durable persistence for `c9153d38255692eb4cde1fbcdc7f105d3d917dc8`. The hostname is intentionally not committed to the repository, so repository-only evidence cannot substitute for this operational proof.

## Audit policy

Future Alpha release reports should be added here rather than replacing prior dated records. Each report must identify its exact certified SHA and distinguish PR-head evidence, merged-main evidence, deployment-provider evidence and independently observed runtime evidence.
