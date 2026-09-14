# Visual 4.4 promotion checklist

Promotion is allowed only when every item below is green on the exact PR head:

- Full repository CI.
- Static/source/schema audits.
- Behavioral suite and engine coverage.
- Production PostgreSQL probes.
- Production build.
- HTTP/browser E2E.
- Visual 4.2 notebook-density browser certification.
- Visual 4.3 mobile portrait/landscape browser certification.
- Flagship visual workflows triggered for `visual/**`.
- Pull request remains mergeable against the current `main`.
- Merge uses expected-head SHA protection.
- Post-merge `main` smoke is checked before production is called fully green.
