// ─── Categoría ───────────────────────────────────────────────
export interface Categoria {
  categoriaId: number;
  empresaRuc: string;
  categoriaNombre: string;
}

// ─── SucursalProducto (precio y stock por sucursal) ──────────
export interface SucursalProducto {
  sucursalProductoId: number;
  nomSucursal: string | null;
  precioUnitario: number;
  stock?: number | null;
  ultimoPrecioCompra?: number | null;
  fechaUltimaCompra?: string | null;
  precioMayorista?: number | null;
  cantidadMinimaMayorista?: number | null;
  enPromocion?: boolean | null;
  porcentajeDescuento?: number | null;
  usuarioId?: number | null;
  ubicacionTienda?: string | null;
  /** Calculado por el backend: fecha de vencimiento más próxima entre los lotes con saldo. Solo lectura. */
  proximoVencimiento?: string | null;
}

// ─── Producto Base (sin datos de sucursal) ───────────────────
export interface ProductoBase {
  productoId: number;
  codigo: string;
  tipoProducto: string | null;
  codigoSunat: string | null;
  nomProducto: string;
  unidadMedida: string;
  tipoAfectacionIGV: string;
  incluirIGV: boolean;
  estado: boolean;
  fechaCreacion: string;
  categoria: Categoria | null;
  urlImagenProducto?: string | null;
  codigoBarras?: string | null;
  esPaquete?: boolean | null;
  productoBaseId?: number | null;
  factorConversion?: number | null;
}

// ─── Producto con datos de sucursal ──────────────────────────
export interface ProductoSucursal extends ProductoBase {
  sucursalProducto: SucursalProducto;
}

// ─── Para crear nuevo producto (POST) ────────────────────────
export interface NuevoProducto {
  codigo: string;
  tipoProducto: string;
  codigoSunat?: string;
  nomProducto: string;
  unidadMedida: string;
  tipoAfectacionIGV: string;
  incluirIGV: boolean;
  categoriaId: number;
  sucursalId: number;
  precioUnitario: number;
  stock?: number | null;
  urlImagenProducto?: string | null;
  codigoBarras?: string | null;
  esPaquete?: boolean | null;
  productoBaseId?: number | null;
  factorConversion?: number | null;
  precioMayorista?: number | null;
  cantidadMinimaMayorista?: number | null;
  enPromocion?: boolean | null;
  porcentajeDescuento?: number | null;
  usuarioId?: number | null;
  ubicacionTienda?: string | null;
}

// ─── Para editar producto (PUT) ───────────────────────────────
export interface EditProducto {
  productoId: number;
  codigo: string;
  tipoProducto: string;
  codigoSunat?: string;
  nomProducto: string;
  unidadMedida: string;
  tipoAfectacionIGV: string;
  incluirIGV: boolean;
  categoriaId: number;
  sucursalProductoId: number;
  precioUnitario: number;
  stock?: number | null;
  urlImagenProducto?: string | null;
  codigoBarras?: string | null;
  esPaquete?: boolean | null;
  productoBaseId?: number | null;
  factorConversion?: number | null;
  precioMayorista?: number | null;
  cantidadMinimaMayorista?: number | null;
  enPromocion?: boolean | null;
  porcentajeDescuento?: number | null;
  usuarioId?: number | null;
  ubicacionTienda?: string | null;
}