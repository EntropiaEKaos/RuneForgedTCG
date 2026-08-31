# Aura 2.0 — Continuous Keyword Auras

## Objetivo

Aura 2.0 amplia o contrato contínuo já certificado de `Enchantment`/`Artifact` sem criar um segundo engine de efeitos persistentes. A mesma recomputação autoritativa do battlefield agora deriva duas contribuições independentes para unidades aliadas elegíveis:

- **atributos** — `buffPower` / `buffHealth`, com stacking aditivo;
- **keywords** — `keywords`, com stacking por união de conjunto e sem duplicatas.

Estruturas continuam usando sua base estrutural `Artifact`, portanto herdam esse contrato sem alterar replay, DTO ou o `CardType` persistido.

## Ciclo de vida

A contribuição existe somente enquanto a fonte permanece viva no battlefield. Entrada, saída, destruição e mudança de elegibilidade por raça/classe passam pelo mesmo `recomputeContinuousAuras()` que já preserva dano marcado e remove corretamente bônus de vida.

Para keywords, `UnitInstance.keywords` permanece a visão efetiva consumida pelo gameplay e pela UI. Dois campos opcionais preservam proveniência sem invalidar replays antigos:

- `durableKeywords` — impressão da carta, Equipment e grants permanentes/one-shot;
- `auraKeywords` — contribuição derivada das fontes de Aura ativas.

Ao remover uma fonte, somente `auraKeywords` é recalculado. Um grant durável feito enquanto a mesma keyword já estava presente por Aura continua existindo depois que a fonte sai.

## Filtros e stacking

`races` e `classes` mantêm o contrato existente:

- dentro da lista de raças vale **OU**;
- dentro da lista de classes vale **OU**;
- quando os dois grupos existem, raça e classe combinam como **E**.

Múltiplas Auras somam Power/Health e unem keywords sem duplicação.

## Keywords permitidas

Studio, authoring e runtime compartilham `AURA_GRANTABLE_KEYWORDS`.

A lista parte das keywords já grantable pelo runtime e exclui explicitamente:

- **Barrier** — possui estado consumível próprio; rederivá-la continuamente poderia recriar uma proteção já gasta;
- **LastBreath** — depende de um trigger `onDeath` executável na própria carta e já não é uma keyword genericamente grantable.

As demais keywords permitidas reutilizam os runtimes autoritativos já existentes de ataque, bloqueio, strike, dano, rodada e targeting.

## Card Studio e validação

O editor de Continuous Aura agora permite combinar stats, filtros e keywords. O servidor continua fail-closed:

- keyword desconhecida é rejeitada;
- keyword não segura para Aura é rejeitada;
- bônus devem continuar inteiros entre 0 e 20;
- Aura continua restrita a `Enchantment` e `Artifact` (incluindo Structure semanticamente);
- Aura exclusivamente de keyword (`0/0 + keywords`) é válida.

A validação Aura 2.0 vive no boundary semântico usado por publicação, importação, sandbox e QA, preservando o sanitizer legado de stat Aura para payloads/replays anteriores.

## Ability Grammar 2.0

O catálogo expõe `PERMANENT_KEYWORD_AURA_CONTRACT`, enquanto a projeção histórica `permanentStatAura` continua sendo usada como envelope compatível e agora transporta também `aura.keywords`.

A família `aura` permanece marcada como **partial**. Este PR não pretende resolver ainda:

- debuffs contínuos em inimigos;
- remoção contínua de keywords;
- dependências entre efeitos persistentes;
- ordenação genérica de layers/sub-layers;
- replacement effects contínuos.

Esses itens pertencem a um corte futuro de Aura 2.1 / layer system.

## Certificação

A suíte comportamental cobre:

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
