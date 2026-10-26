"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  PackageSearch,
  X,
  Lock,
  ChevronDown,
  ChevronUp,
  LineChart as LineChartIcon,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
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
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
import { useCategoriasLista } from "@/app/factufly/productos/gestioProductos/useCategoriasLista";
import { useRentabilidadLista } from "../useRentabilidadLista";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";

type CampoOrden =
  | "utilidadBruta"
  | "margenPorcentaje"
  | "cantidadVendida"
  | "ingresoVentas"
  | "costoVentas";

type DireccionOrden = "desc" | "asc";

const OPCIONES_ORDEN: {
  id: string;
  label: string;
  campo: CampoOrden;
  dir: DireccionOrden;
}[] = [
  { id: "utilidadBruta:desc", label: "Mayor ganancia (S/)", campo: "utilidadBruta", dir: "desc" },
  { id: "utilidadBruta:asc", label: "Menor ganancia (S/)", campo: "utilidadBruta", dir: "asc" },
  { id: "margenPorcentaje:desc", label: "Mayor rentabilidad (%)", campo: "margenPorcentaje", dir: "desc" },
  { id: "margenPorcentaje:asc", label: "Menor rentabilidad (%)", campo: "margenPorcentaje", dir: "asc" },
  { id: "cantidadVendida:desc", label: "Más vendidos", campo: "cantidadVendida", dir: "desc" },
  { id: "cantidadVendida:asc", label: "Menos vendidos", campo: "cantidadVendida", dir: "asc" },
  { id: "ingresoVentas:desc", label: "Mayor ingreso (S/)", campo: "ingresoVentas", dir: "desc" },
  { id: "ingresoVentas:asc", label: "Menor ingreso (S/)", campo: "ingresoVentas", dir: "asc" },
];

const getFechaHoy = (): string => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${año}-${mes}-${dia}`;
};

export default function RentabilidadPage() {
  const { user, accessToken } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [ordenCampo, setOrdenCampo] = useState<CampoOrden>("utilidadBruta");
  const [ordenDir, setOrdenDir] = useState<DireccionOrden>("desc");
  const [menuOrdenAbierto, setMenuOrdenAbierto] = useState(false);
  const menuOrdenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuOrdenRef.current && !menuOrdenRef.current.contains(e.target as Node)) {
        setMenuOrdenAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const { productosSucursal } = useProductosSucursal(sucursalId || null, !!sucursalId);
  const { categorias, fetchCategorias } = useCategoriasLista();

  useEffect(() => {
    if (accessToken && user?.ruc) {
      fetchCategorias(user.ruc);
    }
  }, [accessToken, user?.ruc, fetchCategorias]);

  // Mapa rápido productoId -> nombre de categoría (si es paquete sin categoría propia, hereda la de su producto base)
  const categoriaPorProductoId = useMemo(() => {
    const porId = new Map(productosSucursal.map((p) => [p.productoId, p]));
    const map = new Map<number, string>();
    for (const p of productosSucursal) {
      const cat =
        p.categoria?.categoriaNombre ||
        (p.productoBaseId ? porId.get(p.productoBaseId)?.categoria?.categoriaNombre : undefined);
      if (cat) {
        map.set(p.productoId, cat);
      }
    }
    return map;
  }, [productosSucursal]);

  const opcionesCategorias = useMemo(() => {
    const set = new Set<string>();
    for (const c of categorias) {
      if (c.categoriaNombre) set.add(c.categoriaNombre);
    }
    for (const cat of categoriaPorProductoId.values()) {
      if (cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [categorias, categoriaPorProductoId]);

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
    if (expandido !== null && sucursalId > 0) {
      fetchRentabilidadDiaria({
        sucursalId,
        productoId: expandido,
        desde: desdeCalculado,
        hasta: hastaCalculado,
      });
    }
  }, [expandido, sucursalId, desdeCalculado, hastaCalculado, fetchRentabilidadDiaria]);

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

  const handleSortColumna = (campo: CampoOrden) => {
    if (ordenCampo === campo) {
      setOrdenDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setOrdenCampo(campo);
      setOrdenDir("desc");
    }
  };

  const labelOrdenActual = useMemo(() => {
    const idActual = `${ordenCampo}:${ordenDir}`;
    const encontrado = OPCIONES_ORDEN.find((o) => o.id === idActual);
    if (encontrado) return encontrado.label;
    if (ordenCampo === "costoVentas") {
      return ordenDir === "desc" ? "Mayor costo (S/)" : "Menor costo (S/)";
    }
    return "Mayor ganancia (S/)";
  }, [ordenCampo, ordenDir]);

  const filtrosActivos =
    filtroSucursal !== "Todos" ||
    filtroCategoria !== "Todos" ||
    !!fechaDesde ||
    !!fechaHasta ||
    !!busqueda ||
    ordenCampo !== "utilidadBruta" ||
    ordenDir !== "desc";

  const limpiarFiltros = () => {
    setFiltroSucursal("Todos");
    setFiltroCategoria("Todos");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
    setOrdenCampo("utilidadBruta");
    setOrdenDir("desc");
  };

  const toggleExpandido = (r: (typeof rentabilidad)[number]) => {
    if (expandido === r.productoId) {
      setExpandido(null);
      return;
    }
    setExpandido(r.productoId);
  };

  const rentabilidadFiltrada = useMemo(() => {
    const base = rentabilidad.filter((r) => {
      const catProducto = categoriaPorProductoId.get(r.productoId) ?? "Sin categoría";
      if (filtroCategoria !== "Todos" && catProducto !== filtroCategoria) {
        return false;
      }
      if (busqueda.trim()) {
        return coincideBusqueda(busqueda, r.nomProducto, r.codigo, catProducto);
      }
      return true;
    });

    return [...base].sort((a, b) => {
      const valA = a[ordenCampo] ?? 0;
      const valB = b[ordenCampo] ?? 0;
      const diff = ordenDir === "desc" ? valB - valA : valA - valB;
      if (diff !== 0) return diff;
      return (b.utilidadBruta ?? 0) - (a.utilidadBruta ?? 0);
    });
  }, [rentabilidad, busqueda, filtroCategoria, categoriaPorProductoId, ordenCampo, ordenDir]);

  const totales = useMemo(
    () =>
      rentabilidadFiltrada.reduce(
        (acc, r) => ({
          ingreso: acc.ingreso + r.ingresoVentas,
          costo: acc.costo + r.costoVentas,
          utilidad: acc.utilidad + r.utilidadBruta,
        }),
        { ingreso: 0, costo: 0, utilidad: 0 },
      ),
    [rentabilidadFiltrada],
  );
  const margenTotal = totales.ingreso === 0 ? 0 : (totales.utilidad / totales.ingreso) * 100;

  const renderSortIcon = (campo: CampoOrden) => {
    if (ordenCampo !== campo) {
      return <ArrowUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />;
    }
    return ordenDir === "desc" ? (
      <ArrowDown className="w-3 h-3 text-brand-blue" />
    ) : (
      <ArrowUp className="w-3 h-3 text-brand-blue" />
    );
  };

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

        <DropdownFiltro
          label="Categoría: Todas"
          value={filtroCategoria}
          options={["Todos", ...opcionesCategorias]}
          onChange={setFiltroCategoria}
          searchable
        />

        <div className="relative" ref={menuOrdenRef}>
          <button
            type="button"
            onClick={() => setMenuOrdenAbierto((prev) => !prev)}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Ordenar productos por rentabilidad, ganancia o ventas"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-brand-blue shrink-0" />
            <span>{labelOrdenActual}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${
                menuOrdenAbierto ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOrdenAbierto && (
            <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-52 py-1">
              {OPCIONES_ORDEN.map((op) => {
                const activo = ordenCampo === op.campo && ordenDir === op.dir;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setOrdenCampo(op.campo);
                      setOrdenDir(op.dir);
                      setMenuOrdenAbierto(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left cursor-pointer ${
                      activo
                        ? "bg-blue-50 text-brand-blue font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{op.label}</span>
                    {activo && <Check className="w-3.5 h-3.5 text-brand-blue shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Categoría</th>
              <th className="text-right font-bold uppercase tracking-wide px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleSortColumna("cantidadVendida")}
                  className={`group inline-flex items-center justify-end gap-1 cursor-pointer select-none transition-colors ${
                    ordenCampo === "cantidadVendida" ? "text-brand-blue" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>Cant. Vendida</span>
                  {renderSortIcon("cantidadVendida")}
                </button>
              </th>
              <th className="text-right font-bold uppercase tracking-wide px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleSortColumna("ingresoVentas")}
                  className={`group inline-flex items-center justify-end gap-1 cursor-pointer select-none transition-colors ${
                    ordenCampo === "ingresoVentas" ? "text-brand-blue" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>Ingreso</span>
                  {renderSortIcon("ingresoVentas")}
                </button>
              </th>
              <th className="text-right font-bold uppercase tracking-wide px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleSortColumna("costoVentas")}
                  className={`group inline-flex items-center justify-end gap-1 cursor-pointer select-none transition-colors ${
                    ordenCampo === "costoVentas" ? "text-brand-blue" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>Costo</span>
                  {renderSortIcon("costoVentas")}
                </button>
              </th>
              <th className="text-right font-bold uppercase tracking-wide px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleSortColumna("utilidadBruta")}
                  className={`group inline-flex items-center justify-end gap-1 cursor-pointer select-none transition-colors ${
                    ordenCampo === "utilidadBruta" ? "text-brand-blue" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>Utilidad</span>
                  {renderSortIcon("utilidadBruta")}
                </button>
              </th>
              <th className="text-right font-bold uppercase tracking-wide px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleSortColumna("margenPorcentaje")}
                  className={`group inline-flex items-center justify-end gap-1 cursor-pointer select-none transition-colors ${
                    ordenCampo === "margenPorcentaje" ? "text-brand-blue" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>Margen</span>
                  {renderSortIcon("margenPorcentaje")}
                </button>
              </th>
              <th className="w-10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loadingRentabilidad &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={9}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingRentabilidad && sucursalId === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center">
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
                <td colSpan={9} className="py-16 text-center">
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
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin resultados</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {filtroCategoria !== "Todos" && busqueda
                        ? `No se encontraron productos para "${busqueda}" en la categoría "${filtroCategoria}"`
                        : filtroCategoria !== "Todos"
                          ? `No hay ventas registradas en la categoría "${filtroCategoria}" para este periodo`
                          : `No se encontraron productos para "${busqueda}"`}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingRentabilidad &&
              rentabilidadFiltrada.map((r, idx) => {
                const isOpen = expandido === r.productoId;
                const nombreCategoria = categoriaPorProductoId.get(r.productoId);
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
                      <td className="px-3 py-2.5 font-semibold text-gray-800">
                        <span className="inline-flex items-center gap-1.5">
                          {r.nomProducto ?? "—"}
                          {r.esPaquete && (
                            <span className="text-[9px] font-bold text-brand-blue bg-brand-blue/10 rounded-full px-1.5 py-0.5 uppercase tracking-wide">
                              Paquete
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {nombreCategoria ? (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            {nombreCategoria}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
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
                        <td colSpan={9} className="px-3 pb-3 pt-0">
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
