import { NextRequest, NextResponse } from "next/server";

// Busca datos de un producto (nombre + imagen) por su código de barras en la
// API pública de Superfood. Se llama desde el servidor (no desde el navegador)
// porque esa API no admite CORS para el header x-api-key.
//
// Respuesta:
//   { ok: true, encontrado: true, nombre, imagenUrl }
//   { ok: true, encontrado: false }            → código válido pero sin datos
//   { ok: false, error }                        → error de configuración/conexión
export async function POST(req: NextRequest) {
  const apiUrl = process.env.SUPERFOOD_API_URL;
  const apiKey = process.env.SUPERFOOD_API_KEY;

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

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: "API de Superfood no configurada." }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${apiUrl}/superfood/productos?q=${encodeURIComponent(barcode)}`,
      { headers: { "x-api-key": apiKey, "Content-Type": "application/json" } },
    );
    if (!res.ok) {
      return NextResponse.json({ ok: true, encontrado: false });
    }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) {
      return NextResponse.json({ ok: true, encontrado: false });
    }
    return NextResponse.json({
      ok: true,
      encontrado: true,
      nombre: item.nombre ?? null,
      imagenUrl: item.imagenUrl ?? null,
    });
  } catch {
    // Error de red / timeout → tratar como "no encontrado" para no bloquear al usuario.
    return NextResponse.json({ ok: true, encontrado: false });
  }
}
