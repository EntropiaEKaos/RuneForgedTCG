# Self-Mill Effects 1.0 — Design

Base certificada: `f5edebf2fdc1c35874164f67b62c41eedb8c9cfd` (`main`, Ecos do Abismo 1.0 pós-merge 6/6 verde).

## Objetivo

Adicionar uma primitiva genérica e autoritativa de **self-mill** sem alterar a semântica histórica de `mill`.

- `mill`: continua descartando cartas do topo do deck inimigo para o Cemitério.
- `selfMill`: descarta cartas do topo do deck do controlador do efeito para o próprio Cemitério.

Os dois efeitos usam a mesma transição física certificada `millDeckToGraveyard`, preservando ordem, owner, reason=`mill`, roundEntered e IDs determinísticos.

## Escopo deste PR

1. adicionar `selfMill` ao `EffectKind`;
2. expor `selfMill` no catálogo de authoring/Card Studio;
3. executar `selfMill` no engine sem target oculto;
4. ensinar IA principal e IA de habilidades ativadas a avaliar self-mill;
5. certificar engine + authoring + IA com testes determinísticos;
6. manter cards, starters, Ranked e recipe de Ecos inalterados.

## Contrato autoritativo

`selfMill`:

- target obrigatório: `none`;
- amount: inteiro positivo após sanitização;
- controlador = `playerId` que resolve o efeito;
- move no máximo as cartas que realmente existem no deck;
- cada carta entra no Cemitério do mesmo controlador com reason=`mill`;
- deck vazio é um no-op seguro;
- não compra, não cria cópia e não altera ownership;
- não requer seleção do cliente.

## IA

Self-mill não deve ser avaliado como dano de deck ao oponente.

A IA pode valorizá-lo quando:

- há cartas no próprio deck;
- o deck possui recursos de Cemitério/reanimation/recursion;
- ou o efeito faz parte de um card cujo valor total continua positivo.

Sem sinergia de Cemitério conhecida, o valor deve ser conservador para impedir que a IA moa o próprio deck compulsivamente.

## Não entra neste PR

- novas cartas;
- mudança na recipe `ecos_do_abismo`;
- condições por quantidade no Cemitério;
- payoff por carta milled;
- Ranked;
- alterações nos seis starters.

Após merge e pós-merge certification, o conteúdo **Ecos do Abismo 1.1** poderá usar `selfMill` em cards e passar por balance dedicado.
