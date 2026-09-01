# Condition System 2.4 — Living Board Size Thresholds

## Objetivo

Condition 2.4 adiciona condições genéricas de quantidade de Units no battlefield sem exigir raça ou classe. O objetivo é abrir design de swarm, anti-swarm e comeback usando apenas estado público e o mesmo evaluator de condições já certificado.

## Novas condições

- `allyUnitsAtLeast` — verdadeira quando o controlador possui pelo menos `min` Units vivas no bench.
- `enemyUnitsAtLeast` — verdadeira quando o adversário do controlador possui pelo menos `min` Units vivas no bench.

O threshold é inclusivo (`>= min`). O authoring canônico normaliza `min` para `1..6`, acompanhando o limite estrutural do bench atualmente certificado.

Condições complementares não criam novos kinds. Por exemplo, “menos de 3 Units inimigas” é representado por:

```ts
{ kind: "not", child: { kind: "enemyUnitsAtLeast", min: 3 } }
```

## Semântica de Unit viva

A contagem usa exclusivamente:

```ts
unit.health > 0
```

Uma Unit que já recebeu dano letal, mas ainda está fisicamente presente no array durante uma transição de cleanup, não satisfaz `allyUnitsAtLeast` nem `enemyUnitsAtLeast`.

A contagem considera somente `PlayerState.bench`:

- Sentinelas não contam;
- Enchantments/Artifacts/Structures não contam;
- cartas na mão, deck ou outras zonas não contam.

## Orientação pelo controlador

As duas condições são controller-scoped:

- uma fonte controlada por `player` usa `players.player.bench` como aliados e `players.ai.bench` como inimigos;
- uma fonte controlada por `ai` faz exatamente o inverso.

Não existe dependência do alvo de uma Aura para determinar qual board é aliado ou inimigo.

## Mechanics

`mechanicConditionMatches()` avalia ambas as folhas diretamente sobre o owner da Unit-fonte. Elas podem ser usadas em qualquer árvore válida de `and`, `or` e `not`.

Exemplos:

- efeito de swarm: `allyUnitsAtLeast: 3`;
- resposta anti-swarm: `enemyUnitsAtLeast: 4`;
- comeback: `not(enemyUnitsAtLeast: 3)` combinado com outro predicado.

## Continuous Auras

`AURA_CONDITION_KINDS` inclui as duas novas folhas, portanto Permanent Aura, Unit Lord Effect e Sentinela Command Aura podem depender de tamanho de board.

A condição decide se a fonte participa do layer. Os filtros `races` / `classes`, quando presentes, continuam decidindo quais Units são afetadas; não alteram a contagem da condição.

Entrada, morte, recall e remoção já convergem pelos cleanups/recomputações autoritativos existentes. Nenhum segundo lifecycle ou cache de contagem foi criado.

## Studio

O Unified Ability Composer expõe:

- `Living allied Units ≥`;
- `Living enemy Units ≥`.

O Continuous Aura Studio expõe:

- `Units aliadas vivas ≥`;
- `Units inimigas vivas ≥`.

Ambos usam `1..6` e preservam composição recursiva AND/OR/NOT.

## Ability Grammar

`ABILITY_GRAMMAR_CATALOG.conditions` e `conditionContracts` continuam derivados de `MECHANIC_CONDITION_KINDS` e `CONDITION_RUNTIME_SUPPORT`. Assim, ambas as condições entram como `supported` sem novo rule kind ou contrato paralelo.

`blueprintFromPermanentStatAura()` preserva a árvore condicional e mantém `features: ["conditional"]` para Auras que dependem dessas folhas.

## Certificação comportamental

`src/game/condition-2-4-board-size-thresholds.test.ts` cobre:

- catálogo, support matrix e clamp `1..6`;
- orientação player/AI;
- Units letais ainda presentes no array não contam;
- composição com `NOT`;
- evaluator de Mechanics e Aura;
- summon real cruzando o threshold para cima e ativando Aura no mesmo estado retornado;
- kill real cruzando o threshold para baixo e removendo a Aura no mesmo estado resolvido;
- authoring de Mechanics e Aura;
- projeção pela Ability Grammar.

Com o registro dessa suíte, a taxonomia comportamental passa de 70 para 71 targets.