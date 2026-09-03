# Flagship Art Batch C — Mana Rituals

## Objetivo

O Batch C adiciona seis masters dedicados para os Rituais de Mana do Alpha, um por região. O lote é editorial: não altera regras, custos, efeitos, timing ou balanceamento.

A linguagem visual dos Rituais deve comunicar **mana em movimento e transformação deliberada**, diferenciando-os de:

- **Estruturas** — permanentes/landmarks estáticos;
- **Armadilhas** — interrupções súbitas e reativas;
- spells genéricos — o Ritual sempre deve parecer um processo de canalização de recurso.

## Masters

| Região | Carta | Direção visual |
| --- | --- | --- |
| Emberhold | Rito da Chama Soberana | mana fundida em círculo de forja, reservatório central e pressão de fogo controlado |
| Tidecall | Liturgia da Maré da Memória | corrente reciclada de mana, água suspensa e memória convertida em recurso |
| Ironwood | Rito das Raízes Antigas | mana armazenada em raízes e semente ancestral, investimento paciente |
| Voidborn | Liturgia da Ausência | fios luminosos drenados para uma abertura do Vazio, custo de memória visível |
| Florestia | Uivo da Lua Verde | lua verde, pedras da matilha e energia natural reunida antes da caçada |
| Tempestade | Rito do Olho da Tempestade | olho calmo cercado por energia rotacional e raios disciplinados |

## Pipeline

- Fonte determinística: `scripts/generate-flagship-ritual-art.mjs`.
- Entrega: WebP 1536×1920, qualidade 88.
- Caminhos: `public/art/cards/flagship/<região>/<defId>.webp`.
- Resolver: `src/game/flagship-ritual-art.ts`.
- Prioridade de arte permanece: **Admin/editorial > Champion/Structure/Ritual built-in > fallback regional**.
- `next.config.ts` materializa Estruturas e Rituais antes do Next resolver `/public`.

## Certificação

O mesmo contrato usado pelos Batches A+B é estendido para o Batch C:

1. runtime verifica exatamente seis Ritual masters;
2. cada carta continua `Spell + archetypeKey=ritual + manaRefund`;
3. o registry resolve o WebP regional correto;
4. override editorial continua superior ao master embutido;
5. o browser abre cada Ritual no Codex e exige CardView sem `regional-fallback`;
6. o botão **VER ARTE** precisa abrir o master com `background-size: contain`, sem crop;
7. screenshots `12a`–`12f` são publicadas como evidência visual.

## Freeze

O Batch C não modifica `BattleView`, `CardView`, `ArenaIdentity` nem as folhas Visual 3.0/3.1/3.2. É conteúdo visual dentro do Alpha Visual Feature Freeze.
