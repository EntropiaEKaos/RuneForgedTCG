# Aura 2.3 — Unit-source / Lord Effects

## Objetivo

Aura 2.3 permite que uma `Unit` viva no battlefield seja a fonte de uma Aura contínua, reutilizando o mesmo contrato já certificado para Permanent Auras.

O objetivo é habilitar designs clássicos de “lord” sem criar um segundo motor de efeitos:

- “Outros Dragões aliados recebem +1/+1”;
- “Outros Guerreiros aliados ganham Tough”;
- “Unidades inimigas perdem 1 de Power enquanto esta Unit estiver viva”;
- “Unidades inimigas elegíveis perdem Hexproof enquanto esta Unit estiver viva”.

Nenhuma dessas regras grava buffs permanentes no alvo. A contribuição é derivada continuamente do estado real do battlefield.

## Contrato

`UNIT_SOURCE_AURA_CONTRACT` define:

- fonte: `Unit`;
- zona da fonte: `bench`;
- lifecycle: enquanto a fonte estiver viva no bench;
- alvos: aliados ou inimigos conforme `aura.affects`;
- autoexclusão: o `instanceId` da Unit-fonte nunca é elegível para sua própria Aura;
- stats: stacking aditivo;
- grants/supressões de keywords: união de conjunto;
- filtros: mesmas regras de `races` e `classes` das Permanent Auras.

A autoexclusão é de instância, não de `defId`. Duas cópias da mesma carta podem se afetar mutuamente porque possuem `instanceId` diferentes.

## Efeitos aliados

Uma Unit-source Aura aliada pode:

- conceder `buffPower >= 0`;
- conceder `buffHealth >= 0`;
- conceder keywords de `AURA_GRANTABLE_KEYWORDS`;
- filtrar por raça e/ou classe.

A fonte nunca recebe o próprio efeito, mesmo que corresponda aos filtros.

## Efeitos inimigos

Uma Unit-source Aura com `affects: "enemies"` pode:

- aplicar `buffPower <= 0`;
- aplicar `buffHealth <= 0`;
- suprimir keywords de `AURA_SUPPRESSIBLE_KEYWORDS`;
- filtrar por raça e/ou classe.

O Power efetivo continua com piso 0. Reduções de vida máxima podem tornar dano já marcado letal, usando o mesmo `cleanupDead()` iterativo certificado em Aura 2.1.

## Keyword safety

Aura 2.3 não amplia o vocabulário de keywords. As mesmas fronteiras de Aura 2.0/2.2 continuam obrigatórias:

- `Barrier` não pode ser grantada nem suprimida continuamente porque possui estado consumível em `unit.barrier`;
- `LastBreath` não pode ser tratada como keyword estática transferível porque depende de trigger executável `onDeath`.

## Lifecycle e estabilidade

O runtime enumera duas classes de fontes:

1. permanentes vivos em `players[owner].permanents` com CardDef `Enchantment`/`Artifact` + `aura`;
2. Units vivas em `players[owner].bench` com CardDef `Unit` + `aura`.

Todas alimentam o mesmo `permanentAuraBonusForUnit()` e as mesmas derivações de keyword.

Isso preserva:

- entrada de fonte;
- destruição de fonte;
- recall/remoção do bench;
- transformação/level-up que muda o CardDef da fonte;
- dano marcado ao entrar/sair +Health;
- proveniência durável de keywords;
- stacking com Permanent Auras e outras Unit-source Auras.

## Dois lordes

Dois lordes aliados podem se afetar mutuamente.

Exemplo: duas Units 2/3, cada uma com “outras Units aliadas recebem +1/+0”. Com ambas em jogo, cada uma fica 3/3, não 4/3:

- Lord A ignora a própria Aura, mas recebe a de Lord B;
- Lord B ignora a própria Aura, mas recebe a de Lord A.

Isso evita auto-buff circular e ainda permite sinergia natural entre múltiplas fontes.

## Authoring e compatibilidade

O validator legado `validateAuthorableCard()` continua rejeitando Aura em Unit. Isso é intencional: ele representa o contrato histórico stat-only de `Enchantment`/`Artifact` e não foi ampliado retroativamente.

O boundary canônico `validateAuthorableCardWithSemanticTypes()` implementa Aura 2.3:

1. valida audiência, stats, keywords e safety rules;
2. usa `sanitizePermanentStatAura()` como probe canônico de stats/filtros;
3. remove temporariamente `aura` antes do validator legado de carta quando a fonte é Unit;
4. valida todo o restante do CardDef;
5. restaura somente o payload de Aura já validado.

Assim publicação/import/sandbox/QA ganham a nova capacidade sem mudar o comportamento histórico do sanitizer base.

## Card Studio

`PermanentAuraEditor` passa a aparecer também para `Unit`.

Quando a carta é Unit:

- o painel identifica o modo “Unit Lord Effect”;
- “Aliados” é apresentado como “Outras unidades aliadas”;
- a UI informa que a própria fonte é sempre excluída;
- os mesmos controles de stats, grants, suppressions, raça e classe são reutilizados.

## Ability Grammar 2.0

O catálogo publica `unitSourceAuraContract` apontando para `UNIT_SOURCE_AURA_CONTRACT`.

`blueprintFromPermanentStatAura()` mantém o nome histórico por compatibilidade, mas passa a projetar Auras de `Unit`, `Enchantment` e `Artifact` pelo mesmo envelope `permanentStatAura`.

A família global `aura` permanece `partial`; Aura 2.3 não declara suporte genérico a replacement effects, mudança contínua de tipo/texto/controller ou ordenação arbitrária entre famílias diferentes de efeitos contínuos.

## Certificação comportamental

`src/game/aura-2-3-unit-source-lord-effects.test.ts` cobre:

- autoexclusão da fonte em Power e Health;
- filtros de raça/classe preservados;
- dois lordes se afetando mutuamente sem self-stack;
- entrada via `playUnit()` atualizando aliados existentes;
- morte da fonte removendo o efeito;
- preservação de dano marcado quando +Health desaparece;
- keyword grant source-bound por Unit;
- hostile Unit aura com stat debuff + keyword suppression;
- restauração após morte da fonte;
- authoring aliado e hostil;
- rejeição de fonte Spell;
- manutenção do safety boundary de Barrier;
- projeção no Ability Grammar e publicação do contrato 2.3.
