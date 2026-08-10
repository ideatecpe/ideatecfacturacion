import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Primera API: guarda el comprobante en BD y asigna serie/correlativo real.
export async function generarXml(payload: Record<string, unknown>, token: string | null) {
  const res = await axios.post(
    `${API_URL}/api/Comprobantes/GenerarXml`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
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
