# RuneForge Alpha — Release Reports

This folder contains the certified Alpha release reports for the RuneForge project.

## Certified baseline

- Repository: `EntropiaEKaos/RuneForgedTCG`
- Branch: `main`
- Certified SHA: `2cdee5787042666b8c4747da63d4757abf9f28ba`
- Marketplace PR: `#151 — Alpha Marketplace 1.0: Gold trading + escrowed card trades`
- Release hardening PR: `#150 — Alpha Release Hardening: secure recovery + certified deploy`
- CI after Marketplace merge: `#941 — success`
- Alpha Release Candidate: `#6 — success`
- Report date: `2026-09-12`

## Reports

1. [`2026-09-12-alpha-engineering-report.md`](./2026-09-12-alpha-engineering-report.md) — full engineering and certification report.
2. [`2026-09-12-alpha-executive-go-no-go.md`](./2026-09-12-alpha-executive-go-no-go.md) — executive GO / NO-GO decision with traffic-light status by system.

## Release interpretation

The codebase is certified for an Alpha deployment on the SHA above. A public Alpha should only be declared fully released after the production HTTPS environment proves that it is running the same SHA through the deployment provenance endpoint and passes the production smoke checklist.

This folder is intended to remain the permanent audit trail for the Alpha release decision. Future Alpha release reports should be added here rather than replacing the certified 2026-09-12 records.
