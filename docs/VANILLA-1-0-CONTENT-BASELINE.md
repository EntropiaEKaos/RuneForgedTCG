# Vanilla 1.0 — Content Baseline & Balance Lab Intake

## Objetivo

Esta etapa transforma a coleção Vanilla em uma entrada mensurável para o Balance Lab antes de qualquer rebalanceamento em massa. O princípio é simples: primeiro congelar e certificar o que existe; depois simular; só então alterar cartas com evidência.

## Baseline certificado

O contrato Vanilla 1.0 parte dos seguintes números do catálogo code-authored atual:

- **429 cartas** no catálogo base Vanilla através da onda 2.96;
- **180 cartas** da onda experimental `van_*` criada para aprofundar as seis regiões;
- **12 decks experimentais** de entrada no Balance Lab;
- **40 cartas por deck**;
- **2 arquétipos experimentais por região**: Emberhold, Tidecall, Ironwood, Voidborn, Florestia e Tempestade;
- **180/180 cartas experimentais cobertas** pelo conjunto dos 12 decks;
- nenhuma carta experimental pode ficar órfã do pool de intake sem bloquear o gate.

Os 12 decks continuam deliberadamente fora do Ranked até a certificação estatística do Balance Lab.

## Auditor determinístico

`src/game/vanilla-content-audit.ts` produz um relatório versionado sem banco de dados e sem estado mutável. Ele mede:

- total e total coletável do catálogo;
- distribuição por região, tipo estrutural e raridade;
- identidade mono/dual/tripla;
- presença de arquétipos semânticos;
- quantidade de decks por região;
- tamanho e número de cartas únicas por deck;
- custo médio e curva de mana por deck;
- composição por tipo de carta;
- duplicatas e limite máximo de três cópias;
- referências inexistentes;
- compatibilidade entre identidade regional da carta e do deck;
- cobertura integral da onda `van_*`.

O gate é **fail-closed**: qualquer erro estrutural retorna `gate: "blocked"`.

## Execução manual

Relatório legível em stdout:

```bash
node --import tsx scripts/vanilla-content-audit.ts
```

Gerar JSON reproduzível:

```bash
node --import tsx scripts/vanilla-content-audit.ts --write VANILLA_CONTENT_BASELINE.json
```

Aplicar o gate:

```bash
node --import tsx scripts/vanilla-content-audit.ts --enforce
```

A mesma lógica executa como teste comportamental em `src/game/vanilla-content-audit.test.ts` e integra `npm run test:behavior`.

## O que esta etapa não faz

Este PR **não rebalanceia cartas** e **não promove decks experimentais ao Ranked**. Alterar números antes de estabelecer o baseline contaminaria a amostra que queremos medir.

Também não cria um segundo simulador. RuneForge já possui o Balance Lab 2.97 usado pelo Ranked, com estratos determinísticos de seeds, alternância de lado/primeiro jogador, intervalo de Wilson 95%, estabilidade e gate de saúde. A próxima etapa vai adaptar essa infraestrutura aos 12 decks Vanilla.

## Próxima etapa

**Vanilla 1.1 — Balance Lab Experimental Matrix**:

1. tornar os 12 decks experimentais um pool explícito de simulação sem liberá-los no Ranked;
2. executar todos os matchups relevantes em seeds determinísticas;
3. medir win rate, first-player advantage, duração, estabilidade e extremos;
4. produzir uma lista de decks/cartas sob observação;
5. só então propor ajustes de custo, stats, velocidade ou composição;
6. repetir a simulação após cada lote pequeno de mudanças.

## Política de documentação

A partir desta etapa, todo resultado final de engenharia certificado deve ganhar um registro resumido no `README.md`, além de sua documentação específica quando aplicável.
