export interface SirePeriodoDto {
  periodo: string | null;
  estado: string | null;
  descripcion: string | null;
}

export interface SireEjercicioDto {
  anio: string | null;
  periodos: SirePeriodoDto[];
}

export interface SirePeriodosResponse {
  success: boolean;
  mensaje: string | null;
  ejercicios: SireEjercicioDto[];
  respuestaCruda: string | null;
}

export interface SireComprobanteDto {
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  periodo: string | null;
  carSunat: string | null;
  fechaEmision: string | null;
  fechaVctoPago: string | null;
  tipoComprobante: string | null;
  serie: string | null;
  numero: string | null;
  tipoDocCliente: string | null;
  numDocCliente: string | null;
  razonSocialCliente: string | null;
  baseImponible: number;
  igv: number;
  mtoExonerado: number;
  mtoInafecto: number;
  importeTotal: number;
  activo: boolean;
  tipoCambio: number | null;
  codMoneda: string | null;
  inconsistencias: string | null;
  fechaEmisionDocModificado: string | null;
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

export interface SireComprobanteEliminarDto {
  numSerieCDP: string;
  numCDP: string;
  codCar: string;
  codTipoCDP: string;
}

export interface SireEliminarComprobanteResponse {
  success: boolean;
  mensaje: string | null;
}

export interface SireComprobanteNuevoDto {
  fechaEmision: string; // dd/mm/aaaa
  fechaVctoPago?: string | null;
  tipoComprobante: string;
  serie: string;
  numero: string;
  tipoDocCliente?: string | null;
  numDocCliente?: string | null;
  razonSocialCliente?: string | null;
  baseImponible: number;
  igv: number;
  importeTotal: number;
  codMoneda: string;
  tipoCambio?: number | null;
  valorFacturadoExportacion?: number;
  mtoExonerado?: number;
  mtoInafecto?: number;
  isc?: number;
  icbper?: number;
  fechaEmisionDocModificado?: string | null;
  tipoCPModificado?: string | null;
  serieCPModificado?: string | null;
  nroCPModificado?: string | null;
}

export interface SireImportarComprobantesResponse {
  success: boolean;
  mensaje: string | null;
  numTicket: string | null;
}

export interface SireEditarTipoCambioDto {
  codCar: string;
  codMoneda: string;
  mtoTipoCambio: number;
  mtoCambioMonedaExt?: number | null;
}

export interface SireEditarTipoCambioResponse {
  success: boolean;
  mensaje: string | null;
}

// RCE (Registro de Compras Electrónico): comprobantes que otras empresas emitieron a favor del RUC consultado.
// Solo consulta/descarga (no forma parte del flujo de aceptar propuesta / cerrar mes, exclusivo de RVIE).
export interface SireComprobanteCompraDto {
  rucProveedor: string | null;
  razonSocialProveedor: string | null;
  periodo: string | null;
  carSunat: string | null;
  fechaEmision: string | null;
  tipoComprobante: string | null;
  serie: string | null;
  numero: string | null;
  baseImponible: number;
  igv: number;
  mtoExonerado: number;
  mtoInafecto: number;
  importeTotal: number;
  codMoneda: string | null;
  tipoCambio: number | null;
  activo: boolean;
  inconsistencias: string | null;
}

export interface SireDescargarPropuestaComprasResponse {
  success: boolean;
  mensaje: string | null;
  numTicket: string | null;
  comprobantes: SireComprobanteCompraDto[];
}

export interface SireComprobanteCompraEliminarDto {
  numSerieCDP: string;
  numCDP: string;
  codCar: string;
  codTipoCDP: string;
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
