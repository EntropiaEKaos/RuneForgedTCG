# Condition System 2.2 — Enemy Board Identity

## Objetivo

Condition System 2.2 amplia a linguagem canônica de condições do RuneForge com duas folhas controller-scoped para observar a identidade pública do battlefield adversário:

```ts
{ kind: "enemyRace", race: "Dragon", min: 1 }
{ kind: "enemyClass", classKey: "guardian", min: 2 }
```

O corte reutiliza o mesmo `MechanicCondition`, sanitizer, evaluator, composição lógica, Studio e Ability Grammar já certificados. Não cria uma segunda DSL e não acessa mão, deck, stack ou informação oculta.

## Semântica autoritativa

A orientação é sempre relativa ao controller da fonte.

- fonte do `player` observa `players.ai.bench`;
- fonte da `ai` observa `players.player.bench`.

`enemyRace` conta Units inimigas vivas cuja identidade racial contém a raça pedida. Isso inclui a raça primária e identidades multirraça materializadas em `UnitInstance.races`.

`enemyClass` conta Units inimigas vivas cujo `UnitInstance.classes` contém o `classKey` pedido.

Somente Units com `health > 0` contam. Uma Unit que já recebeu dano letal não satisfaz a condição durante uma janela transitória anterior à sua remoção física pelo cleanup.

## Limites de authoring

As duas folhas usam o mesmo boundary certificado das condições aliadas:

- `min` é inteiro efetivo de `1..6`;
- `race` deve pertencer a `CARD_RACES`;
- `classKey` deve passar pelo identificador canônico de classe (`[a-z0-9_-]`, até 64 caracteres);
- payload desconhecido ou malformado falha fechado.

Não há seleção de alvo no payload. A condição só responde à composição pública do board adversário.

## Composição

`enemyRace` e `enemyClass` podem aparecer em qualquer profundidade válida de:

- `and`;
- `or`;
- `not`.

Exemplo:

```ts
{
  kind: "and",
  children: [
    { kind: "enemyRace", race: "Dragon", min: 1 },
    { kind: "not", child: { kind: "enemyClass", classKey: "assassin", min: 1 } }
  ]
}
```

A composição continua usando o evaluator canônico; não existe evaluator paralelo para condições adversárias.

## Mechanics runtime

`mechanicConditionMatches()` resolve `enemyRace` e `enemyClass` a partir de `other(unit.owner)`.

Isso permite gatilhos como:

- "Quando atacar, se o oponente controlar um Dragão, compre 1.";
- "No início da rodada, se o oponente controlar 2 Guardians, ganhe +1/+1.";
- condições combinadas entre board aliado, board inimigo, Nexus e mana.

## Continuous Auras

`AURA_CONDITION_KINDS` inclui as duas novas folhas. Permanent, Unit Lord e Sentinela Command Auras podem depender de identidade inimiga.

Exemplo:

> Enquanto o oponente controlar um Dragão, suas outras Units têm Flying.

A condição decide se a fonte participa do continuous-effect layer; os filtros `races`/`classes` da própria Aura continuam decidindo quais Units ela afeta.

`selfDamaged` não é alterado por Condition 2.2 e continua sendo uma exceção exclusiva de Unit-source Aura.

## Lifecycle

Mudanças autoritativas de battlefield convergem para os cleanups/recomputações já existentes. Quando a última Unit inimiga que satisfaz a identidade sai ou recebe dano letal, a contribuição contínua da Aura deixa de existir no mesmo estado resolvido.

A suíte 2.2 inclui uma remoção real por spell direcionada: a Unit inimiga é destruída, o cleanup remove o corpo e `recomputeContinuousAuras()` retira imediatamente o grant source-bound.

## Card Studio

Tanto o Unified Ability Composer quanto o editor de Continuous Aura passam a oferecer:

- `enemyRace` — raça inimiga + mínimo;
- `enemyClass` — classe inimiga + mínimo.

Os controles reutilizam os limites canônicos e continuam disponíveis dentro de AND/OR/NOT. O editor de Aura preserva a capability especial de `selfDamaged`: essa opção continua aparecendo somente para Unit-source.

## Ability Grammar

`ABILITY_GRAMMAR_CATALOG.conditions` e `conditionContracts` derivam do catálogo canônico, portanto passam a publicar automaticamente:

- `enemyRace: supported`;
- `enemyClass: supported`.

Blue­prints condicionais preservam a árvore exata sem introduzir um novo `AbilityRuleKind`.

## Fora deste corte

Condition 2.2 não adiciona condições sobre:

- cartas na mão;
- tamanho do deck;
- cemitério ou futuras zonas;
- spells na stack;
- alvo selecionado;
- stats derivados de uma Unit alvo;
- texto, controller ou tipo modificados por continuous effects.

Essas famílias precisam de contratos próprios antes de serem expostas ao authoring.

## Certificação comportamental

`src/game/condition-2-2-enemy-board-identity.test.ts` cobre:

- catálogo/sanitizer e support matrix;
- clamp `1..6`;
- rejeição de raça/classe inválida;
- orientação simétrica player/AI;
- identidade multirraça;
- classes inimigas;
- exclusão de Units com `health <= 0`;
- AND/OR/NOT combinando estado aliado e inimigo;
- Aura controller-scoped;
- remoção autoritativa por spell desligando Aura imediatamente;
- semantic authoring;
- Ability Grammar projection.

A taxonomia comportamental passa de 68 para 69 targets neste slice.
