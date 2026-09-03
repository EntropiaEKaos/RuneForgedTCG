# Ecos do Abismo 1.0 — Discard/Reanimator

Base certificada: `db13df8541d910c1aebc1901fc3169d51a95ed21` (`main`, Graveyard Effects 1.0 pós-merge 5/5 verde).

## Objetivo

Entregar o primeiro arquétipo Discard/Reanimator completo e original de RuneForge usando os contratos de Cemitério já certificados. **Ecos do Abismo** é um preset avançado Tidecall/Voidborn de 40 cartas. Ele não substitui nenhum dos seis starters e permanece fora de Ranked nesta etapa.

A experiência final é:

1. estabelecer um outlet de descarte selecionado;
2. colocar conscientemente uma ameaça de custo alto no Cemitério;
3. sobreviver à janela de preparação com compra, remoção, Frostbite, Stun e corpos defensivos;
4. reanimar a ameaça antes de sua curva natural;
5. usar recursão de valor ou uma segunda reanimação se o adversário responder;
6. fechar a partida com ameaças grandes, porém respondíveis em combate.

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
| Colosso da Fenda Oca | Voidborn | 9 | alvo de pressão | 8/8, totalmente bloqueável, onSummon 2 Nexus |

As nove cartas continuam registradas e authorable. **Selo do Nada** e **Dama Afogada do Espelho** permanecem no pacote de conteúdo, mas saíram da recipe final de 40 cartas durante a certificação de balance.

Nenhum nome, texto ou arte de Magic é copiado. A inspiração é apenas a filosofia de jogo Discard/Reanimator.

## Recipe avançada certificada — 40 cartas

### Núcleo Reanimator — 13

- 3x Contrabandista de Memórias
- 2x Sepulcro das Vozes Afogadas
- 1x Fio da Memória Morta
- 2x Rito do Segundo Pulso
- 1x Vigília do Último Eco
- 2x Devorador das Marés Mortas
- 2x Colosso da Fenda Oca

### Suporte Tidecall/Voidborn — 27

- 3x Tide Oracle
- 2x Tidal Warden
- 2x Reef Sprite
- 2x Soothing Tide
- 2x Glacial Tomb
- 2x Riptide
- 1x Riptide Stun
- 3x Duskwing Stalker
- 3x Life Siphon
- 3x Hexbound Acolyte
- 1x Unmake
- 1x Blight Witherer
- 1x Living Nightmare
- 1x Death Mark

Total: **40**. Máximo de três cópias preservado. Identidade: **Tidecall/Voidborn**.

## Tuning do Colosso

O Colosso da Fenda Oca começou como 8/8 com Fearsome + Overwhelm. A matriz mostrou que esse pacote de evasão amplificava matchups já favoráveis sem melhorar os pisos do deck.

O CardDef final mantém:

- custo 9;
- 8/8;
- Voidling;
- onSummon: 2 de dano ao Nexus inimigo;
- status de Legend.

E remove:

- Fearsome;
- Overwhelm.

A fantasia de reanimar um monstro enorme permanece, mas qualquer Unidade pode bloqueá-lo. Isso tornou o payoff forte e respondível sem nerfar a mecânica de reanimation.

## IA Reanimator-aware

A política genérica anterior pagava custos de descarte escolhendo as cartas de menor custo. Isso é correto para decks normais, mas incorreto para Reanimator.

A política 1.0 permanece determinística e, quando uma Spell de `reanimateUnit` já está disponível:

- prioriza como descarte Unidades colecionáveis de custo 6+;
- entre alvos premium, prefere o maior custo impresso;
- protege Spells de reanimação e retorno do Cemitério;
- reduz a penalidade heurística de descartar um alvo premium quando recursão está pronta;
- sem recursão pronta, mantém a política histórica de descarte barato.

A IA também foi corrigida para reconhecer `reanimateUnit` como ameaça válida de Counterspell e para não ativar outlets de loot compulsivamente antes de avaliar uma carta jogável da mão.

## Doutrina e mulligan

`ecos_do_abismo` possui doutrina própria.

O mulligan prioriza:

- outlets de descarte;
- Rito do Segundo Pulso;
- interação/setup de custo baixo.

Finalizadores de custo alto e a Vigília retornam ao deck na mão inicial, porque a infraestrutura deve vir antes do payoff.

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

Ecos do Abismo permanece:

- fora dos seis starters Alpha;
- fora de `RANKED_PRECONS`;
- sem alteração nas recipes Ranked;
- sem alteração em CardDefs históricos dos starters;
- com tuning restrito às novas cartas Ecos e à recipe avançada.

A entrada em Ranked exige certificação posterior específica.

## Self-mill

O design original prevê self-mill como expansão natural de Tidecall. Ele **não entra no pacote 1.0 deste PR**. O lançamento inicial concentra-se em descarte selecionado, porque esse caminho já é certificado ponta a ponta — Studio, UI, PvP, replay, engine e IA.

## Behavioral certification

`src/game/ecos-do-abismo.test.ts` prova:

- nove cartas originais registradas;
- preset legal de exatamente 40 cartas e duas regiões;
- recipe final travada: 2 Ritos, 1 Fio, 2 Riptides, Living Nightmare e Death Mark;
- Colosso sem Fearsome/Overwhelm;
- nenhum card Reanimator infiltrado nos seis starters;
- nenhum card/preset Reanimator infiltrado em Ranked;
- authoring via Card Studio para discard outlets e graveyard effects;
- doutrina e mulligan;
- loop real: descartar Colosso → Cemitério autoritativo → Rito do Segundo Pulso → nova Unidade → onSummon → entrada consumida;
- summon sickness e contagem de spell corretas;
- IA escolhendo deliberadamente o Colosso quando a reanimação está pronta;
- IA de Tide usando Counterspell contra reanimation quando legal e falhando fechado sem mana.

A suite está registrada no behavioral gate central.

## Balance evidence final de seleção

O harness usa ambos os assentos, seeds determinísticos, stack/reactions reais e telemetria de utilização por carta.

A seleção final do slot `Death Mark` foi feita em uma matriz de **4.000 partidas** — 500 por matchup — sobre a recipe canônica candidata:

| Oponente | Win rate Ecos | Estado |
| --- | ---: | --- |
| Emberhold Blitz | 46,8% | healthy |
| Tidecall Control | 59,4% | watch |
| Ironwood Grove | 47,2% | healthy |
| Voidborn Dread | 46,4% | healthy |
| Matilha da Florestia | 47,0% | healthy |
| Tempestade Iminente | 56,6% | watch |
| Convergence Dual | 48,8% | healthy |
| Convergence Triad | 41,4% | watch |

Agregado da seleção:

- **4.000 partidas concluídas**;
- **49,2% win rate global**;
- **48,6% first-player win rate**;
- **65,7% das partidas com reanimation**;
- **rodada média da primeira reanimation: 8,2**;
- 4.347 reanimations resolvidas;
- 4.504 tentativas;
- 157 reanimations interrompidas por reação;
- **zero matchups críticos**;
- release gate: **review**, não `blocked`.

O candidato Death Mark foi o único, entre cinco refinamentos de 4.000 partidas, a eliminar o crítico contra Triad sem recriar um crítico em Tempestade, Dual ou nos starters.

## Gate canônico final

Depois da promoção do Death Mark, a CI dedicada deve repetir **4.000 partidas diretamente do `decks.ts` real**, sem overrides de recipe ou CardDef em memória.

O PR só pode ser mergeado quando o mesmo SHA exato tiver:

1. balance canônico sem críticos;
2. CI completa verde;
3. behavioral + coverage verdes;
4. build e browser E2E verdes;
5. visual certs existentes verdes;
6. auditoria final do diff contra a base certificada;
7. confirmação de que starters e Ranked não mudaram;
8. pós-merge certification da `main` definitiva.
