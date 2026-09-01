# Aura 2.6 — Conditional Aura Ability Grammar

## Objetivo

Aura 2.6 fecha o gap de introspecção deixado propositalmente pelo corte funcional Aura 2.5.

O gameplay, o authoring e o Card Studio já entendem `PermanentStatAura.condition`. Este corte faz a Ability Grammar 2.0 representar exatamente o mesmo contrato, sem introduzir um novo runtime, rule kind, payload persistido ou layer engine.

## O que muda

`blueprintFromPermanentStatAura(card)` passa a projetar a condição controller-scoped certificada em dois lugares complementares:

- `AbilityBlueprint.condition` — metadata canônica para ferramentas de introspecção, previews e auditorias;
- `AbilityRule.permanentStatAura.aura.condition` — envelope read-only que espelha o payload autoritativo da Aura.

Quando a Aura não possui condição explícita, a compatibilidade histórica permanece:

- `AbilityBlueprint.condition = { kind: "always" }`;
- o rule payload não inventa um campo `condition` ausente.

## Catálogo

`ABILITY_GRAMMAR_CATALOG` passa a publicar:

`conditionalAuraContract: CONDITIONAL_AURA_CONTRACT`

Esse é o mesmo objeto de contrato consumido pelo slice Aura 2.5:

- condições: `always`, `allyRace`, `allyClass`, `nexusBelow`, `manaAtLeast`, `and`, `or`, `not`;
- escopo: estado do controlador da fonte;
- `selfDamaged`: não suportado no contrato multi-fonte;
- runtime malformado: fonte inativa/fail-closed;
- lifecycle: recomputação quando estado autoritativo relevante muda.

Ability Grammar não mantém uma segunda lista de condições Aura-safe.

## Feature `conditional`

O marker `features: ["conditional"]` continua significando que o comportamento possui alguma elegibilidade condicional relevante para introspecção.

Ele aparece quando:

- existe uma condição de fonte diferente de `always`; ou
- existem filtros de alvo `races`/`classes`, preservando o comportamento histórico da projeção.

Por isso uma Aura filtrada, porém sempre ativa, continua com `features: ["conditional"]` e `condition: { kind: "always" }`.

A diferença é intencional:

- `condition` descreve a ativação da **fonte**;
- `races`/`classes` dentro do rule payload descrevem elegibilidade dos **alvos**.

## Isolamento de dados

A Ability Grammar é uma visão read-only. Aura 2.6 reforça isso fazendo cópias defensivas da árvore de condição.

A condição em `AbilityBlueprint.condition`, a condição dentro do rule payload e o `CardDef.aura.condition` original não compartilham a mesma referência mutável.

Assim uma ferramenta de preview, migração ou auditoria pode manipular seu blueprint local sem alterar a definição original da carta ou outra visão da mesma habilidade.

## Compatibilidade

Aura 2.6 não altera:

- `PermanentStatAura` persistido;
- sanitização/authoring;
- `auraConditionMatches()`;
- `auraSources()`;
- `recomputeContinuousAuras()`;
- combate;
- mana;
- dano/cura do Nexus;
- lifecycle de Permanent, Unit ou Sentinela;
- replay/DTO;
- Card Studio.

O rule kind permanece `permanentStatAura` para preservar o envelope de compatibilidade já usado desde Aura 2.0.

## Status da família Aura

`ABILITY_KIND_SUPPORT.aura` continua **partial**.

O fato de a Ability Grammar agora representar corretamente condições de Aura não significa que RuneForge tenha um layer system genérico para qualquer efeito contínuo.

Ainda ficam fora:

- condições dependentes do alvo ou do resultado de outra Aura;
- `selfDamaged` com semântica multi-fonte;
- dependências arbitrárias entre contínuos;
- ordenação genérica de layers/sub-layers entre famílias diferentes;
- replacement effects contínuos;
- transformação contínua de tipo, texto ou controller.

## Certificação

`src/game/aura-2-6-ability-grammar.test.ts` valida:

- publicação de `CONDITIONAL_AURA_CONTRACT` no catálogo;
- projeção exata de condições AND/OR/NOT e folhas controller-scoped;
- `features: conditional` para condição de fonte;
- preservação do marker histórico para filtros de alvo;
- compatibilidade de Aura sem condição explícita;
- direção `enemyUnit` e suppression payload em Aura hostil condicional;
- enumeração por `abilityBlueprintsForCard()`;
- isolamento de referências entre CardDef, metadata e rule payload;
- manutenção de `ABILITY_KIND_SUPPORT.aura = "partial"`.
