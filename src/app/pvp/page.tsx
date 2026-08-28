import PvpClient from "./PvpClient";

export const metadata = {
  title: "PvP Casual — RuneForge",
  description: "Lobby PvP casual com salas autoritativas, sessão estável e reconexão automática.",
};

export default function PvpPage() {
  return <PvpClient />;
}
