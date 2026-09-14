import { PRODUCT_BRAND } from "@/lib/product-brand";
import AlbumClient from "./AlbumClient";

export const metadata = {
  title: `Álbum Vanilla — ${PRODUCT_BRAND.fullName}`,
  description: `Acompanhe a primeira coleção de ${PRODUCT_BRAND.displayName}, complete raridades e resgate marcos permanentes do álbum Vanilla.`,
};

export default function AlbumPage() {
  return <AlbumClient />;
}
