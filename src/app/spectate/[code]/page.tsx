import SpectatorClient from "./SpectatorClient";

export default async function SpectatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SpectatorClient code={code.toUpperCase()} />;
}
