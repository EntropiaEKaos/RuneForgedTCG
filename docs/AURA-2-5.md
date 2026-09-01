# Aura 2.5 — Conditional Continuous Auras

## Objetivo

Aura 2.5 adiciona ativação condicional às fontes contínuas já certificadas sem criar um segundo engine de layers.

Uma Aura continua usando exatamente o mesmo payload de stats, grants, supressões, audiência e filtros de Aura 2.0–2.4. O novo campo opcional `condition` apenas decide se a **fonte inteira participa ou não** da derivação contínua naquele estado autoritativo.

Ausência de `condition` preserva o comportamento histórico: a fonte está ativa sempre que sua zona/lifecycle normal estiver válido.

## Condições certificadas

Aura 2.5 reutiliza o vocabulário `MechanicCondition` já existente, mas limita o primeiro corte a condições de estado do controlador:

- `always`;
- `allyRace`;
- `allyClass`;
- `nexusBelow`;
- `manaAtLeast`;
- `and`;
- `or`;
- `not`.

As composições AND/OR/NOT podem ser aninhadas dentro dos limites já definidos pelo sanitizer canônico de condições.

### Por que `selfDamaged` fica fora

`selfDamaged` é perfeitamente definido para uma Unit, mas não possui uma semântica única entre todas as fontes de Aura certificadas:

- Unit tem `health/maxHealth`;
- Enchantment/Artifact possui vida de permanente;
- Sentinela usa Lealdade em vez de vida.

Em vez de inventar três interpretações diferentes para a mesma condição, Aura 2.5 rejeita `selfDamaged` no authoring e considera qualquer payload runtime contendo esse nó como fonte inativa (fail-closed), inclusive quando escondido dentro de AND/OR/NOT.

## Escopo da condição

A condição pertence à **fonte**, não ao alvo.

Exemplo:

> “Enquanto você controlar pelo menos 2 Beasts, suas outras Units recebem +1/+1.”

1. `condition: { kind: "allyRace", race: "Beast", min: 2 }` decide se a fonte existe no layer.
2. `races` / `classes` do payload da Aura continuam decidindo quais Units são alvos elegíveis.

Isso evita dependências target-by-target e mantém o stacking determinístico.

## Fontes suportadas

O mesmo condition contract vale para todas as famílias de fonte já certificadas:

- `Enchantment`;
- `Artifact` / `Structure`;
- `Unit` / Lord Effect;
- `Sentinela` / Command Aura.

As regras anteriores continuam intactas:

- Unit-source nunca afeta o próprio `instanceId`;
- Sentinela-source exige Lealdade positiva;
- Permanents exigem vida positiva;
- allied Aura usa stats não negativos + grants seguros;
- enemy Aura usa stats não positivos + supressões seguras.

## Runtime fail-closed

`auraSources()` continua sendo o ponto único de enumeração das fontes ativas. Aura 2.5 acrescenta uma única gate antes de uma fonte entrar nessa lista:

`auraConditionMatches(state, owner, aura.condition)`

Se a condição for falsa ou contiver uma árvore não suportada, **nenhuma parte da fonte participa**:

- sem Power/Health;
- sem keyword grants;
- sem keyword suppressions;
- sem incremento de source count.

Isso impede estados parciais em que apenas um subefeito da mesma Aura permanecesse ativo.

## Reatividade autoritativa

Condições controller-scoped podem mudar quando:

- Units entram/saem do battlefield;
- mana é paga ou renovada;
- o Nexus recebe dano ou cura;
- triggers de ataque alteram o board antes dos bloqueios;
- uma nova rodada começa.

O facade `engine/semantic-actions.ts` recompõe Continuous Auras depois de transições válidas de:

- `playUnit()`;
- `castSpell()`;
- `declareAttack()`;
- `endTurn()`.

Combate resolvido e activated/Sentinela abilities já convergem pelos cleanups autoritativos que recomputam Auras.

Assim uma condição não fica congelada aguardando outra ação não relacionada.

## Card Studio

O painel de Continuous Aura passa a oferecer uma condição opcional.

O editor expõe somente condições Aura-safe e permite composição AND/OR/NOT. `selfDamaged` não aparece como opção.

A UI diferencia claramente:

- **condição da fonte** — decide se a Aura participa;
- **filtros de raça/classe** — decidem quais Units a Aura afeta.

## Authoring

`validateAuthorableCardWithSemanticTypes()`:

- detecta `aura.condition` como extensão Aura 2.x;
- valida a árvore usando o sanitizer canônico;
- rejeita `selfDamaged` em qualquer profundidade;
- rejeita `null`/payload malformado em vez de convertê-lo silenciosamente para `always`;
- remove `condition` antes de passar pelo sanitizer legado de Permanent Aura;
- restaura somente a árvore sanitizada após a validação histórica.

O sanitizer legado continua inalterado, preservando payloads/replays antigos.

## O que não entra em Aura 2.5

- `selfDamaged` source-relative multi-family;
- condição baseada em stats/keywords do alvo;
- dependências entre uma Aura e o resultado de outra Aura;
- ordenação genérica de layers/sub-layers entre famílias diferentes;
- replacement effects contínuos;
- transformação contínua de tipo, texto ou controller.

A família `aura` continua marcada como **partial** no Ability System 2.0.

## Certificação

`src/game/aura-2-5-conditional-auras.test.ts` cobre:

- shape do contrato público;
- AND/OR/NOT controller-scoped;
- ativação/desativação por raça/classe;
- pagamento de mana desligando a Aura e refresh de rodada religando;
- dano/cura do Nexus alternando grants contínuos;
- composição booleana aninhada;
- runtime fail-closed para `selfDamaged`;
- authoring válido e round-trip da condição;
- rejeição de `selfDamaged`, nested `selfDamaged`, `null` e condition-only sem efeito.
