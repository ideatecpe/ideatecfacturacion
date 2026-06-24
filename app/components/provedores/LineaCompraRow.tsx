"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { Proveedor } from "@/app/factufly/proveedores/gestionProveedorCompra/Proveedor";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";

export interface LineaCompra {
  key: number;
  proveedorId: number;
  sucursalId: number;
  productoId: number;
  unidadMedida: string;
  cantidad: string;
  precioCompra: string;
  docReferencia: string;
}

interface Sucursal {
  sucursalId: number;
  nombre: string;
}

interface Props {
  linea: LineaCompra;
  modoProveedor: "unico" | "varios";
  modoSucursal: "fijo" | "porItem";
  modoDoc: "unico" | "porLinea";
  proveedores: Proveedor[];
  sucursales: Sucursal[];
  sucursalFija?: { id: number; nombre: string };
  productosCache: Record<number, ProductoSucursal[]>;
  productosLoadingIds: Set<number>;
  ensureProductos: (sucursalId: number) => void;
  errors: Record<string, boolean>;
  disabled: boolean;
  canRemove: boolean;
  onChange: (key: number, field: keyof Omit<LineaCompra, "key">, value: string | number) => void;
  onRemove: (key: number) => void;
}

export default function LineaCompraRow({
  linea,
  modoProveedor,
  modoSucursal,
  modoDoc,
  proveedores,
  sucursales,
  sucursalFija,
  productosCache,
  productosLoadingIds,
  ensureProductos,
  errors,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: Props) {
  const sucursalIdEfectiva =
    modoSucursal === "porItem" ? linea.sucursalId : sucursalFija?.id ?? 0;

  React.useEffect(() => {
    if (sucursalIdEfectiva > 0) ensureProductos(sucursalIdEfectiva);
  }, [sucursalIdEfectiva]);

  const productosSucursal = productosCache[sucursalIdEfectiva] ?? [];
  const loadingSucursal = productosLoadingIds.has(sucursalIdEfectiva);

  const producto = productosSucursal.find((p) => p.productoId === linea.productoId);

  const mostrarProveedor = modoProveedor === "varios";
  const mostrarSucursal = modoSucursal === "porItem";
  const mostrarDocLinea = modoProveedor === "varios" && modoDoc === "porLinea";

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
      {(mostrarProveedor || mostrarSucursal || mostrarDocLinea) && (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: [
              mostrarProveedor ? "1fr" : null,
              mostrarSucursal ? "1fr" : null,
              mostrarDocLinea ? "1fr" : null,
            ]
              .filter(Boolean)
              .join(" "),
          }}
        >
          {mostrarProveedor && (
            <select
              value={linea.proveedorId}
              onChange={(e) => onChange(linea.key, "proveedorId", Number(e.target.value))}
              disabled={disabled}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none focus:border-brand-blue disabled:opacity-50 ${
                errors.proveedorId ? "border-rose-400" : "border-gray-200"
              }`}
            >
              <option value={0}>Seleccione proveedor</option>
              {proveedores.map((p) => (
                <option key={p.proveedorId} value={p.proveedorId}>
                  {p.razonSocial}
                </option>
              ))}
            </select>
          )}

          {mostrarSucursal && (
            <select
              value={linea.sucursalId}
              onChange={(e) => onChange(linea.key, "sucursalId", Number(e.target.value))}
              disabled={disabled}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none focus:border-brand-blue disabled:opacity-50 ${
                errors.sucursalId ? "border-rose-400" : "border-gray-200"
              }`}
            >
              <option value={0}>Seleccione sucursal</option>
              {sucursales.map((s) => (
                <option key={s.sucursalId} value={s.sucursalId}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}

          {mostrarDocLinea && (
            <input
              type="text"
              value={linea.docReferencia}
              onChange={(e) => onChange(linea.key, "docReferencia", e.target.value)}
              placeholder="N° doc. de este proveedor"
              disabled={disabled}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue disabled:opacity-50"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_120px_auto] gap-2 items-start">
        <div className="space-y-1">
          <select
            value={linea.productoId}
            onChange={(e) => {
              const id = Number(e.target.value);
              const seleccionado = productosSucursal.find((p) => p.productoId === id);
              onChange(linea.key, "productoId", id);
              onChange(linea.key, "unidadMedida", seleccionado?.unidadMedida ?? "");
            }}
            disabled={sucursalIdEfectiva === 0 || loadingSucursal || disabled}
            className={`w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none focus:border-brand-blue disabled:opacity-50 ${
              errors.productoId ? "border-rose-400" : "border-gray-200"
            }`}
          >
            <option value={0}>
              {loadingSucursal ? "Cargando productos..." : "Seleccione un producto"}
            </option>
            {productosSucursal.map((p) => (
              <option key={p.productoId} value={p.productoId}>
                {p.nomProducto} ({p.codigo})
              </option>
            ))}
          </select>
          {producto && (
            <p className="text-[10px] text-blue-600">
              Unidad: <strong>{producto.unidadMedida}</strong> · Stock actual:{" "}
              {producto.sucursalProducto.stock ?? 0} · Venta: S/{" "}
              {producto.sucursalProducto.precioUnitario.toFixed(2)}
            </p>
          )}
        </div>

        <input
          type="number"
          value={linea.cantidad}
          onChange={(e) => onChange(linea.key, "cantidad", e.target.value)}
          placeholder="Cantidad"
          disabled={disabled}
          className={`w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none focus:border-brand-blue disabled:opacity-50 ${
            errors.cantidad ? "border-rose-400" : "border-gray-200"
          }`}
        />

        <input
          type="number"
          step="0.01"
          value={linea.precioCompra}
          onChange={(e) => onChange(linea.key, "precioCompra", e.target.value)}
          placeholder="Precio compra"
          disabled={disabled}
          className={`w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none focus:border-brand-blue disabled:opacity-50 ${
            errors.precioCompra ? "border-rose-400" : "border-gray-200"
          }`}
        />

        <button
          type="button"
          onClick={() => onRemove(linea.key)}
          disabled={!canRemove || disabled}
          className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
