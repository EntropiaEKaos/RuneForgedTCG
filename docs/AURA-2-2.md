# Aura 2.2 — Continuous Keyword Suppression

## Objetivo

Aura 2.2 amplia o mesmo pipeline contínuo certificado em Aura 2.0/2.1 para permitir que `Enchantment` e `Artifact` — incluindo `Structure` pela base estrutural Artifact — suprimam keywords de unidades inimigas enquanto a fonte permanecer viva no battlefield.

Não existe um segundo engine de efeitos contínuos. `recomputeContinuousAuras()` continua sendo o ponto autoritativo de recomputação de stats e keywords.

## Contrato de authoring

Uma Aura hostil usa:

```ts
{
  buffPower: 0,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Flying", "Hexproof"]
}
```

Ela pode combinar:

- modificadores de Power/Health não positivos já certificados em Aura 2.1;
- `suppressKeywords` com uma ou mais keywords seguras;
- filtros opcionais de `races` e `classes`.

Uma Aura inimiga pode ser exclusivamente de supressão (`0/0 + suppressKeywords`). Já uma Aura `0/0` sem stats, grants ou supressões continua inválida.

Auras aliadas não podem usar `suppressKeywords`. Auras inimigas não podem usar `keywords` para grants.

## Layer de keywords

Cada `UnitInstance` mantém três camadas opcionais de proveniência:

- `durableKeywords` — impressão, Equipment e grants duráveis/one-shot;
- `auraKeywords` — grants derivados de Auras aliadas ativas;
- `auraSuppressedKeywords` — supressões derivadas de Auras inimigas ativas.

A visão efetiva consumida pelo engine continua sendo `unit.keywords`, calculada deterministically como:

```text
unique(durableKeywords + auraKeywords) - auraSuppressedKeywords
```

Isso estabelece a precedência certificada de Aura 2.2:

1. reconstruir origens duráveis;
2. unir grants de Aura;
3. unir supressões hostis;
4. remover da visão efetiva tudo que estiver suprimido.

A supressão nunca apaga a origem. Se uma unidade recebe `Flying` duravelmente enquanto `Flying` está suprimido, o grant fica registrado e torna-se efetivo quando a fonte hostil sair.

Da mesma forma, se uma Aura aliada concede `Flying` e uma Aura inimiga o suprime, `auraKeywords` continua contendo `Flying`; a saída da fonte hostil reexpõe o grant imediatamente se a fonte aliada ainda estiver ativa.

## Keywords suprimíveis

Runtime, Studio e authoring compartilham `AURA_SUPPRESSIBLE_KEYWORDS`.

Ficam explicitamente fora:

- **Barrier** — o shield consumível vive em `unit.barrier`; remover apenas o nome do array de keywords não suprimiria corretamente a proteção;
- **LastBreath** — o comportamento depende de contrato executável `onDeath`/`lastBreath`, não apenas da presença da string no array efetivo.

Payloads que tentem publicar esses casos falham fechados. O runtime também filtra essas supressões se um payload malformado contornar o authoring.

## Filtros e ownership

Aura 2.2 reutiliza `permanentAuraAffectsUnit()`:

- `affects: "enemies"` exige owner da fonte diferente do owner da unidade;
- valores dentro de `races` combinam como OU;
- valores dentro de `classes` combinam como OU;
- quando raça e classe existem, os grupos combinam como E.

A direção é derivada do owner real da fonte, funcionando de player → AI e AI → player.

## Integração com gameplay

Nenhum runtime de keyword foi duplicado. Ataque, blocking, strike, dano, round rules e targeting continuam consultando `unit.keywords`.

Consequentemente, uma keyword suprimida deixa de produzir seu efeito real. A certificação de Aura 2.2 inclui `Hexproof`: um spell direcionado que falha contra a unidade normalmente torna-se legal enquanto Hexproof está suprimido.

## Ability Grammar 2.0

O catálogo passa a expor `PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT` com:

- source: `Enchantment` / `Artifact`;
- target: `enemyUnit`;
- lifecycle: `whileSourceInPlay`;
- stacking: união de conjunto;
- precedência: `afterDurableAndAuraGrants`;
- restauração: automática quando a fonte sai.

A projeção do card continua usando o envelope compatível `permanentStatAura`, agora transportando também `aura.suppressKeywords`.

A família geral `aura` permanece `partial`; este PR não implementa um sistema universal de layers entre efeitos contínuos arbitrários, replacement effects, mudança contínua de controller/tipo/texto ou dependências cross-layer genéricas.

## Card Studio

O editor de Continuous Aura diferencia explicitamente:

- **Unidades aliadas** — stats positivos + grants de keywords;
- **Unidades inimigas** — stats não positivos + supressões de keywords.

Ao trocar de audiência, campos semanticamente incompatíveis são limpos do draft. O backend continua sendo a autoridade final e rejeita combinações inválidas independentemente da UI.

## Certificação

A suíte comportamental de Aura 2.2 cobre:

- supressão de keyword impressa em unidade que entra com a fonte já ativa;
- restauração automática após saída da fonte;
- sobreposição entre grant de Aura e supressão hostil;
- grant durável criado enquanto a keyword está suprimida;
- integração real de `Hexproof` com targeting de spell;
- filtro runtime de `Barrier` e `LastBreath` malformados;
- authoring de Aura hostil somente de supressão;
- authoring misto de stat debuff + supressão;
- rejeição de grants em Auras inimigas e supressões em Auras aliadas;
- rejeição de keyword desconhecida/unsafe;
- projeção e catálogo do Ability Grammar 2.0.
