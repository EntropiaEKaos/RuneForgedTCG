# RuneForge Visual 5.4 — Ranked Competitive Premium

## Objetivo

Dar ao lobby Ranked uma linguagem visual competitiva própria, mais próxima de um circuito premium do que de um painel operacional, sem alterar matchmaking, gates de certificação, temporada, MMR, pool de decks, navegação para a partida ou qualquer autoridade PvP.

## Auditoria que definiu o recorte

Antes da implementação foram revisadas as superfícies sociais/competitivas atuais. `Community`, `Friends` e `Leaderboard` já possuem hierarquia visual, estados vazios, cards, filtros e CTAs maduros. O ganho de maior impacto e menor risco ficou concentrado em `/ranked`.

Por isso, o Visual 5.4 não tenta redesenhar todo o ecossistema social. Ele atua somente no Ranked e deixa Draft para um passe separado, evitando uma mudança ampla sem evidência de necessidade.

## Contratos de DOM usados

A camada se ancora em contratos já presentes em `RankedClient.tsx`:

- `[aria-label="Estado do competitivo"]`
- `[aria-labelledby="rank-card-heading"]`
- `[aria-label="Deck ranqueado certificado"]`
- `[aria-labelledby="ranked-history-heading"]`
- `[aria-labelledby="ranked-leaderboard-heading"]`
- `[aria-labelledby="rank-tiers-heading"]`
- `.ranked-queue-beacon`

Nenhum wrapper, estado de apresentação paralelo ou prop nova foi adicionado ao cliente.

## Direção visual

A superfície passa a usar uma identidade de circuito competitivo com obsidiana, violeta, ouro e ciano. O snapshot operacional ganha leitura por trilhas laterais; a classificação atual vira o hero central; pool e matchmaking formam a zona de decisão; histórico e ranking global viram um par de consoles; e as ligas são tratadas como uma constelação de progressão.

A animação existente de busca recebe apenas um beacon visual e respeita `prefers-reduced-motion`.

## Limites de autoridade

`src/app/ranked/RankedClient.tsx` fica congelado byte a byte no blob `e42eaac7375cf54ee12f581d0916a9d30e6497ad`.

Continuam fora do escopo:

- `GET /api/ranked` e seu snapshot;
- `POST/DELETE /api/matchmaking`;
- expansão da faixa MMR;
- certificação da release Ranked;
- regras, versão do pool e temporada;
- cancelamento de fila;
- redirecionamento para sala PvP;
- engine, API, banco de dados e contratos de partida.

## Arquivos

- `src/app/styles/visual-5-4-ranked-competitive.css` — camada CSS-only;
- `src/app/layout.tsx` — import da camada, depois do Visual 5.3;
- `src/lib/visual-5-4-ranked-competitive-regression.test.ts` — contrato de fonte e congelamento de autoridade;
- `scripts/test-suites.mjs` — registro do source-contract test.

## Certificação esperada

O PR deve passar os mesmos oito gates usados nas fases 5.x anteriores. O merge só deve ocorrer com o head exato certificado. Após o merge, o `main` deve ser revalidado pelos nove workflows de push, incluindo Alpha Release Candidate.

A camada inclui fallback sem `backdrop-filter`, ajuste móvel e redução de movimento. Qualquer falha no cert Mobile com `expected an enabled battlefield action` deve ser diagnosticada pelo artifact antes de atribuição causal, porque o harness possui a flutuação conhecida quando a IA recebe o primeiro turno.