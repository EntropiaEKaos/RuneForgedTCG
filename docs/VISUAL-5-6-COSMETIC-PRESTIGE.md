# Visual 5.6 — Cosmetic Prestige

Visual 5.6 turns the existing card-cosmetic infrastructure into a clearer collectible hierarchy without introducing a second gameplay identity for cards.

## Product goal

The same gameplay card may have multiple visual printings. Premium frames, Full Art, Foil/Holo, Animated and Serialized copies remain the same `defId`; only presentation and collectible identity change.

The rarity of a cosmetic frame is derived from the existing published `dropWeight` in parts-per-million (PPM). It does **not** reuse or modify the gameplay `Rarity` field.

## Cosmetic prestige bands

| Prestige | Published pack odds | Meaning |
| --- | ---: | --- |
| Forjada | >= 100,000 PPM (>= 10%) | recurring special printing |
| Escassa | 25,000–99,999 PPM | uncommon cosmetic printing |
| Exaltada | 5,000–24,999 PPM | premium low-frequency printing |
| Relíquia | 1–4,999 PPM (< 0.5%) | extremely rare pack printing |
| Exclusiva | not in normal pack pool | event, promotion, market or grant distribution |

The unallocated PPM remainder continues to be the implicit Standard appearance. Cosmetic odds never replace or alter the card-definition roll.

## Presentation surfaces

- shared `CardView` receives a `card-prestige-*` class through the existing cosmetic class resolver;
- Ateliê de Variantes shows prestige and the real nominal drop chance;
- Pack reveal highlights show the same prestige derived from the registered variant;
- Visual 5.6 CSS gives each prestige band a distinct premium frame treatment with reduced-motion support.

## Authority boundaries

Visual 5.6 must not change:

- `CardInstance` gameplay identity;
- card cost, power, health, rules text, keywords, regions or gameplay rarity;
- pack card-definition selection;
- deck legality, matchmaking, Ranked, PvP or battle state;
- engine/reducer/replay authority;
- database schema.

`rarity` remains a forbidden key in cosmetic authoring payloads. The cosmetic layer is allowed to read only the already-authoritative collectible variant fields (`variantId`, `frameId`, `finish`, acquisition and `dropWeight`).

## Certification

Promotion requires full CI plus the existing notebook/mobile/flagship gates. The behavioral cosmetics test certifies the PPM bands and confirms that the shared renderer receives cosmetic prestige classes without adding cosmetic identity to authoritative gameplay state.
