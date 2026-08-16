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

// Nota de Venta: documento de control interno, no pasa por SUNAT.
export async function crearNotaVenta(payload: Record<string, unknown>, token: string | null) {
  const res = await axios.post(
    `${API_URL}/api/NotaVenta`,
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
