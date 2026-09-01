# Vanilla 1.2 — Utilization Telemetry

## Objetivo

Vanilla 1.2 responde à principal pergunta aberta pela matriz 1.1: **o abismo Vanguard × Ascendant vem apenas de força bruta das cartas/decks ou existe fricção de utilização que precisa ser corrigida antes de balancear números?**

A etapa instrumenta o mesmo simulador real usado pelo Balance Lab 1.1, em modo estritamente opt-in. A telemetria não altera `GameState`, regras, targeting, custos, prioridades, IA ou resultado da simulação.

O princípio desta fase é separar três dimensões:

1. **força observada** — win rate, dano ao Nexus e presença de board;
2. **extração de valor** — quantas cartas vistas são efetivamente jogadas e quanto recurso fica preso;
3. **fricção tática** — cartas sem alvo, cartas jogáveis ignoradas e diferenças entre as duas políticas do simulador.

Vanilla 1.2 é um diagnóstico. Ela não autoriza, por si só, buff/nerf de carta.

## Contrato de não interferência

`runBalanceSimulation()` mantém o contrato histórico. A instrumentação vive em uma API paralela, `runBalanceSimulationWithTelemetry()`, e o teste comportamental executa o mesmo matchup/semente com e sem telemetria e exige `SimulationSummary` idêntico.

O coletor registra dados somente fora do estado autoritativo da partida. A suíte também valida merge de telemetria e invariantes como:

- cartas jogadas nunca excedem cartas vistas;
- cartas que terminam na mão nunca excedem cartas vistas;
- ambos os lados/políticas recebem amostragem balanceada;
- contadores de progresso permanecem finitos;
- os 12 decks experimentais continuam sendo o universo da auditoria.

## Matriz executada

A execução diagnóstica da 1.2 utilizou:

- **12 decks experimentais**;
- **66/66 matchups pairwise**;
- **20 jogos por estrato**;
- **3 estratos determinísticos**;
- **60 jogos por matchup**;
- **3.960 partidas** no total;
- alternância de lado/política e primeiro jogador herdada do simulador;
- **330 partidas por política por deck**;
- zero erros de pool;
- zero erros de telemetria;
- zero matchups incompletos;
- **quality gate: PASS**.

A matriz pesada é reproduzível, mas não roda em toda CI normal. A CI cotidiana executa apenas o contrato comportamental leve da instrumentação.

## Resultado por família

| Métrica | Vanguard | Ascendant | Gap Vanguard − Ascendant |
| --- | ---: | ---: | ---: |
| Win rate | **70,1%** | **29,9%** | **+40,2 pp** |
| Cartas jogadas/jogo | **11,8** | **9,7** | **+2,1** |
| Cartas na mão ao final | **2,7** | **5,3** | **−2,6** |
| Dano ao Nexus/jogo | **22,8** | **11,9** | **+10,9** |
| Aliados invocados/jogo | **10,8** | **4,3** | **+6,5** |
| Fim de turno com jogável — player heuristic | **8,3%** | **16,9%** | Ascendant pior |
| Fim de turno com jogável — AI core | **34,3%** | **53,5%** | Ascendant pior |
| Amostras sem alvo | **11.439** | **54.416** | **+42.977 Ascendant** |
| Jogáveis ignoradas | **10.251** | **26.491** | **+16.240 Ascendant** |
| Policy unsupported | **0** | **0** | nenhum suporte ausente detectado |

O sinal é consistente: Ascendant joga menos cartas, encerra as partidas com quase o dobro de cartas na mão, invoca muito menos aliados e converte aproximadamente metade do dano ao Nexus de Vanguard.

Ao mesmo tempo, **não existe evidência de um tipo de carta simplesmente “não suportado” pela política** (`policyUnsupportedSamples = 0`). O problema é mais sutil: legalidade/targeting, prioridade heurística, composição e timing fazem cartas válidas perderem muitas janelas de valor.

## Resultado por deck

| Deck | Win rate | Cartas jogadas | Mão final | Dano Nexus | Invocados | Sem alvo | Jogáveis ignoradas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tidecall Vanguard | **87,3%** | 11,6 | 3,8 | 26,1 | 10,6 | 2.639 | 2.605 |
| Tempestade Vanguard | **73,2%** | 11,3 | 2,7 | 24,8 | 10,4 | 3.125 | 2.209 |
| Emberhold Vanguard | **69,4%** | 11,2 | 2,5 | 21,9 | 10,2 | 1.515 | 1.908 |
| Florestia Vanguard | **67,1%** | 11,7 | 2,2 | 22,4 | 10,9 | 1.840 | 586 |
| Ironwood Vanguard | **62,9%** | 12,2 | 2,3 | 21,1 | 11,0 | 853 | 887 |
| Voidborn Vanguard | **60,6%** | 12,8 | 2,7 | 20,4 | 11,8 | 1.467 | 2.056 |
| Tidecall Ascendant | **44,7%** | 11,9 | 7,3 | 15,4 | 5,3 | 10.697 | 5.266 |
| Ironwood Ascendant | **29,4%** | 10,0 | 4,3 | 11,2 | 4,3 | 9.822 | 3.718 |
| Tempestade Ascendant | **28,9%** | 8,8 | 6,3 | 13,0 | 3,8 | 11.205 | 4.308 |
| Voidborn Ascendant | **27,3%** | 9,7 | 4,5 | 10,2 | 4,4 | 6.244 | 5.266 |
| Emberhold Ascendant | **27,1%** | 8,6 | 4,4 | 12,4 | 3,7 | 8.743 | 3.751 |
| Florestia Ascendant | **22,1%** | 9,1 | 5,0 | 9,1 | 4,5 | 7.705 | 4.182 |

A ordem relativa permanece compatível com o diagnóstico 1.1: Tidecall Vanguard continua muito forte e Florestia Ascendant continua no fundo. A execução 1.2 é menor porque seu objetivo é instrumentação/causalidade, não recalcular a estimativa certificada de win rate da matriz de 13.200 jogos.

## Gargalo 1 — target starvation

O maior diferencial é a frequência em que cartas dependentes de alvo ficam sem uma opção legal/útil. Entre os Ascendant, exemplos de maior volume:

| Carta | Deck | Tipo | Custo | Vistas | Jogadas | Mão final | Amostras sem alvo |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Prisão de Gelo | Tidecall Ascendant | Spell | 4 | 647 | 174 | 473 | **2.267** |
| Tridente da Lua Azul | Tidecall Ascendant | Equipment | 4 | 641 | 385 | 256 | **2.080** |
| Prisão Elétrica | Tempestade Ascendant | Spell | 4 | 495 | 212 | 283 | **2.076** |
| Foice do Último Suspiro | Voidborn Ascendant | Equipment | 4 | 471 | 324 | 147 | **2.024** |
| Asas de Relâmpago | Tempestade Ascendant | Spell | 2 | 506 | 169 | 337 | **1.996** |
| Juramento da Forja | Emberhold Ascendant | Spell | 4 | 407 | 99 | 308 | **1.966** |
| Pele de Carvalho | Ironwood Ascendant | Spell | 4 | 498 | 149 | 349 | **1.945** |
| Pele da Matilha | Florestia Ascendant | Spell | 2 | 455 | 151 | 304 | **1.927** |

Isso não significa automaticamente que o targeting da engine está errado. Uma carta pode estar corretamente indisponível porque a receita não gera o alvo necessário com frequência suficiente. A próxima etapa deve distinguir **regra/IA incorreta** de **dependência estrutural ruim do deck**.

## Gargalo 2 — jogáveis ignoradas

Há também volume alto de cartas que a telemetria considera jogáveis em uma decisão, mas a política encerra/prioriza outra ação e elas continuam represadas. Entre os Ascendant:

| Carta | Deck | Jogáveis ignoradas | Amostras jogáveis | Taxa ignorada |
| --- | --- | ---: | ---: | ---: |
| Gota Restauradora | Tidecall Ascendant | **1.476** | 5.122 | 28,8% |
| Corrente de Retorno | Tidecall Ascendant | **1.337** | 6.402 | 20,9% |
| Pele da Matilha | Florestia Ascendant | **1.156** | 4.055 | 28,5% |
| Rajada Cortante | Tempestade Ascendant | **1.149** | 4.285 | 26,8% |
| Marca Venenosa | Voidborn Ascendant | **1.040** | 3.486 | 29,8% |
| Sussurro do Nada | Voidborn Ascendant | **1.006** | 3.388 | 29,7% |
| Dreno de Alma | Voidborn Ascendant | **1.004** | 3.681 | 27,3% |
| Seiva Restauradora | Ironwood Ascendant | **997** | 3.134 | 31,8% |

Este indicador também não equivale a “bug de IA”: ignorar uma carta jogável pode ser a decisão correta. O valor está em localizar concentrações anormais e reproduzi-las em cenários menores para verificar prioridade, timing e valor esperado.

## Cartas mais represadas

Algumas cartas combinam alta taxa de mão final com target starvation e/ou ações jogáveis ignoradas:

- **Vento de Recuo** — 77,8% das cópias vistas terminam na mão;
- **Juramento da Forja** — 75,7%;
- **Prisão de Gelo** — 73,1%;
- **Rajada Cortante** — 70,2%;
- **Pele de Carvalho** — 70,1%;
- **Emboscada Verde** — 69,3%;
- **Caçada Implacável** — 67,5%;
- **Corrente de Retorno** — 67,2%;
- **Pele da Matilha** — 66,8%;
- **Asas de Relâmpago** — 66,6%.

Esse conjunto é o primeiro backlog objetivo para investigação de utilização.

## Diagnóstico de engenharia

A hipótese “Ascendant é fraco apenas porque os números das cartas estão baixos” **não está demonstrada** e não deve orientar buffs ainda.

A telemetria aponta um problema estrutural de extração de valor:

- Ascendant tem **40,2 pp** menos win rate nesta matriz;
- joga **2,1** cartas a menos por partida;
- termina com **2,6** cartas a mais na mão;
- causa **10,9** menos dano ao Nexus;
- invoca **6,5** aliados a menos;
- acumula quase **4,8×** as amostras sem alvo de Vanguard;
- acumula aproximadamente **2,6×** as jogáveis ignoradas;
- a fricção aparece nas duas políticas, embora `ai-core` termine turnos com carta jogável com frequência especialmente alta;
- não há amostras `policyUnsupported`, então não existe evidência de um buraco simples de suporte por tipo semântico.

Portanto a ordem correta é **corrigir/explicar utilização antes de alterar stats e custos**.

## Próxima etapa — Vanilla 1.3 Tactical Coverage & Playability Friction

A próxima fatia deve ser pequena e causal:

1. criar reproduções determinísticas para as cartas Ascendant mais target-starved;
2. classificar cada ocorrência em alvo realmente inexistente, timing restrito, custo/recurso, slot/board, ou escolha heurística;
3. auditar `player-heuristic` e `ai-core` para ações legalmente jogáveis que ficam sem execução;
4. corrigir apenas gaps comprovados de legalidade/seleção/prioridade, sem rebalancear números;
5. adicionar testes por carta/classe de comportamento corrigida;
6. rerodar a matriz 1.2;
7. só então rerodar a matriz 1.1 de 13.200 jogos para decidir mudanças de receita/curva/stats.

Se a fricção persistir depois de a execução tática estar correta, o próximo passo passa a ser reconstrução das receitas Ascendant e ajuste de curva/cópias. Buff/nerf de carta deve permanecer por último.

## Como reproduzir

Smoke comportamental, adequado à CI normal:

```bash
npx tsx src/game/vanilla-utilization-telemetry.test.ts
```

Matriz de telemetria 1.2:

```bash
npm run audit:vanilla-utilization
```

Equivalente explícito da execução diagnóstica de 3.960 jogos:

```bash
node --import tsx scripts/vanilla-utilization-audit.ts 20 3 --write VANILLA_UTILIZATION_AUDIT_1.2.json --enforce
```

`--enforce` bloqueia falhas da qualidade do instrumento/matriz — pool inválido, matchup incompleto ou contagem de telemetria inconsistente. Ele não transforma win rate ruim em falha técnica.

## Boundary de release

Vanilla 1.2 **não**:

- altera stats, custos ou texto de cartas;
- altera receitas dos 12 decks;
- muda regras autoritativas;
- muda decisões do simulador;
- promove decks experimentais para Ranked;
- muda o gate de Ranked 2.97;
- declara a coleção Vanilla balanceada.

Ela cria a evidência necessária para que a próxima mudança seja causal, pequena e mensurável.
