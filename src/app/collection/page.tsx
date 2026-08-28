import CollectionClient from "./CollectionClient";

export const metadata = {
  title: "Coleção — RuneForge",
  description: "Gerencie seu acervo RuneForge, acompanhe o progresso e faça craft ou desencanto com operações de economia protegidas.",
};

export default function CollectionPage() {
  return <CollectionClient />;
}
