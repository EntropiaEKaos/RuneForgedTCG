import DraftClient from "./DraftClient";

export const metadata = {
  title: "Arena Draft — RuneForge",
  description: "Construa um deck em formato limitado com escolhas autoritativas, regras imutáveis por sessão e até três regiões.",
};

export default function DraftPage() {
  return <DraftClient />;
}
