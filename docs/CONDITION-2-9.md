# Condition System 2.9 — Match Progress Thresholds

## Objetivo

Condition 2.9 expõe ao contrato genérico seis contadores públicos e autoritativos que o engine já mantinha para progressão de Campeões e telemetria de partida:

```ts
{ kind: "spellsCastAtLeast", amount: N }
{ kind: "opponentSpellsCastAtLeast", amount: N }
{ kind: "alliesSummonedAtLeast", amount: N }
{ kind: "opponentAlliesSummonedAtLeast", amount: N }
{ kind: "nexusDamageDealtAtLeast", amount: N }
{ kind: "opponentNexusDamageDealtAtLeast", amount: N }
```

## Semântica autoritativa

As folhas leem diretamente `PlayerState.stats`. `spellsCast` avança quando uma Spell/Permanent/Equipment que conta como spell é efetivamente comprometida; `alliesSummoned` avança em invocações autoritativas de Unit/token; `nexusDamageDealt` avança em `damageNexus()` independentemente da origem do dano.

A orientação é controller-scoped: as variantes sem `opponent` observam o controlador da fonte, e as variantes `opponent*` observam o outro jogador. Player e IA usam exatamente a mesma regra.

Nenhum contador, cache, replay field ou lifecycle paralelo foi criado.

## Envelope de authoring

As seis folhas usam `1..2000` como envelope de segurança do sanitizer/Studio. Esse limite não é um cap de gameplay e não altera os contadores do engine; ele apenas impede payloads absurdos no authoring, seguindo o mesmo envelope já usado por `roundAtLeast`.

## Lifecycle

Os caminhos normais já convergem pelos pontos autoritativos existentes:

- `castSpell()` incrementa `spellsCast` e passa por `cleanupDead()`/recompute;
- `playUnit()` e `summonToken` incrementam `alliesSummoned` e convergem pelo cleanup/recompute do action/trigger correspondente;
- combate, Spells e habilidades usam `damageNexus()`, e seus actions convergem antes de devolver o estado.

Condition 2.9 fecha ainda uma lacuna da stack: `consumeNegatedCard()` já considerava uma Spell negada como conjurada e pagava/retirava a carta da mão, mas não reavaliava level-up nem Continuous Auras. Agora esse consumo chama `checkLevelUps()` e `recomputeContinuousAuras()` no mesmo estado. Isso também corrige a convergência de condições anteriores baseadas em mão/mana quando uma carta é negada.

## Studio e Ability Grammar

As seis folhas aparecem no Ability Composer e no editor de Continuous Aura com labels próprias, suportam `AND`, `OR` e `NOT`, e entram automaticamente no Ability Grammar pelo catálogo canônico `MECHANIC_CONDITION_KINDS` + `CONDITION_RUNTIME_SUPPORT`.

## Certificação

`condition-2-9-match-progress-thresholds.test.ts` cobre catálogo, clamps, orientação player/IA, composição, Mechanics, Aura, lifecycle real de Spell, invocação e dano de combate ao Nexus, convergência de Spell negada, level-up imediato, authoring e Ability Grammar. O total comportamental sobe de 75 para 76 targets.
