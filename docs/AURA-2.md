# Aura 2.x — Continuous Aura System

## Objetivo

Aura 2.x evolui o contrato contínuo do RuneForge sem criar um segundo engine de efeitos persistentes. A mesma recomputação autoritativa do battlefield deriva contribuições de stats e keywords a partir das fontes vivas atualmente em jogo.

Os slices certificados são incrementais:

- **Aura 2.0** — buffs de stats + grants contínuos de keywords em aliados;
- **Aura 2.1** — debuffs contínuos de Power/Health em inimigos;
- **Aura 2.2** — supressão source-bound de keywords em inimigos;
- **Aura 2.3** — Units vivas como fontes de Aura (“lord effects”), com autoexclusão por `instanceId`.

Estruturas continuam usando sua base estrutural `Artifact`, portanto herdam o contrato de Permanent Aura sem alterar replay, DTO ou o `CardType` persistido.

## Fontes certificadas

### Permanent sources

`Enchantment` e `Artifact` continuam usando os contratos históricos de Aura 2.0–2.2. Esses contratos não foram reescritos quando Aura 2.3 entrou; continuam descrevendo exatamente o que foi certificado em cada PR.

### Unit sources — Aura 2.3

Uma `Unit` com `CardDef.aura` passa a ser uma fonte contínua enquanto estiver viva no bench. Ela reutiliza o mesmo payload de Aura já certificado:

- aliados: `buffPower >= 0`, `buffHealth >= 0`, `keywords` seguras;
- inimigos: `buffPower <= 0`, `buffHealth <= 0`, `suppressKeywords` seguras;
- filtros opcionais `races` e `classes`.

A regra de “lord effect” é intrínseca: **a Unit-fonte nunca afeta o próprio `instanceId`**. Outra fonte de Aura pode afetá-la normalmente. Assim, dois lordes podem fortalecer um ao outro, mas nenhum recebe o próprio bônus.

## Ciclo de vida

A contribuição existe somente enquanto a fonte está viva e presente na zona correta:

- `Enchantment` / `Artifact` — em `permanents` com vida positiva;
- `Unit` — no `bench` com vida positiva.

Entrada, saída, destruição, recall, transformação e mudança de elegibilidade convergem para `recomputeContinuousAuras()` / `cleanupDead()`. Dano já marcado continua preservado quando `maxHealth` muda por entrada ou saída de Aura.

## Proveniência de keywords

`UnitInstance.keywords` permanece a visão efetiva consumida pelo gameplay e pela UI. A proveniência é mantida em campos opcionais para compatibilidade com replays antigos:

- `durableKeywords` — impressão da carta, Equipment e grants permanentes/one-shot;
- `auraKeywords` — grants derivados das fontes aliadas de Aura ativas;
- `auraSuppressedKeywords` — supressões hostis source-bound.

A visão efetiva é derivada como:

**durable + grants de Aura − supressões hostis**

Ao remover uma fonte, somente as camadas source-bound são recalculadas. Um grant durável feito enquanto a mesma keyword estava presente ou suprimida por Aura continua existindo depois que a fonte sai.

## Filtros e stacking

`races` e `classes` mantêm o contrato existente:

- dentro da lista de raças vale **OU**;
- dentro da lista de classes vale **OU**;
- quando os dois grupos existem, raça e classe combinam como **E**.

Múltiplas Auras somam Power/Health e unem grants/supressões de keywords sem duplicação. Unit-source Aura adiciona apenas a regra de autoexclusão da fonte.

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
- `Unit` — Aura 2.3.

Para Units, o Studio informa explicitamente que o próprio source instance é excluído.

O servidor continua fail-closed. O sanitizer legado de stat Aura permanece preservado para payloads/replays anteriores. Aura 2.3 valida o payload de Unit-source no boundary semântico, reutiliza `sanitizePermanentStatAura()` para stats/filtros, remove temporariamente `aura` antes do validator legado de carta e restaura somente o payload já validado depois.

Isso evita ampliar silenciosamente o contrato antigo de `validateAuthorableCard()`.

## Ability Grammar 2.0

O catálogo expõe contratos separados para os slices certificados. Aura 2.3 adiciona `UNIT_SOURCE_AURA_CONTRACT`, enquanto a projeção histórica `permanentStatAura` continua sendo usada como envelope compatível para stats, `aura.keywords`, `aura.suppressKeywords`, filtros e `aura.affects`.

A família `aura` permanece marcada como **partial**. Já estão certificados:

- buffs contínuos de stats em aliados;
- grants contínuos de keywords em aliados;
- debuffs contínuos de stats em inimigos — Aura 2.1;
- supressão contínua de keywords em inimigos — Aura 2.2;
- Unit-source / lord effects com autoexclusão — Aura 2.3.

Ainda ficam fora do contrato genérico:

- dependências arbitrárias entre efeitos persistentes;
- ordenação genérica de layers/sub-layers entre famílias diferentes;
- replacement effects contínuos;
- regras contínuas que transformem tipo, texto ou controller da carta;
- fontes contínuas em zonas futuras diferentes de battlefield/permanents.

## Certificação

A suíte histórica de Aura 2.0 cobre Permanent Auras e proveniência de keywords. As extensões possuem certificação comportamental separada:

- `docs/AURA-2-1.md` — enemy stat debuffs;
- `docs/AURA-2-2.md` — keyword suppression;
- `docs/AURA-2-3.md` — Unit-source / lord effects.
