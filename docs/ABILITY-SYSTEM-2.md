# RuneForge Ability System 2.0

## Objetivo

Ability System 2.0 cria uma linguagem única para habilidades sem substituir de uma vez os caminhos de execução já certificados. A evolução permanece incremental: cartas 2.97 continuam válidas, enquanto runtime, Studio, auditorias e novas famílias passam a compartilhar uma gramática canônica.

## Superfícies atuais

A coleção canônica ainda possui superfícies especializadas que representam habilidades de formas diferentes:

1. `CardDef.trigger` — gatilho legado com um `CardEffect`.
2. `CardDef.mechanics` — regras data-driven do Mechanics Studio, com gatilho + condição + efeito.
3. `CardDef.activatedAbilities` — habilidades genéricas ativadas de `mainPhase`, com custo + efeito/modos + limite por rodada.
4. `CardDef.reactionActivatedAbilities` — habilidades voluntárias de battlefield permitidas somente durante uma janela autoritativa de reação.
5. `CardDef.sentinela.abilities` — contrato legado de lealdade das Sentinelas.
6. `CardDef.levelUp` e keywords também representam comportamento de habilidade, mas com estruturas especializadas.

Esses caminhos continuam válidos. O objetivo da gramática é tornar timing, custo, condição, alvo, escolha e composição explícitos e reutilizáveis.

## Gramática canônica

Uma habilidade é projetada para um `AbilityBlueprint` v2:

`Kind + Timing + Trigger + Costs + Condition + Target + Effect + Features`

Campos ausentes são intencionais. Por exemplo, uma keyword não possui custo nem `CardEffect`; um level-up possui progressão em vez de efeito imediato.

### Kinds

- `keyword`
- `static`
- `triggered`
- `activated`
- `reaction`
- `replacement`
- `delayed`
- `modal`
- `transformation`
- `aura`
- `linked`

### Features ortogonais

`conditional` e `chained` não são tratados como kinds mutuamente exclusivos. Uma habilidade pode ser simultaneamente disparada, condicional, encadeada e direcionada. A gramática registra essas propriedades como features:

- `conditional`
- `chained`
- `repeatable`
- `targeted`

### Timing

- `static` — continuamente aplicável enquanto a fonte/regra estiver válida.
- `automatic` — resolução iniciada por gatilho/evento.
- `mainPhase` — ativação voluntária pelo jogador durante a fase principal.
- `combat` — família parcialmente suportada pelos eventos de ataque/bloqueio; authoring genérico ainda não liberado.
- `reaction` — suportado para spells reativos e, neste corte, para `reactionActivatedAbilities` de battlefield contra ações pendentes.
- `priority` — reservado para uma futura janela geral de prioridade, incluindo persistência multiplayer concorrente.

`reaction` e `priority` não são sinônimos. O runtime PvE possui uma janela autoritativa de reação LIFO; o Casual PvP atual ainda não persiste uma janela de prioridade compartilhada no servidor e, portanto, reações humanas de qualquer origem permanecem fail-closed nesse modo até o corte multiplayer específico.

## Custos atualmente executáveis

- mana regular;
- mana de feitiço dedicada;
- vida do Nexus;
- descarte escolhido explicitamente da própria mão;
- exaurir a própria fonte;
- consumir a Barrier ativa da própria Unit;
- sacrificar a própria fonte;
- alteração/pagamento de lealdade.

Mana regular e mana de feitiço são recursos separados. Um custo `spellMana` usa somente `PlayerState.spellMana` e nunca converte nem usa mana regular como fallback. `consumeBarrier` é permitido somente para uma Unit controlada com `barrier === true`; o pagamento remove a Barrier antes de o efeito resolver.

`discardFromHand` exige escolha explícita. A definição armazena a quantidade; o payload autoritativo transporta `costDiscardInstanceIds` com exatamente os `instanceId` escolhidos. O servidor valida quantidade, unicidade e pertencimento à mão antes de qualquer mutação. A remoção acontece antes do efeito, portanto draws e follow-ups observam deterministicamente o estado pós-pagamento.

Outros custos que exigem seleção adicional — como retornar uma permanente escolhida, exilar/consumir recursos de cemitério ou selecionar marcadores — permanecem fora do catálogo authorable até possuírem payload determinístico, validação, execução, IA, replay e browser certification próprios.

## Matriz de suporte

O catálogo diferencia explicitamente:

- `supported` — contrato genérico seguro já disponível;
- `partial` — existe comportamento concreto, mas ainda falta linguagem ou cobertura transversal completa;
- `planned` — reservado na gramática; não deve aparecer como opção publicável no Studio.

Isso impede o Studio de prometer uma habilidade que a engine ainda não consegue resolver de forma autoritativa.

## Compatibilidade

`abilityBlueprintsForCard(card)` continua sendo uma projeção somente-leitura. Ela não altera `CardDef`, seed, decks ou balanceamento.

Novos campos de transporte são aditivos. Replays históricos sem `modeId`, `costDiscardInstanceIds` ou `responseKind` continuam válidos. A ação histórica `react` permanece o opcode do log de reação; respostas de battlefield acrescentam `responseKind: "activatedAbility"`, `abilityIndex`, `modeId`, target e seleção de descarte apenas quando necessários.

## Caminho de evolução

### Fase 1 — Foundation

- vocabulário único;
- adaptadores dos contratos atuais;
- matriz explícita de suporte;
- catálogo exposto ao Studio;
- certificação sobre todo o catálogo.

### Fase 2 — Unified Ability Composer

Card Creator e Mechanics Studio usam componentes/catálogos compartilhados para timing, custo, condição, target, efeito e follow-up. O editor de habilidade ativada não mantém uma gramática paralela.

### Fase 3 — Access Boundary

Todo `/admin/studio/**` e suas APIs ficam disponíveis somente a `admin` e `designer`. QA, publisher e papéis operacionais continuam podendo acessar apenas as superfícies explicitamente necessárias fora do Studio de criação.

### Fase 4 — Runtime expansion

Adicionar uma família por vez, sempre nesta ordem:

1. schema + sanitizer;
2. authoring contract;
3. authoritative execution;
4. legality/targeting;
5. AI;
6. replay/snapshot;
7. apresentação/tooltip/UI;
8. browser certification;
9. somente então disponibilizar ao Studio.

### Fase 4.1 — Modal Activated Abilities

Habilidades modais adicionam escolhas determinísticas às habilidades ativadas. Uma habilidade modal possui lista ordenada de modos com `id` estável, descrição e `CardEffect`; a ativação exige o `modeId` escolhido e rejeita ids ausentes, desconhecidos, duplicados ou definições ambíguas antes de pagar qualquer custo.

Custo, exaustão, sacrifício, lealdade e `maxUsesPerRound` pertencem à habilidade-base e são compartilhados por todos os modos. Cada modo pode usar efeito e target diferentes. O Studio oferece **Escolha um (modal)**, IDs persistentes `mode-N` e até quatro escolhas por habilidade.

`modal` permanece `partial`: custos/condições diferentes por modo e modalidades fora das habilidades ativadas continuam fora do contrato certificado.

### Fase 4.2 — Expanded Activated Ability Costs

`spellMana` e `consumeBarrier` pertencem ao mesmo `ActivatedAbilityCost`. O executor mantém pagamento atômico: modo, target, limites e recursos são validados no estado original antes do clone. Falta de recurso, alvo inválido, Hexproof ou qualquer outra falha preserva o estado integralmente.

A IA considera os novos recursos e o Studio só oferece Barrier a Units. Replays históricos permanecem compatíveis porque esses pagamentos não exigem novo dado selecionável além do próprio contrato de custo.

### Fase 4.3 — Selected Discard Activated Cost

`discardFromHand` mantém a quantidade no blueprint da habilidade-base e exige a seleção concreta em `costDiscardInstanceIds`. Sem IDs explícitos a ativação falha; quantidade incorreta, duplicatas e cartas fora da mão também falham antes de mutação.

No gameplay humano existe seletor dedicado. A IA escolhe deterministicamente cartas de menor valor/custo conforme a política certificada. O Studio publica somente a quantidade, porque a escolha pertence à ação em runtime.

### Fase 4.4 — Reaction Activated Abilities

`CardDef.reactionActivatedAbilities` é uma coleção de timing explícito para fontes persistentes (`Unit`, `Artifact`, `Enchantment` e `Sentinela`). Ela reutiliza `ActivatedAbilityCost`, modos, `maxUsesPerRound` e efeitos do sistema ativado, mas não é executável na main phase. Cada habilidade declara `respondsTo`, uma lista única contendo `unit`, `spell` e/ou `sentinela`, determinando quais famílias de ação adversária podem abrir a oportunidade.

A integração usa a **mesma pilha LIFO autoritativa** já existente para reações de carta. Não existe uma segunda stack nem um motor paralelo de prioridade. Frames de battlefield recebem `responseKind: "activatedAbility"`, eliminando a ambiguidade do opcode histórico `sentinela` sem quebrar ações antigas. `modeId`, target e `costDiscardInstanceIds` continuam aditivos e opcionais.

O runtime valida antes de qualquer pagamento:

- ação pendente realmente adversária;
- `respondsTo` compatível;
- fonte controlada e ainda existente;
- modo válido;
- mana, spell mana, vida, descarte, Barrier, exaustão, sacrifício e lealdade;
- limite de uso por rodada;
- target de board e Hexproof;
- `spellOnStack` somente para `negateSpell` contra uma magia pendente;
- `uncounterable` antes de permitir uma anulação.

Uma resposta não-counter resolve seu efeito no topo da stack antes da ação-base. Uma resposta `negateSpell` legal marca a magia pendente como negada pela mesma resolução LIFO. Custos são reais e pagos antes do efeito; descarte e sacrifício alteram as zonas antes da resolução subsequente.

A IA usa o mesmo contrato de elegibilidade e produz payload determinístico com source, `abilityIndex`, modo, target e cartas descartadas. Replay autoritativo mantém o opcode histórico `react` e diferencia battlefield por `responseKind`, portanto logs antigos continuam válidos.

No PvE humano, `ReactionStack` oferece um picker de **Resposta do campo**. A UI lista somente opções iniciáveis segundo o engine, deriva alvos pelo validador autoritativo, exige exatamente o descarte configurado e envia um payload tipado. O lifecycle revalida esse payload antes de registrá-lo ou resolvê-lo; manipular o DOM não autoriza uma ativação ilegal.

O Card Studio possui painel **Habilidades de reação** com `respondsTo`, efeitos clássicos/modais, custos e limites compartilhados. `spellOnStack` é authorable somente nesse timing. O sanitizer do servidor continua sendo a autoridade final e rejeita fontes não persistentes, timings vazios/duplicados, overrides por modo e combinações inválidas.

#### Limite multiplayer explícito

O servidor atual de Casual PvP não persiste uma janela de prioridade/reação compartilhada. `react`, `resolve` e qualquer transição que tente retornar `awaitingReaction` são rejeitados pelo boundary PvP. Por isso, este corte **não declara suporte de reaction activated abilities no Casual PvP**; a funcionalidade permanece fail-closed nesse modo em vez de simular prioridade apenas no cliente.

O próximo corte multiplayer deverá modelar prioridade pendente no estado/snapshot do room, ownership da janela, CAS/versionamento concorrente, timeout, reconexão, replay e dois browsers antes de habilitar reações humanas PvP.

`reaction` permanece `partial` no Ability System 2.0 mesmo após este corte: a família já é funcional e authorable em PvE/replay/IA, mas prioridade geral, reação multiplayer persistida e futuros eventos/timings reativos ainda não formam uma linguagem universal completa.

### Próximos cortes

1. Aura 2.0 com efeitos contínuos genéricos além de atributos permanentes;
2. prioridade/reação persistida no Casual PvP com concorrência, timeout e reconexão;
3. próximos custos selecionáveis, como retorno de permanentes e recursos de futuras zonas, somente quando a respectiva zona/protocolo estiver certificado;
4. expansão de timings/eventos reativos além das ações de carta atuais;
5. certificação transversal e revisão final da matriz de suporte antes de promover qualquer família a `supported`/`FULL`.