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
- **Aura 2.6** — Ability Grammar/introspection projeta o contrato condicional certificado sem alterar runtime.

Estruturas continuam usando sua base estrutural `Artifact`, portanto herdam o contrato de Permanent Aura sem alterar replay, DTO ou o `CardType` persistido.

## Fontes do contrato

### Permanent sources

`Enchantment` e `Artifact` continuam usando os contratos históricos de Aura 2.0–2.2.

### Unit sources — Aura 2.3

Uma `Unit` com `CardDef.aura` é fonte contínua enquanto estiver viva no bench. A regra de “lord effect” é intrínseca: **a Unit-fonte nunca afeta o próprio `instanceId`**. Outra fonte de Aura pode afetá-la normalmente.

### Sentinela sources — Aura 2.4

Uma `Sentinela` com `CardDef.aura` projeta uma Command Aura enquanto existir em `players[owner].sentinelas` com `loyalty > 0`.

Sentinelas reutilizam o mesmo payload já certificado:

- aliados: `buffPower >= 0`, `buffHealth >= 0`, `keywords` seguras;
- inimigos: `buffPower <= 0`, `buffHealth <= 0`, `suppressKeywords` seguras;
- filtros opcionais `races` e `classes`.

Como Sentinela não é Unit, ela nunca pertence ao conjunto de alvos Unit e não requer regra especial de autoexclusão.

## Condições de fonte — Aura 2.5

`PermanentStatAura.condition` é opcional. Ausente significa o comportamento histórico “sempre ativa enquanto o lifecycle da fonte for válido”.

O primeiro corte aceita somente condições de estado do controlador:

- `always`;
- `allyRace`;
- `allyClass`;
- `nexusBelow`;
- `manaAtLeast`;
- `and` / `or` / `not`.

A condição decide se **a fonte inteira participa do layer**. Os filtros `races` / `classes` continuam decidindo quais Units aquela fonte afeta.

`selfDamaged` não entra em Aura 2.5 porque não possui uma única semântica entre Unit, Permanent e Sentinela. Authoring rejeita esse nó em qualquer profundidade; runtime considera payloads malformados/unsupported como fonte inativa.

## Ciclo de vida

A contribuição existe somente enquanto a fonte está ativa na zona correta **e** sua condição opcional é verdadeira:

- `Enchantment` / `Artifact` — em `permanents` com vida positiva;
- `Unit` — no `bench` com vida positiva;
- `Sentinela` — em `sentinelas` com Lealdade positiva.

Entrada, saída, destruição, recall, transformação e mudança de elegibilidade convergem para `recomputeContinuousAuras()` / cleanups autoritativos. Aura 2.4 garante lifecycle imediato de Sentinelas; Aura 2.5 acrescenta reatividade para estado do controlador.

O facade `engine/semantic-actions.ts` recompõe Continuous Auras depois de transições válidas de jogar carta, conjurar feitiço, declarar ataque e encerrar turno. Combate resolvido e activated/Sentinela abilities já convergem pelos cleanups autoritativos.

Isso cobre mudanças de board, mana, dano/cura do Nexus e triggers de ataque sem espalhar um segundo sistema de observers pelo engine.

Dano já marcado continua preservado quando `maxHealth` muda por ativação/desativação de Aura.

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

Aura 2.5 acrescenta um editor opcional de condição. Ele expõe somente condições Aura-safe e composição AND/OR/NOT; `selfDamaged` não aparece como opção.

A UI diferencia condição da fonte de filtros de alvo. Para Units, o Studio informa que o próprio source instance é excluído. Para Sentinelas, informa que a fonte permanece disponível enquanto houver Lealdade positiva.

O servidor continua fail-closed. O sanitizer legado de stat Aura permanece preservado para payloads/replays anteriores. Unit e Sentinela são validadas como fontes semânticas no boundary `validateAuthorableCardWithSemanticTypes()`. Aura 2.5 valida `condition`, remove extensões antes do sanitizer legado e restaura somente o payload sanitizado depois.

Isso evita ampliar silenciosamente o contrato antigo de `validateAuthorableCard()`.

## Ability Grammar 2.0 — Aura 2.6

O catálogo expõe os contratos certificados de fonte de Aura 2.0–2.4 e agora também publica `conditionalAuraContract: CONDITIONAL_AURA_CONTRACT`, reutilizando exatamente o contrato funcional certificado em Aura 2.5.

`blueprintFromPermanentStatAura()` passa a representar a condição real da fonte:

- `AbilityBlueprint.condition` recebe uma cópia defensiva de `card.aura.condition`;
- `AbilityRule.permanentStatAura.aura.condition` preserva a mesma semântica em outra cópia defensiva;
- Aura sem condição explícita continua projetando `condition: { kind: "always" }` e não ganha um campo `condition` artificial dentro do rule payload.

O marker `features: ["conditional"]` aparece se houver condição de fonte diferente de `always` **ou** filtros de alvo `races`/`classes`. Isso preserva o comportamento histórico de filtros sem confundir os dois níveis: o campo `condition` descreve a fonte; filtros continuam no payload da Aura e descrevem os alvos.

As árvores projetadas não compartilham referência mutável com o `CardDef` nem entre a metadata do blueprint e o rule payload. Ability Grammar continua sendo introspecção read-only e não consegue alterar a definição autoritativa da carta por mutação acidental.

A família `aura` permanece marcada como **partial**. Aura 2.6 não promove o envelope `permanentStatAura` a um layer system genérico entre famílias diferentes.

O sistema de gameplay cobre:

- buffs contínuos de stats em aliados;
- grants contínuos de keywords em aliados;
- debuffs contínuos de stats em inimigos;
- supressão contínua de keywords em inimigos;
- Permanent sources;
- Unit-source / lord effects;
- Sentinela-source / command effects;
- condições controller-scoped de Aura — Aura 2.5;
- introspecção fiel dessas condições pela Ability Grammar — Aura 2.6.

Ainda ficam fora do contrato genérico:

- `selfDamaged` multi-family;
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
- `docs/AURA-2-6.md` — conditional Aura Ability Grammar/introspection.
