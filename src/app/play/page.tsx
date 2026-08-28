import GameClient from "./GameClient";

export const metadata = {
  title: "Jogar — RuneForge",
  description: "Prepare seu deck, confirme a sessão e entre em partidas autoritativas de RuneForge.",
};

export default function PlayPage() {
  return <GameClient />;
}
