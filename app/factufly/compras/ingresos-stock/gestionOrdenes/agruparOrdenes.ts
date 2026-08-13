// gestionOrdenes/agruparOrdenes.ts
//
// Una "orden de compra" puede registrar varias líneas de producto (una fila
// CompraProveedor por producto). Para contar "órdenes" reales (no líneas),
// agrupamos por proveedor + sucursal + doc. referencia + fecha (sin hora).

import { CompraProveedor } from "../../proveedores/gestionProveedorCompra/Proveedor";

function fechaSinHora(fecha?: string | null): string {
  if (!fecha) return "sin-fecha";
  return fecha.slice(0, 10);
}

export function claveOrden(c: CompraProveedor): string {
  const doc = c.docReferencia?.trim() || `sin-doc-${c.compraProveedorId}`;
  return `${c.proveedorId}-${c.sucursalId}-${doc}-${fechaSinHora(c.fechaCreacion)}`;
}

export function contarOrdenes(compras: CompraProveedor[]): number {
  return new Set(compras.map(claveOrden)).size;
}

export interface GrupoOrden {
  clave: string;
  docReferencia: string | null;
  fechaCreacion: string | null;
  proveedorId: number;
  razonSocialProveedor: string | null;
  sucursalId: number;
  nomSucursal: string | null;
  items: CompraProveedor[];
  totalInvertido: number;
}

/** Agrupa líneas de compra en "órdenes" reales (mismo proveedor + sucursal + doc + fecha),
 * para mostrarlas como bloques con su detalle y total, en vez de filas sueltas. */
export function agruparPorDocumento(compras: CompraProveedor[]): GrupoOrden[] {
  const grupos = new Map<string, GrupoOrden>();

  compras.forEach((c) => {
    const clave = claveOrden(c);
    const existente = grupos.get(clave);
    const subtotal = (c.precioCompra ?? 0) * (c.cantidad ?? 0);

    if (existente) {
      existente.items.push(c);
      existente.totalInvertido += subtotal;
    } else {
      grupos.set(clave, {
        clave,
        docReferencia: c.docReferencia,
        fechaCreacion: c.fechaCreacion,
        proveedorId: c.proveedorId,
        razonSocialProveedor: c.razonSocialProveedor,
        sucursalId: c.sucursalId,
        nomSucursal: c.nomSucursal,
        items: [c],
        totalInvertido: subtotal,
      });
    }
  });

  return Array.from(grupos.values()).sort((a, b) => {
    const fa = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
    const fb = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
    return fb - fa;
  });
}
