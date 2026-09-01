# Aura 2.7 — Unit-source `selfDamaged` Conditions

## Objetivo

Aura 2.7 amplia o contrato condicional de Aura somente onde `self` possui semântica inequívoca: uma `Unit` viva que atua como fonte contínua no bench.

O corte não transforma `selfDamaged` em condição genérica de todas as fontes. `Enchantment`, `Artifact` e `Sentinela` continuam rejeitando a condição no authoring e considerando payloads bypassados/malformados inativos em runtime.

## Semântica certificada

Para uma Unit-source Aura, `selfDamaged` significa exatamente:

```text
sourceUnit.health < sourceUnit.maxHealth
```

A fonte também precisa estar viva (`health > 0`) e pertencer ao controller avaliado. A condição pode aparecer isoladamente ou dentro de árvores `and`, `or` e `not` já limitadas pelo contrato de `MechanicCondition`.

A própria Unit-fonte continua excluída dos alvos da sua Aura por `instanceId`, como já certificado em Aura 2.3. `selfDamaged` observa a fonte; não permite que ela passe a afetar a si mesma.

## Por que somente Unit

Aura 2.5 manteve `selfDamaged` fora do contrato controller-scoped porque Permanent, Unit e Sentinela não compartilham a mesma noção de `self` e de dano:

- Unit possui `health` e `maxHealth`, inclusive dano marcado preservado;
- Permanent possui integridade própria, mas não o mesmo contrato de Unit;
- Sentinela usa Lealdade, não `UnitInstance.health`.

Aura 2.7 não inventa equivalências artificiais. O runtime recebe explicitamente o `UnitInstance` da fonte somente no caminho Unit-source. Permanent e Sentinela continuam chamando a avaliação sem Unit source e portanto `selfDamaged` falha fechado.

## Dano marcado e +Health contínuo

`recomputeContinuousAuras()` já preserva dano marcado quando o teto de vida muda:

```text
damageTaken = maxHealth - health
health depois da recomputação = novo maxHealth - damageTaken
```

Por isso uma Aura externa de `+Health` não cria falsamente `selfDamaged` em uma fonte que estava ilesa. Da mesma forma, uma Unit que já sofreu 2 de dano continua com exatamente 2 de dano marcado quando um bônus de Health entra ou sai.

Essa propriedade evita que Aura 2.7 crie uma dependência circular simples entre a condição da fonte e o próprio layer contínuo de Health.

## Runtime

`auraSources()` continua sendo o único enumerador autoritativo de fontes contínuas.

- Permanent: `auraConditionMatches(state, owner, condition)`;
- Unit: `auraConditionMatches(state, owner, condition, sourceUnit)`;
- Sentinela: `auraConditionMatches(state, owner, condition)`.

Somente o segundo caminho pode interpretar `selfDamaged`.

Quando a Unit está em vida cheia, a fonte não participa do layer. Ao receber dano e ocorrer a convergência autoritativa normal, toda a Aura passa a contribuir. Ao ser curada de volta até `maxHealth`, a fonte deixa novamente o layer e apenas suas contribuições source-bound são removidas.

## Authoring fail-closed

`sanitizeAuraCondition(raw, allowUnitSourceSelfDamaged)` mantém `false` como padrão para preservar Aura 2.5.

`validateAuthorableCardWithSemanticTypes()` habilita a capability apenas quando `raw.type === "Unit"`.

Assim:

- Unit + `selfDamaged`: aceito;
- Unit + `and/or/not` contendo `selfDamaged`: aceito dentro dos limites estruturais existentes;
- Enchantment/Artifact + `selfDamaged`: rejeitado;
- Sentinela + `selfDamaged`: rejeitado;
- árvore não suportada/malformada: rejeitada.

## Card Studio

`ContinuousAuraConditionEditor` recebe uma capability explícita `allowSelfDamaged`.

`PermanentAuraEditor` passa `true` somente para cards do tipo `Unit`. Em outras fontes a opção não aparece, inclusive em níveis aninhados de `and`, `or` e `not`.

A UI explica que a condição observa dano marcado da própria Unit-fonte e que a fonte continua autoexcluída como alvo da Aura.

## Compatibilidade

`CONDITIONAL_AURA_CONTRACT` de Aura 2.5 permanece semanticamente intacto e ainda declara `selfDamaged` como unsupported no contrato controller-scoped geral.

Aura 2.7 adiciona um contrato separado:

`UNIT_SOURCE_SELF_DAMAGED_AURA_CONTRACT`

Isso evita alterar consumidores existentes que interpretam o contrato Aura 2.5 de forma exata.

Ability Grammar 2.6 já projeta a árvore real de `PermanentStatAura.condition`, portanto um Lord Effect `selfDamaged` aparece como `features: ["conditional"]` e preserva a condição tanto no blueprint quanto no rule payload sem mudança de execução.

## Fora de escopo

Aura 2.7 não adiciona:

- `selfDamaged` para Permanent;
- `selfDamaged` para Sentinela/Lealdade;
- condições baseadas no alvo da Aura;
- comparação de Power/Health derivados do alvo;
- dependências arbitrárias entre continuous effects;
- generic layer/sub-layer engine;
- replacement effects contínuos.

A família `aura` continua **partial** na Ability Grammar.

## Certificação

A suíte `src/game/aura-2-7-unit-source-self-damaged.test.ts` cobre:

- contrato dedicado;
- predicate full-health/damaged/owner mismatch;
- ativação por dano e desativação por cura;
- autoexclusão da Unit-fonte;
- stats + keyword grants condicionais;
- estabilidade do dano marcado quando +Health externo entra/sai;
- composição `and/or/not`;
- authoring Unit permitido;
- authoring Permanent/Sentinela rejeitado;
- runtime não-Unit bypassado fail-closed;
- projeção fiel pela Ability Grammar 2.6.
