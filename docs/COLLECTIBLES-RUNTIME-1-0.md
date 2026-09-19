# FORGED Cards — Collectibles Runtime 1.0

## Objetivo

Fechar o fluxo de printings colecionáveis do FORGED sem transferir autoridade cosmética para a engine.

A regra central permanece:

- `CardDef.defId` define gameplay, regras, custo, stats, legalidade e limites de deck.
- `card_cosmetic_variants` define uma printing publicada: frame, finish, arte, animação, edição, serialização e distribuição.
- `card_assets` representa uma cópia colecionável exata possuída por um jogador.
- `custom_decks.appearance_assets` guarda somente a preferência visual `defId -> assetId` daquele deck.
- `CardView` resolve a aparência no limite de apresentação; a engine não recebe `assetId`, `variantId`, frame, finish ou serial.

## Fluxo end-to-end

1. **Studio/Admin**
   - Publica uma variante cosmética para um `defId` existente.
   - Gameplay fields são rejeitados pela normalização cosmética.
   - Pack eligibility, drop weight, frame, finish, art e serial limit pertencem à printing.

2. **Pack Opening**
   - O pack escolhe primeiro o `defId` autoritativo.
   - Depois `createPackCollectibleAsset` materializa uma cópia Standard ou uma printing especial.
   - Uma run serializada esgotada cai para Standard sem trocar a carta de gameplay sorteada.

3. **Collection / Ateliê**
   - `/api/player/cosmetics` devolve as cópias exatas possuídas e a preferência global.
   - O Ateliê permite busca e filtros por raridade, finish e frame.
   - Equipar uma cópia globalmente continua opcional.

4. **Deck Builder**
   - Cada deck pode selecionar uma cópia colecionável exata por `defId`.
   - O servidor valida ownership, correspondência do `defId` e disponibilidade da printing.
   - A lista de cartas usada por `validateDeck` continua sendo apenas `string[]` de `defId`.

5. **Match presentation**
   - GameClient mantém o mapa de aparência fora do `GameState`.
   - Deck Select, mulligan, mão, campo e combat lanes recebem `assetId` apenas como prop visual.
   - Cartas controladas pela IA nunca herdam automaticamente a printing escolhida pelo jogador.
   - Um asset ausente ou vendido falha de forma segura para a preferência global ou Standard.

6. **CardView**
   - `resolveCardAppearance(defId, variantId, assetId)` resolve a cópia visual.
   - Arte e crop da printing têm precedência sobre art editorial/definition somente quando a printing está resolvida.
   - Frame, finish, prestígio e serial permanecem atributos/classes de apresentação.

## Invariantes de segurança

- Nenhum campo cosmético foi adicionado a `CardInstance` ou `GameState`.
- Nenhuma printing altera raridade autoritativa de `CardDef`.
- Nenhum `assetId` é aceito no deck sem pertencer ao jogador.
- Um asset não pode representar outro `defId`.
- Printings especiais arquivadas/desabilitadas não podem ser salvas como escolha de deck.
- Trading/marketplace podem invalidar uma escolha salva; o runtime falha fechado sem conceder ownership ou gameplay.
- O mapa de aparência não participa de matchmaking, hash de estado, regras, replay autoritativo ou resolução da engine.

## Persistência

Migration: `drizzle/0048_deck_collectible_appearances.sql`

```sql
ALTER TABLE "custom_decks"
ADD COLUMN IF NOT EXISTS "appearance_assets" jsonb NOT NULL DEFAULT '{}'::jsonb;
```

O migration foi incluído nos caminhos de upgrade e nos gates de fresh-schema, static parity e semantic parity.

## Superfícies certificáveis

- Collection / Ateliê de Variantes
- Forge / Deck Builder
- Deck Select
- Mulligan
- Player Hand
- Player Battlefield
- Combat Lanes
- Pack Opening
- Studio Cosmetics & Printings
- Shared CardView / Art Viewer

## Não objetivos

Esta frente não:
- muda regras de deck;
- muda drop de raridade de gameplay;
- torna cosmetics pay-to-win;
- injeta cosméticos na engine;
- altera comportamento da IA;
- concede ownership pelo cliente.
