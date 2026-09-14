import { PRODUCT_BRAND } from "@/lib/product-brand";
import ReplayViewer from "./ReplayViewer";

export const metadata = { title: `Replay — ${PRODUCT_BRAND.fullName}` };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplayViewer id={id} />;
}
