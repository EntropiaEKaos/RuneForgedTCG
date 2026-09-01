# Vanilla 1.1 — Balance Lab Experimental Matrix

## Objetivo

Vanilla 1.1 mede os 12 arquétipos experimentais congelados em Vanilla 1.0 antes de qualquer alteração de custo, stats ou texto de carta. A etapa reutiliza a engine real e o simulador 2.97 existente, mantendo os decks fora do Ranked através de overrides isolados.

O princípio desta fase é separar duas perguntas:

1. **A simulação é confiável e reproduzível?** Isso é um gate de engenharia.
2. **Os decks estão equilibrados?** Isso é um resultado de design/balanceamento e deve ser reportado mesmo quando falha.

Um meta 97/3 não invalida a auditoria; ao contrário, é justamente o tipo de problema que o Balance Lab precisa revelar.

## Contrato da matriz

- 12 decks experimentais;
- 40 cartas por deck;
- 2 decks por região;
- 66 matchups pairwise completos;
- 6 confrontos internos de região;
- 60 confrontos entre regiões;
- decks injetados via `runBalanceSimulation(..., overrides)`;
- nenhum registro dos decks no pool público de Ranked;
- alternância de lado do deck e primeiro jogador herdada do simulador 2.97;
- estratos independentes de seeds determinísticas;
- intervalo de Wilson 95% para win rate;
- estabilidade medida pela maior diferença absoluta de um estrato para o resultado agregado.

O contrato permanente fica em `src/game/vanilla-balance-lab.ts`. O smoke comportamental fica em `src/game/vanilla-balance-lab.test.ts`.

## Execução certificada inicial

A execução de intake utilizou:

- **40 jogos por estrato**;
- **5 estratos**;
- **200 jogos por matchup**;
- **66 matchups**;
- **13.200 jogos totais**.

Resultado de qualidade da simulação:

- matchups esperados: **66**;
- matchups concluídos: **66**;
- matchups incompletos: **0**;
- erros no pool: **0**;
- matchups estáveis: **66/66**;
- matchups instáveis: **0**;
- limite de estabilidade: **23,7 pp**;
- maior desvio observado entre estrato e agregado: **18,5 pp**;
- first-player win rate: **49,9%**;
- draw rate: **0%**;
- duração média: **10,6 rodadas**;
- **simulation quality gate: PASS**.

## Resultado de balanceamento

O balanceamento experimental não passou:

- health score: **0**;
- healthy: **9** matchups;
- watch: **5** matchups;
- critical: **52** matchups;
- **balance status: BLOCKED**.

Isso não bloqueia a integração da ferramenta 1.1: a ferramenta existe para revelar esse estado. O estado BLOCKED impede, sim, qualquer promoção desses decks ao Ranked ou declaração de Vanilla balanceada.

### Resultado agregado por deck

| Deck | Região | Win rate | Jogos | Healthy | Watch | Critical |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Tidecall Vanguard | Tidecall | **85,5%** | 2.200 | 0 | 0 | 11 |
| Tempestade Vanguard | Tempestade | **75,1%** | 2.200 | 1 | 0 | 10 |
| Emberhold Vanguard | Emberhold | **68,6%** | 2.200 | 1 | 1 | 9 |
| Florestia Vanguard | Florestia | **66,8%** | 2.200 | 1 | 1 | 9 |
| Ironwood Vanguard | Ironwood | **64,3%** | 2.200 | 3 | 1 | 7 |
| Voidborn Vanguard | Voidborn | **60,1%** | 2.200 | 0 | 2 | 9 |
| Tidecall Ascendant | Tidecall | **45,0%** | 2.200 | 0 | 1 | 10 |
| Ironwood Ascendant | Ironwood | **29,6%** | 2.200 | 3 | 1 | 7 |
| Tempestade Ascendant | Tempestade | **28,1%** | 2.200 | 3 | 0 | 8 |
| Voidborn Ascendant | Voidborn | **27,7%** | 2.200 | 3 | 1 | 7 |
| Emberhold Ascendant | Emberhold | **27,6%** | 2.200 | 3 | 0 | 8 |
| Florestia Ascendant | Florestia | **21,4%** | 2.200 | 0 | 2 | 9 |

### Resultado agregado por região

| Região | Win rate agregado |
| --- | ---: |
| Tidecall | **65,3%** |
| Tempestade | **51,6%** |
| Emberhold | **48,1%** |
| Ironwood | **47,0%** |
| Florestia | **44,1%** |
| Voidborn | **43,9%** |

Os números regionais escondem uma parte importante do problema: Tempestade, por exemplo, aparece perto de 50% no agregado, mas seus dois decks estão em extremos opostos. Portanto o primeiro problema não parece ser apenas "uma região forte e outra fraca".

## Confronto mais extremo

**Tidecall Vanguard × Florestia Ascendant**:

- Tidecall Vanguard: **97,5%**;
- Florestia Ascendant: **2,5%**;
- 200 jogos;
- 195 × 5 vitórias;
- first-player win rate: **50,5%**;
- seed-strata de Tidecall Vanguard: **92,5 / 97,5 / 97,5 / 100 / 100%**;
- maior desvio de estrato: **5 pp**.

Esse confronto é extremamente desigual e, ao mesmo tempo, estatisticamente estável dentro do protocolo escolhido.

## Diagnóstico de engenharia

O padrão dominante é **Vanguard forte / Ascendant fraco** em cinco das seis regiões, com Tidecall Ascendant sendo a exceção menos fraca. Isso sugere que não devemos começar nerfando e buffando cartas individualmente.

As duas receitas têm composição estrutural diferente. Vanguard concentra principalmente unidades e poucas spells; Ascendant usa uma parcela maior de spells/permanentes/equipment. O simulador usa políticas reais de IA, mas políticas heurísticas podem extrair valor diferente desses perfis. Um nerf imediato nas cartas Vanguard poderia mascarar um problema de utilização, targeting, prioridade ou curva dos decks Ascendant.

Por isso Vanilla 1.1 congela o diagnóstico sem mudar números de cartas.

## Próxima etapa — Vanilla 1.2

A próxima fatia deve adicionar **telemetria de utilização do Balance Lab**, sem alterar gameplay autoritativo. Para cada deck/matchup precisamos medir, no mínimo:

- cartas compradas e efetivamente jogadas;
- cartas que permanecem mortas na mão;
- mana disponível versus mana efetivamente gasta;
- tipos de carta jogados e não jogados;
- falhas de targeting / ausência de alvo útil;
- utilização de Equipment, Artifact, Enchantment, Structure, Ritual, Trap e Sentinela;
- tamanho de mão e board ao longo da partida;
- dano ao Nexus e eficiência por curva;
- frequência de ações em que a IA encerra o turno com cartas potencialmente úteis;
- diferenças Vanguard × Ascendant.

Só depois dessa telemetria devemos decidir se o próximo lote é:

1. correção de IA/utilização;
2. reconstrução de receitas de deck;
3. ajuste de curva/cópias;
4. ou balanceamento real de cartas.

## Como reproduzir

A matriz certificada de intake:

```bash
npm run audit:vanilla-balance
```

Equivalente explícito:

```bash
node --import tsx scripts/vanilla-balance-audit.ts 40 5 --write VANILLA_BALANCE_AUDIT_1.1.json --enforce
```

`--enforce` bloqueia somente falhas de **qualidade da simulação** (pool inválido, matriz incompleta ou instabilidade acima do limite). O resultado de balanceamento permanece no relatório como `pass`, `review` ou `blocked`, sem adulterar a evidência.

## Boundary de release

Vanilla 1.1 **não**:

- altera stats/custos/texto das cartas;
- muda regras do jogo;
- registra os 12 decks como Ranked;
- muda o gate do Ranked 2.97;
- declara a coleção Vanilla balanceada.

Ela estabelece uma linha de evidência reproduzível para que as próximas mudanças sejam orientadas por dados.
