# RuneForge Visual 2.0 — Victory / Defeat / Rewards

## Objective

Turn the end of a RuneForge match into a meaningful battle conclusion without changing the result, mastery calculation, reward settlement or replay/deck actions.

The previous surface already exposed the correct data, but presented it as a compact report modal. This slice makes the same authoritative facts read as the end of a Nexus duel: outcome first, Nexus state second, mastery and rewards as earned progression, actions last.

## Authority boundary

`MatchResult` remains a projection of existing state and already-settled reward data.

This slice does **not**:

- decide the winner;
- calculate XP, gold or dust;
- grant rewards;
- change level-up thresholds;
- change mastery scoring;
- mutate match state;
- alter PvP or Ranked settlement;
- create a second result/reward store;
- call a new API.

The existing inputs remain authoritative:

- `state.phase === "gameover"` controls whether the result surface exists;
- `state.winner === "player"` projects victory or defeat;
- current Nexus health and match stats come directly from `GameState`;
- `evaluateMatchMastery(state)` remains the sole mastery calculation;
- `reward.xpGain`, `reward.goldGain`, `reward.dustGain`, `reward.leveledUp` and `reward.newLevel` remain the already-confirmed reward values provided by the existing settlement flow.

## Visual hierarchy

The surface now reads in five layers:

1. **Outcome** — Victory or Defeat is the primary emotional statement.
2. **Nexus scoreboard** — both final Nexus values are shown as explicit sides of the duel.
3. **Battle summary** — rounds, Nexus damage, summons and spells remain concise supporting facts.
4. **Mastery and rewards** — mastery becomes a medal/progress surface; confirmed rewards become a dedicated earned-progression panel.
5. **Next action** — Rematch remains primary, with deck change and sharing subordinate.

Victory and defeat use different accent materials. Those accents never change copy, values, actions or authority.

## Reward semantics

The `aria-label="Recompensas confirmadas"` contract is preserved because rewards shown here have already passed the existing settlement path. The presentation must never imply a reward that has not been provided through the `reward` prop.

If `reward` is absent — such as result surfaces that do not include a local reward payload — the reward panel is simply absent. The result, score, mastery and actions still render normally.

## PvP compatibility

The existing PvP browser certification reads `.match-result-card` and verifies the exact victory/defeat semantics after authoritative concession/forfeit settlement. That class remains stable.

The new layout therefore must support both:

- PvE result with confirmed XP/gold reward data;
- PvP host/guest result without requiring a reward panel.

## Responsive contract

The result is intentionally wider than the old 440px report card, but remains bounded by the viewport.

- standard desktop target: up to 560px;
- low-height desktop compacts vertical spacing before shrinking hierarchy;
- mobile reflows stats to two columns and actions to one column;
- the backdrop may scroll vertically when device height is constrained;
- no result content may enlarge root horizontal overflow.

## Motion and accessibility

Strong motion is reserved for the one-time appearance of the result. Decorative rift/seal rotation is presentation-only and stops under `prefers-reduced-motion: reduce`.

The information hierarchy does not depend on animation, color alone or transient FX.

## Engineering boundary

Victory / Rewards polish must not change:

- game engine or `GameState` transitions;
- winner determination;
- reward settlement or economy ledgers;
- mastery scoring;
- matchmaking, PvP or Ranked authority;
- persistence or authentication;
- CardDef/content authoring;
- Card Studio permissions;
- replay/deck-change callbacks.

## Certification

The integration gate requires:

- behavioral baseline remains 85/85;
- source-contract proof that result/reward authority is unchanged;
- full build/DB/Studio/security certification;
- browser E2E for PvE and PvP result semantics;
- visual inspection of `12-match-result.png`, `22-pvp-host-result.png` and `23-pvp-guest-result.png`;
- no viewport clipping or horizontal overflow;
- local artifact download, ZIP integrity verification and SHA-256 match before final certification.
