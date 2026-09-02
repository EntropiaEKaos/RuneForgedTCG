# RuneForge Visual 2.0 — Art Bible

## North star

RuneForge must feel like a **premium dark-fantasy tactical card game**, not a web dashboard containing cards.

The battlefield is an **Arcane War Table**: obsidian, forged metal, old gold, crystal, runes and restrained magical energy. The UI is allowed to be beautiful, but it must remain subordinate to the cards, the Nexus and the combat state.

## Core principles

1. **Cards are the heroes.** UI chrome may frame information but must not compete with card art.
2. **The battlefield is a place.** Rows are deployment plates, the center is a ritual conflict seal and the Nexus is a physical object.
3. **Information has hierarchy.** Immediate combat information is visible; deep information remains in inspection/tooltips.
4. **Magic has material.** Gold behaves like metal, cyan behaves like energy, black behaves like obsidian/iron rather than a flat background.
5. **Motion communicates importance.** Small actions get small feedback; lethal, Champion evolution and victory get the strongest spectacle.
6. **Competitive legibility wins.** FX may decorate state but never hide priority, targets, stats, mana, blockers or the stack.
7. **2.5D before 3D.** CSS/SVG/parallax/particles are preferred over a new rendering engine.

## Global material system

| Material | Role |
| --- | --- |
| Obsidian | Battlefield base, deep panels, card-back body |
| Forged iron | Player plates, rails, deployment boundaries |
| Old gold | Brand, premium accents, interaction framing |
| Ivory | High-priority readable text |
| Arcane cyan | Mana, response windows, energy systems |
| Ember red | Damage, combat escalation, lethal state |

The base UI stays neutral. Regional identity is projected through controlled accent energy so the cards remain visually dominant.

## Regional material language

- **Emberhold** — scorched iron, ember seams, furnace orange.
- **Tidecall** — ocean glass, pearl reflections, fluid cyan.
- **Ironwood** — cold teal metal, ancestral wood, moss.
- **Voidborn** — obsidian, purple spatial distortion, empty light.
- **Florestia** — leather, bone, old gold, wild leaf shapes.
- **Tempestade** — blue steel, electric fractures, storm light.

## Battlefield composition

### Opponent zone

The opponent plate remains compact, but hidden information is represented physically: the known hand count becomes a fan of RuneForge card backs. No card identity is exposed.

### Deployment rows

Rows are engraved deployment plates rather than flat horizontal containers. Board cards are slightly larger than the Alpha baseline, centered and allowed to rise visually on interaction.

### Conflict zone

The middle of the table owns the emotional center. A reusable RuneForge war seal sits beneath stack/combat information. Combat and response phases change the seal's energy without changing gameplay geometry.

### Player zone

The player's hand is a real 2.5D fan. Cards rotate around a shared lower origin, with a controlled lift at the edges. Hover/focus straightens and raises the selected card for inspection.

## Nexus language

The Nexus is no longer just a number.

- **Stable:** 16–20 health — intact crystal core.
- **Strained:** 11–15 — brighter, stressed energy.
- **Cracked:** 6–10 — visible magical fractures and warmer leakage.
- **Fractured:** 1–5 — pulsing critical core, red/orange fractures.
- **Destroyed:** game-over cinematics remain authoritative for the lethal event.

The numerical value remains fully visible in every state.

## Motion hierarchy

### Tier 1 — tactile

Hover, selection, mana crystals, button press, card fan movement.

### Tier 2 — tactical

Summon, spell cast, attack declaration, block, Barrier, Frostbite, Stun, stack response.

### Tier 3 — cinematic

Champion evolution, Sentinela moment, Legendary presentation, lethal Nexus hit, victory/defeat.

`prefers-reduced-motion` must disable non-essential looping animation while preserving state clarity.

## Typography

- **Cinzel / display:** RuneForge branding, major headings, Nexus values, high-impact numbers.
- **Manrope / body:** gameplay UI, labels, rules, tooltips and dense information.

Small labels use uppercase and tracking, but long gameplay guidance stays normal-case for readability.

## Accessibility and competitive constraints

- Never encode required state by color alone.
- Targetable/selected/attacking states retain semantic classes and rings.
- Opponent hand backs reveal count only, never identity.
- Board rows keep horizontal overflow on reduced widths.
- Mobile/tablet flatten the hand fan into a conventional horizontal scroller.
- Reduced motion disables critical-core pulse and rotating war seal.

## Delivery sequence

### Visual 2.0 / PR 1 — Battlefield Foundation

- Arcane War Table shell.
- Official RuneForge card back.
- Reusable conflict seal.
- Physical opponent hand representation.
- 2.5D player hand fan.
- Progressive Nexus damage states.
- Forged player plates, deployment rows and action controls.

### Visual 2.0 / PR 2 — Card Presentation

- Board-card hierarchy.
- Hand-card hierarchy.
- Rarity/frame polish.
- Keyword simplification on small states.
- Hover/inspection choreography.

### Visual 2.0 / PR 3 — Combat FX

- Draw/play/summon paths.
- Attack/block contact.
- Regional spell language.
- Nexus hit escalation.
- Champion/Sentinela cinematic moments.

### Visual 2.0 / PR 4 — Meta surfaces

- Deck Selection as war doctrines.
- Collection as a desirable collectible gallery.
- Match Result as a reward event.

## Engineering boundary

Visual 2.0 is presentation work. It must not change:

- authoritative game rules;
- AI policy;
- card definitions or balance;
- PvP/Ranked authority;
- persistence;
- economy/rewards/payment behavior.

Browser E2E and the Alpha visual artifact remain the final authority for integration.
