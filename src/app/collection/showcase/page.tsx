import CollectorShowcaseClient from "./CollectorShowcaseClient";
import { PRODUCT_BRAND } from "@/lib/product-brand";
export const metadata={title:`Vitrine de Colecionador — ${PRODUCT_BRAND.fullName}`,description:"Exiba cópias exatas, frames, acabamentos e serializadas sem alterar poder de gameplay."};
export const dynamic="force-dynamic";
export default async function CollectorShowcasePage({searchParams}:{searchParams:Promise<{player?:string}>}){const params=await searchParams;return <CollectorShowcaseClient requestedPlayer={String(params.player||"").trim()}/>;}
