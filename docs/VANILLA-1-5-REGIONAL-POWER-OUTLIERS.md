# Vanilla 1.5 — Regional Power Outliers

## Objetivo

Vanilla 1.5 começa a tratar outliers regionais somente depois que Vanilla 1.3 normalizou cobertura tática da IA e Vanilla 1.4 reconstruiu as receitas Ascendant. O primeiro alvo é inequívoco: **Tidecall Vanguard**, que terminou a matriz certificada 1.4 com **82,4% de win rate global e 11/11 matchups críticos**.

A regra desta etapa é conservadora: descobrir a causa antes de alterar cartas. A correção final muda **apenas a receita experimental de Tidecall Vanguard**. Nenhum `CardDef`, regra da engine, política da IA, receita Ascendant ou conteúdo de Ranked é alterado.

## Diagnóstico e hipóteses rejeitadas

O Vanguard histórico usa o mesmo template nas seis regiões: 36 Units + 4 Spells. Isso eliminou uma vantagem estrutural exclusiva óbvia de Tidecall e exigiu separar força de carta, sustain, habilidades ativadas e concentração de receita.

Os sweeps determinísticos mostraram:

- remover apenas Regeneration não explicava o outlier;
- Lifesteal contribuía, mas não era suficiente para explicar sozinho a diferença;
- as habilidades ativadas de `van_tide_u15`–`u18` não eram o principal motor: desativá-las ou encarecê-las alterava pouco o resultado;
- um pacote global de nerfs de custo/Lifesteal reduzia Tidecall Vanguard, mas causava dano colateral inaceitável.

O último ponto foi o veto decisivo. Na matriz completa de 13.200 jogos, o pacote global de carta derrubava Tidecall Vanguard de **82,4% para 62,5%**, porém Tidecall Ascendant despencava de **46,5% para 27,9%** e a saúde global piorava de **14 healthy / 11 watch / 41 critical** para **12 / 11 / 43**. Portanto, esses nerfs foram descartados e não entram no produto.

## Correção escolhida — recipe32_control

A solução preserva todas as cartas e reduz apenas a concentração do Vanguard:

- **32 Units + 8 Spells**;
- `u01`–`u14`: 2 cópias cada;
- `u15`–`u18`: 1 cópia cada;
- `s01`, `s02`, `s05`, `s06`: 2 cópias cada;
- 40 cartas;
- 22 cartas únicas;
- custo médio autoritativo **3,43**;
- apenas 2 cartas de custo 7+;
- máximo de 2 cópias por carta.

A identidade continua Tidecall: desenvolvimento de board, Recall, Frostbite e sustain. O que sai é a duplicação automática de todo o top-end, não uma mecânica regional.

## Validação finalista — 6.600 partidas

O baseline e os dois melhores candidatos foram repetidos em **5 estratos determinísticos × 40 jogos × 11 oponentes**.

Baseline histórico:

- Tidecall Vanguard: **82,4%**;
- 0 healthy / 0 watch / 11 critical;
- faixa de matchup: **69,5%–93,0%**.

`recipe32_control`:

- Tidecall Vanguard: **58,6%**;
- 4 healthy / 2 watch / 5 critical;
- faixa: **44,5%–70,5%**;
- Emberhold Vanguard: **51,0%**;
- Tidecall Ascendant: **55,0%**;
- Florestia Vanguard: **52,0%**;
- Tempestade Vanguard: **50,5%**.

O segundo finalista (`recipe32_toolbox`) ainda terminou em **65,1%**, com 7 matchups críticos, e foi rejeitado.

## Evidência de Balance Lab — 13.200 partidas

O candidato vencedor foi então aplicado somente como override de deck e executado nos **66/66 matchups** da matriz real, 200 jogos por matchup em cinco estratos:

- **13.200 partidas concluídas**;
- first-player win rate **50,3%**;
- draw rate **0%**;
- max seed deviation **16,0 pp**;
- qualidade estatística preservada;
- saúde global melhora de **14 healthy / 11 watch / 41 critical** para **18 healthy / 13 watch / 35 critical**;
- redução de **6 matchups críticos** sem alterar nenhuma carta.

Win rates globais na matriz final:

- Tempestade Vanguard — **67,5%**;
- Emberhold Vanguard — **62,1%**;
- Ironwood Vanguard — **59,2%**;
- Tidecall Vanguard — **58,6%**;
- Florestia Vanguard — **57,3%**;
- Voidborn Vanguard — **53,8%**;
- Tidecall Ascendant — **49,2%**;
- Tempestade Ascendant — **48,0%**;
- Emberhold Ascendant — **41,3%**;
- Ironwood Ascendant — **35,8%**;
- Florestia Ascendant — **34,5%**;
- Voidborn Ascendant — **32,6%**.

O gate global de balance continua corretamente **BLOCKED**: ainda existem 35 matchups críticos. Vanilla 1.5 não tenta esconder esse fato; ela remove um outlier regional comprovado sem criar regressão sistêmica.

## Behavioral contract

`src/game/vanilla-regional-power-outliers-1-5.test.ts` congela:

- Tidecall Vanguard em 40 cartas;
- exatamente 32 Units / 8 Spells;
- exatamente 22 cartas únicas;
- custo médio autoritativo 3,43;
- exatamente 2 slots de custo 7+;
- `u01`–`u14` em 2 cópias;
- `u15`–`u18` em 1 cópia;
- `s01`, `s02`, `s05`, `s06` em 2 cópias;
- ausência intencional das demais ferramentas no Vanguard;
- mono-região Tidecall e somente Unit/Spell;
- Tidecall Ascendant permanece independente com 40 cartas / 30 únicas.

O contrato 1.4 continua congelando os outros cinco Vanguards históricos em 36 Units + 4 Spells. A exceção Tidecall passa a ser propriedade explícita da 1.5.

Esse é o **82º behavioral target**.

## Boundary

Vanilla 1.5 não altera:

- custo, poder, vida, keywords ou texto de nenhuma carta;
- engine autoritativa;
- habilidades ativadas;
- políticas da IA;
- receitas Ascendant;
- pool ou regras de Ranked;
- promoção dos decks experimentais para Ranked.

## Próxima etapa

O maior teto remanescente passa a ser **Tempestade Vanguard**, enquanto Ironwood/Florestia/Voidborn Ascendant continuam abaixo da faixa desejada. O próximo ciclo deve tratar esses desequilíbrios com a mesma disciplina: primeiro receita/matchup e identidade regional, depois números de carta somente se a evidência exigir.
