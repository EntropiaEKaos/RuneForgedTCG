# Vanilla 1.4 — Ascendant Recipe & Curve Reconstruction

## Objetivo

Vanilla 1.4 corrige a estrutura dos seis decks Ascendant antes de qualquer buff/nerf de carta. A etapa parte do diagnóstico das versões 1.1–1.3: a IA tinha um gap real de cobertura, mas mesmo após esse gap ser corrigido os Ascendant continuavam com receita pesada, pouca presença de board e muita dependência de alvo.

A regra desta etapa é deliberada: **alterar apenas composição de deck**. Custos, stats, texto, regras autoritativas, Ranked e o conteúdo das 180 cartas `van_*` permanecem intactos.

## Diagnóstico estrutural

A receita Ascendant antiga era praticamente o mesmo template em todas as seis regiões:

- 40 cartas;
- apenas **16 Units**;
- 16 Spells;
- 8 cartas entre Enchantment / Artifact / Equipment;
- custo médio aproximado **4,6**;
- apenas **2 cartas de custo 0–1**;
- **22 cartas de custo 4–5**;
- **6 cartas de custo 7+**.

O Vanguard histórico, em contraste, possui 36 Units + 4 Spells e custo médio 3,7. A diferença não era apenas de poder individual: Ascendant tinha dificuldade estrutural para desenvolver board e transformar mana em ações úteis.

## Contrato reconstruído

Cada Ascendant passa a ser construído por um helper determinístico:

1. exatamente uma cópia de **todas as 30 cartas experimentais da região**;
2. exatamente **10 duplicatas explícitas**;
3. máximo de 2 cópias por carta;
4. 40 cartas totais;
5. cobertura global permanece **180/180 `van_*`**.

Vanguard também passa por helper, mas preserva exatamente a receita histórica de 36 Units + 4 Spells.

A estrutura final dos Ascendant fica entre **26 e 28 Units**, com custo médio **3,63**, pelo menos 5 cartas de custo 0–1 e no máximo 3 cartas de custo 7+.

## Seleção das duplicatas

As 10 duplicatas não foram escolhidas manualmente por preferência. Um sweep determinístico comparou quatro políticas de receita por região contra os outros 11 decks, usando a engine real e seeds controladas:

- curva genérica;
- curva + motores permanentes;
- midrange de valor;
- seleção power-aware com teto de custo.

O sweep escolheu política power-aware para Emberhold, Ironwood, Voidborn, Florestia e Tempestade. Tidecall escolheu política midrange + motores para evitar overcorrection: o sweep mostrou que mais concentração de poder empurrava Tidecall Ascendant alto demais.

## Evidência de utilização — 3.960 partidas

A matriz final repetiu 66/66 matchups com 20 jogos × 3 estratos.

Ascendant final:

- win rate agregado: **38,5%**;
- cartas jogadas/jogo: **13,9**;
- mão final: **2,7**;
- dano ao Nexus/jogo: **15,6**;
- aliados invocados/jogo: **9,7**;
- `ai-core` encerrando turno com carta jogável: **10,2%**;
- `target-starved`: **13.731**;
- `ignored-playable`: **3.021**;
- `policyUnsupportedSamples`: **0**.

Comparado ao diagnóstico 1.2, cartas jogadas sobem de 9,7 para 13,9, mão final cai de 5,3 para 2,7, target starvation cai de 54.416 para 13.731 e ignored-playable cai de 26.491 para 3.021. Parte desse ganho veio da correção tática 1.3; a 1.4 fecha a segunda metade do problema ao reconstruir a receita.

O sinal principal é que os decks agora conseguem **executar sua mão**: Ascendant joga ligeiramente mais cartas que Vanguard (13,9 × 13,6) e o `ai-core` encerra com carta jogável praticamente na mesma taxa (10,2% × 10,0%).

## Evidência de Balance Lab — 13.200 partidas

A matriz completa final executou 66 matchups × 200 partidas, distribuídas em 5 estratos determinísticos:

- **13.200 partidas concluídas**;
- 66/66 matchups completos;
- **66/66 estáveis**;
- 0 pool errors;
- first-player win rate **50,1%**;
- draw rate **0%**;
- max seed deviation **16,0 pp**, abaixo do limite de 23,7 pp;
- simulation quality: **PASS**.

A saúde do meta melhorou, mas permanece corretamente BLOCKED:

- Vanilla 1.3: **8 healthy / 8 watch / 50 critical**;
- Vanilla 1.4: **14 healthy / 11 watch / 41 critical**.

Decks finais por win rate global:

- Tidecall Vanguard — **82,4%**;
- Tempestade Vanguard — **65,8%**;
- Emberhold Vanguard — **59,4%**;
- Ironwood Vanguard — **56,5%**;
- Florestia Vanguard — **54,5%**;
- Voidborn Vanguard — **51,0%**;
- Tempestade Ascendant — **46,8%**;
- Tidecall Ascendant — **46,5%**;
- Emberhold Ascendant — **40,0%**;
- Ironwood Ascendant — **34,0%**;
- Florestia Ascendant — **32,0%**;
- Voidborn Ascendant — **31,1%**.

O resultado mostra que receita quebrada deixou de ser o principal bloqueio. O maior outlier agora é claramente **Tidecall Vanguard**, que sozinho termina em 82,4% e possui 11/11 matchups críticos.

## Behavioral contract

`src/game/vanilla-ascendant-recipes-1-4.test.ts` congela:

- 12 decks / 180 cartas experimentais cobertas;
- Vanguard histórico em 36 Units + 4 Spells e custo médio 3,7;
- Ascendant com 40 cartas / 30 únicas;
- exatamente 10 duplicatas evidenciadas por região;
- máximo de 2 cópias;
- densidade mínima de Units;
- curva baixa mínima e top-end máximo;
- envelope de custo médio <= 3,65.

Esse contrato é o **81º behavioral target**.

## Boundary

Vanilla 1.4 não altera:

- custo, stats ou texto de nenhuma carta;
- engine autoritativa;
- políticas da IA;
- conteúdo de Ranked;
- promoção dos 12 decks experimentais para Ranked.

## Próxima etapa

**Vanilla 1.5 — Regional Power Outliers**, começando por Tidecall Vanguard. Agora que utilização e receita estão normalizadas, o próximo lote pode finalmente medir força regional/cartas específicas sem confundir o resultado com problemas de execução do deck.
