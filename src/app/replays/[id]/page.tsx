import { PRODUCT_BRAND } from "@/lib/product-brand";
import ReplayViewer from "../../replay/[id]/ReplayViewer";

export const metadata = { title: `Replay Público — ${PRODUCT_BRAND.fullName}` };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplayViewer id={id} />;
}
