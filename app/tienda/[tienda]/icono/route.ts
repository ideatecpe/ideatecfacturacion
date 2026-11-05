import { NextRequest, NextResponse } from "next/server";

/**
 * Ícono de la pestaña de una tienda online: el logo de la empresa (el mismo de sus
 * comprobantes PDF), en cuadrado. Lo pide el navegador desde el <link rel="icon"> que
 * pone page.tsx, así ya viene en el HTML y no depende de que el JavaScript llegue a
 * cambiarlo. Sin logo (o si algo falla) se entrega el ícono de FactuFly.
 */

const API = process.env.NEXT_PUBLIC_API_URL;
const TAMANO = 128;
const ICONO_POR_DEFECTO = "/android-chrome-192x192.png";

function conTipo(bytes: Buffer): string | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.length > 4 && bytes.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tienda: string }> }) {
  const { tienda } = await params;
  const clave = decodeURIComponent(tienda).slice(0, 80);
  const beta = req.nextUrl.searchParams.get("e") === "beta";

  const porDefecto = () =>
    NextResponse.redirect(new URL(ICONO_POR_DEFECTO, req.url), { headers: { "Cache-Control": "no-store" } });

  if (!API || !clave) return porDefecto();

  let base64: string | null = null;
  try {
    const res = await fetch(`${API}/api/tienda/${encodeURIComponent(clave)}${beta ? "?e=beta" : ""}`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) base64 = ((await res.json()) as { logoBase64?: string | null }).logoBase64 ?? null;
  } catch {
    return porDefecto();
  }
  if (!base64) return porDefecto();

  // Puede venir como data URL o como base64 suelto.
  const original = Buffer.from(base64.replace(/^data:[^,]*,/, ""), "base64");
  if (original.length === 0) return porDefecto();

  let imagen: Buffer = original;
  let tipo: string | null = conTipo(original);
  try {
    // El logo suele ser horizontal: se centra en un cuadrado transparente en vez de aplastarlo.
    const { default: sharp } = await import("sharp");
    imagen = await sharp(original)
      .resize(TAMANO, TAMANO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    tipo = "image/png";
  } catch {
    // Sin sharp o con un formato raro: se entrega el logo tal cual si es una imagen conocida.
    if (!tipo) return porDefecto();
  }

  return new NextResponse(new Uint8Array(imagen), {
    headers: {
      "Content-Type": tipo ?? "image/png",
      // El navegador lo guarda 5 min; si la tienda cambia su logo se ve poco después.
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
