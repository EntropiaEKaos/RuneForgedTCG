# RuneForge Ability System 2.0

## Objetivo

Ability System 2.0 cria uma linguagem única para habilidades sem substituir de uma vez os caminhos de execução já certificados. A primeira fase é uma camada de compatibilidade somente-leitura: cartas 2.97 continuam executando pelos contratos atuais, enquanto Studio, auditorias e próximas migrações passam a enxergar uma gramática canônica.

## Problema atual

A coleção canônica usa múltiplas superfícies que representam habilidades de formas diferentes:

1. `CardDef.trigger` — gatilho legado com um `CardEffect`.
2. `CardDef.mechanics` — regras data-driven do Mechanics Studio, com gatilho + condição + efeito.
3. `CardDef.activatedAbilities` — habilidades genéricas ativadas, com custo + efeito + limite por rodada.
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
- vida do Nexus;
- exaurir a própria fonte;
- sacrificar a própria fonte;
- alteração/pagamento de lealdade.

Custos novos como descarte, retorno à mão, cemitério, consumo de Barrier e marcadores só devem entrar no catálogo authorable depois de terem validação, execução autoritativa, IA, replay e testes.

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
