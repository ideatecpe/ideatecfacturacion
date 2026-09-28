import axios from "axios";
import { notificarVentaRegistrada } from "@/lib/eventosCaja";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Un error se considera "transitorio" (se debe encolar y reintentar después,
// no mostrarse como fallo definitivo) cuando:
// - No hubo respuesta HTTP en absoluto (sin internet, backend inalcanzable), o
// - El backend respondió pero con un 5xx: su propia infraestructura falló
//   (ej. "Unable to connect to any of the specified MySQL hosts"), no la venta.
// Un 4xx (400, 401, 404...) sí es un error real de negocio/datos y se muestra tal cual.
export function esErrorTransitorio(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === undefined) return true;
  return status >= 500;
}

// Primera API: guarda el comprobante en BD y asigna serie/correlativo real.
export async function generarXml(payload: Record<string, unknown>, token: string | null) {
  const urlXml = `${API_URL}/api/Comprobantes/GenerarXml`;
  logEmision(etiquetaPorTipo(payload), urlXml, payload);

  const res = await axios.post(
    urlXml,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  notificarVentaRegistrada();
  return res.data as { comprobanteId: number; serie?: string; correlativo?: string };
}

/** Número apartado para una venta que todavía no se guarda. */
export interface ReservaNumero {
  serie: string;
  correlativo: number;
  sucursalId: number;
}

/**
 * Aparta el siguiente número de la serie ANTES de guardar la venta.
 *
 * Es lo que permite imprimir el ticket al instante: el número sale del mismo UPDATE
 * atómico que usa la emisión, así que dos cajas simultáneas nunca reciben el mismo, y
 * la venta se guarda después con ese número ya apartado.
 *
 * Devuelve null si no se pudo reservar; en ese caso la venta sigue el camino de siempre
 * (la API asigna el número al guardar) y el ticket se imprime cuando responde.
 */
export async function reservarNumero(
  empresaRuc: string,
  codEstablecimiento: string,
  tipoComprobante: "01" | "03" | "NV",
  token: string | null,
): Promise<ReservaNumero | null> {
  try {
    const res = await axios.post(
      `${API_URL}/api/Comprobantes/numero/reservar`,
      { empresaRuc, codEstablecimiento, tipoComprobante },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { serie, correlativo, sucursalId } = res.data ?? {};
    return serie && Number.isFinite(correlativo) ? { serie, correlativo, sucursalId } : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve un número reservado cuya venta no llegó a guardarse, para no dejar un salto
 * en la numeración. Si otra venta ya tomó el siguiente número, el backend no lo toca.
 */
export async function liberarNumero(
  empresaRuc: string,
  codEstablecimiento: string,
  tipoComprobante: "01" | "03" | "NV",
  correlativo: number,
  token: string | null,
): Promise<void> {
  try {
    await axios.post(
      `${API_URL}/api/Comprobantes/numero/liberar`,
      { empresaRuc, codEstablecimiento, tipoComprobante, correlativo },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // Best-effort: si no se pudo liberar, queda un número sin usar que se resuelve
    // con una comunicación de baja desde Comprobantes.
  }
}

// Segunda API: envía el comprobante ya guardado a SUNAT.
export async function enviarASunatApi(comprobanteId: number, token: string | null) {
  const urlSunat = `${API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`;
  logEmision("SUNAT", urlSunat, { comprobanteId, body: null });

  const res = await axios.post(
    urlSunat,
    null,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data as {
    exitoso: boolean;
    mensaje?: string;
    estadoSunat?: string;
  };
}

// Traza de emision: imprime en consola la URL exacta y el body completo que sale hacia
// la API, para poder reproducir la peticion tal cual desde Postman o curl.
// Queda fuera de produccion porque el body lleva datos del cliente (nombre, documento).
export function logEmision(etiqueta: string, url: string, payload: unknown) {
  if (process.env.NODE_ENV === "production") return;

  console.groupCollapsed(`%c[${etiqueta}] POST ${url}`, "color:#d97706;font-weight:bold");
  console.log("URL:", url);
  console.log("Body:", payload);
  console.log("Body (JSON):", JSON.stringify(payload, null, 2));
  console.groupEnd();
}

// El endpoint GenerarXml es el mismo para boleta y factura; el tipo va dentro del body.
export function etiquetaPorTipo(payload: unknown) {
  const tipo = (payload as { tipoComprobante?: string })?.tipoComprobante;
  return tipo === "01" ? "Factura" : tipo === "03" ? "Boleta" : "Comprobante";
}

// Nota de Venta: documento de control interno, no pasa por SUNAT.
export async function crearNotaVenta(payload: Record<string, unknown>, token: string | null) {
  const url = `${API_URL}/api/NotaVenta`;
  logEmision("NotaVenta", url, payload);

  const res = await axios.post(
    url,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  notificarVentaRegistrada();
  return res.data as { comprobanteId?: number; ComprobanteId?: number; numeroCompleto?: string; NumeroCompleto?: string };
}

export async function descontarStockApi(
  comprobanteId: number,
  items: { sucursalProductoId: number; cantidad: number }[],
  token: string | null,
) {
  const res = await axios.put(
    `${API_URL}/api/Comprobantes/${comprobanteId}/descontar-stock`,
    items,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}
