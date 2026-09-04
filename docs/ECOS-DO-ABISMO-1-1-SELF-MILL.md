# Ecos do Abismo 1.1 — Self-Mill Setup

Base certificada: `c0afa4277a507bf41fcad5b3d02c7999965e6a0b` (`main`, Self-Mill Effects 1.0 pós-merge).

## Objetivo

Evoluir o preset avançado **Ecos do Abismo** de Discard/Reanimator para **Discard + Self-Mill/Reanimator** usando exclusivamente a primitiva genérica `selfMill` já certificada no engine, Card Studio, Rule Graph, IA e behavioral suite.

## Conteúdo novo

### Recordação Submersa

- região: Tidecall;
- tipo: Spell;
- custo canônico: 2;
- raridade: Common;
- efeito: `selfMill 1 -> draw 1`;
- target: `none`;
- papel: engine/setup;
- doutrina: `ecos_do_abismo`.

Texto mecânico:

> Envie a carta do topo do seu deck ao seu Cemitério. Depois compre 1 carta.

A resolução usa a transição autoritativa `millDeckToGraveyard`. A carta enviada ao Cemitério recebe `reason="mill"` e a Spell resolvida entra normalmente no Cemitério como Spell.

## Recipe 1.1 promovida

A lista continua com exatamente **40 cartas** e identidade **Tidecall/Voidborn**.

Delta final contra Ecos 1.0:

- +1x **Recordação Submersa**;
- -1x **Tide Oracle**;
- mantém **2x Soothing Tide**;
- mantém **2x Tide Oracle**;
- nenhuma outra quantidade é alterada.

A posição textual da recipe promovida também é protegida pelo gate canônico para preservar a mesma população determinística usada durante a seleção.

## Baseline Ecos 1.0

A certificação histórica do recipe 1.0 registrou:

- 49,2% global;
- 48,6% first-player;
- 65,7% das partidas com reanimation;
- primeira reanimation média na rodada 8,2;
- Tide Control: 59,4%;
- Tempestade: 56,6%;
- Convergence Triad: 41,4%;
- zero matchups críticos.

## Exploração 1 — profundidade e quantidade de self-mill

O primeiro candidato, **2x Recordação com selfMill 2**, foi rejeitado: Tide e Triad entraram em faixa crítica.

Depois, um grid de 12.000 partidas comparou:

- 2x Recordação / selfMill 1;
- 1x Recordação / selfMill 2;
- 1x Recordação / selfMill 1.

A variante 1x/selfMill1 foi a única configuração conceitualmente adequada para continuar o refinamento.

## Exploração 2 — custo da Recordação

Custos 3 e 4 foram testados após o recipe 1x/selfMill1. Aumentar o custo não resolveu o outlier contra Tide Control e foi descartado.

A carta final permanece em **custo 2**.

## Exploração 3 — slots do recipe

Foram executadas matrizes sucessivas de 4.000 partidas por variante, removendo slots únicos e depois cópias de cartas duplicadas/triplicadas.

Trocas envolvendo Death Mark, Unmake, Wither, Glacial, Freeze e outras peças causaram regressões em Tide, Triad ou matchups agressivos.

No harness histórico certificado, os melhores candidatos sem críticos foram:

- reduzir Void Stalker;
- reduzir Void Drain;
- reduzir Tide Oracle;
- reduzir Void Hexer;
- reduzir Tide Guard.

O melhor perfil global foi **Tide Oracle -> Soothing Tide**, equivalente ao recipe final **1x Recordação, 2x Soothing Tide, 2x Tide Oracle**.

Resultado da variante escolhida em 4.000 partidas:

- **48,3% global**;
- **48,5% first-player**;
- **67,0%** das partidas com reanimation;
- primeira reanimation média: **rodada 8,1**;
- Ember Aggro: **45,4%**;
- Tide Control: **57,8%**;
- Wood Midrange: **46,6%**;
- Void Shadow: **47,4%**;
- Florestia Tribal: **45,2%**;
- Tempestade Rush: **53,2%**;
- Convergence Dual: **46,0%**;
- Convergence Triad: **44,4%**;
- **zero matchups críticos**;
- release gate: **review**, nunca blocked.

## Auditoria metodológica — ordem do deck

Durante a investigação foi identificado que o simulador determinístico usa o array do recipe como entrada para o shuffle. Portanto, alterar a ordem textual de um mesmo multiset muda o mapeamento seed -> partida.

Foi construído experimentalmente um harness order-invariant, ordenando os 40 IDs antes do shuffle. A experiência revelou um ponto importante: **o próprio Ecos 1.0 já certificado passou a falhar nessa nova população**, com:

- Tide Control: **64,8% critical**;
- Convergence Triad: **39,8% critical**.

Isso demonstra que introduzir a canonicalização silenciosamente neste PR quebraria a comparabilidade histórica e exigiria um rebaseline completo do sistema de balance.

### Decisão metodológica

Este PR **não altera o método de amostragem certificado**.

O gate 1.1:

1. usa o mesmo harness/população histórica do Ecos 1.0;
2. lê o CardDef e `decks.ts` reais;
3. não usa overrides de custo ou recipe;
4. protege a quantidade das peças;
5. protege a janela textual do recipe medida.

Uma futura migração para harness order-invariant deve ocorrer em PR separado, acompanhada de rebaseline de todos os decks certificados e novos thresholds/evidências, se necessário.

## Behavioral certification

`src/game/ecos-do-abismo.test.ts` prova:

- dez cartas originais Ecos registradas;
- recipe legal de exatamente 40 cartas;
- 1x Recordação Submersa;
- 2x Soothing Tide;
- 2x Tide Oracle;
- Card Studio round-trip preservando `selfMill 1 -> draw 1`;
- topo do deck -> Cemitério com `reason="mill"`;
- compra da carta seguinte;
- Spell resolvida -> Cemitério com `reason="spell"`;
- starters continuam isolados;
- Ranked continua sem Ecos;
- loops históricos de discard/reanimation continuam válidos;
- IA continua selecionando setup e reagindo a reanimation pela stack.

## Proteções contra regressão

O gate final falha fechado se:

- Recordação deixar de ser exatamente custo 2 / `selfMill 1 -> draw 1`;
- Ecos deixar de ter 40 cartas;
- identidade deixar de ser Tidecall/Voidborn;
- recipe deixar de conter exatamente 1x Recordação, 2x Soothing Tide e 2x Tide Oracle;
- a janela certificada do recipe mudar de ordem;
- qualquer starter absorver conteúdo `rfalpha_reanimator_*`.

## Não entra neste PR

- mudança na primitiva `selfMill`;
- payoff baseado em quantidade de cartas moídas;
- segunda carta de self-mill;
- Ranked enablement;
- mudanças econômicas/PvP/rewards;
- migração order-invariant do balance harness.

## Merge gate

Não mergear sem:

1. CI completa verde no **head exato**;
2. behavioral + coverage verdes;
3. build + browser E2E verdes;
4. balance canônico final de 4.000 partidas sem críticos;
5. quatro visual certs verdes;
6. recipe/starter/Ranked isolation confirmados;
7. pós-merge certification da `main`.
