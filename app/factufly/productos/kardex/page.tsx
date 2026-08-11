"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar, PackageSearch, X, Lock } from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
import { useKardexLista } from "../useKardexLista";

const TIPO_LABEL: Record<string, string> = {
  ENTRADA_COMPRA: "Entrada por compra",
  ENTRADA_SALDO_INICIAL: "Saldo inicial",
  ENTRADA_DEVOLUCION: "Entrada por devolución",
  SALIDA_VENTA: "Salida por venta",
  SALIDA_NOTA: "Salida por nota",
  SALIDA_VENCIMIENTO: "Salida por vencimiento",
  AJUSTE: "Ajuste",
};

const TIPO_STYLE: Record<string, { badge: string; cantidad: string; signo: string; fila: string }> = {
  ENTRADA_COMPRA: {
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    cantidad: "text-blue-700",
    signo: "+",
    fila: "border-l-2 border-l-blue-300",
  },
  ENTRADA_SALDO_INICIAL: {
    badge: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
    cantidad: "text-gray-700",
    signo: "+",
    fila: "border-l-2 border-l-gray-300",
  },
  ENTRADA_DEVOLUCION: {
    badge: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200",
    cantidad: "text-fuchsia-700",
    signo: "+",
    fila: "border-l-2 border-l-fuchsia-300",
  },
  SALIDA_VENTA: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    cantidad: "text-emerald-700",
    signo: "−",
    fila: "border-l-2 border-l-emerald-300",
  },
  SALIDA_NOTA: {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    cantidad: "text-amber-700",
    signo: "−",
    fila: "border-l-2 border-l-amber-300",
  },
  SALIDA_VENCIMIENTO: {
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    cantidad: "text-rose-700",
    signo: "−",
    fila: "border-l-2 border-l-rose-300",
  },
  AJUSTE: {
    badge: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
    cantidad: "text-purple-700",
    signo: "±",
    fila: "border-l-2 border-l-purple-300",
  },
};

const TIPO_STYLE_DEFAULT = {
  badge: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  cantidad: "text-gray-700",
  signo: "",
  fila: "border-l-2 border-l-gray-200",
};

function MovimientoBadge({ tipo }: { tipo: string }) {
  const style = TIPO_STYLE[tipo] ?? TIPO_STYLE_DEFAULT;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${style.badge}`}>
      {TIPO_LABEL[tipo] ?? tipo}
    </span>
  );
}

export default function KardexPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");

  const sucursalId = isSuperAdmin
    ? sucursales.find((s) => s.nombre === filtroSucursal)?.sucursalId ?? 0
    : parseInt(user?.sucursalID ?? "0");

  const { productosSucursal } = useProductosSucursal(sucursalId || null, !!sucursalId);
  const [filtroProducto, setFiltroProducto] = useState<string>("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const productoSeleccionado = productosSucursal.find((p) => p.nomProducto === filtroProducto);
  const sucursalProductoId = productoSeleccionado?.sucursalProducto.sucursalProductoId ?? 0;

  const { kardex, loadingKardex, fetchKardex } = useKardexLista();

  useEffect(() => {
    if (!sucursalProductoId) return;
    // Si solo se llena "Desde", se filtra por ese día exacto (no un rango abierto hasta hoy).
    fetchKardex({
      sucursalProductoId,
      desde: fechaDesde || undefined,
      hasta: fechaHasta || fechaDesde || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalProductoId, fechaDesde, fechaHasta]);

  const filtrosActivos = filtroSucursal !== "Todos" || filtroProducto !== "Todos" || !!fechaDesde || !!fechaHasta;

  const limpiarFiltros = () => {
    setFiltroSucursal("Todos");
    setFiltroProducto("Todos");
    setFechaDesde("");
    setFechaHasta("");
  };

  const totalSaldo = useMemo(() => {
    if (kardex.length === 0) return { cantidad: 0, valor: 0 };
    const ultimo = kardex[kardex.length - 1];
    return { cantidad: ultimo.saldoCantidadPost, valor: ultimo.saldoValorPost };
  }, [kardex]);

  if (!loadingConfig && !config?.isStock) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-gray-100 rounded-full p-4 mb-3">
          <Lock className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 font-semibold text-sm">Este reporte no está disponible</p>
        <p className="text-gray-400 text-xs mt-1">
          Tu empresa no tiene activada la gestión de stock/inventario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in duration-500">

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <DropdownFiltro
              label="Sucursal"
              value={filtroSucursal}
              options={["Todos", ...sucursales.map((s) => s.nombre)]}
              onChange={(v) => {
                setFiltroSucursal(v);
                setFiltroProducto("Todos");
              }}
            />
          )}

          <DropdownFiltro
            label="Producto"
            value={filtroProducto}
            options={["Todos", ...productosSucursal.map((p) => p.nomProducto)]}
            onChange={setFiltroProducto}
            searchable
          />

          <div className="flex items-center h-9 gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="text-xs outline-none w-[105px] h-full"
            />
            <span className="text-gray-300">–</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="text-xs outline-none w-[105px] h-full"
            />
          </div>

          {filtrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 font-semibold transition-colors px-2 py-2"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {sucursalProductoId > 0 && kardex.length > 0 && (
          <div className="flex items-center gap-2.5 sm:ml-auto">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 flex flex-col">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stock actual</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{totalSaldo.cantidad} unid.</span>
            </div>
            <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-3 py-1.5 flex flex-col">
              <span className="text-[10px] font-semibold text-brand-blue/70 uppercase tracking-wide">Valor actual</span>
              <span className="text-sm font-bold text-brand-blue tabular-nums">S/ {totalSaldo.valor.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{ maxHeight: "calc(100vh - 260px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Fecha</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Movimiento</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cantidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Unit.</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Total</th>
            </tr>
          </thead>
          <tbody>
            {loadingKardex &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={5}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingKardex && sucursalProductoId === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Selecciona un producto</p>
                    <p className="text-gray-400 text-xs mt-1">Elige la sucursal y el producto para ver su kardex</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingKardex && sucursalProductoId > 0 && kardex.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin movimientos registrados</p>
                    <p className="text-gray-400 text-xs mt-1">Este producto todavía no tiene historial en el kardex</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingKardex &&
              sucursalProductoId > 0 &&
              kardex.map((m, idx) => {
                const style = TIPO_STYLE[m.tipoMovimiento] ?? TIPO_STYLE_DEFAULT;
                return (
                  <tr
                    key={m.kardexMovimientoId}
                    className={`border-b transition-colors hover:bg-blue-50/40 ${style.fila} ${
                      idx % 2 === 1 ? "bg-gray-50/50 border-gray-100" : "bg-white border-gray-100"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {new Date(m.fechaMovimiento).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-3 py-2.5">
                      <MovimientoBadge tipo={m.tipoMovimiento} />
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${style.cantidad}`}>
                      {style.signo}
                      {m.cantidad}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {m.costoUnitarioPromedio != null ? (
                        <>
                          S/ {m.costoUnitarioPromedio.toFixed(2)}
                          {m.lotesConsumidos > 1 && (
                            <span className="text-gray-400"> (promedio)</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {m.costoTotal != null ? `S/ ${m.costoTotal.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
