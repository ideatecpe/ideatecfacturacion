"use client";

import React from "react";
import { Trash2, Boxes, Check } from "lucide-react";
import { Proveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/Proveedor";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import { SelectConBuscador } from "@/app/components/ui/SelectConBuscador";
import { cn } from "@/app/utils/cn";

/** Valor centinela usado en los <select> de proveedor para la opción "+ Agregar nuevo proveedor". */
export const NUEVO_PROVEEDOR_VALUE = -1;

export interface LineaCompra {
  key: number;
  proveedorId: number;
  sucursalId: number;
  productoId: number;
  unidadMedida: string;
  cantidad: string;
  precioCompra: string;
  docReferencia: string;
  fechaVencimiento: string;
  /** Estado de guardado de esta línea al registrar la compra (varias líneas se envían una por una). */
  estado?: "guardando" | "guardado" | "error";
}

interface Sucursal {
  sucursalId: number;
  nombre: string;
}

interface Props {
  index: number;
  linea: LineaCompra;
  mostrarProveedor: boolean;
  mostrarSucursal: boolean;
  mostrarDocLinea: boolean;
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
  onAgregarProveedor: (key: number) => void;
}

const inputCls =
  "w-full px-2 py-1.5 text-xs bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 focus:bg-white disabled:opacity-50";

export default function LineaCompraRow({
  index,
  linea,
  mostrarProveedor,
  mostrarSucursal,
  mostrarDocLinea,
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
  onAgregarProveedor,
}: Props) {
  const sucursalIdEfectiva = mostrarSucursal ? linea.sucursalId : sucursalFija?.id ?? 0;

  React.useEffect(() => {
    if (sucursalIdEfectiva > 0) ensureProductos(sucursalIdEfectiva);
  }, [sucursalIdEfectiva]);

  const productosSucursal = productosCache[sucursalIdEfectiva] ?? [];
  const loadingSucursal = productosLoadingIds.has(sucursalIdEfectiva);
  const producto = productosSucursal.find((p) => p.productoId === linea.productoId);
  const subtotal = (Number(linea.cantidad) || 0) * (Number(linea.precioCompra) || 0);

  const esPaquete = !!producto?.esPaquete && !!producto?.factorConversion;
  const productoBase = esPaquete
    ? productosSucursal.find((p) => p.productoId === producto?.productoBaseId)
    : undefined;
  const unidadesEquivalentes = esPaquete
    ? (Number(linea.cantidad) || 0) * (producto?.factorConversion ?? 0)
    : 0;

  return (
    <tr className="hover:bg-gray-50/70 transition-colors">
      <td className="px-2 py-1.5 text-center align-top">
        <span
          title={linea.estado === "guardado" ? "Guardado" : linea.estado === "error" ? "No se pudo guardar" : undefined}
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
            linea.estado === "guardado"
              ? "bg-emerald-100 text-emerald-700"
              : linea.estado === "error"
                ? "bg-rose-100 text-rose-700"
                : "bg-gray-100 text-gray-500",
          )}
        >
          {linea.estado === "guardado" ? <Check className="w-3 h-3" /> : index + 1}
        </span>
      </td>

      {mostrarProveedor && (
        <td className="px-1.5 py-1.5 align-top min-w-[170px]">
          <select
            value={linea.proveedorId}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id === NUEVO_PROVEEDOR_VALUE) {
                onAgregarProveedor(linea.key);
                return;
              }
              onChange(linea.key, "proveedorId", id);
            }}
            disabled={disabled}
            className={`${inputCls} ${errors.proveedorId ? "border-rose-400" : "border-gray-200"}`}
          >
            <option value={0}>Seleccione</option>
            <option value={NUEVO_PROVEEDOR_VALUE} className="font-semibold text-brand-blue">
              + Agregar nuevo proveedor
            </option>
            {proveedores.map((p) => (
              <option key={p.proveedorId} value={p.proveedorId}>
                {p.razonSocial}
              </option>
            ))}
          </select>
        </td>
      )}

      {mostrarSucursal && (
        <td className="px-1.5 py-1.5 align-top">
          <select
            value={linea.sucursalId}
            onChange={(e) => onChange(linea.key, "sucursalId", Number(e.target.value))}
            disabled={disabled}
            className={`${inputCls} ${errors.sucursalId ? "border-rose-400" : "border-gray-200"}`}
          >
            <option value={0}>Seleccione</option>
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
        </td>
      )}

      {mostrarDocLinea && (
        <td className="px-1.5 py-1.5 align-top">
          <input
            type="text"
            value={linea.docReferencia}
            onChange={(e) => onChange(linea.key, "docReferencia", e.target.value)}
            placeholder="N° doc."
            disabled={disabled}
            className={`${inputCls} border-gray-200`}
          />
        </td>
      )}

      <td className="px-1.5 py-1.5 align-top min-w-[220px]">
        <SelectConBuscador
          value={linea.productoId === 0 ? null : linea.productoId}
          onChange={(val) => {
            const id = val ?? 0;
            const seleccionado = productosSucursal.find((p) => p.productoId === id);
            onChange(linea.key, "productoId", id);
            onChange(linea.key, "unidadMedida", seleccionado?.unidadMedida ?? "");
            if (seleccionado?.sucursalProducto?.ultimoPrecioCompra && seleccionado.sucursalProducto.ultimoPrecioCompra > 0) {
              onChange(linea.key, "precioCompra", String(seleccionado.sucursalProducto.ultimoPrecioCompra));
            }
          }}
          disabled={sucursalIdEfectiva === 0 || loadingSucursal || disabled}
          placeholder={loadingSucursal ? "Cargando..." : "Seleccione o busque por código..."}
          showError={!!errors.productoId}
          opciones={productosSucursal.map((p) => ({
            value: p.productoId,
            label: `${p.nomProducto} (${p.codigo})`,
            codigoBarras: p.codigoBarras ?? undefined,
            sublabel: p.sucursalProducto?.ultimoPrecioCompra && p.sucursalProducto.ultimoPrecioCompra > 0
              ? `Último costo: S/ ${p.sucursalProducto.ultimoPrecioCompra.toFixed(2)} · Stock: ${p.sucursalProducto.stock ?? 0}`
              : `Stock: ${p.sucursalProducto?.stock ?? 0}`,
          }))}
        />
        {producto && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[9px] text-blue-600 leading-tight">
              Stock: <strong>{producto.sucursalProducto.stock ?? 0}</strong> · Venta: S/{" "}
              {producto.sucursalProducto.precioUnitario.toFixed(2)}
            </span>
            {producto.codigoBarras && (
              <span className="text-[9px] font-mono text-gray-500 bg-gray-100 px-1 py-0.2 rounded border border-gray-200">
                🏷️ {producto.codigoBarras}
              </span>
            )}
          </div>
        )}
        {esPaquete && (
          <p
            className="text-[9px] text-amber-600 mt-0.5 leading-tight font-semibold flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis"
            title={`Solo se compra en paquetes enteros. Equivale a ${unidadesEquivalentes} ${productoBase?.unidadMedida ?? "unidades"}${productoBase ? ` de ${productoBase.nomProducto}` : ""}.`}
          >
            <Boxes className="w-2.5 h-2.5 shrink-0" />
            Solo paquetes enteros · = {unidadesEquivalentes}{" "}
            {productoBase?.unidadMedida ?? "unidades"}
            {productoBase ? ` de ${productoBase.nomProducto}` : ""}
          </p>
        )}
      </td>

      <td className="px-1.5 py-1.5 align-top w-[100px]">
        <div className="relative">
          <input
            type="number"
            min={0}
            step={esPaquete ? 1 : "any"}
            value={linea.cantidad}
            onChange={(e) => onChange(linea.key, "cantidad", e.target.value)}
            placeholder="0"
            disabled={disabled}
            className={`${inputCls} ${linea.unidadMedida ? "pr-9" : ""} ${
              errors.cantidad ? "border-rose-400" : "border-gray-200"
            }`}
          />
          {linea.unidadMedida && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase pointer-events-none">
              {linea.unidadMedida}
            </span>
          )}
        </div>
      </td>

      <td className="px-1.5 py-1.5 align-top w-[115px]">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 pointer-events-none">
            S/
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={linea.precioCompra}
            onChange={(e) => onChange(linea.key, "precioCompra", e.target.value)}
            placeholder="0.00"
            disabled={disabled}
            className={`${inputCls} pl-6 ${errors.precioCompra ? "border-rose-400" : "border-gray-200"}`}
          />
        </div>
        {producto?.sucursalProducto?.ultimoPrecioCompra && producto.sucursalProducto.ultimoPrecioCompra > 0 && (
          <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">
            Últ. costo: <strong>S/ {producto.sucursalProducto.ultimoPrecioCompra.toFixed(2)}</strong>
          </p>
        )}
      </td>

      <td className="px-1.5 py-1.5 align-top w-[130px]">
        <input
          type="date"
          value={linea.fechaVencimiento}
          onChange={(e) => onChange(linea.key, "fechaVencimiento", e.target.value)}
          disabled={disabled}
          className={`${inputCls} border-gray-200`}
        />
      </td>

      <td className="px-1.5 py-1.5 align-top w-[95px]">
        <div className="px-2 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md text-right">
          {subtotal.toFixed(2)}
        </div>
      </td>

      <td className="px-1.5 py-1.5 text-center align-top w-8">
        <button
          type="button"
          onClick={() => onRemove(linea.key)}
          disabled={!canRemove || disabled}
          className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
