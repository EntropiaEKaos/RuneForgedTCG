# FORGED Collector Showcase — Premium Metagame Social 1.0

Collector Showcase connects the existing cosmetic prestige, exact collectible copies and friend graph without introducing a second gameplay rarity system.

A player may curate up to six exact owned `card_assets` copies. The showcase persists only asset identifiers, visibility and a short tagline. Rendering resolves the already-published cosmetic definition and the existing PPM-derived prestige tier.

Visibility is enforced server-side: `public` for anyone, `friends` for accepted friends plus the owner, and `private` for the owner only.

Forjada / Escassa / Exaltada / Relíquia / Exclusiva continue to come from `resolveCardCosmeticPrestige`. Standard copies may also be showcased but have no cosmetic prestige tier.

The Friends surface links directly to each ally's Vitrine. Owners can copy a stable player-name link.

Showcase data cannot alter `CardDef.rarity`, cost, stats, keywords, legality, pack card-definition selection, deck identity, MMR, economy or match state. Every selected asset is revalidated as an exact owned physical copy on save.
