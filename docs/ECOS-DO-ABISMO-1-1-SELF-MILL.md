# Ecos do Abismo 1.1 — Self-Mill Setup

Base certificada: `c0afa4277a507bf41fcad5b3d02c7999965e6a0b` (`main`, Self-Mill Effects 1.0 pós-merge 6/6 verde).

## Objetivo

Evoluir o preset avançado **Ecos do Abismo** de Discard/Reanimator para **Discard + Self-Mill/Reanimator** sem criar uma segunda engine de Cemitério.

O pacote 1.1 usa exclusivamente a primitiva genérica `selfMill` já certificada no engine, Card Studio, Rule Graph, IA e behavioral suite.

## Conteúdo novo

### Recordação Submersa

- região: Tidecall;
- tipo: Spell;
- custo: 2;
- raridade: Common;
- efeito final selecionado: `selfMill 1` → `draw 1`;
- target: `none`;
- papel: engine/setup;
- doutrina: `ecos_do_abismo`.

Texto mecânico final:

> Envie a carta do topo do seu deck ao seu Cemitério. Depois compre 1 carta.

O efeito não escolhe cartas, não altera ownership, não cria cópias e usa a transição autoritativa `millDeckToGraveyard`. A Spell resolvida entra no Cemitério normalmente após o efeito.

## Recipe 1.1 selecionada

A recipe continua com exatamente **40 cartas** e identidade **Tidecall/Voidborn**.

Delta final contra a recipe 1.0:

- remove 1x `tide_heal` / Soothing Tide;
- adiciona 1x Recordação Submersa;
- mantém a segunda cópia de Soothing Tide.

Nenhuma outra quantidade da recipe 1.0 é alterada.

## Baseline 1.0

A recipe pós-certificação de Ecos 1.0 ficou em:

- 49,2% global;
- 48,6% first-player;
- 65,7% das partidas com reanimation;
- primeira reanimation média na rodada 8,2;
- Tide Control: 59,4% para Ecos;
- Tempestade: 56,6%;
- Convergence Triad: 41,4%;
- zero matchups críticos.

## Primeiro candidato rejeitado — 2x selfMill 2

O primeiro candidato real usou 2x Recordação Submersa com `selfMill 2 -> draw 1` e removeu as duas Soothing Tide.

Em 4.000 partidas canônicas:

- 49,5% global;
- 47,5% first-player;
- 63,8% das partidas com reanimation;
- primeira reanimation média: rodada 8,4;
- Tide Control: **60,6% critical**;
- Tempestade: 54,8% healthy;
- Convergence Triad: **38,4% critical**;
- Recordação usada em 61,6% das partidas.

Conclusão: duas cópias moendo duas cartas eram agressivas demais. O deck melhorava contra rush, mas piorava o plano de jogo longo e reduzia a própria taxa de reanimation.

## Grid de refinamento — 12.000 partidas

Três variantes foram comparadas, cada uma em 4.000 partidas, usando ambos os assentos, seeds determinísticos, stack/reactions reais e o mesmo harness de balance.

| Variante | Recipe | Global | First player | Reanimation | Tide | Tempestade | Dual | Triad | Críticos | Gate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `one_mill1` | 1x Recordação selfMill 1 + 1x Soothing | **49,6%** | 47,6% | **64,3%** | 59,8% | 56,2% | 50,4% | **41,0%** | **0** | review |
| `one_mill2` | 1x Recordação selfMill 2 + 1x Soothing | 49,3% | 47,5% | 64,4% | **61,0%** | 55,4% | 51,0% | **39,2%** | 2 | blocked |
| `two_mill1` | 2x Recordação selfMill 1 | 50,4% | 47,7% | 63,2% | **61,6%** | 58,0% | 51,4% | 40,4% | 1 | blocked |

Matchups completos da variante vencedora `one_mill1`:

- Emberhold Blitz: 46,0%;
- Tidecall Control: 59,8%;
- Ironwood Grove: 48,8%;
- Voidborn Dread: 46,6%;
- Matilha da Florestia: 47,8%;
- Tempestade Iminente: 56,2%;
- Convergence Dual: 50,4%;
- Convergence Triad: 41,0%.

Telemetria da vencedora:

- 4.000 partidas concluídas;
- 4.221 reanimations resolvidas;
- 4.370 tentativas;
- 149 interrupções;
- primeira reanimation média: rodada 8,4;
- Recordação usada em 40,4% das partidas;
- 1.615 usos em 1.615 partidas;
- 55,0% win rate nas partidas em que Recordação foi usada;
- zero matchups críticos.

## Decisão

A configuração selecionada é **1x Recordação Submersa, selfMill 1 -> draw 1, mantendo 1x Soothing Tide**.

O grid mostrou que:

1. **profundidade 2** de mill piora Tide e Triad mesmo em apenas uma cópia;
2. **duas cópias** aumentam demais a frequência de setup e empurram Tide para crítico;
3. a versão 1x/selfMill1 preserva a fantasia de autoalimentar o Cemitério sem transformar o deck em self-mill compulsivo;
4. a taxa de reanimation continua material em 64,3%;
5. Tempestade permanece em watch controlável e Triad acima do piso crítico.

A seleção do grid ainda deve ser reproduzida pelo **gate canônico final de 4.000 partidas**, lendo diretamente o CardDef e `decks.ts` reais sem overrides em memória.

## Behavioral certification

`src/game/ecos-do-abismo.test.ts` prova:

- dez cartas originais Ecos registradas;
- recipe legal de exatamente 40 cartas;
- exatamente 1x Recordação Submersa;
- exatamente 1x Soothing Tide;
- Card Studio round-trip preservando `selfMill 1 -> draw 1`;
- execução real: topo 1 → Cemitério com reason=`mill`, topo 2 → mão;
- Spell resolvida → Cemitério com reason=`spell`;
- starters e Ranked continuam isolados;
- loops históricos de descarte/reanimation e IA continuam verdes.

## Proteção contra recipe drift

Durante o primeiro experimento 1.1, uma substituição textual atingiu inicialmente o par `tide_heal` do starter Tidecall em vez do bloco Ecos. Isso foi detectado antes de qualquer merge pela inspeção do artifact e do patch.

O harness final agora falha fechado se:

- Recordação não for exatamente `selfMill 1 -> draw 1`;
- Ecos não tiver exatamente 1x Recordação + 1x Soothing Tide;
- qualquer um dos seis starters contiver conteúdo `rfalpha_reanimator_*`.

Assim a classe de erro encontrada no experimento passa a ser uma regressão permanentemente protegida.

## Não entra neste PR

- mudanças na primitiva `selfMill`;
- novas condições por tamanho do Cemitério;
- payoff por quantidade milled;
- alterações nos seis starters;
- Ranked enablement;
- alterações econômicas, PvP, rewards ou persistência;
- segunda carta de self-mill.

## Merge gate

Não mergear sem:

1. CI completa verde no head exato;
2. behavioral + coverage verdes;
3. build + browser E2E verdes;
4. balance **canônico** final de 4.000 partidas verde, sem overrides;
5. quatro visual certs existentes verdes;
6. auditoria final confirmando starters/Ranked intactos e recipe 1x/1x;
7. pós-merge certification da `main` definitiva.
