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
  const res = await axios.post(
    `${API_URL}/api/Comprobantes/GenerarXml`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  notificarVentaRegistrada();
  return res.data as { comprobanteId: number };
}

// Segunda API: envía el comprobante ya guardado a SUNAT.
export async function enviarASunatApi(comprobanteId: number, token: string | null) {
  const res = await axios.post(
    `${API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`,
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
export function logNotaVenta(url: string, payload: unknown) {
  if (process.env.NODE_ENV === "production") return;

  console.groupCollapsed(`%c[NotaVenta] POST ${url}`, "color:#d97706;font-weight:bold");
  console.log("URL:", url);
  console.log("Body:", payload);
  console.log("Body (JSON):", JSON.stringify(payload, null, 2));
  console.groupEnd();
}

// Nota de Venta: documento de control interno, no pasa por SUNAT.
export async function crearNotaVenta(payload: Record<string, unknown>, token: string | null) {
  const url = `${API_URL}/api/NotaVenta`;
  logNotaVenta(url, payload);

  const res = await axios.post(
    url,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  notificarVentaRegistrada();
  return res.data as { comprobanteId?: number; ComprobanteId?: number };
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
