# Condition System 2.8 — Sentinela Board Thresholds

## Objetivo

Condition 2.8 completa a leitura das zonas principais do battlefield com duas folhas públicas:

```ts
{ kind: "allySentinelasAtLeast", min: N }
{ kind: "enemySentinelasAtLeast", min: N }
```

## Semântica autoritativa

A contagem lê diretamente `PlayerState.sentinelas` e considera ativa somente a instância com `loyalty > 0`. Uma Sentinela em Lealdade zero deixa de satisfazer a condição antes mesmo de ser removida fisicamente por cleanup.

A orientação é controller-scoped: `ally*` observa a zona do controlador da fonte e `enemy*` observa o outro jogador. A mesma regra vale para player e IA.

Sentinelas continuam fora de `bench` e `permanents`; este corte não mistura zonas nem cria contador paralelo.

## Envelope de authoring

O Studio e o sanitizer usam `1..20` como envelope de segurança de authoring. Isso **não** cria um `sentinelasCap` de gameplay. O engine atual não publica um cap configurável de Sentinelas; a heurística da IA que prefere até duas Sentinelas continua sendo apenas política da IA, não regra do jogo.

## Lifecycle

Entrada de Sentinela já converge pelo `playUnit()` semântico, que recompõe Continuous Auras quando há fonte condicional.

Na saída, `cleanupSentinelas()` passa a recompor Auras quando qualquer Sentinela é removida por `loyalty <= 0`, mesmo que a Sentinela removida não tenha Aura própria. Isso permite que thresholds de board desliguem no mesmo estado autoritativo.

Uma Sentinela que seja fonte de Aura e use `allySentinelasAtLeast` conta a si própria enquanto tiver Lealdade positiva.

## Studio e Ability Grammar

As duas folhas aparecem no Ability Composer e no editor de Continuous Aura, suportam `AND`, `OR` e `NOT`, e entram automaticamente no Ability Grammar pelo catálogo canônico de condições.

## Certificação

`condition-2-8-sentinela-board-thresholds.test.ts` cobre catálogo, clamps, orientação player/IA, `loyalty > 0`, fail-closed em Lealdade zero antes de cleanup, composição, Mechanics, Aura, auto-contagem da Sentinela-fonte, entrada real por `playUnit()`, saída real por `cleanupSentinelas()`, authoring e Ability Grammar. O total comportamental sobe de 74 para 75 targets.
