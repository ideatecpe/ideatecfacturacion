export interface RendimientoVentas {
  fecha: string
  totalVentas: number
  totalNotasVenta: number
  totalComision: number
}

export interface ComprobanteReciente {
  comprobanteID: number
  numeroCompleto: string
  tipoComprobante: string
  clienteRznSocial: string
  fechaEmision: string
  importeTotal: number
  estadoSunat: string
}

export interface DashboardData {
  ventasDelDia: number
  ventasNetas: number
  ganancias: number
  totalComisionTarjetaDelDia: number
  facturasEmitidas: number
  boletasEmitidas: number
  notasCreditoEmitidas: number
  notasDebitoEmitidas: number
  notasVentaEmitidas: number
  totalNotasVentaDelDia: number
  totalNotasCreditoDelDia: number
  totalNotasCreditoOtrasFechas: number
  totalNotasDebitoDelDia: number
  totalNotasDebitoOtrasFechas: number
  rendimientoVentas: RendimientoVentas[]
  comprobantesRecientes: ComprobanteReciente[]
}