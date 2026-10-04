// ── Listado de comprobantes a crédito ─────────────────────────────────────────
export interface CuentaPorCobrar {
  comprobanteId: number
  tipoComprobante: string
  serie: string
  correlativo: number
  numeroCompleto: string
  fechaEmision: string
  fechaVencimiento: string
  tipoMoneda: string
  estadoSunat: string
  establecimientoAnexo: string
  usuarioCreacion: number
  clienteNumDoc: string
  clienteRznSocial: string
  clienteCorreo: string
  clienteWhatsApp: string
  valorVenta: number
  totalIGV: number
  importeTotal: number
  montoCredito: number
  tipoPago: string
  // Crédito menos los abonos ya registrados
  saldoPendiente: number | null
}

// ── Cuota ─────────────────────────────────────────────────────────────────────
export interface Cuota {
  cuotaId: number
  comprobanteId: number
  numeroCuota: string
  monto: number
  fechaVencimiento: string
  montoPagado: number | null
  fechaPago: string | null
  estado: string | null
  usuarioRegistroPago: number | null
}

// ── Historial de pagos de una cuota ──────────────────────────────────────────
export interface CuotaPago {
  cuotaPagoId: number
  cuotaId: number
  montoPagado: number
  fechaPago: string
  medioPago: string | null
  entidadFinanciera: string | null
  numeroOperacion: string | null
  observaciones: string | null
  usuarioRegistroPago: number | null
  fechaRegistro: string
}

// ── Comprobante con cuotas ────────────────────────────────────────────────────
export interface ComprobanteConCuotas {
  comprobanteId: number
  tipoComprobante: string
  serie: string
  correlativo: number
  numeroCompleto: string
  fechaEmision: string
  fechaVencimiento: string
  tipoMoneda: string
  estadoSunat: string
  establecimientoAnexo: string
  usuarioCreacion: number
  clienteNumDoc: string
  clienteRznSocial: string
  clienteCorreo: string
  clienteWhatsApp: string
  valorVenta: number
  totalIGV: number
  importeTotal: number
  montoCredito: number
  tipoPago: string
  cuotas: Cuota[]
}

// ── Payload pagar cuota ───────────────────────────────────────────────────────
export interface PagarCuotaPayload {
  cuotaId: number
  montoPagado: number
  fechaPago: string
  medioPago: string
  entidadFinanciera?: string | null
  numeroOperacion?: string | null
  observaciones?: string | null
  usuarioRegistroPago: number
}

// ── Filtros listado ───────────────────────────────────────────────────────────
export interface FiltrosCuentasPorCobrar {
  empresaRuc: string
  establecimientoAnexo?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
  clienteNumDoc?: string | null
}

// ── Cobro por cliente ─────────────────────────────────────────────────────────
// clienteClave identifica al cliente: su documento, o "SD|NOMBRE" cuando la venta
// salió sin documento (Clientes Varios), para no juntar a todos en una deuda.
export interface ResumenClienteCuenta {
  clienteClave: string
  clienteNumDoc: string | null
  clienteRznSocial: string | null
  clienteWhatsApp: string | null
  tipoMoneda: string
  cantidadComprobantes: number
  saldoPendiente: number
  fechaEmisionMasAntigua: string | null
  fechaVencimientoMasAntigua: string | null
  sinDocumento: boolean
}

export interface ComprobantePendienteCliente {
  comprobanteId: number
  tipoComprobante: string
  numeroCompleto: string
  fechaEmision: string
  tipoMoneda: string
  clienteNumDoc: string | null
  clienteRznSocial: string | null
  importeTotal: number
  montoCredito: number
  montoPagado: number
  saldo: number
  cuotasPendientes: number
  fechaVencimientoProxima: string | null
}

export interface PagarClientePayload {
  empresaRuc: string
  establecimientoAnexo: string | null
  clienteClave: string
  tipoMoneda: string
  comprobanteIds: number[]
  montoPagado: number
  fechaPago: string
  medioPago: string
  entidadFinanciera: string | null
  numeroOperacion: string | null
  observaciones: string | null
  usuarioRegistroPago: number
}

export interface PagoClienteDetalle {
  comprobanteId: number
  numeroCompleto: string | null
  fechaEmision: string | null
  cuotaId: number
  numeroCuota: string | null
  saldoAnterior: number
  montoAplicado: number
  saldoRestante: number
  estado: string
}

export interface PagoClienteResultado {
  montoAplicado: number
  saldoSeleccionAnterior: number
  saldoSeleccionRestante: number
  saldoClienteRestante: number
  detalle: PagoClienteDetalle[]
}

// Línea de un comprobante pagado: para que el cliente vea en qué gastó
export interface ProductoComprobante {
  comprobanteId: number
  item: number
  descripcion: string | null
  cantidad: number
  unidadMedida: string | null
  precioVenta: number
  total: number
}
