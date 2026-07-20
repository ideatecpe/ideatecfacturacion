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
  AJUSTE: "Ajuste",
};

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
    fetchKardex({ sucursalProductoId, desde: fechaDesde || undefined, hasta: fechaHasta || undefined });
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
          />

          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-2 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="text-xs outline-none w-[105px]"
            />
            <span className="text-gray-300">–</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="text-xs outline-none w-[105px]"
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
          <p className="text-[12px] text-gray-500">
            Saldo actual:{" "}
            <span className="font-semibold text-gray-900">{totalSaldo.cantidad}</span> unid. ·{" "}
            <span className="font-semibold text-gray-900">S/ {totalSaldo.valor.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{ maxHeight: "calc(100vh - 220px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Fecha</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Movimiento</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cantidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Unit.</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Total</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Saldo Cant.</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Saldo Valor</th>
            </tr>
          </thead>
          <tbody>
            {loadingKardex &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={7}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingKardex && sucursalProductoId === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
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
                <td colSpan={7} className="py-16 text-center">
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
              kardex.map((m) => (
                <tr key={m.kardexMovimientoId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(m.fechaMovimiento).toLocaleDateString("es-PE")}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{TIPO_LABEL[m.tipoMovimiento] ?? m.tipoMovimiento}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{m.cantidad}</td>
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
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{m.saldoCantidadPost}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-brand-blue">S/ {m.saldoValorPost.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
