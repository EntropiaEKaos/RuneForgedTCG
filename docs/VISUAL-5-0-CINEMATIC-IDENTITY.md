# RuneForge Visual 5.0 — Cinematic Identity

## Objetivo

Aumentar a sensação de mundo e identidade de região sem alterar regras, estado ou geometria do campo. Visual 5.0 reutiliza exclusivamente sinais já existentes no cliente: `data-deck-identity`, `ArenaIdentity`, artwork regional, convergence, player plates, Nexus e `MatchCinematics`.

## Entrega visual

- tokens atmosféricos específicos para Emberhold, Tidecall, Ironwood, Voidborn, Florestia e Tempestade;
- artwork regional promovido a cenário com luz e vinheta contextual;
- convergence multirregional preservada e reforçada;
- crest e motes mais legíveis sem virarem UI interativa;
- Nexus, player plates, deployment lanes e altar recebem iluminação sutil derivada da identidade;
- cinematics de rodada/turno herdam o mundo visual da partida;
- combate e resposta intensificam o mesmo ambiente, sem inventar novos estados;
- mobile, notebooks curtos, reduced motion, low-performance e reduced-FX têm redução explícita de custo/intensidade.

## Limite de produção

Nenhum arquivo de engine, reducer, regra, IA, PvP authority, Ranked, persistência, economia ou replay é modificado. `BattleView.tsx`, `ArenaIdentity.tsx` e os três estilos Visual 3.x congelados permanecem byte-for-byte intactos.

O único break-glass estrutural é `layout.tsx`, recertificado para carregar `visual-5-0-cinematic-identity.css` depois de Visual 4.4.

## Promoção

Exige no head exato: CI completo, source/schema audits, behavioral + engine coverage, production probes/build, HTTP/browser E2E, Visual 4.2 density, Visual 4.3 mobile e flagship visual certs. O merge deve usar expected-head SHA e ser seguido por smoke no `main`.
