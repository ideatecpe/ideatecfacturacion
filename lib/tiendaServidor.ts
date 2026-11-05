/**
 * Datos de una tienda online que el servidor necesita antes de mandar la página: el
 * logo (ícono de la pestaña), el color principal (barra del celular) y si está abierta.
 *
 * Se guardan unos minutos en memoria: la respuesta pública trae el logo en base64 (puede
 * pesar más de lo que acepta la caché de fetch de Next) y la piden a la vez la página y
 * su ícono. Las peticiones simultáneas comparten la misma consulta.
 */

const API = process.env.NEXT_PUBLIC_API_URL;
const DURACION_MS = 3 * 60 * 1000;
const MAX_ENTRADAS = 300;
const ESPERA_MAXIMA_MS = 3000;

export interface TiendaServidor {
  logoBase64: string | null;
  colorPrimario: string | null;
  abierta: boolean;
}

const cache = new Map<string, { expira: number; datos: Promise<TiendaServidor | null> }>();

export function datosTiendaServidor(clave: string, beta: boolean): Promise<TiendaServidor | null> {
  if (!API || !clave) return Promise.resolve(null);
  const llave = `${beta ? "beta" : "prod"}:${clave.toLowerCase()}`;
  const guardada = cache.get(llave);
  if (guardada && guardada.expira > Date.now()) return guardada.datos;

  const datos = fetch(`${API}/api/tienda/${encodeURIComponent(clave)}${beta ? "?e=beta" : ""}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const t = (await res.json()) as { logoBase64?: string | null; colorPrimario?: string | null; abierta?: boolean };
      return { logoBase64: t.logoBase64 ?? null, colorPrimario: t.colorPrimario ?? null, abierta: t.abierta !== false };
    })
    .catch(() => null);

  if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value as string);
  cache.set(llave, { expira: Date.now() + DURACION_MS, datos });
  // Si falló, no se guarda: el próximo visitante lo vuelve a intentar.
  void datos.then((d) => {
    if (!d) cache.delete(llave);
  });
  return datos;
}
