# Aura 2.1 — Enemy Continuous Stat Debuffs

## Objetivo

Aura 2.1 amplia o sistema contínuo certificado para permitir que `Enchantment` e `Artifact` afetem unidades inimigas com reduções contínuas de Power e Health.

O novo campo opcional `aura.affects` aceita:

- `allies` — comportamento histórico e default de payloads antigos;
- `enemies` — novo contrato hostil de Aura 2.1.

A ausência de `affects` continua significando aliados, preservando replays e cartas já publicadas.

## Contrato hostil

Uma Aura inimiga:

- aceita apenas `buffPower <= 0` e `buffHealth <= 0`;
- exige pelo menos um dos dois modificadores negativo;
- pode reutilizar filtros de raça e classe;
- soma com outras Auras hostis de forma aditiva;
- existe somente enquanto sua fonte continua viva no battlefield;
- não concede nem remove keywords neste corte.

O runtime decide a direção a partir do **owner real da fonte no battlefield**, não de dados fornecidos pelo cliente. Uma fonte do jogador afeta o bench da IA; a mesma definição controlada pela IA afeta o bench do jogador.

## Power mínimo 0

A auditoria anterior à implementação identificou que Power negativo não pode chegar ao combat damage: o engine de combate trabalha com o Power efetivo da unidade e valores negativos não representam dano válido.

Por isso, a contribuição negativa da camada Aura é limitada ao Power durável disponível antes da Aura. O resultado efetivo de uma unidade não pode ficar abaixo de `0` apenas por Aura 2.1.

Esse invariant é certificado comportamentalmente.

## Health, dano marcado e morte

`recomputeContinuousAuras()` continua preservando dano já marcado ao alterar a vida máxima.

Exemplo: uma unidade 5/5 com 2 de dano está em 3/5. Se uma Aura inimiga aplicar -0/-2, ela passa para 1/3, preservando os mesmos 2 pontos de dano marcado.

Se a redução de vida máxima tornar o dano existente letal, o ciclo normal de `cleanupDead()` remove a unidade. Quando uma Aura não letal sai, a vida máxima é restaurada sem curar artificialmente o dano marcado.

## Filtros

Os filtros existentes permanecem iguais:

- dentro de `races`: OU;
- dentro de `classes`: OU;
- quando raça e classe existem ao mesmo tempo: E entre os dois grupos.

A relação aliado/inimigo é verificada antes do filtro semântico; um filtro correspondente nunca faz uma Aura hostil afetar o próprio controlador.

## Card Studio e authoring

O editor de Continuous Aura agora possui seleção explícita de audiência:

- **Unidades aliadas** — stats positivos e keywords Aura-safe;
- **Unidades inimigas** — somente stats não positivos.

O boundary semântico de publicação/importação/sandbox/QA rejeita:

- audiência desconhecida;
- bônus positivos em Aura inimiga;
- Aura inimiga 0/0;
- keywords em Aura inimiga;
- stats negativos em Aura aliada;
- números fora do intervalo -20..20.

O sanitizer legado de stat Aura permanece intacto. O contrato estendido é validado e restaurado no mesmo boundary compatível usado por Aura 2.0.

## Ability Grammar 2.0

Aura 2.1 adiciona `PERMANENT_ENEMY_STAT_AURA_CONTRACT` ao catálogo sem criar um novo mecanismo de execução.

A projeção histórica `permanentStatAura` continua sendo o envelope da regra persistente, mas agora:

- uma Aura aliada projeta `target: allyUnit`;
- uma Aura inimiga projeta `target: enemyUnit`;
- `affects: enemies` é preservado no payload semântico da regra.

A família `aura` continua honestamente marcada como **partial**.

## Fora de escopo

Aura 2.1 não implementa:

- remoção contínua de keywords;
- concessão de keywords a inimigos;
- dependências entre efeitos contínuos;
- ordenação genérica de layers/sub-layers;
- replacement effects contínuos;
- alteração de controle;
- Auras que afetam permanentes ou Sentinelas.

Esses itens exigem um layer system posterior e não devem ser misturados neste PR.

## Certificação

A suíte comportamental dedicada cobre:

- direção jogador → inimigo e IA → jogador;
- isolamento do próprio controlador;
- filtros de raça/classe;
- Power floor em 0;
- redução e restauração de max Health;
- preservação de dano marcado na entrada e saída;
- morte causada por redução contínua de max Health;
- guard runtime contra keyword hostil malformada;
- authoring válido e casos fail-closed;
- projeção correta no Ability Grammar 2.0.
