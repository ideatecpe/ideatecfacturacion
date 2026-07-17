"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar, PackageSearch, X, Lock } from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useRentabilidadLista } from "../useRentabilidadLista";

export default function RentabilidadPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const sucursalId = isSuperAdmin
    ? sucursales.find((s) => s.nombre === filtroSucursal)?.sucursalId ?? 0
    : parseInt(user?.sucursalID ?? "0");

  const { rentabilidad, loadingRentabilidad, fetchRentabilidad } = useRentabilidadLista();

  useEffect(() => {
    if (sucursalId > 0 && config?.isStock) {
      fetchRentabilidad({ sucursalId, desde: fechaDesde || undefined, hasta: fechaHasta || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId, fechaDesde, fechaHasta, config?.isStock]);

  const filtrosActivos = filtroSucursal !== "Todos" || !!fechaDesde || !!fechaHasta;

  const limpiarFiltros = () => {
    setFiltroSucursal("Todos");
    setFechaDesde("");
    setFechaHasta("");
  };

  const totales = useMemo(
    () =>
      rentabilidad.reduce(
        (acc, r) => ({
          ingreso: acc.ingreso + r.ingresoVentas,
          costo: acc.costo + r.costoVentas,
          utilidad: acc.utilidad + r.utilidadBruta,
        }),
        { ingreso: 0, costo: 0, utilidad: 0 },
      ),
    [rentabilidad],
  );
  const margenTotal = totales.ingreso === 0 ? 0 : (totales.utilidad / totales.ingreso) * 100;

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
              onChange={setFiltroSucursal}
            />
          )}

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

        {rentabilidad.length > 0 && (
          <p className="text-[12px] text-gray-500">
            Ingreso: <span className="font-semibold text-gray-900">S/ {totales.ingreso.toFixed(2)}</span> · Costo:{" "}
            <span className="font-semibold text-gray-900">S/ {totales.costo.toFixed(2)}</span> · Utilidad:{" "}
            <span className="font-semibold text-emerald-600">S/ {totales.utilidad.toFixed(2)}</span> (
            {margenTotal.toFixed(1)}%)
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
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Código</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Producto</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cant. Vendida</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Ingreso</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Utilidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Margen</th>
            </tr>
          </thead>
          <tbody>
            {loadingRentabilidad &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={7}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingRentabilidad && sucursalId === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Selecciona una sucursal</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingRentabilidad && sucursalId > 0 && rentabilidad.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin ventas en este periodo</p>
                    <p className="text-gray-400 text-xs mt-1">Ajusta el rango de fechas o la sucursal</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingRentabilidad &&
              rentabilidad.map((r) => (
                <tr key={r.productoId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500">{r.codigo ?? "—"}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{r.nomProducto ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{r.cantidadVendida}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">S/ {r.ingresoVentas.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">S/ {r.costoVentas.toFixed(2)}</td>
                  <td
                    className={`px-3 py-2.5 text-right font-bold ${
                      r.utilidadBruta >= 0 ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    S/ {r.utilidadBruta.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{r.margenPorcentaje.toFixed(1)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
