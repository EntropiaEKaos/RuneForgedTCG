# Condition System 2.3 — Hand Size Thresholds

## Objetivo

Condition 2.3 amplia o vocabulário controller-scoped do RuneForge com condições baseadas **somente na quantidade de cartas na mão**. O corte não observa identidades de cartas ocultas e não cria um segundo evaluator.

Novas folhas:

- `handAtLeast` — a mão do controlador possui pelo menos `amount` cartas;
- `opponentHandAtLeast` — a mão do adversário do controlador possui pelo menos `amount` cartas.

O limite é inclusivo (`>=`). O authoring reutiliza o envelope numérico canônico `0..20`.

## Privacidade e orientação

A condição lê exclusivamente `PlayerState.hand.length`.

Ela nunca consulta `defId`, ordem ou qualquer outro conteúdo da mão adversária. Trocar todas as identidades ocultas mantendo a mesma contagem não altera o resultado.

A orientação é simétrica:

- uma fonte de `player` avalia `handAtLeast` na mão de `player` e `opponentHandAtLeast` na mão de `ai`;
- uma fonte de `ai` faz o inverso.

## Composição

As novas folhas participam do mesmo contrato `AND / OR / NOT` já certificado.

Não existe uma folha redundante `handBelow`. Designers podem expressar “menos de N cartas” como:

```ts
{ kind: "not", child: { kind: "handAtLeast", amount: N } }
```

Isso mantém o vocabulário menor sem perder poder expressivo.

## Runtime

### Mechanics

`mechanicConditionMatches()` compara a mão do owner da Unit-fonte e a mão do oponente, sem alterar targeting, trigger timing ou resolução de efeitos.

### Continuous Auras

`auraConditionMatches()` usa a mesma orientação. A condição decide se a fonte inteira participa do layer; os filtros de raça/classe continuam independentes.

O lifecycle já convergia corretamente:

- jogar uma carta remove a instância da mão antes do cleanup/recompute autoritativo;
- conjurar uma magia remove a carta, resolve seus efeitos e depois recompõe Continuous Auras;
- efeitos de compra executados durante a resolução são observados no recompute final;
- mudança de rodada passa pelo boundary semântico que já recompõe Auras condicionais.

Não foi necessário adicionar hooks novos ao engine.

## Studio e Ability Grammar

O Unified Ability Composer e o editor de Continuous Aura expõem:

- `Your hand ≥` / `Sua mão ≥`;
- `Opponent hand ≥` / `Mão inimiga ≥`.

As folhas continuam disponíveis recursivamente dentro de `AND / OR / NOT` até os limites estruturais canônicos.

`ABILITY_GRAMMAR_CATALOG.conditions` e `conditionContracts` derivam do catálogo canônico, portanto as duas condições são publicadas como `supported` sem novo rule kind.

## Authoring e fail-closed

`MECHANIC_CONDITION_KINDS`, `MechanicCondition` e `sanitizeMechanicCondition()` permanecem a única fonte canônica.

Payloads numéricos são truncados e limitados a `0..20`. Árvores inválidas continuam rejeitadas pelo sanitizer existente.

Aura 2.7 permanece inalterada: `selfDamaged` continua permitido somente para Unit-source. Condition 2.3 não amplia esse boundary.

## Certificação comportamental

A suíte `src/game/condition-2-3-hand-size-thresholds.test.ts` cobre:

- catálogo, support matrix e sanitizer;
- thresholds inclusivos e composição `NOT`;
- orientação player/AI;
- independência das identidades ocultas da mão adversária;
- Mechanics e Aura usando o mesmo significado;
- uma jogada real reduzindo a mão abaixo do threshold e desligando uma Aura no mesmo estado retornado;
- uma magia de compra atravessando o threshold para cima e ativando a Aura na mesma resolução;
- authoring de Mechanics e Continuous Aura;
- projeção pela Ability Grammar.

Com o registro desta suíte, a taxonomia comportamental passa de **69 para 70 behavioral targets**.
