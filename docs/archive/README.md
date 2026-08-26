# Historical release artifacts

Incremental 2.x audit dumps, file-count snapshots, generated manifests and one-off certification notes are intentionally **not shipped in the active source tree** anymore.

They were useful development records but became misleading as current engineering evidence, especially because many older “tests” were source-text/regex contracts rather than behavioral tests. Preserve immutable historical artifacts in Git tags/releases or external release storage, not alongside the current source of truth.

Current documentation is intentionally small:

- `README.md`
- `CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/RELEASE.md`
- `docs/AUDIT_2.97.md` for the current hardening evidence

Do not reintroduce per-version audit/manifests at repository root.
