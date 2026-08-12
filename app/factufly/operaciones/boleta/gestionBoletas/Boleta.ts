export interface BoletaCliente {
  clienteId: number | null 
  tipoDocumento: string
  numeroDocumento: string
  razonSocial: string
  ubigeo: string
  direccionLineal: string
  departamento: string
  provincia: string
  distrito: string
}

export interface BoletaCompany {
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

export interface BoletaDetalle {
  //detalleId: number
  //comprobanteId: number
  item: number
  productoId: number | null
  codigo: string | null
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
}

export interface BoletaPago {
  //comprobanteId: number
  medioPago: string
  monto: number
  fechaPago: string
  numeroOperacion: string
  entidadFinanciera: string
  observaciones: string
}

export interface BoletaCuota {
  //comprobanteId: number
  numeroCuota: string
  monto: number
  fechaVencimiento: string
  //montoPagado: string
  //fechaPago: string
  //estado: string
}

export interface BoletaLegend {
  code: string
  value: string
}

export interface BoletaGuia {
  //comprobanteId: number
  guiaNumeroCompleto: string
  guiaTipoDoc: string
}

export interface BoletaDetraccion {
  //comprobanteID: number
  codigoBienDetraccion: string
  codigoMedioPago: string
  cuentaBancoDetraccion: string
  porcentajeDetraccion: number
  montoDetraccion: number
  observacion: string
}

export interface Boleta {
  ublVersion: string
  tipoOperacion: string
  tipoComprobante: string
  serie: string
  correlativo: string
  fechaEmision: string
  horaEmision: string
  fechaVencimiento: string
  tipoMoneda: string
  tipoCambio?: number
  tipoPago: string
  cliente: BoletaCliente
  company: BoletaCompany
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
  totalComisionPagoTarjeta?: number | null
  details: BoletaDetalle[]
  pagos: BoletaPago[]
  cuotas: BoletaCuota[]
  legends: BoletaLegend[]
  guias: BoletaGuia[]
  detracciones: BoletaDetraccion[]
}

export interface Sucursal {
  sucursalId: number
  empresaRuc: string
  codEstablecimiento: string
  nombre: string
  direccion: string
  numeroStockBajo?: string | null
  serieFactura: string
  correlativoFactura: number
  serieBoleta: string
  correlativoBoleta: number
  serieNotaCreditoFactura: string
  correlativoNotaCreditoFactura: number
  serieNotaCreditoBoleta: string
  correlativoNotaCreditoBoleta: number
  serieNotaDebitoFactura: string
  correlativoNotaDebitoFactura: number
  serieNotaDebitoBoleta: string
  correlativoNotaDebitoBoleta: number
  serieGuiaRemision: string
  correlativoGuiaRemision: number
  serieGuiaTransportista: string
  correlativoGuiaTransportista: number
  serieNotaVenta?: string
  correlativoNotaVenta?: number
  estado: boolean
}