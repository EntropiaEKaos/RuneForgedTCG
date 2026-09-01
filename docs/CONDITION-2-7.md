# Condition System 2.7 — Resource Thresholds

## Objetivo

Condition 2.7 completa a leitura pública de recursos de mana sem introduzir um segundo modelo de recursos:

```ts
{ kind: "opponentManaAtLeast", amount: N }
{ kind: "spellManaAtLeast", amount: N }
{ kind: "opponentSpellManaAtLeast", amount: N }
```

`manaAtLeast` continua representando a mana normal do controlador da fonte.

## Semântica autoritativa

As quatro leituras de mana são orientadas pelo controlador da fonte. Para uma fonte do jogador, `opponent*` lê a IA; para uma fonte da IA, lê o jogador. Nenhuma condição inspeciona cartas, decisões ocultas ou informação privada.

`opponentManaAtLeast` preserva o envelope histórico de recursos gerais `0..20`. `spellManaAtLeast` e `opponentSpellManaAtLeast` usam `0..10`, alinhado ao teto administrativo real de `maxSpellMana`; o default atual continua 3.

## Lifecycle

O runtime lê diretamente `PlayerState.mana` e `PlayerState.spellMana`. `grantMana()` já converte mana normal não usada em spell mana no começo de uma nova rodada; `endTurn()` recompõe Auras condicionais após a transição. `castSpell()` paga mana normal primeiro e spell mana depois, terminando no ciclo certificado de `cleanupDead()`/recomputação.

Assim, uma Aura pode ligar quando spell mana é bancada e desligar imediatamente quando o recurso é gasto, sem cache, contador duplicado ou hook novo.

## Studio e Ability Grammar

Os três kinds aparecem no Ability Composer e no editor de Continuous Aura, incluindo composição `AND`, `OR` e `NOT`. Spell mana recebe input `0..10`; mana normal preserva `0..20`. Ability Grammar deriva os novos kinds do mesmo catálogo canônico e os publica como `supported`.

## Certificação

A suíte `condition-2-7-resource-thresholds.test.ts` cobre catálogo, clamps, orientação player/IA, composição, Mechanics, Aura, bank real de spell mana na virada de rodada, gasto real por spell, authoring e Ability Grammar. O total comportamental sobe de 73 para 74 targets.
