# RuneForge Ability System 2.0

## Objetivo

Ability System 2.0 cria uma linguagem única para habilidades sem substituir de uma vez os caminhos de execução já certificados. A primeira fase é uma camada de compatibilidade somente-leitura: cartas 2.97 continuam executando pelos contratos atuais, enquanto Studio, auditorias e próximas migrações passam a enxergar uma gramática canônica.

## Problema atual

A coleção canônica usa múltiplas superfícies que representam habilidades de formas diferentes:

1. `CardDef.trigger` — gatilho legado com um `CardEffect`.
2. `CardDef.mechanics` — regras data-driven do Mechanics Studio, com gatilho + condição + efeito.
3. `CardDef.activatedAbilities` — habilidades genéricas ativadas, com custo + efeito/modos + limite por rodada.
4. `CardDef.sentinela.abilities` — contrato legado de lealdade das Sentinelas.
5. `CardDef.levelUp` e keywords também representam comportamento de habilidade, mas com estruturas especializadas.

Esses caminhos continuam válidos e autoritativos. O problema é de linguagem e authoring: timing, custo, condição, alvo e composição não são descritos por um vocabulário comum.

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

`conditional` e `chained` não são tratados como kinds mutuamente exclusivos: uma habilidade pode ser simultaneamente disparada, condicional, encadeada e direcionada. A gramática registra essas propriedades como features:

- `conditional`
- `chained`
- `repeatable`
- `targeted`

### Timing

- `static` — continuamente aplicável enquanto a fonte/regra estiver válida.
- `automatic` — resolução iniciada por gatilho/evento.
- `mainPhase` — ativação pelo jogador na janela principal atualmente suportada.
- `combat` — família parcialmente suportada pelos eventos de ataque/bloqueio; authoring genérico ainda não liberado.
- `reaction` — protocolo já existe para reações de spells, porém habilidades genéricas de reação ainda não estão liberadas.
- `priority` — reservado para uma futura janela geral de prioridade.

### Custos atualmente executáveis

- mana regular;
- mana de feitiço dedicada;
- vida do Nexus;
- exaurir a própria fonte;
- consumir a Barrier ativa da própria Unit;
- sacrificar a própria fonte;
- alteração/pagamento de lealdade.

Mana regular e mana de feitiço são recursos separados. Um custo `spellMana` usa somente o banco de `PlayerState.spellMana` e nunca converte nem usa mana regular como fallback. `consumeBarrier` é permitido somente para uma Unit controlada com `barrier === true`; o pagamento remove a Barrier antes de o efeito resolver, da mesma forma que o runtime já consome essa proteção ao bloquear dano.

Custos que exigem escolha adicional — como descartar uma carta específica da mão, retornar uma permanente escolhida, exilar/consumir recursos de cemitério ou selecionar marcadores — permanecem fora do catálogo authorable até possuírem payload determinístico, validação, execução autoritativa, IA, replay e browser certification próprios.

## Matriz de suporte

O catálogo diferencia explicitamente:

- `supported` — contrato genérico seguro já disponível;
- `partial` — existe comportamento concreto na engine, mas não uma linguagem genérica completa para designers;
- `planned` — reservado na gramática; não deve aparecer como opção publicável no Studio.

Isso impede o Studio de prometer uma habilidade que a engine ainda não consegue resolver de forma autoritativa.

## Compatibilidade

`abilityBlueprintsForCard(card)` é uma projeção somente-leitura. Ela não altera `CardDef`, não muda replay, seed, regras, decks ou balanceamento.

A certificação percorre as 429 cartas canônicas e garante que toda superfície de habilidade existente seja representada na projeção sem mutação.

## Caminho de evolução

### Fase 1 — Foundation

- vocabulário único;
- adaptadores dos contratos atuais;
- matriz explícita de suporte;
- catálogo exposto ao Studio;
- certificação sobre todo o catálogo.

### Fase 2 — Unified Ability Composer

Card Creator e Mechanics Studio passam a usar os mesmos componentes/catálogos para timing, custo, condição, target, efeito e follow-up. O editor de habilidade ativada deixa de duplicar lógica.

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
7. apresentação/tooltip;
8. browser certification;
9. somente então disponibilizar ao Studio.

As primeiras candidatas naturais são habilidades modais, custos alternativos adicionais e reações ativadas, porque aumentam decisões sem exigir centenas de novos efeitos primitivos.

### Fase 4.1 — Modal Activated Abilities

Habilidades modais adicionam escolhas determinísticas às habilidades ativadas sem alterar o opcode histórico de replay/PvP. Uma habilidade modal possui uma lista ordenada de modos com `id` estável, descrição e `CardEffect`; a ativação autoritativa exige o `modeId` escolhido e rejeita de forma fail-closed ids ausentes, desconhecidos, duplicados ou definições ambíguas antes de pagar qualquer custo.

O custo, a exaustão, o sacrifício, a lealdade e o `maxUsesPerRound` pertencem à habilidade-base e são compartilhados por todos os modos. Cada modo pode usar um efeito e um `target` diferentes porque o targeting é derivado do próprio `CardEffect`. O transporte continua usando a ação 2.97 `sentinela`, agora com `modeId` opcional para preservar replays históricos de habilidades não modais.

O corte runtime cobre execução autoritativa, reducer/replay/PvP, seleção e encaminhamento de modo na UI de partida, apresentação/tooltip, projeção `AbilityBlueprint`, IA determinística e regressões. O corte de authoring adiciona ao Card Studio a opção **Escolha um (modal)**, IDs persistentes `mode-N`, até quatro escolhas por habilidade e o mesmo compositor semântico de `CardEffect` usado pelas demais superfícies. O sanitizer do servidor é a autoridade final: rejeita `effect + modes`, modos vazios, ids inválidos/duplicados, overrides de custo/limite por modo, stack targeting ainda não suportado e conflitos entre custos da habilidade-base e qualquer modo.

A certificação do authoring deve provar sanitização, round-trip de persistência, publish/catalog/runtime e superfície do Studio. `modal` permanece `partial` mesmo depois desse authoring: custos e condições diferentes por modo, modos dependentes de prioridade/reação e outras formas modais fora de habilidades ativadas ainda não pertencem ao contrato certificado.

### Fase 4.2 — Expanded Activated Ability Costs

O primeiro corte de custos alternativos adiciona `spellMana` e `consumeBarrier` ao mesmo `ActivatedAbilityCost` usado por runtime, IA, projeção e Studio. Não existe um segundo formato de custo e o opcode histórico de replay/PvP não muda, porque nenhum dos dois pagamentos exige informação adicional na ação do jogador.

O executor mantém pagamento atômico: modo, target, limites de uso e todos os recursos são validados no estado original antes do clone. Somente uma ativação integralmente legal cria o próximo estado e debita custos. Portanto, falta de mana de feitiço, ausência de Barrier, alvo inválido, Hexproof ou qualquer outra falha preserva mana regular, mana de feitiço, Barrier, vida, lealdade, uso por rodada e o restante do estado sem rollback manual.

`spellMana` é um recurso finito independente e também conta como custo consumidor para habilidades sem limite por rodada. `consumeBarrier` conta como custo consumidor, mas naturalmente bloqueia a próxima ativação da mesma fonte até que uma nova Barrier seja concedida. O Studio expõe mana de feitiço para fontes persistentes suportadas e o custo de Barrier apenas para Units; o sanitizer continua sendo a autoridade final e rejeita payloads que tentem usar Barrier em Artifact, Enchantment ou Sentinela.

A IA não ignora os novos recursos: elegibilidade continua vindo do executor autoritativo e a função de score penaliza o gasto de mana de feitiço e o valor defensivo perdido ao consumir Barrier. Como esse corte não adiciona escolha de carta/recurso externo, replays históricos e ações 2.97 permanecem byte-shape compatíveis.

Esse corte não torna o Ability System 2.0 inteiro `FULL`. Descarte escolhido, custos de retorno, cemitério/exílio, marcadores e custos dependentes de seleção permanecem para evoluções próprias; modalidades ainda são `partial`, e Aura continua `partial` até Aura 2.0.

### Próximos cortes

1. habilidades ativadas de reação/evento integradas ao protocolo autoritativo;
2. Aura 2.0 com efeitos contínuos genéricos além de atributos permanentes;
3. custos que exigem seleção/payload adicional, em cortes próprios e replay-safe;
4. certificação transversal e revisão final da matriz de suporte antes de promover qualquer família a `supported`/`FULL`.
