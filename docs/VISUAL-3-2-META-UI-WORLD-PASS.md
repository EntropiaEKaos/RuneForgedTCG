# Visual 3.2 — Meta UI World Pass

## Objetivo

Fazer as superfícies meta do Alpha parecerem lugares distintos dentro do Nexus, e não uma sequência de dashboards escuros com o mesmo acabamento.

O passe é estritamente de apresentação. Ele não altera regras, estado de jogador, APIs, persistência, networking, engine, `CardView`, battlefield, hand zones ou autoridade de gameplay.

## Destinos certificados

O Visual 3.2 atua somente sobre cinco destinos player-facing que já possuem contratos de DOM estáveis:

- **Coleção** — `aria-label="Resumo da coleção"`; linguagem de arquivo/cofre, ciano e linhas de acervo.
- **Forja** — `aria-label="Resumo da Forja"`; linguagem de oficina/arsenal, âmbar e calor de forja.
- **Modos** — `.modes-page`; linguagem de mapa/campanha, verde-ciano e malha cartográfica.
- **Perfil** — `aria-label="Resumo de progressão"`; linguagem de salão/reputação, ouro e identidade do forjador.
- **Codex** — `.codex-page`; linguagem de arquivo arcano, ciano/índigo e geometria de conhecimento.

A identidade de rota é inferida somente desses contratos de apresentação já existentes. A folha CSS não consulta router, player state ou game state.

## Linguagem compartilhada

As cinco superfícies recebem:

- mapa rúnico do Nexus discretamente gravado ao fundo;
- iluminação ambiental específica por destino;
- grande sigilo decorativo de rota sem interação (`pointer-events: none`);
- cabeçalhos tratados como placas de entrada da localização;
- painéis translúcidos integrados ao ambiente;
- destaques direcionais nos cards de resumo;
- microtexturas próprias por destino;
- preservação do ouro RuneForge como linguagem de ação primária.

A camada inclui comportamento responsivo para 920px/640px e respeita `prefers-reduced-motion`.

## Fronteira de engenharia

`src/lib/visual-3-2-meta-world-regression.test.ts` fecha o escopo. O teste exige:

- import da camada 3.2 depois do Visual 3.1;
- existência dos cinco contratos player-facing;
- identidade visual para os cinco destinos;
- mapa/sigilo/atmosfera, mobile e reduced-motion;
- manutenção do `SiteNav` compartilhado;
- ausência de seletores de battlefield, hand ou card shell;
- ausência de `fetch`, `dispatch`, storage, `playUnit` ou `castSpell` na camada de apresentação.

O teste é classificado como `sourceContractTests` em `scripts/test-suites.mjs` para que a taxonomy CI continue fail-closed.

## Gate visual de merge

CI verde não é suficiente. Antes do merge, o artifact `alpha-visual-journey-*` deve ser baixado, ter digest SHA-256 verificado e passar inspeção manual dos seguintes screenshots:

1. `06-collection.png`
2. `07-forge.png`
3. `08-modes.png`
4. `09-profile.png`
5. `10-codex.png`

A inspeção deve confirmar:

- conteúdo e ações continuam legíveis;
- nenhum painel ou botão foi cortado;
- navegação permanece íntegra;
- cada destino possui identidade visual reconhecível;
- o world layer não invade cards, battlefield ou tooltip;
- não há regressão evidente em viewport desktop.

Somente após essa aprovação o PR pode ser squash-mergeado. Em seguida, a CI completa e o artifact visual devem ser repetidos no SHA definitivo da `main`.
