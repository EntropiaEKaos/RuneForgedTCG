# Ecos do Abismo 1.0 — Discard/Reanimator

Base certificada: `db13df8541d910c1aebc1901fc3169d51a95ed21` (`main`, Graveyard Effects 1.0 pós-merge 5/5 verde).

## Objetivo

Entregar o primeiro arquétipo Discard/Reanimator completo e original de RuneForge usando exclusivamente os contratos de Cemitério já certificados. **Ecos do Abismo** é um preset avançado Tidecall/Voidborn de 40 cartas. Ele não substitui nenhum dos seis starters e não entra em Ranked nesta etapa.

A experiência pretendida é:

1. estabelecer um outlet de descarte selecionado;
2. colocar conscientemente uma ameaça de custo alto no Cemitério;
3. sobreviver à janela de preparação com compra, remoção, stun, recall e negação;
4. reanimar a ameaça antes de sua curva natural;
5. usar recursão de valor ou uma segunda reanimação se o adversário responder;
6. manter mirrors e controles interativos com hate de Cemitério disponível no mesmo pacote.

## Conteúdo original

| Carta | Região | Custo | Papel | Contrato principal |
| --- | --- | ---: | --- | --- |
| Contrabandista de Memórias | Tidecall | 2 | outlet | 1x/rodada: descarte 1 escolhida → compre 1 |
| Sepulcro das Vozes Afogadas | Tidecall | 3 | outlet permanente | até 2x/rodada: 1 mana + descarte 1 → compre 1 |
| Fio da Memória Morta | Tidecall | 2 | recursão de valor | Cemitério → mão |
| Rito do Segundo Pulso | Voidborn | 5 | reanimation baseline | reanime 1 Unidade própria |
| Vigília do Último Eco | Voidborn | 7 | reanimation tardia | reanime 1 + cure 3 Nexus |
| Selo do Nada | Voidborn | 1 | hate | bana 1 carta do Cemitério inimigo |
| Dama Afogada do Espelho | Tidecall | 7 | alvo evasivo | 5/7, Elusive, Barrier |
| Devorador das Marés Mortas | Voidborn | 8 | alvo estabilizador | 6/8, Lifesteal, Tough |
| Colosso da Fenda Oca | Voidborn | 9 | alvo de pressão | 8/8, Fearsome, Overwhelm, onSummon 2 Nexus |

Nenhum nome, texto ou arte de Magic é copiado. A inspiração é apenas a filosofia de jogo Discard/Reanimator.

## Recipe avançado — 40 cartas

### Núcleo Reanimator — 19

- 3x Contrabandista de Memórias
- 2x Sepulcro das Vozes Afogadas
- 2x Fio da Memória Morta
- 3x Rito do Segundo Pulso
- 1x Vigília do Último Eco
- 2x Selo do Nada
- 2x Dama Afogada do Espelho
- 2x Devorador das Marés Mortas
- 2x Colosso da Fenda Oca

### Suporte Tidecall/Voidborn — 21

- 3x Tide Oracle
- 2x Tidal Warden
- 2x Foresight
- 2x Recall
- 2x Deny
- 3x Duskwing Stalker
- 3x Life Siphon
- 2x Unmake
- 1x Malakar, the Hollow King
- 1x Riptide Stun

Total: **40**. Máximo de três cópias preservado. Identidade: **Tidecall/Voidborn**.

## IA Reanimator-aware

A política genérica anterior pagava custos de descarte escolhendo as cartas de menor custo. Isso é correto para decks normais, mas incorreto para Reanimator.

A política 1.0 permanece determinística e muda somente quando uma Spell de `reanimateUnit` já está na mão:

- prioriza como descarte Unidades colecionáveis de custo 6+;
- entre alvos premium, prefere o maior custo impresso;
- protege Spells de reanimação e retorno do Cemitério;
- reduz a penalidade heurística de descartar um alvo premium quando recursão está pronta;
- sem recursão na mão, mantém exatamente a política histórica de descartar primeiro as cartas de menor custo.

Isso evita que a IA trate um Colosso de custo 9 como uma carta que jamais pode ser descartada quando o plano correto é precisamente colocá-lo no Cemitério.

## Doutrina e mulligan

`ecos_do_abismo` é uma doutrina própria no catálogo de arquétipos.

O mulligan prioriza:

- outlets de descarte;
- Rito do Segundo Pulso;
- interação/setup de custo baixo.

Finalizadores de custo alto e a Vigília de custo 7 voltam ao deck na mão inicial, porque o objetivo é encontrar primeiro a infraestrutura do combo.

## Contratos reaproveitados

Este pacote não cria uma segunda engine de Cemitério. Ele usa:

- `discardFromHand` selecionado e autoritativo;
- `returnGraveyardToHand`;
- `reanimateUnit`;
- `banishGraveyardCard`;
- IDs físicos de entradas do Cemitério;
- validação fail-closed antes do pagamento;
- reanimação através de `makeUnit` com summon sickness e `onSummon` normais.

## Isolamento de release

Ecos do Abismo é deliberadamente:

- fora dos seis starters Alpha;
- fora da matriz de starter balance atual;
- fora de `RANKED_PRECONS`;
- sem alteração nas recipes Ranked;
- sem mudança global em CardDefs existentes.

A entrada em Ranked exige uma certificação posterior específica.

## Self-mill

O design original prevê self-mill como expansão natural de Tidecall. Ele **não entra no pacote 1.0 deste PR**. O primeiro lançamento se concentra em descarte selecionado, porque esse caminho já é certificado ponta a ponta — Studio, UI, PvP, replay, engine e IA.

Self-mill será uma evolução separada para manter este PR pequeno o suficiente para uma auditoria inequívoca e evitar introduzir uma nova semântica de `mill` junto com o primeiro conteúdo Reanimator.

## Behavioral certification

`src/game/ecos-do-abismo.test.ts` prova:

- nove cartas originais registradas;
- preset legal de exatamente 40 cartas e duas regiões;
- nenhum card Reanimator infiltrado nos seis starters;
- nenhum card/preset Reanimator infiltrado em Ranked;
- authoring via Card Studio para discard outlets e graveyard effects;
- doutrina e mulligan;
- loop real: descartar Colosso → entrada autoritativa no Cemitério → Rito do Segundo Pulso → Colosso reanimado → onSummon → entrada consumida;
- IA escolhendo deliberadamente o Colosso em vez de uma carta barata quando a reanimação está pronta.

A suite está registrada no behavioral gate central.

## Gates antes do merge

O PR não deve ser mergeado sem:

1. CI completa verde no head exato;
2. behavioral + coverage verdes;
3. build e browser E2E verdes;
4. visual certs existentes verdes;
5. matriz determinística de balance de Ecos do Abismo;
6. auditoria final do diff contra a base certificada;
7. confirmação de que starters e Ranked não mudaram;
8. pós-merge certification da `main` definitiva.

## Balance evidence planejada

A evidência dedicada deve comparar Ecos do Abismo contra os seis starters e os presets avançados certificados, com ambos os assentos e seeds determinísticos. Além do win rate, a análise deve observar:

- first-player skew;
- rodada média da primeira reanimação;
- percentual de partidas com reanimação bem-sucedida;
- win rate condicionado a reanimar até rodadas 3/4/5;
- utilização dos dois outlets, recursion e finishers;
- finishers presos na mão;
- frequência de Selo do Nada jogável/usado;
- matchups críticos segundo as bandas de balance do projeto.

Recipe-only tuning é preferível antes de alterar qualquer CardDef global.
