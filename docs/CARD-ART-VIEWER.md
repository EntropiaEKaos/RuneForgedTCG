# Card Art Viewer — Codex + Collection

## Objetivo

Permitir que o jogador veja a ilustração da carta em tamanho grande sem moldura, texto de regras ou elementos de gameplay, diretamente a partir da inteligência contextual já existente.

## Superfícies

O recurso é habilitado automaticamente apenas em:

- `/codex`
- `/collection`

`CardTip` continua inalterado em comportamento nas superfícies de partida, Mulligan, Draft, Forge e demais usos. A Coleção restaura `pointer-events` somente no host da carta para que hover e long-press funcionem sem alterar a estrutura do tile.

## Prioridade da arte

O visualizador usa a mesma prioridade editorial do jogo:

1. arte explícita/Admin registrada em `card-art`;
2. arte definida na própria carta;
3. quando aplicável, master Flagship embutido pelo runtime.

Se não houver URL de arte válida (`/…` ou `https://…`), o botão não é exibido.

## UX e acessibilidade

O tooltip mostra um botão compacto `VER ARTE`. Ao acioná-lo:

- abre um `role="dialog"` modal;
- a arte usa `background-size: contain`, portanto não é cortada;
- o scroll da página é bloqueado;
- o foco vai para o botão de fechar;
- `ESC`, clique no backdrop ou `×` fecham o modal;
- o fundo é escurecido e desfocado para preservar leitura da arte.

## Visual Feature Freeze

Nenhum dos sete blobs do Alpha Visual Feature Freeze é alterado. Em especial, este trabalho não modifica `CardView`, `BattleView`, `ArenaIdentity`, `layout.tsx` nem as folhas Visual 3.0/3.1/3.2.

## Certificação

`src/lib/card-art-viewer-regression.test.ts` protege o contrato estrutural.

`scripts/alpha-card-art-viewer-browser-cert.mjs` valida em Chrome real:

1. Pyra no Codex → tooltip → `VER ARTE` → WebP oficial → screenshot `10k-codex-art-viewer.png`;
2. Pyra na Coleção → tooltip → `VER ARTE` → WebP oficial → screenshot `10l-collection-art-viewer.png`.

O browser gate também valida semântica de diálogo, `aria-modal`, bloqueio de scroll e ausência de overflow horizontal.
