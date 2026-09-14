# Visual 5.1 — Metagame Premium

## Objetivo

Elevar as superfícies player-facing fora da partida ao mesmo nível de acabamento da identidade cinematográfica Visual 5.0, sem criar estado, mecânica ou autoridade nova.

A 5.1 é uma camada estritamente de apresentação sobre os contratos já certificados pelo Visual 3.2. Ela reutiliza a identidade de destino existente (`--rf-world-accent`) e transforma cabeçalhos, painéis, resumo, filtros e superfícies interativas em materiais de obsidiana forjada, metal escuro e energia regional controlada.

## Destinos certificados

A camada atua somente nos cinco destinos meta que já possuem contratos estáveis:

- **Coleção** — `aria-label="Resumo da coleção"`;
- **Forja** — `aria-label="Resumo da Forja"`;
- **Modos** — `.modes-page`;
- **Perfil** — `aria-label="Resumo de progressão"`;
- **Codex** — `.codex-page`.

Nenhuma rota, API ou estado de jogador é introduzido para detectar identidade visual.

## Escopo visual

- cabeçalhos passam a funcionar como placas premium de entrada do destino;
- painéis recebem profundidade material, bordas mais refinadas e integração com o accent do mundo;
- cards de resumo ganham leitura de contador premium sem alterar conteúdo ou grid;
- inputs e filtros ganham foco acessível e acabamento coerente;
- ações secundárias recebem resposta de metal/energia sem competir com o ouro das ações primárias;
- a Coleção ganha uma prateleira visual mais nobre para cartas selecionáveis e showcase de coleções;
- Modos e Codex ganham feedback premium em tiles já interativos;
- mobile reduz densidade e altura sem mudar a ordem do conteúdo;
- `prefers-reduced-motion` remove transformações/transições não essenciais;
- navegadores sem `backdrop-filter` recebem fallback opaco legível.

## Fronteira de engenharia

Não há alteração em:

- engine, reducer, regras ou IA;
- PvP, Ranked, replay ou matchmaking;
- APIs, DTOs, backend, persistência ou banco;
- economia, craft, coleção autoritativa ou catálogo;
- `BattleView.tsx`, `CardView.tsx` ou `ArenaIdentity.tsx`;
- folhas congeladas Visual 3.0, 3.1 e 3.2.

O único break-glass do Alpha Visual Feature Freeze é `layout.tsx`, necessário para montar `visual-5-1-metagame-premium.css` **depois** da Visual 5.0. O hash de blob do layout é recertificado explicitamente em `alpha-visual-feature-freeze-regression.test.ts`.

`src/lib/visual-5-1-metagame-premium-regression.test.ts` fecha o escopo e falha se a camada perder qualquer um dos cinco destinos, se deixar de oferecer os contratos de acessibilidade/fallback ou se invadir tokens ligados a batalha, cartas estruturais, storage, rede ou dispatch.

## Gate de promoção

A Visual 5.1 só pode ser promovida ao `main` com o SHA exato do PR após:

1. CI completo verde, incluindo taxonomy, audits, typecheck e lint;
2. behavioral suite e cobertura da engine verdes;
3. probes PostgreSQL e production build verdes;
4. HTTP/browser E2E verde;
5. Visual 4.2 Notebook Density Cert verde;
6. Visual 4.3 Mobile Responsive Cert verde;
7. quatro flagship visual certs verdes;
8. Alpha Starter Balance Evidence verde;
9. inspeção dos screenshots player-facing do Alpha Visual Journey, especialmente Coleção, Forja, Modos, Perfil e Codex;
10. merge protegido pelo SHA exato do head aprovado.

## Critério visual de revisão

A revisão deve confirmar que:

- nenhuma ação ou texto perdeu contraste/legibilidade;
- cards reais continuam protagonistas nas superfícies em que aparecem;
- o ouro continua reservado à hierarquia de ação primária;
- cada destino preserva sua cor/identidade Visual 3.2;
- não existe clipping novo em desktop, notebook ou mobile;
- o acabamento premium não cria ruído visual em grids densos;
- hover/focus não deslocam layout nem escondem affordances;
- reduced-motion permanece estável e funcional.
