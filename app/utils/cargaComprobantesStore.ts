import { ComprobanteListado } from "@/app/factufly/comprobantes/gestionComprobantes/Comprobante";

export const CARGA_COMPROBANTES_KEY = "factufly:carga-comprobantes:pendientes";

export type CargaComprobantePendiente = ComprobanteListado & {
  _cargaEstatica?: true;
  _itemsCarga?: {
    placa: string;
    concepto: string;
    fechaInicio: string;
    fechaFin: string;
    importe: number;
  }[];
};

export function leerComprobantesCarga(): CargaComprobantePendiente[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CARGA_COMPROBANTES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function guardarComprobantesCarga(comprobantes: CargaComprobantePendiente[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CARGA_COMPROBANTES_KEY, JSON.stringify(comprobantes));
}

export function agregarComprobantesCarga(comprobantes: CargaComprobantePendiente[]) {
  const prev = leerComprobantesCarga();
  guardarComprobantesCarga([...comprobantes, ...prev]);
}

export function marcarComprobanteCargaEnviado(comprobanteId: number) {
  const actualizados = leerComprobantesCarga().map((comprobante) =>
    comprobante.comprobanteId === comprobanteId
      ? {
          ...comprobante,
          estadoSunat: "ACEPTADO",
          fechaEnvioSunat: new Date().toISOString(),
          mensajeRespuestaSunat: "Enviado a SUNAT en modo estático",
        }
      : comprobante,
  );
  guardarComprobantesCarga(actualizados);
  return actualizados.find((c) => c.comprobanteId === comprobanteId);
}
