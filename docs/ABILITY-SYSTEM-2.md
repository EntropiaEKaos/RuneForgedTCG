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
- `reaction` — suportado para spells reativos e `reactionActivatedAbilities` de battlefield contra ações pendentes.
- `priority` — janela de rede persistida no Casual PvP para uma oportunidade de resposta autoritativa antes da resolução da ação-base.

`reaction` e `priority` não são sinônimos. `reaction` descreve o timing/legibilidade da resposta; `priority` descreve quem pode responder e por quanto tempo. No PvE a janela continua local ao fluxo autoritativo da partida. No Casual PvP, a janela é persistida em `pvp_rooms.reaction_state`, versionada junto com a sala e recuperável por polling/reconexão. O protocolo PvP v1 certifica uma oportunidade de resposta por ação-base; encadeamento arbitrário de múltiplas respostas humanas ainda permanece fail-closed.

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

Novos campos de transporte são aditivos. Replays históricos sem `modeId`, `costDiscardInstanceIds` ou `responseKind` continuam válidos. A ação histórica `react` permanece o opcode do log de reação; respostas de battlefield acrescentam `responseKind: "activatedAbility"`, `abilityIndex`, `modeId`, target e seleção de descarte apenas quando necessários. O opcode histórico `resolve` é preservado no PvP como passe explícito de prioridade e também como registro determinístico de timeout autoritativo.

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

### Fase 4.5 — Persistent PvP Reaction Priority

O Casual PvP agora persiste a oportunidade de reação em `pvp_rooms.reaction_state`. O estado de jogo continua no snapshot **pré-ação** enquanto a janela está aberta; a ação-base não é resolvida e depois “desfeita”. Isso preserva atomicidade e torna resposta, passe, reconnect e timeout determinísticos.

O contrato v1 registra:

- versão do protocolo;
- ação pendente;
- ator que comprometeu a ação;
- participante que detém prioridade;
- instante de abertura;
- deadline autoritativo.

A abertura e o fechamento passam pelo mesmo `FOR UPDATE`/version CAS já usado pelo room. Cada request mantém receipt idempotente. A abertura incrementa a versão mesmo sem mutar `GameState`, porque muda a autoridade da sala. Enquanto `reaction_state` existe, o ator da ação-base não pode avançar turno, atacar ou enviar outra ação normal.

A resposta pode ser uma magia da mão ou `reactionActivatedAbility`; ambas são revalidadas pelo contrato canônico de reação e resolvidas pela mesma pilha. O passe usa `resolve`. Se o responder desconectar, GET/polling detecta o deadline expirado e resolve o mesmo `resolve` sob row lock no servidor. Assim o cliente não é autoridade do relógio e uma desconexão não bloqueia a partida indefinidamente.

O DTO público orienta `actor`, `responder` e `pendingAction.player` para o participante guest do mesmo modo que já orienta `GameState`, sem alterar IDs estáveis de carta/alvo. O transporte carrega `reactionState` também em respostas 409 para que conflito/reconnect se recupere imediatamente.

Replay PvP reproduz a mesma máquina de estados: a ação-base pode abrir prioridade sem mutar o estado; o `react` ou `resolve` subsequente conclui a transição. Isso preserva a propriedade “mesmas ações + mesmo snapshot = mesmo estado final”.

A UI reutiliza `ReactionStack`: o responder vê opções legais e pode reagir/passar; o ator vê um estado explícito de espera e suas ações normais ficam bloqueadas. Timeout PvP é apenas exibido no cliente — a resolução continua exclusivamente no servidor.

#### Limite explícito do protocolo v1

Este corte certifica **uma oportunidade de resposta por ação-base**. Uma resposta que, por sua vez, deveria abrir nova prioridade humana ainda é rejeitada fail-closed com erro explícito. Encadeamento arbitrário de counters/respostas humanas, múltiplos passes alternados e uma stack multiplayer geral exigem um protocolo v2 próprio antes de serem declarados suportados.

Por esse motivo, `reaction` e `priority` permanecem `partial` na matriz global do Ability System 2.0 mesmo com Casual PvP funcional para o contrato v1. O sistema geral também permanece **PARTIAL**, não `FULL`.

### Próximos cortes

1. Aura 2.0 com efeitos contínuos genéricos além de atributos permanentes;
2. Priority Protocol v2 para cadeias arbitrárias de resposta/pass no PvP;
3. próximos custos selecionáveis, como retorno de permanentes e recursos de futuras zonas, somente quando a respectiva zona/protocolo estiver certificado;
4. expansão de timings/eventos reativos além das ações de carta atuais;
5. certificação transversal e revisão final da matriz de suporte antes de promover qualquer família a `supported`/`FULL`.
