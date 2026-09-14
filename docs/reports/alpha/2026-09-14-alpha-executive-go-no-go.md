# Relatório Executivo GO / NO-GO — RuneForge Alpha

**Data:** 14/09/2026  
**Baseline:** `main@cb0274f86da146e8079037dfaf51ef58c6d2671c`  
**Release:** `2.97.0`  
**Status de engenharia:** CERTIFICADO  
**Status Vercel:** DEPLOY CONCLUÍDO

## Decisão

### 🟢 GO — Alpha fechado / controlado

O RuneForge possui uma baseline pós-merge certificada para iniciar um Alpha fechado/controlado.

A decisão é baseada no SHA exato de `main`, não apenas em checks do PR:

- **9/9 workflows pós-merge verdes**;
- **Alpha Release Candidate #24: PASS**;
- **CI #1116: PASS**;
- **Vercel: success / Deployment has completed**;
- readiness/provenance do RC presos ao SHA exato;
- build de produção, PostgreSQL, browser E2E, mobile/notebook e visual certs verdes.

### 🟡 GO CONDICIONAL — anúncio público amplo

Antes de um anúncio público amplo, executar um smoke simples a partir de uma rede externa comum contra o hostname público atual e confirmar:

1. `/api/health` saudável;
2. Alpha readiness `state=ready`;
3. deployment provenance reportando `cb0274f86da146e8079037dfaf51ef58c6d2671c`.

O ambiente usado nesta revisão não conseguiu resolver o hostname público por DNS e, por isso, essa confirmação externa não é inventada neste relatório. O provider de deploy, o build certificado e o RC estão verdes; não existe falha de código conhecida associada a esse ponto.

### 🟡 FORA DO ESCOPO — Ranked público

Ranked permanece deliberadamente fail-closed e não é requisito para o Alpha inicial.

---

## Semáforo atual

| Área | Status | Decisão |
|---|---|---|
| Engine / regras | 🟢 | GO |
| Jornada PvE | 🟢 | GO |
| Casual PvP | 🟢 | GO |
| Ranked público | 🟡 | Fora do escopo / fechado |
| PostgreSQL / migrations | 🟢 | GO |
| Marketplace / economia | 🟢 | GO controlado |
| Recovery / sessão | 🟢 | GO |
| Card Studio | 🟢 | GO |
| Coleção / Forge / Codex | 🟢 | GO |
| Cosmetics / variantes | 🟢 | GO |
| Balanceamento automatizado | 🟢 | Gate verde; acompanhar humanos |
| Notebook 1280×720 | 🟢 | GO |
| Mobile portrait/landscape | 🟢 | GO |
| Visual 5.0 / 5.1 | 🟢 | GO |
| Build de produção | 🟢 | GO |
| Vercel Production | 🟢 | Deploy concluído |
| Smoke externo do hostname atual | 🟡 | Confirmar antes de anúncio amplo |

---

## Evidência crítica

### Exact-main workflows

Todos verdes no SHA certificado:

- CI `#1116`;
- Alpha Release Candidate `#24`;
- Alpha Starter Balance Evidence `#244`;
- Visual 4.2 Notebook Density `#62`;
- Visual 4.3 Mobile Responsive `#36`;
- Flagship Structures `#378`;
- Flagship Mana Rituals `#375`;
- Flagship Traps `#373`;
- Flagship Starter Signatures `#371`.

### Release Candidate

O manifesto do RC informa `passed=true`, `state=ready` e sete capacidades do Alpha disponíveis:

- onboarding;
- deck selection;
- mulligan;
- PvE;
- Forge/decks persistidos;
- rewards/progressão persistida;
- Casual PvP.

Ranked permanece `rankedOperational=false`.

### Browser / experiência

O CI pós-merge passou a jornada completa em browser, incluindo Marketplace, Studio, recovery, Ranked fail-closed, Casual matchmaking, PvP em dois browsers e isolamento de DTO.

A jornada visual pós-merge também foi preservada como artifact SHA-bound.

---

## O que mudou desde o NO-GO público de 12/09

O relatório de 12/09 estava correto ao bloquear anúncio público porque ainda não existia prova suficiente do deployment real.

Desde então foram concluídos, entre outros:

- Vercel certified deployment com SHA exato;
- resolução do blocker de storage durável;
- certificação da base Neon de produção;
- sync da baseline do Studio;
- variantes cosméticas/serializadas;
- hardening adicional da engine de activated abilities;
- Vanilla 1.9, 1.10 e 1.11;
- Visual 4.0–4.4;
- Visual 5.0;
- Visual 5.1;
- nova certificação pós-merge completa no `main` atual.

Por isso a decisão deixa de ser `NO-GO por infraestrutura` e passa a **GO para Alpha fechado/controlado**.

---

## Riscos aceitos

### Meta humano

Simulações automatizadas não substituem descoberta de combos e padrões de jogadores reais.

**Ação:** medir matchup, win rate, utilização, duração de partida e segunda sessão antes de novo rebalanceamento amplo.

### Economia real

Locks, ownership e transações estão certificados; preço de mercado e concentração econômica dependem de uma comunidade real.

**Ação:** iniciar com coorte pequena e limites operacionais existentes.

### Operação contínua

Um deploy verde não mede semanas de uso.

**Ação:** acompanhar logs, latência, erros, banco e storage durante o Alpha fechado antes de ampliar convites.

---

## Plano recomendado

### Fase A — confirmação externa

Executar o smoke de health/readiness/provenance no host público atual.

### Fase B — Alpha fechado

Liberar para uma coorte pequena e conhecida.

Medir:

- conclusão do onboarding;
- primeira e segunda partidas;
- abandono por etapa;
- duração de match;
- recuperação de conta;
- criação/edição de deck;
- uso do Marketplace;
- erros de browser/API;
- balanceamento e matchup reais.

### Fase C — expansão gradual

Aumentar convites somente após a telemetria da coorte inicial mostrar estabilidade.

Não usar ausência de bugs automatizados como justificativa para abrir Ranked ou pagamentos reais antes dos seus próprios critérios de lançamento.

---

## Decisão final em 14/09/2026

**Código / engenharia:** 🟢 GO  
**Production build / deployment:** 🟢 GO  
**Alpha fechado / controlado:** 🟢 GO  
**Anúncio público amplo:** 🟡 GO CONDICIONAL AO SMOKE EXTERNO DO SHA ATUAL  
**Ranked público:** 🟡 FORA DO ESCOPO / FAIL-CLOSED

A recomendação de produto agora é parar de adicionar grandes features preventivas e começar o ciclo de validação com jogadores reais sobre a baseline certificada.
