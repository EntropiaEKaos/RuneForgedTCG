# Visual 5.2 — Player Journey Premium

## Objetivo

Elevar a jornada certificada do Alpha ao mesmo nível de acabamento já entregue pela Visual 5.0 (arena) e Visual 5.1 (metagame), sem criar nova autoridade de produto.

A Visual 5.2 atua somente nos estados de entrada, decisão e encerramento que circundam a partida. Ela não altera engine, regras, reducer, matchmaking, economia, persistência, APIs ou o DOM estrutural do battlefield.

## Evidência que originou esta passada

O `alpha-visual-journey` já certifica uma sequência completa de screenshots. Depois da promoção da 5.0 e 5.1, os seguintes estágios ainda não tinham uma camada premium equivalente:

- `00-recovery-key-handoff.png` — handoff da chave de recuperação;
- `01-first-run-onboarding.png` — primeiro acesso;
- `02-deck-selection.png` — seleção de deck;
- `03-mulligan.png` — mulligan;
- `04-first-match-guide.png` — briefing da primeira partida;
- `11-return-to-play.png` — retorno ao lobby de batalha;
- `12-match-result.png` — resultado da partida;
- `13-post-match-return.png` — retorno pós-partida.

Esses screenshots formam uma jornada visual coerente entre metagame e arena e são o escopo da 5.2.

## Camada

Arquivo:

`src/app/styles/visual-5-2-player-journey.css`

Carregamento:

- depois de Visual 5.0;
- depois de Visual 5.1;
- sem substituir Visual 3.x;
- sem tocar em `BattleView`, `ArenaIdentity` ou geometria da arena.

## Superfícies

### Recovery handoff

Contrato existente:

`[role="dialog"][aria-labelledby="recovery-key-title"]`

Ajustes:

- material escuro/ciano coerente com segurança de conta;
- contraste e hierarquia do código de recuperação;
- backdrop mais forte;
- fallback quando `backdrop-filter` não está disponível.

### First-run onboarding

Contrato existente e único:

`.rf-app-page:has(> .rf-app-shell.max-w-5xl)`

Ajustes:

- hero premium em obsidiana forjada;
- ouro rúnico como foco de entrada;
- grid sutil de Nexus;
- passos do treinamento tratados como módulos de progressão;
- nenhuma mudança no fluxo ou storage do onboarding.

### Deck selection

Contrato existente:

`.deck-select-page`

Ajustes:

- maior hierarquia dos deck cards;
- seleção mais explícita;
- materiais coerentes entre identidade, doutrina, perfil e dificuldade;
- CTA final em rail flutuante/sticky, sem mudar a ação `onStart`;
- retorno pós-partida usa o mesmo visual, evitando uma segunda linguagem de lobby.

### Mulligan

Contratos existentes:

- `section[aria-label="Análise da mão inicial"]`;
- `section[aria-labelledby="mulligan-hand-title"]`;
- `section[aria-label="Confirmar mulligan"]`.

Ajustes:

- análise e conselheiro com melhor separação material;
- mão inicial tratada como área de decisão;
- hover somente de apresentação;
- confirmação final visualmente isolada;
- nenhum efeito sobre a seleção ou confirmação autoritativa.

### First-match guide

Contrato existente:

`.match-guide-backdrop` / `.match-guide-card`

Ajustes:

- briefing com material premium e foco rúnico;
- progresso e iconografia reforçados;
- nenhuma mudança nos passos, textos, storage ou callbacks.

### Match result

Contrato existente:

`.match-result-backdrop` / `.match-result-card`

Ajustes:

- material alinhado ao resto da Visual 5.x;
- scoreboard, stats, mastery e rewards com hierarquia mais coesa;
- ações finais separadas visualmente;
- sem alteração de reward settlement, mastery ou resultado.

## Não escopo

Visual 5.2 não altera:

- engine/reducer/rules;
- PvE/PvP/Ranked authority;
- match token, replay ou settlement;
- APIs, DTOs, banco ou migrations;
- economia, rewards ou Marketplace;
- `BattleView.tsx`;
- `CardView.tsx`;
- `ArenaIdentity.tsx`;
- `.tcg-arena`, `.player-hand-shell` ou `.tcg-actions`;
- Visual 3.x congelada;
- Visual 5.0 arena identity;
- Visual 5.1 Collection/Forge/Modes/Profile/Codex.

## Acessibilidade e compatibilidade

A camada inclui:

- `prefers-reduced-motion`;
- fallback sem `backdrop-filter`;
- ajuste mobile abaixo de 720 px;
- nenhum texto essencial inserido via CSS, exceto decoração não funcional;
- preservação dos contratos ARIA existentes.

## Freeze break-glass

`layout.tsx` é recertificado apenas para montar a nova camada depois da Visual 5.1. Todos os demais blobs estruturais congelados permanecem byte-for-byte iguais.

## Gate de promoção

A Visual 5.2 só pode ser promovida ao `main` depois de:

1. source-contract Visual 5.2 verde;
2. Alpha Visual Feature Freeze verde;
3. typecheck e lint verdes;
4. behavioral suite e engine coverage verdes;
5. PostgreSQL/build verdes;
6. browser E2E verde;
7. Visual 4.2 Notebook Density verde;
8. Visual 4.3 Mobile Responsive verde;
9. quatro flagship visual certs verdes;
10. Alpha Starter Balance Evidence verde;
11. inspeção manual do artifact `alpha-visual-journey-*`, com foco em `00`, `01`, `02`, `03`, `04`, `11`, `12` e `13`;
12. merge protegido pelo SHA exato do PR.
