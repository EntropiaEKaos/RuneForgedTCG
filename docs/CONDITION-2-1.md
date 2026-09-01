# Condition System 2.1 — Opponent Nexus Threshold

## Objetivo

Condition System 2.1 amplia o vocabulário autoritativo de `MechanicCondition` com uma folha controller-scoped para consultar a vida do Nexus adversário:

```ts
{ kind: "opponentNexusBelow", amount: 10 }
```

A condição é verdadeira quando o oponente do controlador da fonte possui `nexusHealth <= amount`.

Ela atende padrões de design como:

- “Enquanto o Nexus inimigo tiver 10 ou menos...”;
- “Se o adversário estiver em alcance de execução...”;
- “Enquanto o oponente estiver abaixo do limite, outras unidades recebem +1/+0.”

## Semântica autoritativa

A orientação é sempre relativa ao controlador da fonte:

- fonte controlada por `player` consulta `state.players.ai.nexusHealth`;
- fonte controlada por `ai` consulta `state.players.player.nexusHealth`.

O limite é inclusivo. Portanto `amount: 10` é verdadeiro para Nexus em 10, 9, 8 etc.

`nexusBelow` não muda de significado: ele continua consultando o Nexus do próprio controlador. As duas folhas são deliberadamente distintas.

## Authoring e sanitização

`MECHANIC_CONDITION_KINDS` passa a incluir `opponentNexusBelow`.

O sanitizer canônico reutiliza o mesmo domínio numérico de `nexusBelow` e `manaAtLeast`:

- números são normalizados para inteiro;
- mínimo `0`;
- máximo `20`;
- árvores continuam limitadas pelo mesmo depth/group contract;
- nós desconhecidos continuam fail-closed.

`condition-contract.ts` deriva suporte e limites do sanitizer, portanto Ability Grammar e Studio não mantêm uma segunda definição independente.

## Runtime de Mechanics

`mechanicConditionMatches()` avalia a folha usando `other(unit.owner)`.

Isso mantém o runtime de custom mechanics determinístico e simétrico para player/AI. A folha pode ser usada em qualquer posição válida de `and`, `or` e `not`.

## Runtime de Aura

`AURA_CONDITION_KINDS` também passa a incluir `opponentNexusBelow` porque a condição depende apenas de estado do controlador/oponente e não de target nem de outra camada contínua.

`auraConditionMatches()` resolve o adversário a partir de `sourceOwner`. Assim o mesmo payload funciona em:

- Enchantment / Artifact;
- Unit-source lord effects;
- Sentinela command Auras.

Aura 2.7 permanece intacta: `selfDamaged` continua exclusivo de Unit-source. Condition 2.1 não amplia essa exceção.

Dano/cura do Nexus já convergem pelos boundaries autoritativos que recompõem Auras condicionais, portanto atravessar o threshold liga/desliga a fonte no mesmo fluxo certificado.

## Card Studio

Os dois editores de condição passam a oferecer a nova folha:

- Mechanics / Ability composer;
- Continuous Aura condition editor.

A UI diferencia explicitamente:

- `nexusBelow` → seu Nexus ≤ X;
- `opponentNexusBelow` → Nexus inimigo ≤ X;
- `manaAtLeast` → Mana ≥ X.

Composição recursiva AND/OR/NOT continua usando os limites derivados do backend.

## Ability Grammar

`ABILITY_GRAMMAR_CATALOG.conditions` usa `MECHANIC_CONDITION_KINDS`, e `conditionContracts` usa `CONDITION_RUNTIME_SUPPORT`. Por isso a nova folha entra automaticamente no catálogo como `supported` sem criar outro rule kind.

Blueprints condicionais continuam preservando a árvore real e marcando `features: ["conditional"]` quando aplicável.

## Compatibilidade

Condition 2.1 não cria:

- novo `CardType`;
- novo formato de replay/DTO;
- nova zona;
- nova família de Aura;
- dependência entre continuous layers;
- target-relative condition.

Replays/cartas antigas sem a folha permanecem estruturalmente idênticos. `nexusBelow`, `selfDamaged` e toda composição existente preservam a semântica anterior.

## Certificação

`src/game/condition-2-1-opponent-nexus-threshold.test.ts` cobre:

- catálogo/suporte canônico;
- clamp 0..20 e fail-closed de kind desconhecido;
- orientação player → AI e AI → player;
- threshold inclusivo;
- independência do próprio Nexus;
- composição AND/NOT;
- Aura de player e de AI;
- transição real por `damageNexus`/`castSpell`;
- authoring semântico;
- projeção pela Ability Grammar;
- preservação explícita da semântica de `nexusBelow`.

A suíte é registrada como o 68º alvo comportamental do repositório neste corte.
