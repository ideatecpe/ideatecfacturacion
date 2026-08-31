// ─── Lote de compra (capa PEPS) ────────────────────────────────
export interface LoteReporte {
  inventarioLoteId: number;
  origen: string; // "COMPRA" | "SALDO_INICIAL" | "DEVOLUCION_VENTA" | "AJUSTE"
  fechaLote: string;
  cantidadOriginal: number;
  costoUnitario: number;
  saldoCantidad: number;
  saldoValor: number;
  fechaVencimiento: string | null;
}

// ─── Movimiento de Kardex ───────────────────────────────────────
export interface KardexMovimiento {
  kardexMovimientoId: number;
  sucursalProductoId: number;
  tipoMovimiento: string; // "ENTRADA_COMPRA" | "ENTRADA_SALDO_INICIAL" | "SALIDA_VENTA" | "SALIDA_NOTA" | "ENTRADA_DEVOLUCION" | "AJUSTE"
  referenciaTipo: string | null;
  referenciaId: number | null;
  comprobanteDetalleId: number | null;
  cantidad: number;
  costoUnitarioPromedio: number | null;
  costoTotal: number | null;
  saldoCantidadPost: number;
  saldoValorPost: number;
  fechaMovimiento: string;
  lotesConsumidos: number;
  // Qué se vendió realmente en esa línea (puede ser un paquete, no el producto base
  // cuyo stock ledger es este). Igual que en RentabilidadProducto.esPaquete.
  productoId: number | null;
  nomProducto: string | null;
  codigo: string | null;
  esPaquete: boolean;
  cantidadVenta: number;
  costoVenta: number | null;
}

// ─── Stock valorizado (por producto, con detalle de lotes) ─────
export interface StockValorizado {
  sucursalProductoId: number;
  nomProducto: string | null;
  codigo: string | null;
  stockActual: number;
  valorTotal: number;
  costoPromedioActual: number;
  lotes: LoteReporte[];
}

// ─── Rentabilidad por producto (ingreso vs costo PEPS) ──────────
export interface RentabilidadProducto {
  productoId: number;
  sucursalProductoId: number;
  nomProducto: string | null;
  codigo: string | null;
  esPaquete: boolean;
  cantidadVendida: number;
  ingresoVentas: number;
  costoVentas: number;
  utilidadBruta: number;
  margenPorcentaje: number;
}

// ─── Rentabilidad diaria de un producto (para el gráfico de evolución) ──
export interface RentabilidadDiaria {
  fecha: string;
  cantidadVendida: number;
  ingresoVentas: number;
  costoVentas: number;
  utilidadBruta: number;
  margenPorcentaje: number;
}

// ─── Lote vencido (vista previa de solo lectura antes de retirar) ──────
export interface LoteVencido {
  inventarioLoteId: number;
  sucursalProductoId: number;
  nomProducto: string | null;
  codigo: string | null;
  origen: string;
  fechaLote: string;
  fechaVencimiento: string;
  saldoCantidad: number;
  costoUnitario: number;
}
