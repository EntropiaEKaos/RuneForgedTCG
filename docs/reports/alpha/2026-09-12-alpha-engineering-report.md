# Relatório de Engenharia — RuneForge Alpha

**Data:** 12/09/2026  
**Projeto:** RuneForge / RuneForgedTCG  
**Repositório:** `EntropiaEKaos/RuneForgedTCG`  
**Branch oficial:** `main`  
**SHA certificado:** `2cdee5787042666b8c4747da63d4757abf9f28ba`

## 1. Resumo executivo técnico

O RuneForge atingiu o estado de **Release Candidate de Alpha certificado em código**. O ciclo de hardening de release e o Marketplace P2P foram implementados, certificados em PR, mergeados por squash e novamente certificados no SHA exato que permanece na `main`.

O escopo técnico atual cobre engine, jornada Alpha, coleção, Forge, Deck Builder, Card Studio, economia, packs, recovery seguro, PvP casual, E2E em navegador, PostgreSQL real, Marketplace P2P e certificações visuais.

A única fronteira ainda não comprovada por este relatório é o **deploy HTTPS público real executando o SHA certificado**. Portanto, o código está pronto para deployment Alpha; a publicação pública definitiva depende da prova de provenance e smoke tests no ambiente real.

## 2. Release Hardening

O PR `#150 — Alpha Release Hardening: secure recovery + certified deploy` consolidou a camada de segurança e rastreabilidade necessária para o Alpha.

Principais entregas:

- sessão persistente baseada em cookie HttpOnly;
- recovery de jogador com rotação de credencial e revogação de sessões anteriores;
- chave de recuperação entregue como handoff único, sem persistência em Web Storage;
- certificação visual ajustada ao fluxo de recovery;
- deploy fail-closed com SHA explícito;
- endpoint de provenance de deployment;
- documentação operacional de deployment certificado.

O merge definitivo do hardening gerou a base certificada anterior ao Marketplace:

`8c634c6cc20435e941bdc026253f9b9bc79dbaeb`

Essa base passou por CI completa e Alpha Release Candidate antes de receber o Marketplace.

## 3. Marketplace P2P 1.0

O PR `#151 — Alpha Marketplace 1.0: Gold trading + escrowed card trades` adicionou o sistema econômico P2P do RuneForge.

### 3.1 Modelo de propriedade por cópia

Foi introduzido o conceito de `card_assets`, permitindo que cada cópia colecionável tenha identidade própria e metadados independentes do `defId` de gameplay.

Cada ativo pode registrar:

- proprietário;
- definição da carta;
- `variant_id`;
- `frame_id`;
- `finish`;
- condição `tradable`;
- origem de aquisição;
- timestamp de aquisição.

Essa arquitetura permite que duas cartas idênticas em gameplay tenham valores colecionáveis diferentes, criando a base para frames raros, versões promocionais e acabamentos especiais.

### 3.2 Venda por Gold

O Marketplace utiliza exclusivamente Gold interno do RuneForge.

Dust permanece não transferível.

O fluxo de venda implementa:

- criação de anúncio;
- validação de preço inteiro;
- limite de anúncios;
- escrow da cópia;
- impedimento de auto-compra;
- trava da linha do anúncio;
- locks determinísticos dos jogadores;
- débito do comprador;
- crédito líquido do vendedor;
- taxa econômica configurável;
- atualização do ownership por cópia;
- atualização do agregado `player_cards`;
- ledger econômico para comprador e vendedor;
- operação idempotente por `X-Operation-Id`.

A taxa padrão configurada para o Alpha é de aproximadamente **5%**, administrável pelo Studio.

### 3.3 Escrow

A tabela de locks utiliza uma única linha por asset, garantindo que uma cópia não participe simultaneamente de mais de uma operação.

O escrow impede, entre outros casos:

- listar a mesma carta duas vezes;
- negociar uma carta já listada;
- desencantar uma carta em negociação;
- transferir uma cópia já bloqueada;
- vender a mesma cópia para dois compradores.

### 3.4 Compra concorrente

O E2E do Marketplace cria dois compradores e dispara compras concorrentes contra o mesmo anúncio.

Contrato certificado:

**exatamente um comprador deve vencer.**

Após a operação, o teste valida:

- status vendido;
- comprador vencedor;
- ownership da cópia;
- saldo do vendedor;
- ledger do comprador;
- ledger do vendedor;
- ausência de duplicação econômica.

### 3.5 Trocas diretas

O sistema também implementa troca direta card-for-card.

A oferta contém:

- jogador proponente;
- jogador destinatário;
- assets ofertados;
- especificações dos assets pedidos;
- status;
- timestamps;
- prazo de expiração.

No aceite:

- a oferta é travada;
- os jogadores são travados em ordem determinística;
- o ownership é revalidado;
- os escrows são revalidados;
- as cartas pedidas são selecionadas e travadas dentro da transação;
- o limite de duplicatas é verificado;
- as transferências dos dois lados são atômicas;
- os agregados de coleção são atualizados;
- o escrow é liberado.

Cancelar e aceitar competem pela mesma oferta travada, impedindo estados de aceite e cancelamento simultâneos.

### 3.6 Proteção antiabuso

Defaults atuais do Alpha:

- nível mínimo: `2`;
- idade mínima da conta: `24h`;
- Gold somente interno;
- sem cash-out;
- Dust não transferível;
- compra própria bloqueada;
- limite de preço;
- limite de anúncios ativos;
- limite de cartas por troca;
- rate limit;
- idempotência;
- audit log administrativo.

As leituras e mutações de `/api/market` e `/api/trades` respeitam o gate de elegibilidade.

### 3.7 Integração com coleção

O modelo por cópia foi conectado aos principais pontos de criação/destruição de cartas:

- packs;
- crafting;
- disenchant;
- migration/backfill de coleções já existentes.

O backfill cria somente a diferença entre o agregado `player_cards.count` e as cópias já existentes em `card_assets`, tornando a migration replay-safe.

## 4. Administração do Marketplace

Foi criado o painel:

`/admin/studio/marketplace`

Capacidades administrativas incluem:

- habilitar/desabilitar o Marketplace;
- configurar `fee_bps`;
- preço mínimo/máximo;
- limite de anúncios ativos;
- duração de anúncio;
- duração de troca;
- número máximo de cartas por lado;
- nível mínimo;
- idade mínima da conta;
- telemetria de anúncios/vendas/trocas.

Alterações sensíveis exigem step-up administrativo e são registradas em audit log.

## 5. Interface do jogador

Rota principal:

`/market`

A interface contém:

- Mercado;
- Meu acervo;
- Meus anúncios;
- Trocas diretas;
- Histórico.

A criação de troca utiliza catálogo público e seleção legível por nome/raridade/região; `defId` permanece apenas como identificador interno.

## 6. Banco de dados e migration

Migration principal:

`drizzle/0043_p2p_marketplace.sql`

Tabelas centrais:

- `card_assets`;
- `marketplace_settings`;
- `market_listings`;
- `card_asset_locks`;
- `trade_offers`.

A migration foi integrada ao fresh bootstrap e ao fluxo de upgrade de banco existente.

O certificador PostgreSQL valida:

- existência das tabelas;
- provenance de schema;
- settings singleton;
- paridade entre `player_cards` e `card_assets`;
- ownership dos locks;
- escrow obrigatório para anúncios ativos;
- escrow obrigatório para trades ativos;
- unicidade de anúncio ativo por asset.

## 7. Certificação do PR #151

Antes do merge, o head do PR passou pela CI completa.

Foram validados:

- runtime gate;
- lockfile/dependências;
- source/schema contracts;
- typecheck;
- lint;
- bootstrap PostgreSQL;
- Marketplace PostgreSQL;
- Mercado Pago PostgreSQL;
- Card Studio;
- Studio abilities;
- rollback;
- Super Admin security;
- behavioral suite;
- coverage;
- production DB/concurrency probes;
- build;
- browser E2E;
- Alpha Journey;
- Marketplace E2E;
- recovery;
- Ranked fail-closed;
- Casual PvP;
- two-browser PvP;
- DTO isolation.

## 8. Merge definitivo

O PR #151 foi mergeado por squash.

SHA final da `main`:

`2cdee5787042666b8c4747da63d4757abf9f28ba`

A `main` permaneceu exatamente nesse SHA durante toda a certificação descrita neste relatório.

## 9. Certificação pós-merge

### CI #941

Resultado final:

**SUCCESS**

A CI pós-merge repetiu no SHA definitivo todos os principais gates do PR, incluindo Marketplace PostgreSQL, behavior, coverage, build e E2E completo de navegador.

### Alpha Release Candidate #6

Resultado final:

**SUCCESS**

O workflow certificou:

- checkout exato do candidato;
- runtime e lock reproducíveis;
- banco PostgreSQL limpo;
- `production:verify`;
- fronteiras do Alpha;
- build exata de produção;
- execução dessa build;
- escopo público do Alpha;
- upload da evidência de Release Candidate.

### Alpha Starter Balance Evidence #164

Resultado:

**SUCCESS**

Foi executada matriz automatizada de aproximadamente **3.000 partidas** para evidência de balanceamento dos starters.

### Certificados visuais pós-merge

Resultado: **SUCCESS** para:

- Starter Signatures;
- Structures;
- Traps;
- Mana Rituals.

Cada workflow regenerou build, validou as seis cartas-alvo no Codex/VER ARTE e publicou evidência visual.

## 10. Estado atual do Alpha

A base atual inclui, entre outros sistemas:

- onboarding;
- recovery seguro;
- perfil;
- progressão;
- recompensas;
- coleção;
- Vanilla;
- Deck Builder;
- Forge;
- IA;
- batalha;
- mulligan;
- game engine;
- Structures;
- Rituals;
- Traps;
- Sentinelas;
- auras;
- habilidades ativadas;
- tooltips de inteligência de carta;
- Casual PvP;
- matchmaking;
- modos PvE;
- Codex;
- Card Studio;
- Super Admin;
- economia;
- packs;
- Marketplace P2P;
- trocas diretas;
- suporte estrutural a variantes colecionáveis.

## 11. Fronteira não certificada

Este relatório **não declara um deploy público como comprovado**.

O repositório usa placeholders/exemplos para `NEXT_PUBLIC_APP_URL` e domínios `.invalid` nos workflows de CI. Não existe um hostname público real versionado que permita, apenas pelo GitHub, comprovar que o ambiente HTTPS executa o SHA certificado.

Para classificar a entrega como `ALPHA PUBLIC DEPLOY CERTIFIED`, ainda é necessário:

1. identificar o projeto real de hosting;
2. validar variáveis de ambiente;
3. validar PostgreSQL persistente;
4. aplicar migrations;
5. publicar exatamente o SHA `2cdee5787042666b8c4747da63d4757abf9f28ba`;
6. validar HTTPS;
7. consultar o endpoint de deployment provenance;
8. exigir correspondência exata de SHA;
9. executar smoke test real de `/market`;
10. validar criação de conta, recovery, partida, progressão e persistência.

## 12. Avaliação de engenharia

| Área | Nota |
|---|---:|
| Engine | 9,4 / 10 |
| Infraestrutura de testes | 9,6 / 10 |
| Segurança transacional | 9,3 / 10 |
| Marketplace | 9,1 / 10 |
| Ferramentas administrativas | 9,3 / 10 |
| Preparação técnica para Alpha | 9,4 / 10 |
| Deploy público comprovado | Pendente |

## 13. Conclusão

O Marketplace passou pelo ciclo completo:

**design → implementação → hardening → certificação → merge → recertificação pós-merge.**

O código atual da `main` está apto a ser usado como candidato oficial de Alpha.

A próxima prioridade de engenharia não deve ser abrir outra grande frente funcional. O próximo objetivo é provar o ambiente real de deployment e transformar um **Alpha tecnicamente certificado** em um **Alpha publicado e operacionalmente certificado**.
