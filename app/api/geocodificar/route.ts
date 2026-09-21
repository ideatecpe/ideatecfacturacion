import { NextRequest, NextResponse } from "next/server";

/**
 * Dirección a partir de las coordenadas del celular (geocodificación inversa) con
 * OpenStreetMap/Nominatim, que es gratuito y no pide clave. Lo usa la tienda online
 * para rellenar solo la dirección de entrega cuando el cliente comparte su ubicación.
 *
 * Nominatim pide identificar la app y no más de 1 consulta por segundo, así que la
 * llamada sale desde el servidor (con su User-Agent), se guarda un rato en memoria
 * y cada IP tiene un límite por minuto.
 *
 * Respuesta: { ok: true, direccion: string | null }  (null = no se pudo determinar)
 */

const DIRECCION_MAX = 200;
const DURACION_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 500;
const CONSULTAS_POR_MINUTO = 12;

const cache = new Map<string, { direccion: string | null; expira: number }>();
const consultasPorIp = new Map<string, number[]>();

type Direccion = Record<string, string | undefined>;

/** "Jr. Amalia Puga 123, Barrio X, Cajamarca": lo que el repartidor necesita, sin el país ni el código postal. */
function armarDireccion(a: Direccion | undefined, nombreCompleto: string | undefined): string | null {
  if (a) {
    const calle = [a.road ?? a.pedestrian ?? a.footway ?? a.path, a.house_number].filter(Boolean).join(" ");
    const zona = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.residential;
    const ciudad = a.city ?? a.town ?? a.village ?? a.municipality ?? a.city_district ?? a.county;
    const partes = [calle, zona, ciudad].filter((p): p is string => !!p);
    const sinRepetir = partes.filter((p, i) => partes.indexOf(p) === i);
    if (sinRepetir.length > 0) return sinRepetir.join(", ").slice(0, DIRECCION_MAX);
  }
  if (nombreCompleto) return nombreCompleto.split(",").slice(0, 3).join(",").trim().slice(0, DIRECCION_MAX);
  return null;
}

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
}

function superoElLimite(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (consultasPorIp.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  consultasPorIp.set(ip, recientes);
  return recientes.length > CONSULTAS_POR_MINUTO;
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ ok: false, error: "Coordenadas inválidas." }, { status: 400 });
  }

  // ~1 metro de precisión: suficiente para una dirección y hace que el caché sirva.
  const clave = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const guardada = cache.get(clave);
  if (guardada && guardada.expira > Date.now()) {
    return NextResponse.json({ ok: true, direccion: guardada.direccion });
  }

  if (superoElLimite(ipDe(req))) {
    return NextResponse.json({ ok: false, error: "Demasiadas consultas. Intenta en un minuto." }, { status: 429 });
  }

  let direccion: string | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=es` +
        `&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`,
      {
        headers: { "User-Agent": "IdeatecFacturacion/1.0 (soporte@ideatec.com)" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (res.ok) {
      const datos = (await res.json()) as { address?: Direccion; display_name?: string };
      direccion = armarDireccion(datos.address, datos.display_name);
    }
  } catch {
    // Sin respuesta del servicio: el cliente escribe su dirección a mano, no se bloquea nada.
    return NextResponse.json({ ok: true, direccion: null });
  }

  if (cache.size >= MAX_ENTRADAS_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(clave, { direccion, expira: Date.now() + DURACION_CACHE_MS });
  return NextResponse.json({ ok: true, direccion });
}
