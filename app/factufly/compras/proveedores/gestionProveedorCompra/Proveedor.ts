// ─── Proveedor ────────────────────────────────────────────────
export interface Proveedor {
  proveedorId: number;
  numDocumento: string | null;
  razonSocial: string;
  nombreComercial: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  personaContacto: string | null;
  rucEmpresa: string;
  estado: boolean;
  fechaCreacion: string;
}

// ─── Para crear nuevo proveedor (POST) ────────────────────────
export interface NuevoProveedor {
  numDocumento?: string | null;
  razonSocial: string;
  nombreComercial?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  personaContacto?: string;
  rucEmpresa: string;
}

// ─── Para editar proveedor (PUT) ───────────────────────────────
export interface EditProveedor {
  proveedorId: number;
  numDocumento?: string | null;
  razonSocial: string;
  nombreComercial?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  personaContacto?: string;
}

// ─── Compra a proveedor (detalle, registra ingreso de stock) ──
export interface CompraProveedor {
  compraProveedorId: number;
  proveedorId: number;
  razonSocialProveedor: string | null;
  sucursalId: number;
  nomSucursal: string | null;
  productoId: number;
  nomProducto: string | null;
  precioCompra: number;
  cantidad: number;
  unidadMedida: string | null;
  docReferencia: string | null;
  fechaCreacion: string;
}

// ─── Para registrar una compra (POST) ─────────────────────────
export interface NuevaCompraProveedor {
  proveedorId: number;
  sucursalId: number;
  productoId: number;
  precioCompra: number;
  cantidad: number;
  unidadMedida?: string;
  docReferencia?: string;
}
