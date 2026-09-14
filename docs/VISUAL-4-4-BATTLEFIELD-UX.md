# RuneForge Visual 4.4 — Battlefield UX

## Objetivo

Visual 4.4 torna a intenção da partida mais legível sem alterar nenhuma regra. A camada usa somente estado já projetado pela UI: fase atual, janela de prioridade, modo de targeting, disponibilidade de habilidades ativadas e pressão potencial do ataque.

## Escopo de apresentação

- Rail de turno com fase ativa semanticamente marcada por `data-phase` e `aria-current="step"`.
- Identidade visual distinta para Principal, Combate, Resposta, turno do oponente e fim de partida.
- Reaction Stack recebe hierarquia de prioridade mais evidente sem mudar resolução, timer ou autoridade.
- Targeting HUD diferencia reação, desafio, bloqueio e Sentinela usando o `data-targeting-mode` já existente.
- Habilidades ativadas prontas e bloqueadas passam a ter contraste de disponibilidade mais claro sem alterar `disabled` ou os contratos de custo.
- Attack Forecast mantém a semântica correta de **pressão potencial antes dos bloqueios** e ganha apenas bandas visuais de intensidade.
- `:focus-visible`, `prefers-reduced-motion`, `data-performance="low"` e `data-fx="reduced"` preservam acessibilidade e fallback.

## Limites de produção

Visual 4.4 não modifica engine, reducer, regras, IA, PvP authority, Ranked, banco, economia, replay ou resolução de combate. `BattleView.tsx` e os três blobs congelados Visual 3.x permanecem intactos.

O único break-glass estrutural é `layout.tsx`, recertificado para carregar `visual-4-4-battlefield-ux.css` depois de `visual-4-0-responsive-battlefield.css`. O freeze guard continua validando os sete blobs explicitamente e registra esse motivo.

## Promoção

Antes de merge:

- full CI;
- source/schema audits;
- behavioral + engine coverage;
- production build;
- HTTP/browser E2E;
- Visual 4.2 notebook density cert;
- Visual 4.3 portrait/landscape responsive cert;
- demais flagship visual certs disparados pelo branch `visual/**`.

Nenhuma promoção deve ocorrer se o head SHA mudar ou se qualquer gate obrigatório estiver vermelho.
