"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet, X, Download, Building2, Tag,
  ReceiptText, Package, Wrench, BarChart3, Loader2
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useReporteProductosExcel, ReporteProductosFiltro } from "@/app/factufly/productos/gestioProductos/useReporteProductosexcel";

interface Categoria {
  categoriaId: number;
  categoriaNombre: string;
}

interface Sucursal {
  sucursalId: number;
  nombre: string;
}

interface ModalReporteProductosProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: Categoria[];
  sucursales: Sucursal[];
}

const IGV_OPCIONES = [
  { value: "10", label: "Gravado",   color: "bg-blue-50 border-blue-300 text-blue-700" },
  { value: "20", label: "Exonerado", color: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { value: "30", label: "Inafecto",  color: "bg-amber-50 border-amber-300 text-amber-700" },
];

const STOCK_OPCIONES = [
  { value: "todos",     label: "Todos" },
  { value: "con_stock", label: "Con stock" },
  { value: "sin_stock", label: "Sin stock" },
  { value: "menor_a",   label: "Stock menor a..." },
];

export default function ModalReporteProductos({
  isOpen,
  onClose,
  categorias,
  sucursales,
}: ModalReporteProductosProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.rol === "superadmin";
  const { descargarReporte, descargando } = useReporteProductosExcel();

  // Filtros
  const [sucursalId, setSucursalId]       = useState<number | undefined>(undefined);
  const [categoriaId, setCategoriaId]     = useState<number | undefined>(undefined);
  const [igvTipo, setIgvTipo]             = useState<string | undefined>(undefined);
  const [tipoProducto, setTipoProducto]   = useState<string | undefined>(undefined);
  const [stockFiltro, setStockFiltro]     = useState<string>("todos");
  const [stockValor, setStockValor]       = useState<number | undefined>(undefined);
  const [tituloReporte, setTituloReporte] = useState("");

  const esServicio = tipoProducto === "SERVICIO";

  const handleLimpiar = () => {
    setSucursalId(undefined);
    setCategoriaId(undefined);
    setIgvTipo(undefined);
    setTipoProducto(undefined);
    setStockFiltro("todos");
    setStockValor(undefined);
    setTituloReporte("");
  };

  const handleDescargar = async () => {
    const filtro: ReporteProductosFiltro = {
      sucursalId:   isSuperAdmin ? sucursalId : undefined,
      categoriaId,
      igvTipo,
      tipoProducto,
      stockFiltro:  esServicio ? undefined : stockFiltro === "todos" ? undefined : stockFiltro,
      stockValor:   !esServicio && stockFiltro === "menor_a" ? stockValor : undefined,
      tituloReporte,
    };
    await descargarReporte(filtro);
  };

  // Resumen de filtros activos para el nombre auto-generado
  const filtrosActivos = [
    isSuperAdmin && sucursalId ? sucursales.find(s => s.sucursalId === sucursalId)?.nombre : null,
    categoriaId ? categorias.find(c => c.categoriaId === categoriaId)?.categoriaNombre : null,
    igvTipo ? IGV_OPCIONES.find(o => o.value === igvTipo)?.label : null,
    tipoProducto ? (tipoProducto === "BIEN" ? "Bien" : "Servicio") : null,
    !esServicio && stockFiltro !== "todos" ? STOCK_OPCIONES.find(o => o.value === stockFiltro)?.label : null,
  ].filter(Boolean);

  const nombreAutoGenerado = filtrosActivos.length > 0
    ? `reporte-productos_${user?.ruc}_${filtrosActivos.map(f => f!.toLowerCase().replace(/\s+/g, "-")).join("_")}`
    : `reporte-productos_${user?.ruc}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Reporte de Productos</h2>
              <p className="text-xs text-gray-400 mt-0.5">Configura los filtros y descarga el reporte en Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Fila 1: Sucursal (solo superadmin) + Categoría */}
          <div className={cn("grid gap-4", isSuperAdmin ? "grid-cols-2" : "grid-cols-1")}>
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Building2 className="w-3 h-3" /> Sucursal
                </label>
                <select
                  value={sucursalId ?? ""}
                  onChange={e => setSucursalId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                >
                  <option value="">Todas las sucursales</option>
                  {sucursales.map(s => (
                    <option key={s.sucursalId} value={s.sucursalId}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <Tag className="w-3 h-3" /> Categoría
              </label>
              <select
                value={categoriaId ?? ""}
                onChange={e => setCategoriaId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(c => (
                  <option key={c.categoriaId} value={c.categoriaId}>{c.categoriaNombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 2: Tipo IGV + Tipo Producto en la misma fila */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <ReceiptText className="w-3 h-3" /> Tipo de afectación IGV
              </label>
              <div className="flex gap-2 flex-wrap">
                {IGV_OPCIONES.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIgvTipo(prev => prev === value ? undefined : value)}
                    className={cn(
                      "px-3.5 py-2 text-xs font-semibold border rounded-xl transition-all",
                      igvTipo === value ? color : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <Package className="w-3 h-3" /> Tipo de producto
              </label>
              <div className="flex gap-2">
                {[
                  { value: "BIEN",     label: "Bien",     icon: <Package className="w-3.5 h-3.5" /> },
                  { value: "SERVICIO", label: "Servicio", icon: <Wrench className="w-3.5 h-3.5" /> },
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipoProducto(prev => prev === value ? undefined : value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border rounded-xl transition-all",
                      tipoProducto === value
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 4 (NO SE USA ACTUALMENTE): Filtro de stock — oculto si es SERVICIO 
            {!esServicio && (
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <BarChart3 className="w-3 h-3" /> Filtro de stock
                </label>
                <div className="flex gap-2 flex-wrap">
                  {STOCK_OPCIONES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setStockFiltro(value); if (value !== "menor_a") setStockValor(undefined); }}
                      className={cn(
                        "px-3.5 py-2 text-xs font-semibold border rounded-xl transition-all",
                        stockFiltro === value
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>


                {stockFiltro === "menor_a" && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Mostrar productos con stock menor a</span>
                    <input
                      type="number"
                      min={1}
                      value={stockValor ?? ""}
                      onChange={e => setStockValor(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all bg-gray-50"
                    />
                    <span className="text-xs text-gray-400">unidades</span>
                  </div>
                )}
              </div>
            )}

          */}

          {/* Fila 5: Nombre del archivo */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              Nombre del archivo
              <span className="normal-case font-normal text-gray-300">(auto-generado si no lo completas)</span>
            </label>
            <input
              type="text"
              value={tituloReporte}
              onChange={e => setTituloReporte(e.target.value)}
              placeholder={nombreAutoGenerado}
              className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
            />
          </div>

          {/* Preview de filtros activos */}
          {filtrosActivos.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Filtros:</span>
              {filtrosActivos.map((f, i) => (
                <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-200">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleLimpiar}
            className="text-xs text-gray-400 hover:text-rose-500 font-semibold transition-colors flex items-center gap-1.5 px-2 py-1.5 hover:bg-rose-50 rounded-lg"
          >
            Limpiar filtros
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleDescargar}
              disabled={descargando || (stockFiltro === "menor_a" && !stockValor)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all",
                descargando || (stockFiltro === "menor_a" && !stockValor)
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 hover:shadow-emerald-300"
              )}
            >
              {descargando
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                : <><Download className="w-3.5 h-3.5" /> Descargar Excel</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
