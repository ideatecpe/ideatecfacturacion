"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  PackageSearch,
  X,
  Lock,
  ChevronDown,
  ChevronUp,
  LineChart as LineChartIcon,
  Search,
} from "lucide-react";
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
import { coincideBusqueda } from "@/app/utils/normalizarTexto";

const getFechaHoy = (): string => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${año}-${mes}-${dia}`;
};

export default function RentabilidadPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const fechaHoy = getFechaHoy();
  const esHoy =
    (fechaDesde === fechaHoy && (!fechaHasta || fechaHasta === fechaHoy)) ||
    (!fechaDesde && fechaHasta === fechaHoy);

  const handleToggleHoy = () => {
    if (esHoy) {
      setFechaDesde("");
      setFechaHasta("");
    } else {
      setFechaDesde(fechaHoy);
      setFechaHasta(fechaHoy);
    }
  };

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

  // Si solo se ingresa fechaDesde -> filtra ese día exacto (desde = hasta = fechaDesde)
  // Si solo se ingresa fechaHasta -> filtra ese día exacto (desde = hasta = fechaHasta)
  // Si se ingresan ambas -> filtra el rango (desde = fechaDesde, hasta = fechaHasta)
  // Si ambas están vacías -> trae todo el historial sin filtro de fecha
  const desdeCalculado = useMemo(() => {
    if (fechaDesde && !fechaHasta) return fechaDesde;
    if (!fechaDesde && fechaHasta) return fechaHasta;
    if (fechaDesde && fechaHasta) return fechaDesde;
    return undefined;
  }, [fechaDesde, fechaHasta]);

  const hastaCalculado = useMemo(() => {
    if (fechaDesde && !fechaHasta) return fechaDesde;
    if (!fechaDesde && fechaHasta) return fechaHasta;
    if (fechaDesde && fechaHasta) return fechaHasta;
    return undefined;
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    if (sucursalId > 0 && config?.isStock) {
      fetchRentabilidad({
        sucursalId,
        desde: desdeCalculado,
        hasta: hastaCalculado,
      });
    }
  }, [sucursalId, desdeCalculado, hastaCalculado, config?.isStock, fetchRentabilidad]);

  useEffect(() => {
    if (expandido !== null) {
      fetchRentabilidadDiaria({
        sucursalProductoId: expandido,
        desde: desdeCalculado,
        hasta: hastaCalculado,
      });
    }
  }, [expandido, desdeCalculado, hastaCalculado, fetchRentabilidadDiaria]);

  const handleFechaDesdeChange = (val: string) => {
    setFechaDesde(val);
    if (fechaHasta && val > fechaHasta) {
      setFechaHasta("");
    }
  };

  const handleFechaHastaChange = (val: string) => {
    setFechaHasta(val);
    if (fechaDesde && val < fechaDesde) {
      setFechaDesde("");
    }
  };

  const filtrosActivos = filtroSucursal !== "Todos" || !!fechaDesde || !!fechaHasta || !!busqueda;

  const limpiarFiltros = () => {
    setFiltroSucursal("Todos");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
  };

  const toggleExpandido = (r: (typeof rentabilidad)[number]) => {
    if (expandido === r.sucursalProductoId) {
      setExpandido(null);
      return;
    }
    setExpandido(r.sucursalProductoId);
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

  const rentabilidadFiltrada = useMemo(() => {
    if (!busqueda.trim()) return rentabilidad;
    return rentabilidad.filter((r) => coincideBusqueda(busqueda, r.nomProducto, r.codigo));
  }, [rentabilidad, busqueda]);

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
        <div className="relative flex-1 min-w-50 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o producto..."
            className="w-full h-9 text-xs pl-8 pr-8 rounded-lg border border-gray-200 bg-white outline-none focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue/30"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <DropdownFiltro
            label="Sucursal"
            value={filtroSucursal}
            options={["Todos", ...sucursales.map((s) => s.nombre)]}
            onChange={setFiltroSucursal}
          />
        )}

        <div className="flex items-center gap-1.5 sm:ml-auto">
          <button
            type="button"
            onClick={handleToggleHoy}
            className={`h-9 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              esHoy
                ? "bg-brand-blue text-white border-brand-blue shadow-sm hover:bg-brand-blue/90"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
            }`}
            title={esHoy ? "Quitar filtro de hoy" : "Ver rentabilidad de hoy"}
          >
            <Calendar className={`w-3.5 h-3.5 ${esHoy ? "text-white" : "text-brand-blue"}`} />
            Hoy
          </button>

          <div className="flex items-center h-9 gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => handleFechaDesdeChange(e.target.value)}
              className="text-xs outline-none w-26.25 h-full text-gray-700"
            />
            <span className="text-gray-300">–</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => handleFechaHastaChange(e.target.value)}
              className="text-xs outline-none w-26.25 h-full text-gray-700"
            />
          </div>
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
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px">
            <div className="bg-white px-3 py-2 flex flex-col">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Ingreso
              </span>
              <span className="text-base sm:text-lg font-bold text-gray-900 tabular-nums leading-tight whitespace-nowrap">
                S/ {totales.ingreso.toFixed(2)}
              </span>
            </div>
            <div className="bg-white px-3 py-2 flex flex-col">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Costo
              </span>
              <span className="text-base sm:text-lg font-bold text-gray-600 tabular-nums leading-tight whitespace-nowrap">
                S/ {totales.costo.toFixed(2)}
              </span>
            </div>
            <div className="bg-white px-3 py-2 flex flex-col">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Utilidad
              </span>
              <span
                className={`text-base sm:text-lg font-bold tabular-nums leading-tight whitespace-nowrap ${
                  totales.utilidad >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                S/ {totales.utilidad.toFixed(2)}
              </span>
            </div>
            <div
              className={`px-3 py-2 flex flex-col ${
                margenTotal >= 0 ? "bg-brand-blue/5" : "bg-rose-50"
              }`}
            >
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Margen
              </span>
              <span
                className={`text-base sm:text-lg font-bold tabular-nums leading-tight whitespace-nowrap ${
                  margenTotal >= 0 ? "text-brand-blue" : "text-rose-600"
                }`}
              >
                {margenTotal.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{ maxHeight: "calc(100vh - 260px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr className="whitespace-nowrap">
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

            {!loadingRentabilidad && sucursalId > 0 && rentabilidad.length > 0 && rentabilidadFiltrada.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin resultados</p>
                    <p className="text-gray-400 text-xs mt-1">
                      No se encontraron productos para &quot;{busqueda}&quot;
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingRentabilidad &&
              rentabilidadFiltrada.map((r, idx) => {
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
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.codigo ?? "—"}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{r.nomProducto ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{r.cantidadVendida}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">S/ {r.ingresoVentas.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">S/ {r.costoVentas.toFixed(2)}</td>
                      <td
                        className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                          r.utilidadBruta >= 0 ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        S/ {r.utilidadBruta.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{r.margenPorcentaje.toFixed(1)}%</td>
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
                                        domain={[0, (max: number) => Math.ceil(max * 1.15)]}
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
