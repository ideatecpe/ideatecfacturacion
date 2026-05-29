// ── Interfaces para la respuesta de GET /api/Comprobantes ──

export interface ComprobanteClienteDetalle {
  clienteId: number
  tipoDocumento: string
  numeroDocumento: string
  razonSocial: string
  ubigeo: string
  direccionLineal: string
  departamento: string
  provincia: string
  distrito: string
  correo: string
  enviadoPorCorreo: boolean
  whatsApp: string
  enviadoPorWhatsApp: boolean
}

export interface ComprobanteCompanyDetalle {
  empresaId: number
  numeroDocumento: string
  razonSocial: string
  nombreComercial: string
  establecimientoAnexo: string
  ubigeo: string
  direccionLineal: string
  departamento: string
  provincia: string
  distrito: string
}

export interface ComprobanteDetalleItem {
  detalleId: number
  comprobanteId: number
  item: number
  productoId: number
  codigo: string
  descripcion: string
  cantidad: number
  unidadMedida: string
  precioUnitario: number
  tipoAfectacionIGV: string
  porcentajeIGV: number
  montoIGV: number
  baseIgv: number
  codigoTipoDescuento: string
  descuentoUnitario: number
  descuentoTotal: number
  valorVenta: number
  precioVenta: number
  totalVentaItem: number
  icbper: number
  factorIcbper: number
  trabajadorId?: number | null
}

export interface ComprobantePagoItem {
  comprobanteId: number
  medioPago: string
  monto: number
  fechaPago: string
  numeroOperacion: string | null
  entidadFinanciera: string | null
  observaciones: string
}

export interface ComprobanteCuotaItem {
  comprobanteId: number
  numeroCuota: string
  monto: number
  fechaVencimiento: string
  montoPagado: number | null
  fechaPago: string | null
  estado: string | null
}

export interface ComprobanteLeyenda {
  code: string
  value: string
}

export interface ComprobanteGuia {
  comprobanteId: number
  guiaNumeroCompleto: string
  guiaTipoDoc: string
}

export interface ComprobanteDetraccionItem {
  comprobanteID: number
  codigoBienDetraccion: string
  codigoMedioPago: string
  cuentaBancoDetraccion: string
  porcentajeDetraccion: number
  montoDetraccion: number
  observacion: string
}

export interface Comprobante {
  comprobanteId: number
  ublVersion: string
  tipoOperacion: string
  tipoComprobante: string          
  serie: string
  correlativo: string
  numeroCompleto: string
  tipoCambio: number
  fechaEmision: string
  horaEmision: string
  fechaVencimiento: string
  tipoMoneda: string
  tipoPago: string
  cliente: ComprobanteClienteDetalle
  company: ComprobanteCompanyDetalle
  codigoTipoDescGlobal: string
  descuentoGlobal: number
  totalOperacionesGravadas: number
  totalOperacionesExoneradas: number
  totalOperacionesInafectas: number
  totalOperacionesGratuitas: number
  totalIgvGratuitas: number
  totalIGV: number
  totalImpuestos: number
  totalDescuentos: number
  totalOtrosCargos: number
  totalIcbper: number
  valorVenta: number
  subTotal: number
  importeTotal: number
  montoCredito: number
  tipDocAfectado: string | null     
  numDocAfectado: string | null     
  tipoNotaCreditoDebito: string | null
  motivoNota: string | null
  details: ComprobanteDetalleItem[]
  pagos: ComprobantePagoItem[]
  cuotas: ComprobanteCuotaItem[]
  legends: ComprobanteLeyenda[]
  guias: ComprobanteGuia[]
  detracciones: ComprobanteDetraccionItem[]
  estadoSunat: string
  codigoHashCPE: string | null
  codigoRespuestaSunat: string
  mensajeRespuestaSunat: string
  pdfGenerado: string | null
  enviadoEnResumen: boolean | null
  fechaEnvioSunat: string
  usuarioCreacion: number | null
  fechaCreacion: string
  usuarioModificacion: number | null
  fechaModificacion: string
  comprobanteAfectadoId: number | null
  observaciones: string | null
}

// Interface para listado rápido (sin detalles)
export interface ComprobanteListado {
  comprobanteId: number
  ublVersion: string
  tipoOperacion: string
  tipoComprobante: string
  serie: string
  correlativo: string
  numeroCompleto: string
  tipoCambio: number
  fechaEmision: string
  horaEmision: string
  fechaVencimiento: string
  tipoMoneda: string
  tipoPago: string
  cliente: ComprobanteClienteDetalle
  company: ComprobanteCompanyDetalle
  codigoTipoDescGlobal: string
  descuentoGlobal: number
  totalOperacionesGravadas: number
  totalOperacionesExoneradas: number
  totalOperacionesInafectas: number
  totalOperacionesGratuitas: number
  totalIgvGratuitas: number
  totalIGV: number
  totalImpuestos: number
  totalDescuentos: number
  totalOtrosCargos: number
  totalIcbper: number
  valorVenta: number
  subTotal: number
  importeTotal: number
  montoCredito: number
  comprobanteAfectadoId: number | null
  tipDocAfectado: string | null
  numDocAfectado: string | null
  tipoNotaCreditoDebito: string | null
  motivoNota: string | null
  observaciones: string | null
  estadoSunat: string
  codigoHashCPE: string | null
  codigoRespuestaSunat: string
  mensajeRespuestaSunat: string
  pdfGenerado: string | null
  enviadoEnResumen: boolean | null
  fechaEnvioSunat: string
  usuarioCreacion: number | null
  fechaCreacion: string
  usuarioModificacion: number | null
  fechaModificacion: string
  xmlGenerado: string | null
  xmlRespuestaSunat: string | null
}

// Interface para detalles por id
export interface ComprobanteDetalles {
  comprobanteId: number
  details: ComprobanteDetalleItem[]
  pagos: ComprobantePagoItem[]
  cuotas: ComprobanteCuotaItem[]
  legends: ComprobanteLeyenda[]
  guias: ComprobanteGuia[]
  detracciones: ComprobanteDetraccionItem[]
}