import ForgeClient from "./ForgeClient";

export const metadata = {
  title: "Forja — RuneForge",
  description: "Construa, analise, valide e compartilhe decks RuneForge dentro das regras runtime e formatos publicados.",
};

export default function ForgePage() {
  return <ForgeClient />;
}
