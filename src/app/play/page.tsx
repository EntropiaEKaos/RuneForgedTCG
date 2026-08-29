import PlayEntryClient from "./PlayEntryClient";

export const metadata = {
  title: "Jogar — RuneForge",
  description: "Prepare sua identidade, escolha um deck e entre em partidas autoritativas de RuneForge.",
};

export default function PlayPage() {
  return <PlayEntryClient />;
}
