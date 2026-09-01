/**
 * Cliente del Agente de Impresión FactuFly.
 *
 * El agente es un programita que el cliente instala una vez y queda en la
 * bandeja del sistema escuchando en 127.0.0.1. Cuando está presente, los
 * tickets salen directo por la térmica sin el diálogo de impresión de Chrome
 * — que es imposible de suprimir desde una página web.
 *
 * Todo aquí es best-effort: si el agente no está instalado, no responde o
 * falla, la caja cae al `window.print()` de siempre. Ningún cliente se queda
 * sin poder imprimir por no tener el agente.
 */

export const PUERTO_AGENTE = 9631;
const BASE = `http://127.0.0.1:${PUERTO_AGENTE}`;

/** Cuánto vale una detección positiva antes de volver a preguntar. */
const VIGENCIA_MS = 30_000;

/**
 * La detección negativa dura más: en un equipo sin agente cada reintento cuesta
 * el timeout completo, y que aparezca un agente a mitad de turno es rarísimo.
 * Si el cajero acaba de instalarlo, recargar la página lo detecta al toque.
 */
const VIGENCIA_AUSENTE_MS = 5 * 60_000;

/**
 * Cuánto se espera al ping antes de dar al agente por ausente.
 *
 * Ojo con la intuición: conectarse a un puerto cerrado en 127.0.0.1 NO se
 * rechaza al instante en Windows. Medido en un equipo real, la conexión tarda
 * ~2 s en fallar porque el firewall descarta el paquete en silencio en vez de
 * responder con un RST. Por eso este tope tiene que ser corto y por eso la
 * detección se adelanta en segundo plano (`detectarAgente`): si el usuario
 * tuviera que esperarla en cada impresión, cada cliente sin agente pagaría este
 * tiempo en cada venta.
 *
 * Un agente vivo responde en ~10 ms, así que 600 ms sobra de largo.
 */
const TIMEOUT_PING_MS = 600;
const TIMEOUT_IMPRESION_MS = 15_000;
const TIMEOUT_HTML_MS = 40_000;

export interface InfoAgente {
  version: string;
  /** Impresora que usará por defecto (la fijada en el agente o la de Windows). */
  impresora: string | null;
  impresoras: string[];
  /** false en equipos sin el runtime de WebView2: no pueden imprimir el comprobante HTML. */
  soportaHtml: boolean;
}

let cache: { info: InfoAgente | null; en: number } | null = null;
let enVuelo: Promise<InfoAgente | null> | null = null;

async function pedir(ruta: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}${ruta}`, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

/**
 * ¿Hay agente en este equipo? Devuelve sus datos, o null si no está.
 * El resultado se cachea (también el negativo) para no pingear en cada venta.
 */
export async function detectarAgente(forzar = false): Promise<InfoAgente | null> {
  if (typeof window === "undefined") return null;

  const vigencia = cache?.info ? VIGENCIA_MS : VIGENCIA_AUSENTE_MS;
  if (!forzar && cache && Date.now() - cache.en < vigencia) return cache.info;

  // Si dos cajas piden a la vez (la principal y una venta rápida), comparten
  // el mismo ping en lugar de abrir dos conexiones.
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    let info: InfoAgente | null = null;
    try {
      const res = await pedir("/ping", { method: "GET" }, TIMEOUT_PING_MS);
      if (res.ok) {
        const data = await res.json();
        if (data?.ok) {
          info = {
            version: String(data.version ?? "?"),
            impresora: data.impresora ?? null,
            impresoras: Array.isArray(data.impresoras) ? data.impresoras : [],
            soportaHtml: data.soportaHtml === true,
          };
        }
      }
    } catch {
      // Agente ausente: es el caso normal en un cliente que no lo instaló.
    }
    cache = { info, en: Date.now() };
    enVuelo = null;
    return info;
  })();

  return enVuelo;
}

export interface OpcionesImpresion {
  /** Nombre que aparece en la cola de impresión de Windows. */
  documento?: string;
  /** Impresora concreta; por defecto la que tenga configurada el agente. */
  impresora?: string;
  copias?: number;
}

/**
 * Manda un ticket ESC/POS al agente.
 * @returns true si el agente confirmó la impresión; false si hay que usar el
 *          diálogo del navegador como respaldo.
 */
export async function imprimirConAgente(
  datos: Uint8Array,
  opciones: OpcionesImpresion = {},
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const info = await detectarAgente();
  if (!info) return false;

  try {
    const res = await pedir(
      "/imprimir",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datosBase64: aBase64(datos),
          documento: opciones.documento,
          impresora: opciones.impresora,
          copias: opciones.copias,
        }),
      },
      TIMEOUT_IMPRESION_MS,
    );

    if (!res.ok) {
      // Impresora apagada, sin papel o nombre inexistente: el agente está pero
      // no pudo imprimir. Se invalida la caché por si lo acaban de cerrar.
      cache = null;
      console.warn("Agente de impresión respondió con error:", res.status);
      return false;
    }

    const data = await res.json();
    return data?.ok === true;
  } catch (err) {
    cache = null;
    console.warn("No se pudo imprimir con el agente:", err);
    return false;
  }
}

/** Uint8Array → Base64, por trozos para no reventar la pila con tickets largos. */
function aBase64(datos: Uint8Array): string {
  let binario = "";
  const TROZO = 0x8000;
  for (let i = 0; i < datos.length; i += TROZO) {
    binario += String.fromCharCode(...datos.subarray(i, i + TROZO));
  }
  return btoa(binario);
}

/**
 * Manda al agente el HTML del comprobante que devuelve la API y lo imprime sin
 * el diálogo del navegador.
 *
 * Esta es la ruta buena para un comprobante: el HTML del backend ya trae el
 * logo, el QR de SUNAT y la redacción legal exacta. Reconstruir el ticket en el
 * front daría un papel parecido pero sin QR — y una boleta sin QR no es válida.
 *
 * @param anchoMm Ancho del rollo: 58 u 80.
 * @returns true si el agente lo imprimió; false si hay que usar el navegador.
 */
export async function imprimirHtmlConAgente(
  html: string,
  anchoMm: 58 | 80,
  opciones: OpcionesImpresion = {},
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const info = await detectarAgente();
  if (!info?.soportaHtml) return false;

  try {
    const res = await pedir(
      "/imprimir-html",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          anchoMm,
          documento: opciones.documento,
          impresora: opciones.impresora,
        }),
      },
      // Renderizar la página tarda más que escupir bytes: se le da más margen
      // que a la ruta ESC/POS.
      TIMEOUT_HTML_MS,
    );

    if (!res.ok) {
      cache = null;
      console.warn("El agente no pudo imprimir el HTML:", res.status);
      return false;
    }

    return (await res.json())?.ok === true;
  } catch (err) {
    cache = null;
    console.warn("No se pudo imprimir el HTML con el agente:", err);
    return false;
  }
}
