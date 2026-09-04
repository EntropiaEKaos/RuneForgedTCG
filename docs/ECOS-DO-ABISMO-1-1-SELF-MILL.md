# Ecos do Abismo 1.1 — Self-Mill Setup

Base certificada: `c0afa4277a507bf41fcad5b3d02c7999965e6a0b` (`main`, Self-Mill Effects 1.0 pós-merge 6/6 verde).

## Objetivo

Evoluir o preset avançado **Ecos do Abismo** de Discard/Reanimator para Discard + Self-Mill/Reanimator sem criar uma segunda engine de Cemitério.

O pacote 1.1 usa exclusivamente a primitiva genérica `selfMill` já certificada no engine, Card Studio, Rule Graph, IA e behavioral suite.

## Conteúdo novo

### Recordação Submersa

- região: Tidecall;
- tipo: Spell;
- custo: 2;
- raridade: Common;
- efeito: `selfMill 2` → `draw 1`;
- target: `none`;
- papel: engine/setup;
- doutrina: `ecos_do_abismo`.

Texto mecânico:

> Envie as 2 cartas do topo do seu deck ao seu Cemitério. Depois compre 1 carta.

O efeito não escolhe cartas, não altera ownership, não cria cópias e usa a transição autoritativa `millDeckToGraveyard`. A Spell resolvida entra no Cemitério normalmente após o efeito.

## Delta de recipe

A recipe continua com exatamente **40 cartas** e identidade **Tidecall/Voidborn**.

Mudança única:

- remove 2x `tide_heal` / Soothing Tide;
- adiciona 2x Recordação Submersa.

Nenhuma outra carta, quantidade ou CardDef da recipe 1.0 é alterado neste primeiro candidato.

## Hipótese de balance

A recipe 1.0 pós-certificação ficou em:

- 49,2% global;
- 48,6% first-player;
- 65,7% das partidas com reanimation;
- primeira reanimation média na rodada 8,2;
- Tempestade: 56,6% para Ecos;
- Convergence Triad: 41,4% para Ecos;
- zero matchups críticos.

Trocar duas curas por dois cantrips de self-mill deve, em tese:

1. reduzir parte da estabilização gratuita contra decks rápidos;
2. aumentar a chance de colocar Devorador/Colosso no Cemitério sem exigir outlet em campo;
3. melhorar consistência quando Rito/Fio já estão na mão;
4. diminuir a dependência de descarte selecionado sem substituí-lo;
5. preservar counterplay, porque reanimation continua passando pela stack normal.

A hipótese só será aceita se a matriz determinística de 4.000 partidas confirmar.

## Behavioral certification

`src/game/ecos-do-abismo.test.ts` deve provar:

- dez cartas originais Ecos registradas;
- recipe legal de exatamente 40 cartas;
- exatamente 2x Recordação Submersa;
- 0x Soothing Tide na recipe 1.1;
- Card Studio round-trip preservando `selfMill 2 -> draw 1`;
- execução real: topo 1 e 2 → Cemitério com reason=`mill`, topo 3 → mão;
- Spell resolvida → Cemitério com reason=`spell`;
- starters e Ranked continuam isolados;
- loops históricos de descarte/reanimation e IA continuam verdes.

## Balance gate

O workflow canônico deve continuar lendo diretamente `decks.ts` e os CardDefs reais, sem overrides em memória.

Aceitação mínima:

- 4.000 partidas concluídas;
- zero matchups críticos (<40% ou >60%);
- global dentro da faixa de review/healthy;
- first-player sem skew crítico;
- reanimation continua sendo parte material da identidade do deck;
- nenhum ganho de consistência que transforme o arquétipo em combo não-interativo.

Especial atenção:

- Tempestade não deve piorar para um crítico a favor de Ecos;
- Triad deve permanecer acima do piso crítico;
- a taxa de reanimation não deve cair por perda de sustain antes do setup.

## Não entra neste PR

- mudanças na primitiva `selfMill`;
- novas condições por tamanho do Cemitério;
- payoff por quantidade milled;
- alterações nos seis starters;
- Ranked enablement;
- alterações econômicas, PvP, rewards ou persistência;
- segunda carta de self-mill antes de evidência do primeiro candidato.

## Merge gate

Não mergear sem:

1. CI completa verde no head exato;
2. behavioral + coverage verdes;
3. build + browser E2E verdes;
4. balance canônico de 4.000 partidas verde;
5. quatro visual certs existentes verdes;
6. auditoria final confirmando apenas a carta nova + troca 2-for-2;
7. pós-merge certification da `main` definitiva.
