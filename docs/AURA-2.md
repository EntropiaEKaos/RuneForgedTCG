# Aura 2.x — Continuous Aura System

## Objetivo

Aura 2.x evolui o contrato contínuo do RuneForge sem criar um segundo engine de efeitos persistentes. A mesma recomputação autoritativa do battlefield deriva contribuições de stats e keywords a partir das fontes ativas atualmente em jogo.

Os slices são incrementais:

- **Aura 2.0** — buffs de stats + grants contínuos de keywords em aliados;
- **Aura 2.1** — debuffs contínuos de Power/Health em inimigos;
- **Aura 2.2** — supressão source-bound de keywords em inimigos;
- **Aura 2.3** — Units vivas como fontes de Aura (“lord effects”), com autoexclusão por `instanceId`;
- **Aura 2.4** — Sentinelas como fontes de Command Aura enquanto tiverem Lealdade positiva;
- **Aura 2.5** — ativação condicional controller-scoped com raça/classe aliada, Nexus, mana e AND/OR/NOT;
- **Aura 2.6** — Ability Grammar/introspection projeta o contrato condicional certificado sem alterar runtime;
- **Aura 2.7** — `selfDamaged` como condição source-relative exclusivamente para Unit-source/lord effects;
- **Condition 2.1 integration** — `opponentNexusBelow` amplia o vocabulário controller-scoped com limiar do Nexus adversário sem criar dependência entre layers;
- **Condition 2.2 integration** — `enemyRace` / `enemyClass` observam identidade pública das Units vivas no bench adversário;
- **Condition 2.3 integration** — `handAtLeast` / `opponentHandAtLeast` observam somente a quantidade pública de cartas nas mãos;
- **Condition 2.4 integration** — `allyUnitsAtLeast` / `enemyUnitsAtLeast` observam a quantidade de Units vivas nos benches aliado e adversário;
- **Condition 2.5 integration** — `roundAtLeast` observa a rodada autoritativa compartilhada da partida como condição match-scoped.

Estruturas continuam usando sua base estrutural `Artifact`, portanto herdam o contrato de Permanent Aura sem alterar replay, DTO ou o `CardType` persistido.

## Fontes do contrato

### Permanent sources

`Enchantment` e `Artifact` continuam usando os contratos históricos de Aura 2.0–2.2.

### Unit sources — Aura 2.3 + 2.7

Uma `Unit` com `CardDef.aura` é fonte contínua enquanto estiver viva no bench. A regra de “lord effect” é intrínseca: **a Unit-fonte nunca afeta o próprio `instanceId`**. Outra fonte de Aura pode afetá-la normalmente.

Aura 2.7 acrescenta uma única condição source-relative certificada para essa família: `selfDamaged`. Ela significa exatamente `sourceUnit.health < sourceUnit.maxHealth`, com a fonte viva e pertencendo ao controller avaliado. A condição observa a Unit-fonte, mas não altera sua autoexclusão como alvo.

### Sentinela sources — Aura 2.4

Uma `Sentinela` com `CardDef.aura` projeta uma Command Aura enquanto existir em `players[owner].sentinelas` com `loyalty > 0`.

Sentinelas reutilizam o mesmo payload já certificado:

- aliados: `buffPower >= 0`, `buffHealth >= 0`, `keywords` seguras;
- inimigos: `buffPower <= 0`, `buffHealth <= 0`, `suppressKeywords` seguras;
- filtros opcionais `races` e `classes`.

Como Sentinela não é Unit, ela nunca pertence ao conjunto de alvos Unit e não requer regra especial de autoexclusão. `selfDamaged` continua inválido para Sentinela; Lealdade não é reinterpretada como vida de Unit.

## Condições de fonte — Aura 2.5 + 2.7 + Condition 2.1/2.2/2.3/2.4/2.5

`PermanentStatAura.condition` é opcional. Ausente significa o comportamento histórico “sempre ativa enquanto o lifecycle da fonte for válido”.

O contrato aceita condições controller-scoped e match-scoped:

- `always`;
- `allyRace`;
- `allyClass`;
- `enemyRace` — pelo menos N Units inimigas vivas com a raça;
- `enemyClass` — pelo menos N Units inimigas vivas com a classe;
- `allyUnitsAtLeast` — pelo menos N Units aliadas vivas no bench;
- `enemyUnitsAtLeast` — pelo menos N Units inimigas vivas no bench;
- `nexusBelow` — Nexus do próprio controlador ≤ X;
- `opponentNexusBelow` — Nexus do adversário do controlador ≤ X;
- `manaAtLeast`;
- `handAtLeast` — quantidade de cartas na própria mão ≥ X;
- `opponentHandAtLeast` — quantidade de cartas na mão adversária ≥ X;
- `roundAtLeast` — rodada autoritativa da partida ≥ X;
- `and` / `or` / `not`.

A condição decide se **a fonte inteira participa do layer**. Os filtros `races` / `classes` continuam decidindo quais Units aquela fonte afeta.

Condition 2.1 adiciona `opponentNexusBelow` ao mesmo contrato controller-scoped. A orientação é simétrica: uma fonte de `player` lê o Nexus da `ai`; uma fonte de `ai` lê o Nexus de `player`. O threshold é inclusivo e reutiliza o clamp canônico 0..20.

Condition 2.2 adiciona `enemyRace` e `enemyClass`, também orientados pelo controller. Uma fonte de `player` inspeciona apenas `players.ai.bench`; uma fonte de `ai` inspeciona apenas `players.player.bench`. Só Units com `health > 0` contam. `enemyRace` respeita a identidade multirraça materializada em `UnitInstance.races`; `enemyClass` usa `UnitInstance.classes`.

Condition 2.3 adiciona `handAtLeast` e `opponentHandAtLeast`. Ambas leem exclusivamente `PlayerState.hand.length`: nenhuma identidade, ordem ou outro conteúdo oculto da mão adversária participa da regra. Limiares inferiores são expressáveis por `not` sem criar folhas redundantes.

Condition 2.4 adiciona `allyUnitsAtLeast` e `enemyUnitsAtLeast`. Ambas contam exclusivamente Units com `health > 0` no bench orientado pelo controlador. Sentinelas, Permanents, cartas na mão e corpos já letais aguardando cleanup não entram na contagem. O threshold usa o envelope canônico `1..6`; limites inferiores continuam expressáveis por `not`.

Condition 2.5 adiciona `roundAtLeast`. Diferente das folhas orientadas pelo controller, ela é match-scoped e compara somente `GameState.round` com o threshold inclusivo. Player e AI observam o mesmo relógio autoritativo. O envelope de authoring é `1..2000`, coerente com o limite máximo configurável de rodadas; “antes da rodada N” continua expressável por `not`.

`CONDITIONAL_AURA_CONTRACT` continua declarando `selfDamaged` como unsupported no contrato geral. Aura 2.7 adiciona `UNIT_SOURCE_SELF_DAMAGED_AURA_CONTRACT` como exceção certificada exclusivamente para Unit-source. `selfDamaged` pode aparecer em qualquer profundidade válida de `and`, `or` e `not` quando a fonte é Unit.

Permanent e Sentinela continuam rejeitando `selfDamaged` no authoring e tratando payloads bypassados como fonte inativa em runtime.

## Ciclo de vida

A contribuição existe somente enquanto a fonte está ativa na zona correta **e** sua condição opcional é verdadeira:

- `Enchantment` / `Artifact` — em `permanents` com vida positiva;
- `Unit` — no `bench` com vida positiva;
- `Sentinela` — em `sentinelas` com Lealdade positiva.

Entrada, saída, destruição, recall, transformação e mudança de elegibilidade convergem para `recomputeContinuousAuras()` / cleanups autoritativos. Aura 2.4 garante lifecycle imediato de Sentinelas; Aura 2.5 acrescenta reatividade para estado do controlador; Aura 2.7 reutiliza a mesma convergência para observar dano/cura da Unit-fonte; Condition 2.1 reutiliza essa reatividade para mudanças do Nexus adversário; Condition 2.2 reutiliza a convergência de board para entrada, saída e morte de Units inimigas; Condition 2.3 usa os mesmos boundaries para mudanças de mão por jogar, conjurar e comprar cartas; Condition 2.4 usa a convergência já existente de summon, morte, recall e cleanup para cruzar thresholds de quantidade de Units vivas; Condition 2.5 usa o boundary já certificado de `endTurn()` para recompor Auras quando a rodada autoritativa avança.

O facade `engine/semantic-actions.ts` recompõe Continuous Auras depois de transições válidas de jogar carta, conjurar feitiço, declarar ataque e encerrar turno. Combate resolvido e activated/Sentinela abilities já convergem pelos cleanups autoritativos.

Dano já marcado continua preservado quando `maxHealth` muda por ativação/desativação de Aura. Isso é particularmente importante em Aura 2.7: uma fonte ilesa não passa a contar como `selfDamaged` apenas porque outra Aura aumentou seu `maxHealth`; uma fonte com dano marcado mantém o mesmo déficit quando um bônus de Health entra ou sai.

## Proveniência de keywords

`UnitInstance.keywords` permanece a visão efetiva consumida pelo gameplay e pela UI. A proveniência é mantida em campos opcionais para compatibilidade com replays antigos:

- `durableKeywords` — impressão da carta, Equipment e grants permanentes/one-shot;
- `auraKeywords` — grants derivados das fontes aliadas de Aura ativas;
- `auraSuppressedKeywords` — supressões hostis source-bound.

A visão efetiva é derivada como:

**durable + grants de Aura − supressões hostis**

Ao remover/desativar uma fonte, somente as camadas source-bound são recalculadas. Um grant durável feito enquanto a mesma keyword estava presente ou suprimida por Aura continua existindo depois que a fonte sai ou sua condição se torna falsa.

## Filtros e stacking

`races` e `classes` mantêm o contrato existente:

- dentro da lista de raças vale **OU**;
- dentro da lista de classes vale **OU**;
- quando os dois grupos existem, raça e classe combinam como **E**.

Múltiplas Auras ativas somam Power/Health e unem grants/supressões de keywords sem duplicação. Uma Aura condicional simplesmente deixa de fazer parte da lista de fontes enquanto sua condição for falsa; não existe meio-stacking ou subefeito residual.

## Keywords permitidas

Studio, authoring e runtime compartilham vocabulários fechados para grants e supressões contínuas.

`AURA_GRANTABLE_KEYWORDS` e `AURA_SUPPRESSIBLE_KEYWORDS` excluem os casos que não podem ser representados corretamente apenas pelo array efetivo de keywords:

- **Barrier** — possui estado consumível próprio; rederivá-la ou “suprimi-la” somente no array não representaria corretamente o shield;
- **LastBreath** — depende de um trigger `onDeath` executável e não é uma regra puramente estática.

As demais keywords reutilizam os runtimes autoritativos já existentes de ataque, bloqueio, strike, dano, rodada e targeting.

## Card Studio e validação

O editor de Continuous Aura está disponível para:

- `Enchantment`;
- `Artifact` / `Structure`;
- `Unit` — Lord Effect;
- `Sentinela` — Command Aura.

O editor opcional de condição expõe as condições controller-scoped em todas as famílias e a condição match-scoped `roundAtLeast`, incluindo limiares separados para o próprio Nexus e o Nexus inimigo, tamanho da própria mão e da mão inimiga, quantidade de Units vivas aliadas/inimigas, além de raça/classe aliada ou inimiga. Em Aura 2.7, `ContinuousAuraConditionEditor` recebe uma capability explícita e mostra `selfDamaged` somente para `Unit`, inclusive dentro de composição AND/OR/NOT.

A UI diferencia condição da fonte de filtros de alvo. Para Units, o Studio informa que o próprio source instance é excluído e que `selfDamaged` observa dano marcado da fonte. Para Sentinelas, informa que a fonte permanece disponível enquanto houver Lealdade positiva.

O servidor continua fail-closed. O sanitizer legado de stat Aura permanece preservado para payloads/replays anteriores. Unit e Sentinela são validadas como fontes semânticas no boundary `validateAuthorableCardWithSemanticTypes()`. A capability de `selfDamaged` é habilitada apenas quando `raw.type === "Unit"`.

Isso evita ampliar silenciosamente o contrato antigo de `validateAuthorableCard()` e evita reinterpretar Permanent/Sentinela como Unit.

## Ability Grammar 2.0 — Aura 2.6/2.7 + Condition 2.1/2.2/2.3/2.4/2.5

O catálogo expõe os contratos certificados de fonte de Aura e `conditionalAuraContract: CONDITIONAL_AURA_CONTRACT`. `ABILITY_GRAMMAR_CATALOG.conditions` e `conditionContracts` derivam do vocabulário canônico, portanto `opponentNexusBelow`, `enemyRace`, `enemyClass`, `handAtLeast`, `opponentHandAtLeast`, `allyUnitsAtLeast`, `enemyUnitsAtLeast` e `roundAtLeast` aparecem como `supported` sem rule kinds paralelos.

`blueprintFromPermanentStatAura()` representa a condição real da fonte:

- `AbilityBlueprint.condition` recebe uma cópia defensiva de `card.aura.condition`;
- `AbilityRule.permanentStatAura.aura.condition` preserva a mesma semântica em outra cópia defensiva;
- Aura sem condição explícita continua projetando `condition: { kind: "always" }` e não ganha um campo `condition` artificial dentro do rule payload.

Por isso uma Unit-source Aura 2.7 com `selfDamaged` ou qualquer Aura com condições de Nexus, identidade/quantidade de board, tamanho de mão ou rodada é projetada corretamente como habilidade condicional sem exigir um novo rule kind.

O marker `features: ["conditional"]` aparece se houver condição de fonte diferente de `always` **ou** filtros de alvo `races`/`classes`.

A família `aura` permanece marcada como **partial**. Condition 2.5 não promove o envelope `permanentStatAura` a um layer system genérico entre famílias diferentes.

O sistema de gameplay cobre:

- buffs contínuos de stats em aliados;
- grants contínuos de keywords em aliados;
- debuffs contínuos de stats em inimigos;
- supressão contínua de keywords em inimigos;
- Permanent sources;
- Unit-source / lord effects;
- Sentinela-source / command effects;
- condições controller-scoped de Aura — Aura 2.5;
- introspecção fiel dessas condições pela Ability Grammar — Aura 2.6;
- `selfDamaged` source-relative para Unit Lord Effects — Aura 2.7;
- threshold do Nexus adversário controller-scoped — Condition 2.1;
- identidade pública de raça/classe do board adversário — Condition 2.2;
- thresholds de quantidade da própria mão e mão adversária — Condition 2.3;
- thresholds de quantidade de Units vivas aliadas e inimigas — Condition 2.4;
- threshold match-scoped da rodada autoritativa — Condition 2.5.

Ainda ficam fora do contrato genérico:

- `selfDamaged` para Permanent e Sentinela;
- condições dependentes do alvo ou do resultado de outra Aura;
- dependências arbitrárias entre efeitos persistentes;
- ordenação genérica de layers/sub-layers entre famílias diferentes;
- replacement effects contínuos;
- regras contínuas que transformem tipo, texto ou controller da carta;
- fontes contínuas em zonas futuras diferentes das zonas de battlefield já certificadas.

## Certificação

As extensões possuem suítes comportamentais e documentação separadas:

- `docs/AURA-2-1.md` — enemy stat debuffs;
- `docs/AURA-2-2.md` — keyword suppression;
- `docs/AURA-2-3.md` — Unit-source / lord effects;
- `docs/AURA-2-4.md` — Sentinela-source / command effects;
- `docs/AURA-2-5.md` — conditional continuous Auras;
- `docs/AURA-2-6.md` — conditional Aura Ability Grammar/introspection;
- `docs/AURA-2-7.md` — Unit-source `selfDamaged` conditions;
- `docs/CONDITION-2-1.md` — opponent Nexus thresholds compartilhados por Mechanics e Aura;
- `docs/CONDITION-2-2.md` — enemy board race/class identity compartilhada por Mechanics e Aura;
- `docs/CONDITION-2-3.md` — hand-size thresholds compartilhados por Mechanics e Aura;
- `docs/CONDITION-2-4.md` — living board-size thresholds compartilhados por Mechanics e Aura;
- `docs/CONDITION-2-5.md` — match-scoped round thresholds compartilhados por Mechanics e Aura.

## Condition 2.6 — Permanent Board Thresholds

`allyPermanentsAtLeast` e `enemyPermanentsAtLeast` contam exclusivamente Permanents com `health > 0` nas zonas orientadas pelo controlador. Structures entram por usarem a base `Artifact`; Sentinelas permanecem fora em sua zona dedicada. O envelope de authoring é `1..8`, alinhado ao `permanentsCap` administrável. Entrada e remoção convergem pelos cleanups/recompute já existentes, sem novo hook ou cache. Veja `docs/CONDITION-2-6.md`.


## Condition 2.7 — Resource Thresholds

Continuous Auras podem usar `opponentManaAtLeast`, `spellManaAtLeast` e `opponentSpellManaAtLeast`. As condições leem apenas mana pública do controlador/oponente; bank de spell mana na virada de rodada e gasto por spell reutilizam os ciclos autoritativos existentes de recomputação. Veja `docs/CONDITION-2-7.md`.
