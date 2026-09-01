# Vanilla 1.3 — Tactical Coverage & Playability Friction

## Objetivo

Vanilla 1.3 transforma o diagnóstico observacional da Vanilla 1.2 em uma correção comportamental mínima e comprovável. O objetivo não é equilibrar os 12 decks experimentais por força bruta; é remover uma classe específica de atrito em que uma carta está legalmente jogável, possui alvo/uso válido e, ainda assim, a política `ai-core` encerra o turno sem convertê-la em ação.

A regra desta etapa é simples:

> **corrigir cobertura tática antes de alterar receita, curva, custo ou stats de carta.**

## Causa raiz reproduzida

O `ai-core` histórico já possuía prioridades explícitas para várias decisões importantes de main phase: habilidades ativadas, dano letal ao Nexus, remoção eficiente, Sentinelas, AOE, desenvolvimento de Permanents/Units/Equipment, cura, compra, buffs e dano direcionado sob determinados limiares.

Porém alguns `EffectKind` presentes de forma legítima na coleção experimental não tinham uma rota de decisão de main phase após essas prioridades. Em estados reais da engine, o núcleo podia retornar `null` apesar de `canPlayCard()` aceitar a carta.

A lacuna foi reproduzida com cartas Vanilla reais, entre elas:

- `van_tide_s05` — **Prisão de Gelo** (`frostbite`);
- `van_tide_s02` — **Corrente de Retorno** (`recall`);
- `van_void_s05` — `killUnit`;
- `van_void_s04` — dano não letal ao Nexus;
- `van_void_s03` — `poison`;
- `van_void_s02` — `mill`.

Isso explica uma parte importante do `ignored-playable` observado na Vanilla 1.2: não havia um tipo semântico inteiro sem suporte (`policyUnsupportedSamples` permaneceu zero), mas existiam lacunas por efeito e prioridade.

## Arquitetura da correção

A árvore histórica de prioridades de `src/game/ai-core.ts` não foi reescrita.

Todos os consumidores públicos já passam pelo facade `src/game/ai.ts`. Vanilla 1.3 mantém a decisão certificada como primeira opção e só executa o fallback quando o núcleo realmente desistiria da ação:

```ts
aiChooseCoreAction(state, playerId) ?? chooseTacticalMainPhaseFallback(state, playerId)
```

Isso estabelece duas propriedades importantes:

1. qualquer ação que o `ai-core` histórico já escolhia continua tendo prioridade absoluta;
2. o fallback não compete com a política antiga — ele preenche somente o espaço onde a resposta seria `null`.

## Escopo deliberadamente estreito

O fallback final cobre somente efeitos observados como lacunas relevantes nos decks experimentais:

- `damageNexus` não letal;
- `frostbite`;
- `stun`;
- `recall`;
- `killUnit`;
- `poison`;
- `mill`;
- `buffAllies`;
- `buffRace`;
- `grantKeyword`.

Efeitos especulativos ou já suficientemente tratados pela política histórica não foram adicionados apenas para aumentar utilização.

## Targeting canônico e fail-closed

O fallback não inventa uma segunda regra de targeting.

Ele usa:

- `spellNeedsTarget()` para o contrato da carta;
- `isValidTarget()` para a autoridade de alvo;
- ownership correto para efeitos hostis e aliados;
- seleção determinística quando mais de um alvo legal existe.

Consequências verificadas:

- Hexproof continua impedindo targeting inimigo;
- uma magia sem alvo legal não gera uma ação inválida;
- `spellOnStack` não é convertido em ação de main phase;
- a mesma política funciona simetricamente com `playerId = "player"` ou `"ai"`.

## Anti-no-op semântico

Ser tecnicamente legal não basta para o fallback. Vanilla 1.3 também exige utilidade mínima para evitar transformar a IA em uma política de “gaste toda a mana”.

A regressão bloqueia, entre outros casos:

- novo Frostbite em unidade já `frostbitten` ou com poder zero;
- novo Stun em unidade já atordoada;
- `grantKeyword` em unidade que já possui a keyword;
- `buffAllies` sem aliados;
- `buffRace` sem unidade aliada da raça correspondente;
- Poison depois do limiar letal;
- Mill contra deck vazio.

## Contrato comportamental

`src/game/vanilla-tactical-playability-1-3.test.ts` é o **80º behavioral target**.

Ele prova que:

1. o `ai-core` histórico realmente reproduz os gaps selecionados;
2. o facade 1.3 encontra uma ação legal nesses mesmos estados;
3. a ação passa pela engine autoritativa real e produz o efeito esperado;
4. Hexproof e target starvation continuam fail-closed;
5. ações redundantes são rejeitadas;
6. a política é simétrica entre os dois `PlayerId`;
7. sempre que o núcleo histórico já possui uma decisão, a ação pública é exatamente a mesma.

## Matriz de utilização — 3.960 partidas

A mesma configuração da Vanilla 1.2 foi repetida após o hardening final:

- 66/66 matchups;
- 20 jogos por matchup em cada estrato;
- 3 estratos determinísticos;
- **3.960 partidas**;
- zero pool errors;
- zero telemetry errors;
- zero matchups incompletos;
- quality gate: **PASS**.

### Vanguard — antes × depois

| Métrica | Vanilla 1.2 | Vanilla 1.3 | Delta |
| --- | ---: | ---: | ---: |
| Win rate | 70,1% | 69,4% | -0,7 pp |
| Cartas jogadas/jogo | 11,8 | 12,1 | +0,3 |
| Cartas na mão ao final | 2,7 | 2,5 | -0,2 |
| Dano ao Nexus/jogo | 22,8 | 22,8 | 0,0 |
| Aliados invocados/jogo | 10,8 | 10,9 | +0,1 |
| `ai-core` encerra com jogável | 34,3% | **14,3%** | **-20,0 pp** |
| Target-starved samples | 11.439 | 10.713 | -6,3% |
| Ignored-playable samples | 10.251 | **5.083** | **-50,4%** |

### Ascendant — antes × depois

| Métrica | Vanilla 1.2 | Vanilla 1.3 | Delta |
| --- | ---: | ---: | ---: |
| Win rate | 29,9% | 30,6% | +0,7 pp |
| Cartas jogadas/jogo | 9,7 | **10,4** | **+0,7** |
| Cartas na mão ao final | 5,3 | **4,8** | **-0,5** |
| Dano ao Nexus/jogo | 11,9 | **12,3** | **+0,4** |
| Aliados invocados/jogo | 4,3 | 4,3 | 0,0 |
| `player-heuristic` encerra com jogável | 16,9% | 17,1% | +0,2 pp |
| `ai-core` encerra com jogável | 53,5% | **28,1%** | **-25,4 pp** |
| Target-starved samples | 54.416 | 54.764 | +0,6% |
| Ignored-playable samples | 26.491 | **12.610** | **-52,4%** |

O resultado é importante porque isola a mudança. O lado `player-heuristic` praticamente não mudou, enquanto a fricção medida no `ai-core` caiu drasticamente. Ao mesmo tempo, target starvation permaneceu praticamente estável nos Ascendant — como esperado, pois disponibilidade de board/alvo é um problema diferente de cobertura de decisão.

### Exemplos de recuperação de utilização

A taxa de uso de diversas cartas antes subutilizadas aumentou de forma material:

- **Corrente de Retorno**: +38,7 pp;
- **Prisão de Gelo**: +21,2 pp;
- **Prisão de Espinhos**: +30,5 pp;
- **Rajada Cortante**: +38,2 pp;
- **Pulso Trovejante**: +30,8 pp;
- **Vento de Recuo**: +17,8 pp;
- **Sussurro do Nada**: +43,1 pp;
- **Marca Venenosa**: +42,4 pp;
- **Dreno de Alma**: +38,8 pp;
- **Condenação Silenciosa**: +35,6 pp;
- **Investida de Brasas**: +43,0 pp;
- **Emboscada Verde**: +37,9 pp;
- **Pele da Matilha**: +34,2 pp.

## Balance Lab completo — 13.200 partidas

Depois da correção, a matriz completa da Vanilla 1.1 também foi repetida com a mesma configuração:

- 66/66 matchups;
- 40 jogos por estrato;
- 5 estratos determinísticos;
- **13.200 partidas**;
- 66/66 matchups estáveis;
- zero incompletos;
- first-player win rate: **49,8%**;
- draw rate: **0%**;
- duração média: **10,6 rodadas**;
- maior desvio de estrato: **20,5 pp**, abaixo do limite de **23,7 pp**;
- simulation quality gate: **PASS**.

O balanceamento, porém, continua corretamente **BLOCKED**:

| Estado | Vanilla 1.1 | Após Vanilla 1.3 |
| --- | ---: | ---: |
| Healthy | 9 | 8 |
| Watch | 5 | 8 |
| Critical | 52 | 50 |
| Balance status | BLOCKED | **BLOCKED** |

### Win rate por deck — 13.200 jogos

| Deck | Vanilla 1.1 | Após 1.3 | Delta |
| --- | ---: | ---: | ---: |
| Tidecall Vanguard | 85,5% | 86,9% | +1,4 pp |
| Tempestade Vanguard | 75,1% | 73,8% | -1,3 pp |
| Emberhold Vanguard | 68,6% | 68,9% | +0,3 pp |
| Florestia Vanguard | 66,8% | 65,6% | -1,2 pp |
| Ironwood Vanguard | 64,3% | 63,0% | -1,3 pp |
| Voidborn Vanguard | 60,1% | 59,5% | -0,6 pp |
| **Tidecall Ascendant** | 45,0% | **50,0%** | **+5,0 pp** |
| **Voidborn Ascendant** | 27,7% | **29,5%** | **+1,8 pp** |
| Ironwood Ascendant | 29,6% | 29,1% | -0,5 pp |
| Tempestade Ascendant | 28,1% | 27,1% | -1,0 pp |
| Emberhold Ascendant | 27,6% | 26,7% | -0,9 pp |
| Florestia Ascendant | 21,4% | 20,0% | -1,4 pp |

A maior melhora estrutural ocorreu em Tidecall Ascendant, que chegou a 50,0%. Voidborn também ganhou algum valor. Os demais Ascendant continuam fracos mesmo depois de a política deixar de desperdiçar tantas ações.

O confronto mais extremo passou a ser **Tidecall Vanguard 98,5% × 1,5% Tempestade Ascendant**, 197 × 3 em 200 jogos, com comportamento estatisticamente estável. Portanto não há base técnica para continuar acrescentando heurísticas de IA com o objetivo de forçar paridade.

## Conclusão

Vanilla 1.3 prova duas coisas ao mesmo tempo:

1. **havia um bug/limitação real de cobertura tática** e corrigi-lo reduz drasticamente cartas jogáveis ignoradas;
2. **o desequilíbrio Vanguard × Ascendant não é explicado apenas pela IA**.

O projeto agora tem evidência suficiente para mudar de camada. A próxima etapa deve atuar em **receitas, curva de mana, densidade de unidades, dependência de alvo e distribuição de cópias** dos Ascendant antes de qualquer buff/nerf numérico de cartas.

## Próxima etapa — Vanilla 1.4

**Vanilla 1.4 — Ascendant Recipe & Curve Reconstruction** deve:

1. preservar os 180 cards congelados inicialmente, sem mexer em stats/custos na primeira iteração;
2. auditar curva, densidade de unidades, spells condicionais e permanentes por Ascendant;
3. reconstruir receitas experimentais com hipóteses explícitas por região;
4. executar A/B recipe-vs-recipe sob seeds determinísticas;
5. rerodar telemetria de utilização;
6. rerodar a matriz completa de 13.200 jogos;
7. somente depois decidir se ainda existe necessidade de balanceamento numérico de cartas.

## Boundary de release

Vanilla 1.3 **não**:

- altera custo, poder, vida ou texto de carta;
- altera as 12 receitas experimentais;
- altera regras autoritativas da engine;
- altera o pool ou o gate do Ranked;
- declara a coleção Vanilla balanceada.

Ela corrige uma lacuna concreta da política pública de IA e fornece evidência de que o próximo gargalo é composição de deck, não uma justificativa para buffs/nerfs cegos.
