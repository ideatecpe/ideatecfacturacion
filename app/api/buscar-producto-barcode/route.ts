import { NextRequest, NextResponse } from "next/server";

// Normaliza para comparar: quita espacios, comas y puntos, y pasa a minúsculas.
// Así "750 ml" = "750ml" y "1,5 L" = "1.5L" se consideran iguales.
const normalizar = (s: string) => s.toLowerCase().replace(/[\s.,]+/g, "");

// Estandariza el nombre a "Primera Letra De Cada Palabra En Mayúscula", porque
// Open Food Facts devuelve mayúsculas inconsistentes ("Agua con gas ... San Luis").
// Usa \p{L} para respetar acentos y ñ, y solo toca las letras (no dígitos ni unidades).
const aTitulo = (s: string) =>
  s.replace(/\p{L}+/gu, (palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase());

// Une el nombre con la cantidad ("Agua San Luis" + "750ml" → "Agua San Luis 750ml"),
// pero si el nombre YA incluye la cantidad no la repite ("Agua San Luis 750ml" se
// queda igual).
function combinarNombreCantidad(nombre: string, cantidad: string): string {
  if (!nombre) return nombre;
  if (!cantidad) return nombre;
  if (normalizar(nombre).includes(normalizar(cantidad))) return nombre;
  return `${nombre} ${cantidad}`;
}

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
        `?fields=product_name,product_name_es,brands,image_front_url,image_url,quantity`,
      {
        headers: {
          // Open Food Facts pide identificar la app en el User-Agent.
          "User-Agent": "IdeatecFacturacion/1.0 (soporte@ideatec.com)",
        },
      },
    );
    // Si Open Food Facts devuelve un error HTTP (502, 500, etc.), tratar como
    // "producto no encontrado" en vez de fallar — así el usuario puede seguir
    // registrando el producto manualmente con el código de barras que escribió.
    if (!offRes.ok) {
      return NextResponse.json({ ok: true, encontrado: false });
    }
    off = await offRes.json();
  } catch {
    // Error de red / timeout → tratar como "no encontrado" para no bloquear al usuario.
    return NextResponse.json({ ok: true, encontrado: false });
  }

  // status !== 1 → producto no encontrado en la base
  if (off?.status !== 1 || !off?.product) {
    return NextResponse.json({ ok: true, encontrado: false });
  }

  const p = off.product;
  const nombreBase: string = aTitulo((p.product_name_es || p.product_name || "").trim());
  const cantidad: string = (p.quantity || "").trim();
  const nombre: string = combinarNombreCantidad(nombreBase, cantidad);
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
