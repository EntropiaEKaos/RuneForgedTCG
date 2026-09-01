# Condition System 2.6 — Permanent Board Thresholds

## Objetivo

Condition 2.6 adiciona duas folhas controller-scoped ao vocabulário canônico de condições:

```ts
{ kind: "allyPermanentsAtLeast", min: N }
{ kind: "enemyPermanentsAtLeast", min: N }
```

Elas permitem que Mechanics e Continuous Auras respondam à quantidade de Permanents vivas no battlefield sem criar cache, contador derivado ou hook paralelo.

## Semântica autoritativa

Para uma fonte controlada por `player`, `allyPermanentsAtLeast` lê `state.players.player.permanents` e `enemyPermanentsAtLeast` lê `state.players.ai.permanents`. Para uma fonte da IA a orientação é simétrica.

Só contam instâncias com `health > 0`. Um corpo letal ainda presente no array antes de `cleanupDead()` já deixa de satisfazer o threshold.

Structures entram naturalmente na contagem porque o contrato semântico `structure` é persistido e executado sobre a base estrutural `Artifact`, portanto sua instância está em `PlayerState.permanents`. Sentinelas não entram: elas possuem a zona dedicada `PlayerState.sentinelas` e nunca são reinterpretadas como Permanent.

A própria fonte de uma Permanent Aura conta quando estiver viva, porque ela também ocupa a zona `permanents`. Portanto uma Aura com `allyPermanentsAtLeast: 2` ativa quando ela própria e mais uma Permanent viva estiverem presentes.

## Envelope de authoring

`min` é sanitizado para `1..8`. O teto acompanha o envelope administrativo já existente de `permanentsCap`, configurável de 1 a 8. O default atual do jogo continua 4; Condition 2.6 não congela o runtime nesse default.

Limiares complementares continuam expressáveis por `NOT`, por exemplo:

```ts
{ kind: "not", child: { kind: "enemyPermanentsAtLeast", min: 3 } }
```

## Runtime e lifecycle

`mechanicConditionMatches()` e `auraConditionMatches()` filtram diretamente as zonas autoritativas de Permanents. Não existe snapshot secundário.

Entrada de Enchantment, Artifact ou Structure já converge pelos actions certificados para `cleanupDead()`/`recomputeContinuousAuras()`. Da mesma forma, dano/destruição que deixa uma Permanent letal passa pelo mesmo ciclo de estabilização. Assim cruzar o threshold para cima ou para baixo liga/desliga uma Aura imediatamente na state devolvida pela ação.

Nenhum novo hook de engine, cache de board ou campo de replay foi introduzido.

## Studio e Ability Grammar

Os dois kinds são expostos tanto no `StudioConditionEditor` quanto no `ContinuousAuraConditionEditor`, com input `1..8` e defaults válidos. Eles continuam compondo com `AND`, `OR` e `NOT` nos limites estruturais já certificados.

`ABILITY_GRAMMAR_CATALOG.conditions` e `conditionContracts` derivam do mesmo vocabulário canônico e publicam ambos como `supported`. `blueprintFromPermanentStatAura()` preserva a árvore de condição sem criar novo rule kind.

## Certificação

`condition-2-6-permanent-board-thresholds.test.ts` cobre:

- registro canônico e Ability Grammar;
- clamps `1..8`;
- orientação player/IA;
- somente `health > 0`;
- Structure contando como Permanent;
- Sentinela excluída;
- `NOT/AND`;
- avaliação de Aura;
- entrada real de Structure ligando Aura imediatamente;
- `cleanupDead()` removendo a Permanent letal e desligando Aura no mesmo ciclo;
- authoring de Mechanics e Continuous Aura.

Com este slice, a suíte comportamental passa de 72 para 73 targets.
