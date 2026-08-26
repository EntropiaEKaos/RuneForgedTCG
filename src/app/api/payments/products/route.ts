import { getRuntimePaymentProducts } from "@/lib/control-plane";
import { getMercadoPagoSettings } from "@/lib/payment-settings";
export const dynamic = "force-dynamic";
export async function GET(){
  const [products,settings]=await Promise.all([getRuntimePaymentProducts(),getMercadoPagoSettings(false)]);
  return Response.json({ok:true,gateway:{provider:"mercadopago",enabled:Boolean(settings?.enabled&&settings.accessTokenConfigured&&settings.webhookSecretConfigured),environment:settings?.environment||"sandbox",publicKey:settings?.publicKey||""},products:products.filter(p=>p.active!==false).map(p=>({key:p.key,name:p.name,priceCents:p.priceCents,currency:p.currency,grants:p.grants}))});
}
