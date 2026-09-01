# Aura 2.0 — Continuous Keyword Auras

## Objetivo

Aura 2.0 amplia o contrato contínuo já certificado de `Enchantment`/`Artifact` sem criar um segundo engine de efeitos persistentes. A mesma recomputação autoritativa do battlefield agora deriva duas contribuições independentes para unidades aliadas elegíveis:

- **atributos** — `buffPower` / `buffHealth`, com stacking aditivo;
- **keywords** — `keywords`, com stacking por união de conjunto e sem duplicatas.

Estruturas continuam usando sua base estrutural `Artifact`, portanto herdam esse contrato sem alterar replay, DTO ou o `CardType` persistido.

## Ciclo de vida

A contribuição existe somente enquanto a fonte permanece viva no battlefield. Entrada, saída, destruição e mudança de elegibilidade por raça/classe passam pelo mesmo `recomputeContinuousAuras()` que já preserva dano marcado e remove corretamente bônus de vida.

Para keywords, `UnitInstance.keywords` permanece a visão efetiva consumida pelo gameplay e pela UI. Aura 2.0 introduziu dois campos opcionais de proveniência sem invalidar replays antigos:

- `durableKeywords` — impressão da carta, Equipment e grants permanentes/one-shot;
- `auraKeywords` — contribuição derivada das fontes aliadas de Aura ativas.

Aura 2.2 adiciona uma terceira camada opcional, `auraSuppressedKeywords`, sem mudar essa proveniência de origem. A visão efetiva passa a ser derivada como **durable + grants de Aura − supressões hostis**.

Ao remover uma fonte, somente as camadas source-bound são recalculadas. Um grant durável feito enquanto a mesma keyword estava presente ou suprimida por Aura continua existindo depois que a fonte sai.

## Filtros e stacking

`races` e `classes` mantêm o contrato existente:

- dentro da lista de raças vale **OU**;
- dentro da lista de classes vale **OU**;
- quando os dois grupos existem, raça e classe combinam como **E**.

Múltiplas Auras somam Power/Health e unem grants/supressões de keywords sem duplicação.

## Keywords permitidas

Studio, authoring e runtime compartilham vocabulários fechados para grants e supressões contínuas.

`AURA_GRANTABLE_KEYWORDS` e `AURA_SUPPRESSIBLE_KEYWORDS` excluem os casos que não podem ser representados corretamente apenas pelo array efetivo de keywords:

- **Barrier** — possui estado consumível próprio; rederivá-la ou “suprimi-la” somente no array não representaria corretamente o shield;
- **LastBreath** — depende de um trigger `onDeath` executável e não é uma regra puramente estática.

As demais keywords reutilizam os runtimes autoritativos já existentes de ataque, bloqueio, strike, dano, rodada e targeting.

## Card Studio e validação

O editor de Continuous Aura evoluiu por slices:

- Aura 2.0 — buffs de stats + grants de keywords em aliados;
- Aura 2.1 — debuffs contínuos de Power/Health em inimigos;
- Aura 2.2 — supressão source-bound de keywords em inimigos.

O servidor continua fail-closed e o sanitizer legado de stat Aura permanece preservado para payloads/replays anteriores. Extensões 2.x são validadas no boundary semântico usado por publicação, importação, sandbox e QA.

## Ability Grammar 2.0

O catálogo expõe contratos separados para os slices certificados, enquanto a projeção histórica `permanentStatAura` continua sendo usada como envelope compatível para `aura.keywords`, `aura.suppressKeywords` e a audiência `aura.affects`.

A família `aura` permanece marcada como **partial**. Já estão certificados:

- buffs contínuos de stats em aliados;
- grants contínuos de keywords em aliados;
- debuffs contínuos de stats em inimigos — Aura 2.1;
- supressão contínua de keywords em inimigos — Aura 2.2.

Ainda ficam fora do contrato genérico:

- dependências arbitrárias entre efeitos persistentes;
- ordenação genérica de layers/sub-layers entre famílias diferentes;
- replacement effects contínuos;
- regras contínuas que transformem tipo, texto ou controller da carta.

## Certificação

A suíte histórica de Aura 2.0 cobre:

- entrada e saída de keyword Aura;
- isolamento por jogador;
- stacking sem duplicatas;
- proveniência `durableKeywords` versus `auraKeywords`;
- grant durável sobreposto à mesma keyword fornecida por Aura;
- remoção da fonte preservando o grant durável e removendo apenas a keyword Aura-only;
- authoring keyword-only e stat+keyword;
- bloqueio de `Barrier`, `LastBreath` e keywords desconhecidas;
- Structure herdando o contrato por sua base `Artifact`;
- projeção no Ability Grammar 2.0.

As extensões são certificadas separadamente em `docs/AURA-2-1.md` e `docs/AURA-2-2.md`.
