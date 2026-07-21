"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar, PackageSearch, X, Lock, ChevronDown, ChevronUp, LineChart as LineChartIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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

  const {
    rentabilidad,
    loadingRentabilidad,
    fetchRentabilidad,
    rentabilidadDiaria,
    loadingRentabilidadDiaria,
    fetchRentabilidadDiaria,
  } = useRentabilidadLista();

  const [expandido, setExpandido] = useState<number | null>(null);

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

  const toggleExpandido = (r: (typeof rentabilidad)[number]) => {
    if (expandido === r.sucursalProductoId) {
      setExpandido(null);
      return;
    }
    setExpandido(r.sucursalProductoId);
    fetchRentabilidadDiaria({
      sucursalProductoId: r.sucursalProductoId,
      desde: fechaDesde || undefined,
      hasta: fechaHasta || undefined,
    });
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

  const chartData = useMemo(
    () =>
      rentabilidadDiaria.map((d) => ({
        fecha: new Date(d.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
        Ingreso: d.ingresoVentas,
        Costo: d.costoVentas,
        Utilidad: d.utilidadBruta,
      })),
    [rentabilidadDiaria],
  );

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-col justify-center">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ingreso</span>
            <span className="text-xl font-bold text-gray-900 tabular-nums">S/ {totales.ingreso.toFixed(2)}</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-col justify-center">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Costo</span>
            <span className="text-xl font-bold text-gray-900 tabular-nums">S/ {totales.costo.toFixed(2)}</span>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 flex flex-col justify-center ${
              totales.utilidad >= 0
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60"
                : "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60"
            }`}
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                totales.utilidad >= 0 ? "text-emerald-700/70" : "text-rose-700/70"
              }`}
            >
              Utilidad
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${totales.utilidad >= 0 ? "text-emerald-700" : "text-rose-600"}`}
            >
              S/ {totales.utilidad.toFixed(2)}
            </span>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 flex flex-col justify-center ${
              margenTotal >= 0 ? "border-brand-blue/20 bg-gradient-to-br from-brand-blue/5 to-brand-blue/10" : "border-rose-200 bg-rose-50"
            }`}
          >
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${margenTotal >= 0 ? "text-brand-blue/70" : "text-rose-700/70"}`}>
              Margen
            </span>
            <span className={`text-xl font-bold tabular-nums ${margenTotal >= 0 ? "text-brand-blue" : "text-rose-600"}`}>
              {margenTotal.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{ maxHeight: "calc(100vh - 280px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Código</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Producto</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cant. Vendida</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Ingreso</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Utilidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Margen</th>
              <th className="w-10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loadingRentabilidad &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={8}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingRentabilidad && sucursalId === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
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
                <td colSpan={8} className="py-16 text-center">
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
              rentabilidad.map((r, idx) => {
                const isOpen = expandido === r.sucursalProductoId;
                return (
                  <React.Fragment key={r.productoId}>
                    <tr
                      onClick={() => toggleExpandido(r)}
                      className={`cursor-pointer border-b transition-colors ${
                        isOpen
                          ? "bg-blue-50/70 border-blue-100"
                          : idx % 2 === 1
                            ? "bg-gray-50/50 border-gray-100 hover:bg-blue-50/40"
                            : "bg-white border-gray-100 hover:bg-blue-50/40"
                      }`}
                    >
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
                      <td className="px-3 py-2.5 text-center">
                        <div className={`inline-flex rounded-full p-1 transition-colors ${isOpen ? "text-brand-blue bg-blue-100" : "text-gray-400"}`}>
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-blue-50/30">
                        <td colSpan={8} className="px-3 pb-3 pt-0">
                          <div className="ml-1 rounded-lg border border-blue-100 bg-white overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/60 border-b border-blue-100">
                              <LineChartIcon className="w-3.5 h-3.5 text-brand-blue" />
                              <span className="text-[10px] font-bold text-brand-blue uppercase tracking-wide">
                                Evolución de {r.nomProducto}
                              </span>
                              <span className="text-[10px] text-gray-400">· costo y utilidad por día</span>
                            </div>
                            <div className="p-3">
                              {loadingRentabilidadDiaria ? (
                                <div className="h-56 flex items-center justify-center text-gray-400 text-xs">
                                  Cargando evolución...
                                </div>
                              ) : chartData.length === 0 ? (
                                <div className="h-56 flex items-center justify-center text-gray-400 text-xs">
                                  No hay suficientes ventas en el periodo para graficar una tendencia
                                </div>
                              ) : (
                                <div className="h-56 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                      <XAxis
                                        dataKey="fecha"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                        dy={8}
                                      />
                                      <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                        width={48}
                                      />
                                      <Tooltip
                                        contentStyle={{
                                          borderRadius: "10px",
                                          border: "1px solid #e2e8f0",
                                          fontSize: "12px",
                                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                        }}
                                        formatter={(value: number | undefined) => `S/ ${(value ?? 0).toFixed(2)}`}
                                      />
                                      <Legend
                                        wrapperStyle={{ fontSize: "11px" }}
                                        iconType="circle"
                                        iconSize={8}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="Ingreso"
                                        stroke="#94a3b8"
                                        strokeWidth={1.5}
                                        strokeDasharray="4 3"
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="Costo"
                                        stroke="#0052CC"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="Utilidad"
                                        stroke="#059669"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
