# Graveyard Effects 1.0 — Certification Checklist

Base: `48c2fac6b9e852bc87c09821e63da57bd6552f3b`

## Functional contract

- [x] Exact graveyard entry ids are authoritative targets.
- [x] Return-to-hand consumes one entry and creates a fresh hand instance.
- [x] Reanimation consumes one Unit entry and creates a fresh canonical Unit instance.
- [x] Reanimated Units use normal summon sickness and onSummon semantics.
- [x] Graveyard banish removes exactly one legal entry.
- [x] Stale targets fail closed before payment.
- [x] Full bench/hand capacity fails closed before payment and target consumption.
- [x] AI uses deterministic legal graveyard target selection.
- [x] Gameplay exposes both public graveyards and sends zone instance ids through normal action/PvP flow.
- [x] Studio sandbox moves physical deck cards into both graveyards for live testing.
- [x] Studio authoring exposes only the certified main-phase Spell surface.

## Content isolation

- [x] No `Ecos do Abismo` deck yet.
- [x] No six Alpha starter recipe changes.
- [x] No Alpha Starter Balance tuning.
- [x] No new production card definitions.

## CI gates before merge

- [ ] static source/schema audits
- [ ] Card Studio structure guard
- [ ] typecheck
- [ ] lint
- [ ] PostgreSQL bootstrap/integrity gates
- [ ] Studio persisted publish/catalog/deck/engine lifecycle
- [ ] Studio modal and rollback certification
- [ ] behavioral suite including `graveyard-effects.test.ts`
- [ ] engine coverage gate
- [ ] production build
- [ ] browser E2E / PvP DTO isolation
- [ ] Alpha visual journey artifact
- [ ] flagship visual certs

## Post-merge gate

The definitive squash SHA on `main` must repeat CI and visual certification before PR C — **Ecos do Abismo** — begins.
