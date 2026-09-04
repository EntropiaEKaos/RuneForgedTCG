# Balance Simulator — Stack-Aware Reaction Support

## Why this exists

The historical RuneForge balance simulator predates semantic Trap cards. Its deterministic loop intentionally handled only main-phase decisions and combat blocking. That contract powered earlier balance baselines and must remain reproducible.

After the six Alpha starters received one certified Trap each, the Alpha Starter Balance 1.0 artifact exposed a coverage gap: every Trap was seen hundreds of times, but all six recorded exactly zero plays.

The runtime game was not broken. The evidence harness was incomplete.

## Compatibility rule

The historical APIs remain unchanged:

- `runBalanceSimulation()`
- `runBalanceSimulationWithTelemetry()`

They continue to use the historical main/blocking-only behavior so previously certified reports remain reproducible.

Two explicit opt-in APIs add reaction-stack coverage:

- `runStackAwareBalanceSimulation()`
- `runStackAwareBalanceSimulationWithTelemetry()`

Only callers that explicitly select the new APIs receive stack-aware outcomes.

## Authoritative reaction path

The stack-aware mode does not create a second reaction engine.

Proactive hand actions are routed through the existing certified authority:

- `aiChooseReaction()`;
- `applyStackedActionWithAi()`;
- `canReactWithResponse()`;
- normal engine Spell/Trap mana, targeting, timing and resolution.

Main-phase activated battlefield actions remain direct, matching the existing reducer/Ecos balance contract.

## Starter Trap AI coverage

The public AI facade now includes a narrow fallback for semantic `archetypeKey="trap"` cards after all historical and critical-counter reaction policies decline.

The fallback supports the effects used by the six Alpha teaching Traps:

- damage Nexus;
- negate Spell;
- grant Barrier;
- mill;
- buff allies;
- stun enemy unit.

Every candidate response is still accepted only when `canReactWithResponse()` says it is legal.

## Tidecall timing correction

`Selo da Contramaré` is a `negateSpell` Trap targeting `spellOnStack`.

Under the certified reaction-speed contract:

- Fast may respond to Unit/Sentinela actions;
- Burst may also respond to Spells.

Therefore a Fast counter Trap targeting `spellOnStack` was structurally unusable. Its speed is corrected from **Fast** to **Burst**. No effect, cost, region, rarity or recipe slot changes.

## Telemetry

Reaction cards resolved by the stack-aware simulator are included in existing read-only utilization counters:

- `played`;
- deck/policy `cardPlays`;
- printed cost;
- normal/spell mana spent.

Instrumentation remains outside authoritative game state.

## Certification

`src/game/balance-simulator-reactions.test.ts` proves:

1. all six starter Traps can produce a legal AI reaction in a controlled authoritative state;
2. Tidecall's counter Trap can legally react to a pending Spell;
3. the historical simulator still records zero reactions in the controlled probe;
4. stack-aware mode resolves real Trap reactions;
5. stack-aware telemetry returns the exact same `SimulationSummary` as stack-aware simulation without telemetry.

## Follow-up

After this PR is integrated, Alpha Starter Balance 1.0 must be rebased onto the certified main and rerun using the stack-aware APIs.

Its simulation-quality gate should fail closed if a starter Trap is seen in the full matrix but never played, preventing a reaction-blind baseline from being promoted again.
