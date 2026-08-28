import CollectionsCalendarClient from "./CollectionsCalendarClient";

export const metadata = {
  title: "Calendário de Coleções — RuneForge",
  description: "Acompanhe lançamentos, rotações e o lifecycle Standard/Eternal das coleções publicadas no RuneForge.",
};

export default function CollectionsPage() {
  return <CollectionsCalendarClient />;
}
