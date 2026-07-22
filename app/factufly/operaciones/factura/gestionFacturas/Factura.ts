export interface FacturaCliente {
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

export interface FacturaCompany {
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

export interface FacturaDetalle {
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

export interface FacturaPago {
  medioPago: string
  monto: number
  fechaPago: string
  numeroOperacion: string
  entidadFinanciera: string
  observaciones: string
}

export interface FacturaCuota {
  numeroCuota: string
  monto: number
  fechaVencimiento: string
}

export interface FacturaLegend {
  code: string
  value: string
}

export interface FacturaGuia {
  guiaNumeroCompleto: string
  guiaTipoDoc: string
}

export interface FacturaDetraccion {
  codigoBienDetraccion: string
  codigoMedioPago: string
  cuentaBancoDetraccion: string
  porcentajeDetraccion: number
  montoDetraccion: number
  observacion: string
}

export interface Factura {
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
  cliente: FacturaCliente
  company: FacturaCompany
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
  details: FacturaDetalle[]
  pagos: FacturaPago[]
  cuotas: FacturaCuota[]
  legends: FacturaLegend[]
  guias: FacturaGuia[]
  detracciones: FacturaDetraccion[]
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
  estado: boolean
}