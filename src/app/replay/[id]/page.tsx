import ReplayViewer from "./ReplayViewer";
export const metadata = { title: "Replay — Runeforge" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplayViewer id={id} />;
}
