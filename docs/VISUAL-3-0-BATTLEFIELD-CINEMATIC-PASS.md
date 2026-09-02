# RuneForge Visual 3.0 — Battlefield Cinematic Pass

## Objetivo

Fazer a partida ser a superfície visual mais forte do RuneForge sem redesenhar a UI nem tocar na autoridade da engine. O passe é deliberadamente presentation-only e reaproveita o DOM, os estados e as artes regionais já certificados.

## Problema observado no Alpha

O battlefield já era funcional e coerente, porém a leitura visual ainda era próxima de um dashboard escuro: muito preto, cenário regional subutilizado, Nexus pequeno como objetivo visual, lanes planas e pouca separação de profundidade entre mundo, tabuleiro e HUD.

## Mudanças

- arte regional passa de watermark para cenário visível, com saturação/luz controladas;
- superfície principal fica mais translúcida e larga em desktop;
- iluminação herda `--arena-accent` / `--arena-secondary`, portanto cada região colore a arena sem duplicar regras;
- placas dos jogadores ficam suspensas sobre o campo em vez de formar paredes opacas;
- Nexus ganha halo e presença de objetivo físico;
- lanes recebem profundidade/perspectiva puramente decorativa;
- cartas implantadas crescem levemente no desktop sem aumentar a altura certificada das rows;
- selo central vira o coração visual do combate;
- `main`, `combat` e `response` recebem iluminação distinta usando `data-match-phase` já autoritativo para a apresentação;
- mão, barra de ações e log ficam menos opacos para permitir que o mundo continue presente atrás da UI;
- mobile mantém a geometria anterior e remove perspectiva pesada;
- `prefers-reduced-motion`, `data-fx="reduced"` e `data-performance="low"` continuam fail-safe.

## Limites de escopo

Este PR não altera:

- engine, reducer ou regras;
- targeting/hitboxes;
- ordem da stack/reação;
- composição de decks;
- stats ou balanceamento;
- Card Studio;
- Ranked/PvP authority;
- persistência ou APIs.

## Gate de certificação

A aprovação exige a CI completa e inspeção manual do artifact de navegador, com atenção especial a:

- `05-battlefield.png` — composição PvE em 1440×1000;
- `19-pvp-host-battlefield.png` e `20-pvp-guest-battlefield.png` — legibilidade PvP;
- mão + barra de ações totalmente acessíveis sem scroll obrigatório;
- cenário regional presente sem competir com texto/cartas;
- nenhuma mudança de posição que prejudique targeting ou interação.

O novo source-contract `visual-3-0-battlefield-cinematic-regression.test.ts` certifica carregamento, identidade regional, hierarquia visual e fallbacks de acessibilidade/performance.
