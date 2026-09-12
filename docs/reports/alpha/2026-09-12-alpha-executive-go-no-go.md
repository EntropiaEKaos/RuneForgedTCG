# Relatório Executivo de Lançamento — RuneForge Alpha

**Data:** 12/09/2026  
**Release candidate:** `2cdee5787042666b8c4747da63d4757abf9f28ba`  
**Status do código:** CERTIFICADO  
**Status do deploy público:** NÃO COMPROVADO

## Decisão executiva

### GO técnico para deployment controlado do Alpha

O RuneForge está tecnicamente apto a ser implantado em um ambiente Alpha controlado utilizando exatamente o SHA certificado acima.

### NO-GO para anúncio de Alpha público neste momento

O bloqueio não é mais código, engine, banco ou Marketplace. O único bloqueio de release público é a ausência de prova do ambiente HTTPS real executando o SHA certificado.

A decisão muda automaticamente para **GO PÚBLICO** quando o checklist de deployment final deste relatório estiver integralmente verde.

---

## Semáforo do Alpha

| Área | Status | Avaliação executiva |
|---|---|---|
| Engine / regras | 🟢 VERDE | Engine madura para Alpha, com regressões e behavior suite certificados. |
| Jornada principal | 🟢 VERDE | Onboarding, decks, mulligan, batalha, resultado, recompensa e progressão cobertos. |
| IA / PvE | 🟢 VERDE | Suficiente para Alpha e para jogadores entrarem sem depender de matchmaking. |
| Casual PvP | 🟢 VERDE | Matchmaking e jornada com dois navegadores certificados. |
| Ranked público | 🟡 FORA DO ESCOPO | Permanece fail-closed e não é requisito do Alpha inicial. |
| Coleção / Vanilla | 🟢 VERDE | Base colecionável e primeira coleção integradas à jornada. |
| Forge / Deck Builder | 🟢 VERDE | Fluxos centrais disponíveis e integrados. |
| Card Studio | 🟢 VERDE | Criação, persistência, publish, sandbox e rollback certificados. |
| Tipos de carta | 🟢 VERDE | Structures, Rituals, Traps, Sentinelas e demais sistemas já certificados. |
| Tooltips / inteligência de carta | 🟢 VERDE | Painéis de inteligência e interações visuais certificados em browser. |
| Segurança de sessão | 🟢 VERDE | Sessão HttpOnly e hardening de identidade ativos. |
| Recovery | 🟢 VERDE | Chave de recuperação one-time, rotação e revogação certificados. |
| Economia | 🟢 VERDE | Gold, Dust e ledger têm contratos claros e gates de banco. |
| Marketplace P2P | 🟢 VERDE | Venda, escrow, concorrência, taxa e ownership por cópia certificados. |
| Troca card-for-card | 🟢 VERDE | Troca direta atômica e escrowed certificada. |
| Antiabuso econômico | 🟢 VERDE | Nível/idade mínima, idempotência, locks, limites e auto-compra bloqueada. |
| Super Admin | 🟢 VERDE | Step-up, auditoria e superfícies sensíveis certificados. |
| PostgreSQL | 🟢 VERDE | Bootstrap, migration, constraints, concurrency e production probes verdes. |
| Build de produção | 🟢 VERDE | Alpha Release Candidate executou build e escopo de produção com sucesso. |
| Balanceamento inicial | 🟡 AMARELO | 3.000 partidas automatizadas passaram, mas jogadores reais ainda precisam gerar telemetria de meta. |
| Conteúdo visual | 🟢 VERDE | Starter Signatures, Structures, Traps e Mana Rituals certificados. |
| Observabilidade de produção | 🟡 AMARELO | Deve ser validada no host final com logs, alertas e persistência reais. |
| Deploy HTTPS real | 🔴 BLOQUEIO | Ainda não foi comprovado um host público executando o SHA certificado. |
| Provenance do deployment | 🔴 BLOQUEIO | Falta comparar o SHA servido em produção com `2cdee578…`. |

---

## Gates já concluídos

### PR #150 — Release Hardening

**Concluído e mergeado.**

Entregou recovery seguro, sessão persistente, provenance de deploy e processo fail-closed.

### PR #151 — Marketplace 1.0

**Concluído, certificado e mergeado.**

Entregou:

- Gold-only marketplace;
- ownership por cópia;
- escrow;
- taxa padrão configurável;
- ledger econômico;
- compra concorrente protegida;
- troca card-for-card;
- controles administrativos;
- migration/backfill;
- integração com packs/crafting/disenchant;
- UI `/market`;
- Studio `/admin/studio/marketplace`.

### CI #941 pós-merge

**SUCCESS** no SHA final.

### Alpha Release Candidate #6

**SUCCESS** no SHA final.

Incluiu `production:verify`, build de produção e certificação do escopo público esperado para o Alpha.

### Balance Evidence

**SUCCESS**, incluindo matriz automatizada de aproximadamente 3.000 jogos.

### Visual certification

**SUCCESS** para:

- Starter Signatures;
- Structures;
- Traps;
- Mana Rituals.

---

## Riscos residuais aceitos para Alpha

Os riscos abaixo não bloqueiam um Alpha controlado, mas precisam ser acompanhados após entrada de jogadores reais.

### Balanceamento vivo

Simulações automatizadas reduzem risco, mas não substituem comportamento humano, descoberta de combos e meta emergente.

**Mitigação:** telemetria, ajustes rápidos e revisão semanal de win rate/pick rate.

### Economia emergente

O Marketplace está transacionalmente protegido, porém preços e concentração de riqueza só poderão ser avaliados com usuários reais.

**Mitigação:** taxa configurável, limites, elegibilidade mínima, audit log e possibilidade de desabilitar o Mercado administrativamente.

### Conteúdo e retenção

O Alpha possui conteúdo suficiente para validar a experiência, mas retenção ainda deve ser medida em campo.

**Mitigação:** cohort de testers, análise de sessões, progressão e taxa de segunda partida.

### Escala

A certificação atual prova correção e concorrência dentro dos cenários cobertos, não uma carga massiva de lançamento comercial.

**Mitigação:** Alpha controlado antes de expansão pública ampla.

---

## Checklist obrigatório para mudar para GO PÚBLICO

Todos os itens abaixo devem ficar verdes no mesmo ambiente real:

- [ ] Conectar o provider de hosting do RuneForge.
- [ ] Identificar o domínio HTTPS final.
- [ ] Confirmar que o deploy usa exatamente `2cdee5787042666b8c4747da63d4757abf9f28ba`.
- [ ] Validar secrets e variáveis de produção sem placeholders.
- [ ] Validar PostgreSQL persistente real.
- [ ] Executar as migrations, incluindo `0043_p2p_marketplace.sql`.
- [ ] Validar `/api/health` via HTTPS.
- [ ] Consultar o endpoint de deployment provenance.
- [ ] Exigir que o SHA reportado seja `2cdee5787042666b8c4747da63d4757abf9f28ba`.
- [ ] Criar conta Alpha real.
- [ ] Validar handoff e guarda da recovery key.
- [ ] Recarregar/reconectar e validar sessão.
- [ ] Abrir pack e verificar ownership persistente.
- [ ] Criar deck e jogar uma partida completa.
- [ ] Confirmar resultado, recompensa e progressão persistidos.
- [ ] Acessar `/market` com conta elegível de teste.
- [ ] Criar um anúncio real em ambiente Alpha.
- [ ] Comprar o anúncio com outro jogador de teste.
- [ ] Confirmar Gold, fee, ownership e ledger.
- [ ] Executar uma troca card-for-card.
- [ ] Reiniciar/reciclar o serviço e provar persistência após restart.
- [ ] Validar logs de erro e ausência de exceções críticas.
- [ ] Confirmar que Ranked público continua fechado.

Quando todos os itens acima forem concluídos, registrar:

`ALPHA PUBLIC DEPLOY CERTIFIED`

---

## Recomendação de rollout

### Fase 1 — Alpha interno

Equipe e contas controladas.

Objetivo: provar deploy, persistência, recovery e operações do Marketplace no ambiente real.

### Fase 2 — Alpha fechado

Grupo pequeno de testers convidados.

Objetivos:

- primeira retenção;
- clareza das regras;
- tempo médio de partida;
- primeira economia real;
- primeiros padrões de Marketplace;
- identificação de exploits não automatizados.

### Fase 3 — Expansão gradual

Aumentar a base somente após estabilidade do ambiente, banco e economia.

Ranked público e dinheiro real continuam fora do requisito desse ciclo.

---

## Critérios de sucesso do Alpha

O Alpha deve responder, com jogadores reais, às seguintes perguntas:

1. Um jogador novo consegue começar sem ajuda externa?
2. Ele entende o objetivo das cartas e da partida?
3. Consegue terminar uma partida sem bloqueios críticos?
4. Entende a recompensa e a progressão?
5. Consegue construir ou ajustar um deck?
6. Deseja jogar uma segunda partida?
7. O Marketplace é compreensível sem conhecimento técnico?
8. A economia permanece consistente após compras/trocas concorrentes?
9. Recovery funciona quando realmente necessário?
10. O sistema permanece operacional por sessões prolongadas?

---

## Decisão final em 12/09/2026

### Código / engenharia

**🟢 GO**

### Deployment controlado para certificação do ambiente

**🟢 GO**

### Alpha fechado após smoke de produção

**🟡 GO CONDICIONAL**

### Anúncio de Alpha público neste instante

**🔴 NO-GO**

**Motivo exclusivo do NO-GO público:** ainda falta comprovar um ambiente HTTPS real executando exatamente o SHA certificado e concluir o smoke operacional desse ambiente.

Não existe, neste momento, um bloqueio crítico conhecido de engine, Marketplace, PostgreSQL, build ou navegador no código certificado.

---

## Próxima decisão

A próxima revisão GO/NO-GO deve ocorrer **imediatamente após a certificação do deployment real**, sem adicionar uma nova grande feature entre o SHA atual e o deploy.

Se o environment provenance corresponder ao SHA certificado e o smoke checklist ficar verde, a recomendação é promover o status para:

**🟢 GO — ALPHA FECHADO / CONTROLADO**

A abertura para um público maior deve ser uma decisão posterior baseada em telemetria real, não em mais desenvolvimento preventivo.
