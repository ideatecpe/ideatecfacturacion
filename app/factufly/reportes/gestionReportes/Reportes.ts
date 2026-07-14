export type Periodo = 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado'

// ── KPI ────────────────────────────────────────────────────────────────────────
export interface KpiData {
  totalVentas: number
  totalIGV: number
  totalDocumentos: number
  totalVentasAnterior: number
  totalIGVAnterior: number
  totalDocumentosAnterior: number
}

// ── Gráfico ────────────────────────────────────────────────────────────────────
export interface GraficoBarra {
  etiqueta: string
  ventas: number
  igv: number
  ventasNV: number
}

// ── Distribución donut ─────────────────────────────────────────────────────────
export interface DistribucionDocumentos {
  facturas: number
  boletas: number
  notasCredito: number
  notasDebito: number
  notasVenta: number
  totalNotasVenta: number
}

// ── Tabla clientes ─────────────────────────────────────────────────────────────
export interface ClienteResumen {
  clienteRznSocial: string
  clienteNumDoc: string
  numDocs: number
  subtotal: number
  igv: number
  total: number
}

export interface TotalesClientes {
  totalDocs: number
  totalSubtotal: number
  totalIgv: number
  totalGeneral: number
}

// ── Response principal ─────────────────────────────────────────────────────────
export interface ReportesData {
  kpi: KpiData
  grafico: GraficoBarra[]
  distribucion: DistribucionDocumentos
  topClientes: ClienteResumen[]
  totalesClientes: TotalesClientes
}

// ── Export Excel ───────────────────────────────────────────────────────────────
export interface ClienteExport extends ClienteResumen {}

// ── Params hooks ───────────────────────────────────────────────────────────────
export interface ReportesEmpresaParams {
  ruc: string
  periodo: Periodo
  desde?: string | null
  hasta?: string | null
  limite?: number
  usuarioId?: number | null
}

export interface ReportesSucursalParams {
  sucursalId: number
  periodo: Periodo
  desde?: string | null
  hasta?: string | null
  limite?: number
  usuarioId?: number | null
}

// ── Medios de pago ─────────────────────────────────────────────────────────────
export interface MedioPagoTop {
  medioPago: string
  vecesUsado: number
  montoTotal: number
  promedioMonto: number
}

// ── Productos top ──────────────────────────────────────────────────────────────
export interface ProductoTop {
  codigo: string
  descripcion: string
  totalCantidad: number
  totalMonto: number
  totalIGV: number
  vecesVendido: number
  precioPromedio: number
}

// ── Listado comprobante ────────────────────────────────────────────────────────
export interface ListadoReporte {
  comprobanteId: number
  numeroCompleto: string
  tipoComprobante: string
  fechaEmision: string
  tipoMoneda: string
  valorVenta: number
  totalIGV: number
  importeTotal: number
  estadoSunat: string
  cliente: {
    razonSocial: string
    numeroDocumento: string
  }
}

// ── Params reportes avanzados ──────────────────────────────────────────────────
export interface ReportesAvanzadosParams {
  ruc: string
  codEstablecimiento?: string | null
  fechaDesde?: string | null
  fechaHasta?: string | null
  usuarioCreacion?: number | null
  clienteNumDoc?: string | null
  limit?: number | null
  orderBy?: 'monto' | 'cantidad' | 'veces'
  filtroNV?: FiltroNV | null
}

// ── Modal filtros ──────────────────────────────────────────────────────────────
export type FiltroNV = 'excluir' | 'incluir' | 'solo'

export interface FiltrosReporteModal {
  codEstablecimiento?: string | null
  fechaDesde?: string | null
  fechaHasta?: string | null
  usuarioCreacion?: number | null
  clienteNumDoc?: string | null
  limit?: number | null
  orderBy?: 'monto' | 'cantidad' | 'veces'
  tituloPersonalizado?: string | null
  filtroNV?: FiltroNV | null
}