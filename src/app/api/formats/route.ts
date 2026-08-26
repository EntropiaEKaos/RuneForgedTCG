import { listFormats } from "@/game/format-rules";
export const dynamic="force-dynamic";
export async function GET(){return Response.json({ok:true,formats:await listFormats()});}
