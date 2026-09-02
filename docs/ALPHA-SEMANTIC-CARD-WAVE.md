# Alpha Semantic Card Wave — Structure, Mana Ritual and Trap

## Status

This slice introduces the first production cards for the three certified semantic gameplay types without opening a new rules-engine front.

The Alpha wave contains **18 code-authored Vanilla cards**:

- 6 Structures — one per region;
- 6 Rituals — one per region;
- 6 Traps — one per region.

The canonical Vanilla code-authored baseline therefore moves from **429 to 447 cards**. The historical `van_*` experimental intake remains 180 cards and the 12 Balance Lab deck recipes remain unchanged.

## Product identity

The three semantic types now have deliberately different jobs:

- **Structure** — persistent battlefield preparation, paid with regular mana and not counted as a spell cast;
- **Ritual** — deliberate main-phase **mana card** that manipulates mana and then expresses a regional payoff;
- **Trap** — reaction-only hand interaction inside a legal response window.

The player-facing shorthand is:

> Structure prepares the board. Ritual prepares resources. Trap answers the opponent.

## Ritual design law

Every collectible Ritual must interact with mana.

For the public Alpha, `manaRefund` is the first certified Ritual mana opcode. It restores regular mana up to the controller's existing maximum mana and therefore cannot raise maximum mana or generate an unbounded resource loop by itself.

The semantic validator fails closed when a collectible Ritual does not contain a certified mana effect in its spell/effect chain. Card Studio also seeds a newly selected Ritual with `manaRefund` instead of a generic draw effect.

Non-collectible engine probes remain allowed to isolate timing behavior independently from product-content rules.

## Regional Ritual identities in the Alpha wave

| Region | Ritual identity | Alpha expression |
| --- | --- | --- |
| Emberhold | Burn / tempo conversion | Refund mana, then damage the enemy Nexus |
| Tidecall | Recycling / card flow | Refund mana, then draw |
| Ironwood | Investment / durable value | Larger mana refund, then reinforce allied health |
| Voidborn | Corruption / resource exchange | Refund mana, then mill the enemy deck |
| Florestia | Board-to-resource momentum | Refund mana, then strengthen allied Bestas |
| Tempestade | Explosive current-turn tempo | Larger mana refund, then Stun an enemy unit |

The six cards share a recognizable mana identity without becoming six copies of the same design.

## Mana safety rules

Alpha Rituals follow these constraints:

1. no Ritual increases `maxMana`;
2. no Ritual creates an autonomous repeatable positive-mana loop;
3. refunds are capped by the player's current maximum mana;
4. Ritual remains main-phase only and cannot react;
5. all secondary effects use already-certified engine opcodes;
6. any future mana opcode must gain explicit authoring validation and behavioral coverage before production content can use it.

## Ritual 2.0 backlog — retained, not an Alpha blocker

The following mana families remain on the design roadmap and must be implemented one at a time behind certified contracts:

- **Acceleration** — temporary or next-round mana;
- **Conversion** — regular mana ↔ spell mana;
- **Recovery** — conditional refund after a meaningful investment;
- **Investment** — spend now for a later resource return;
- **Drain** — interact with opponent resources under bounded rules;
- **Affinity** — scale from current mana/spell-mana thresholds;
- **Overload** — optional extra mana for a larger effect;
- **Reserve / Sealed Mana** — store mana in a bounded persistent resource.

These mechanics are intentionally not introduced by the Alpha wave. Shipping the Alpha takes priority over expanding the resource engine.

## Balance isolation

The 18 cards are registered in the canonical base catalog and therefore belong to Vanilla, Collection, Codex, Forge and custom deckbuilding.

They are **not** injected into the 12 historical experimental Balance Lab decks in this slice. This preserves the comparability of the certified Vanilla 1.8 matrix while the new cards receive their own content/runtime certification.

After the semantic wave is stable, candidate starter-deck integrations can be tested in small controlled recipe changes and measured in the existing Balance Lab.

## Release path retained

The delivery order remains:

1. certify the 18-card semantic Alpha wave;
2. certify Alpha starter decks and decide where semantic cards belong;
3. perform the minimum evidence-backed balance work needed for a public Alpha;
4. prioritize card art/presentation for the actual Alpha pool;
5. feature freeze and produce the Release Candidate.

Ranked perfection, additional semantic card types, advanced Ritual 2.0 mana mechanics and complex Live Ops remain outside the Alpha critical path unless player testing exposes a release blocker.
