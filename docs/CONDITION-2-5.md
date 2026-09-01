# Condition System 2.5 — Round Threshold

## Objetivo

Condition 2.5 adiciona uma condição temporal simples e determinística ao vocabulário canônico de condições do RuneForge:

```ts
{ kind: "roundAtLeast", amount: N }
```

Ela permite designs como:

- “A partir da rodada 5, esta unidade recebe…”;
- “Enquanto estivermos na rodada 8 ou posterior…”;
- “Antes da rodada 4…” por composição com `NOT`.

O corte reutiliza o mesmo `MechanicCondition`, sanitizer, evaluator, Continuous Aura runtime, Studio e Ability Grammar já certificados. Não existe um segundo relógio, cache de fase ou lifecycle paralelo.

## Semântica autoritativa

O predicado é exatamente:

```ts
state.round >= condition.amount
```

`roundAtLeast` é **match-scoped**: fontes de `player` e `ai` observam o mesmo `GameState.round`. Não há orientação por controller ou opponent para essa folha.

O threshold é inclusivo. `roundAtLeast: 3` é falso nas rodadas 1 e 2 e verdadeiro a partir da rodada 3.

Para expressar “antes da rodada N”, o contrato usa composição existente:

```ts
{ kind: "not", child: { kind: "roundAtLeast", amount: N } }
```

Isso evita uma folha redundante `roundBelow`.

## Envelope de authoring

O sanitizer canônico limita `amount` a `1..2000`.

Esse envelope acompanha o limite operacional do engine:

- o jogo começa na rodada 1;
- `maxRounds` é configurável pelo runtime/admin;
- o limite administrativo máximo atual é 2000.

Valores menores que 1 são elevados para 1; valores acima de 2000 são reduzidos para 2000.

## Mechanics

`mechanicConditionMatches()` avalia `roundAtLeast` diretamente contra `state.round`.

Como a condição é match-scoped, uma Unit do jogador e uma Unit da IA no mesmo estado obtêm o mesmo resultado para a mesma quantidade de rodada.

A folha continua compondo recursivamente com `AND`, `OR` e `NOT` através do evaluator já certificado.

## Continuous Auras

`AURA_CONDITION_KINDS` inclui `roundAtLeast`.

`CONDITIONAL_AURA_CONTRACT` publica explicitamente:

```ts
matchScopedConditions: ["roundAtLeast"]
```

O restante das condições controller/opponent-scoped preserva a semântica anterior. Aura 2.7 `selfDamaged` continua exclusivo de Unit-source.

Nenhum hook novo foi criado para Auras de rodada. O lifecycle normal de `endTurn()` já avança `state.round` e converge em recomputação autoritativa de Continuous Auras.

A suíte 2.5 prova uma Aura de `roundAtLeast: 3` que permanece inativa nas rodadas 1 e 2 e entra no layer imediatamente quando a transição autoritativa leva a partida à rodada 3.

## Studio

O Unified Ability Composer e o Continuous Aura Studio expõem `roundAtLeast` como:

- `Round ≥` no composer geral;
- `Rodada ≥` no editor de Aura.

O input usa `min=1` e `max=2000`, coerentes com o sanitizer do servidor.

A condição pode aparecer em qualquer profundidade válida de `AND`, `OR` e `NOT`.

## Ability Grammar

`condition-contract.ts` publica uma probe canônica de `roundAtLeast`, portanto:

- `CONDITION_RUNTIME_SUPPORT.roundAtLeast === "supported"`;
- `ABILITY_GRAMMAR_CATALOG.conditions` inclui `roundAtLeast`;
- `ABILITY_GRAMMAR_CATALOG.conditionContracts.roundAtLeast === "supported"`.

`blueprintFromPermanentStatAura()` preserva a árvore real da condição e marca a habilidade como `conditional` sem criar um novo rule kind.

## Certificação comportamental

`src/game/condition-2-5-round-threshold.test.ts` cobre:

- catálogo e support matrix;
- clamp `1..2000`;
- composição com `NOT`;
- match scope compartilhado por player/AI;
- evaluator de Mechanics;
- evaluator de Aura;
- transição real de rodada 1 → 2 → 3 por `endTurn()`;
- ativação da Aura na mesma transição autoritativa que atinge a rodada 3;
- authoring de Mechanics;
- authoring semântico de Continuous Aura;
- projeção pela Ability Grammar.

Com o registro dessa suíte, a taxonomia comportamental passa de 71 para 72 targets.
