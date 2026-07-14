const WHATSAPP_BASE = "https://do.velsat.pe:8443/whatsapp";

type ProductoStock = { nomProducto: string; stock: number };

function buildMensaje(
  productos: ProductoStock[],
  encabezadoUno: string,
  encabezadoVarios: string,
): string {
  const encabezado = productos.length === 1 ? encabezadoUno : encabezadoVarios;
  const lineas = productos.map((p) => `• ${p.nomProducto}: ${p.stock} unid.`).join("\n");
  return `${encabezado}\n\n${lineas}`;
}

async function enviarTextoWhatsapp(texto: string, numero: string): Promise<void> {
  const raw = numero.replace(/\D/g, "");
  if (!raw) return;
  const numeroFormateado = raw.startsWith("51") ? raw : `51${raw}`;
  const whatsappApiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY!;

  try {
    await fetch(`${WHATSAPP_BASE}/api/send/single`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": whatsappApiKey },
      body: JSON.stringify({ phone: numeroFormateado, type: "texto", text: texto }),
    });
  } catch {
    // Aviso best-effort: no debe interrumpir el flujo de emisión/registro que lo origina.
  }
}

export async function avisarStockBajoWhatsapp(
  productos: ProductoStock[],
  numero: string,
): Promise<void> {
  if (!productos.length) return;
  const texto = buildMensaje(
    productos,
    "⚠️ *Stock bajo*\n\nEl siguiente producto está quedando con poco stock:",
    "⚠️ *Stock bajo*\n\nLos siguientes productos están quedando con poco stock:",
  );
  await enviarTextoWhatsapp(texto, numero);
}

export async function avisarStockRepuestoWhatsapp(
  productos: ProductoStock[],
  numero: string,
): Promise<void> {
  if (!productos.length) return;
  const texto = buildMensaje(
    productos,
    "✅ *Stock repuesto*\n\nEl siguiente producto fue repuesto y ya cuenta con stock suficiente:",
    "✅ *Stock repuesto*\n\nLos siguientes productos fueron repuestos y ya cuentan con stock suficiente:",
  );
  await enviarTextoWhatsapp(texto, numero);
}
