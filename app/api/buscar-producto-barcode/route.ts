import { NextRequest, NextResponse } from "next/server";

// Busca datos de un producto por su código de barras en Open Food Facts
// (base de datos abierta y gratuita de productos de supermercado). Si encuentra
// una imagen, la descarga y la sube a Cloudflare Images (a la cuenta propia),
// para no depender de un enlace externo que podría caerse.
//
// Respuesta:
//   { ok: true, encontrado: true, nombre, marca, url, imageId }
//   { ok: true, encontrado: false }            → código válido pero sin datos
//   { ok: false, error }                        → error de configuración/conexión
export async function POST(req: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  let barcode = "";
  try {
    const body = await req.json();
    barcode = String(body?.barcode ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!barcode) {
    return NextResponse.json({ ok: false, error: "Código de barras requerido." }, { status: 400 });
  }

  // ── 1. Consultar Open Food Facts ──────────────────────────────
  let off: any;
  try {
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
        `?fields=product_name,product_name_es,brands,image_front_url,image_url`,
      {
        headers: {
          // Open Food Facts pide identificar la app en el User-Agent.
          "User-Agent": "IdeatecFacturacion/1.0 (soporte@ideatec.com)",
        },
      },
    );
    off = await offRes.json();
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo consultar la base de datos de productos." }, { status: 502 });
  }

  // status !== 1 → producto no encontrado en la base
  if (off?.status !== 1 || !off?.product) {
    return NextResponse.json({ ok: true, encontrado: false });
  }

  const p = off.product;
  const nombre: string =
    (p.product_name_es || p.product_name || "").trim();
  const marca: string = (p.brands || "").split(",")[0]?.trim() ?? "";
  const imagenUrl: string | undefined = p.image_front_url || p.image_url;

  // ── 2. Si hay imagen, descargarla y subirla a Cloudflare ──────
  let url: string | null = null;
  let imageId: string | null = null;

  if (imagenUrl && accountId && apiToken) {
    try {
      const imgRes = await fetch(imagenUrl);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        const cfForm = new FormData();
        cfForm.append("file", blob, `${barcode}.jpg`);

        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
          { method: "POST", headers: { Authorization: `Bearer ${apiToken}` }, body: cfForm },
        );
        const cfData = await cfRes.json();
        if (cfData.success) {
          url = cfData.result.variants[0];
          imageId = cfData.result.id;
        }
      }
    } catch {
      // Si falla la imagen, igual devolvemos el nombre encontrado.
    }
  }

  return NextResponse.json({
    ok: true,
    encontrado: true,
    nombre,
    marca,
    url,
    imageId,
  });
}
