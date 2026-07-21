export interface SirePeriodoDto {
  periodo: string | null;
  estado: string | null;
  descripcion: string | null;
}

export interface SirePeriodosResponse {
  success: boolean;
  mensaje: string | null;
  periodos: SirePeriodoDto[];
  respuestaCruda: string | null;
}

export interface SireComprobanteDto {
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  periodo: string | null;
  carSunat: string | null;
  correlativo: string | null;
  fechaEmision: string | null;
  tipoComprobante: string | null;
  serie: string | null;
  numero: string | null;
  tipoDocCliente: string | null;
  numDocCliente: string | null;
  razonSocialCliente: string | null;
  baseImponible: number;
  igv: number;
  importeTotal: number;
  activo: boolean;
  tipoCambio: number | null;
  codMoneda: string | null;
  inconsistencias: string | null;
}

export interface SireDescargarPropuestaResponse {
  success: boolean;
  mensaje: string | null;
  numTicket: string | null;
  comprobantes: SireComprobanteDto[];
}

export interface SireAceptarPropuestaResponse {
  success: boolean;
  numTicket: string | null;
  mensaje: string | null;
  respuestaCruda: string | null;
}

export interface SireRegistrarPreliminarResponse {
  success: boolean;
  mensaje: string | null;
  respuestaCruda: string | null;
}

export interface SireRegistro {
  id: number;
  rucEmpresa: string;
  perTributario: string;
  numTicket: string | null;
  estado: string;
  respuestaSunat: string | null;
  mensaje: string | null;
  fechaConsulta: string | null;
  fechaCierre: string | null;
  creadoEn: string;
  actualizadoEn: string | null;
}
