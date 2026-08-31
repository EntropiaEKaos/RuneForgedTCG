# Effect Chain Contract

`CardEffect.also` is RuneForge's supported sequential effect composition primitive.

- Effects resolve in authored order through the authoritative `applyEffect` loop.
- Depth starts at `0` for the root effect.
- Maximum supported depth is `12`, so one authored chain may contain at most `13` effects total.
- Studio and server authoring consume the same canonical boundary from `effect-chain-contract.ts`.
- A 14th effect fails closed during authoring instead of being silently ignored.

This contract does not add a new gameplay mechanic or change replay serialization; it formalizes and certifies the existing chained-effect runtime.
