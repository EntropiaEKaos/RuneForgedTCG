# Aura 2.4 — Sentinela Command Auras

## Objetivo

Aura 2.4 permite que uma `Sentinela` no battlefield seja fonte de uma Aura contínua enquanto tiver Lealdade positiva. O corte reutiliza integralmente o engine Aura 2.x já certificado; não cria uma segunda família de efeitos persistentes.

Exemplos de design habilitados:

- “Enquanto esta Sentinela permanecer em jogo, suas Bestas recebem +1/+1.”
- “Seus Guardiões ganham Tough enquanto esta Sentinela comandar o campo.”
- “Unidades inimigas perdem 1 de Power enquanto esta Sentinela tiver Lealdade.”
- “Unidades inimigas elegíveis perdem Hexproof enquanto esta Sentinela estiver ativa.”

## Contrato

`SENTINELA_SOURCE_AURA_CONTRACT` define:

- fonte: `Sentinela`;
- zona da fonte: `players[owner].sentinelas`;
- lifecycle: enquanto `loyalty > 0`;
- alvos: `allyUnit` ou `enemyUnit` conforme `aura.affects`;
- efeitos aliados: stats não negativos + grants seguros de keywords;
- efeitos inimigos: stats não positivos + supressões seguras de keywords;
- filtros: mesmas regras `races` / `classes` do Aura 2.x;
- stats: stacking aditivo;
- grants/supressões: união de conjunto.

Diferentemente da Unit-source Aura 2.3, a Sentinela não é uma Unit e portanto não precisa de autoexclusão: ela nunca pertence ao conjunto de alvos Unit.

## Lifecycle de entrada

O caminho real `playUnit()` continua delegando a resolução da Sentinela ao executor legado. Quando a carta jogada é uma Sentinela com Aura e a jogada efetivamente cria um novo estado, o facade semântico chama `recomputeContinuousAuras()` imediatamente.

Uma tentativa ilegal que devolva o `state` original não dispara recomputação nem mutação lateral.

## Lifecycle de saída

Antes de Aura 2.4, `cleanupSentinelas()` apenas removia instâncias com Lealdade zero. Como Sentinelas agora podem ser fontes contínuas, o cleanup passa a detectar remoção e chamar `recomputeContinuousAuras()` na mesma transição autoritativa.

Isso garante que:

- +Health desapareça imediatamente;
- dano marcado seja preservado;
- grants de keyword source-bound desapareçam;
- supressões hostis sejam removidas;
- keywords duráveis reapareçam no mesmo estado pós-cleanup.

O runtime também ignora `loyalty <= 0` na enumeração de fontes mesmo antes da remoção física, portanto uma Sentinela sem Lealdade nunca continua contribuindo entre etapas de cleanup.

## Authoring e compatibilidade

O sanitizer legado de Aura permanece restrito a `Enchantment`/`Artifact` e não é ampliado retroativamente.

No boundary canônico `validateAuthorableCardWithSemanticTypes()`:

1. Unit e Sentinela são tratadas como fontes semânticas de Aura;
2. stats/filtros são validados por `sanitizePermanentStatAura()` usando o mesmo probe dos slices anteriores;
3. `aura` é removida antes do validator legado da carta;
4. todo o restante do CardDef é validado normalmente, inclusive o contrato de Sentinela e suas habilidades;
5. somente o payload Aura previamente validado é restaurado.

Assim, publicação/import/sandbox ganham Sentinela Command Aura sem alterar o comportamento histórico de `validateAuthorableCard()`.

## Card Studio

`PermanentAuraEditor` aparece agora em:

- Unit;
- Sentinela;
- Enchantment;
- Artifact / Structure.

Em Sentinela, o painel identifica explicitamente `Sentinela Command Aura` e informa que a contribuição dura enquanto houver Lealdade positiva.

Os controles continuam compartilhados:

- audiência aliados/inimigos;
- Power/Health;
- grants de keywords;
- supressões de keywords;
- raça;
- classe.

## Keyword safety

Aura 2.4 não amplia os vocabulários de Aura:

- `Barrier` continua fora de grants/supressões contínuas porque possui estado consumível em `unit.barrier`;
- `LastBreath` continua fora porque depende de trigger executável `onDeath`.

## Ability Grammar 2.0

O catálogo passa a publicar `sentinelaSourceAuraContract` apontando para `SENTINELA_SOURCE_AURA_CONTRACT`.

`blueprintFromPermanentStatAura()` mantém o nome histórico por compatibilidade e passa a aceitar `Sentinela` além de Unit, Enchantment e Artifact. O envelope `permanentStatAura` não muda.

A família global `aura` continua `partial`: este corte não implementa replacement effects, mudança contínua de tipo/texto/controller nem ordenação arbitrária entre famílias diferentes de efeitos persistentes.

## Certificação comportamental

`src/game/aura-2-4-sentinela-command-auras.test.ts` cobre:

- contrato público exato;
- stats aliados + keyword grant;
- filtros de raça;
- entrada pelo `playUnit()` real;
- Lealdade zero removendo fonte e efeito na mesma transição;
- preservação de dano marcado quando +Health sai;
- zero loyalty fail-closed antes do cleanup físico;
- debuff hostil + supressão/restauração de Hexproof;
- authoring aliado e hostil;
- safety boundary de Barrier;
- rejeição de fonte Spell;
- projeção no Ability Grammar.
