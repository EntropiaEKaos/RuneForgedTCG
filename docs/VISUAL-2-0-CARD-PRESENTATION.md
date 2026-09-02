# RuneForge Visual 2.0 — Card Presentation

## Objective

Make the card itself the visual hero of a RuneForge match without increasing rules noise or touching authoritative gameplay.

The presentation system has three densities:

1. **Board card** — art, cost, name, keyword icons and combat stats. Fast tactical reading wins over printed-card completeness.
2. **Hand card** — stronger collectible frame, readable rules text and art, with rarity and regional identity visible before inspection.
3. **Intelligence / inspect** — information-first forged panel for rules, runtime deltas, statuses, abilities and provenance.

## Art direction

The card is a forged object rather than a floating web panel:

- dark iron / obsidian body;
- restrained old-gold structural highlights;
- region as a material accent and local glow rather than a full-frame color wash;
- rarity expressed through frame metal/light;
- mana represented as a rune-stone;
- Power and Health as distinct shield-like anchors;
- angular nameplate inspired by a fitted metal plaque;
- art remains the largest visual surface.

## Regional accents

| Region | Presentation accent |
| --- | --- |
| Emberhold | heated orange iron |
| Tidecall | cyan glass / ocean light |
| Ironwood | teal verdigris / living metal |
| Voidborn | violet void-energy |
| Florestia | old gold / wild amber |
| Tempestade | electric blue steel |

The region remains redundantly encoded by sigil and existing accessible labels, so color is never the only identifier.

## Rarity hierarchy

Rarity does not replace region identity. It changes the perceived quality of the forged object:

- **Common** — base metal frame;
- **Rare** — cold silver edge;
- **Epic** — restrained violet inner light;
- **Legend** — warm gold edge and stronger hand presence;
- **Champion** — retains its existing champion semantics and receives the premium gold frame treatment.

Gameplay target/selection signals always override rarity glow.

## Information hierarchy

### Board

Visible by default:

- art;
- mana cost;
- name;
- region sigil;
- compact keyword icons;
- Power / Health or spell speed;
- runtime status overlays already certified by the engine UI.

Long rules text, role labels, collection metadata and lore stay out of the small battlefield card and remain available through inspection.

### Hand

Adds:

- readable card type / rarity;
- strategic role;
- rule text;
- collection identity;
- richer rarity/frame treatment.

The existing Visual 2.0 fan geometry remains authoritative for layout.

### Intelligence / inspect

The intelligence panel keeps all existing runtime and authoring detail. Visual 2.0 only changes its material hierarchy: dark forged surface, subtle gold inner frame and clearer section separation.

## Engineering boundary

This phase is presentation-only. It must not alter:

- CardDef values;
- costs, Power, Health, keywords or rules;
- targeting legality;
- engine execution;
- AI policy;
- PvP / Ranked authority;
- persistence, economy or rewards;
- Card Studio authoring semantics.

## Certification

The standard CI remains authoritative for behavior. Visual approval additionally requires the Alpha browser journey artifact to be inspected, especially:

- `05-battlefield.png` — board + hand composition;
- `05b-card-intelligence-tooltip.png` — intelligence hierarchy;
- `19-pvp-host-battlefield.png` and `20-pvp-guest-battlefield.png` — competitive readability;
- `21-pvp-reconnected-guest.png` — controls must remain hit-testable and unobstructed.

The screenshot gate from the Battlefield Foundation remains in force: a green CI proves function; the artifact proves presentation quality.
