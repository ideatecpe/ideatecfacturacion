"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PackageSearch, ChevronDown, ChevronUp, Lock, Layers, Pencil, Check, X as XIcon, CalendarOff, Boxes, Wallet, Search } from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useStockValorizadoLista } from "../useStockValorizadoLista";
import { useActualizarFechaVencimientoLote } from "../useActualizarFechaVencimientoLote";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";

const ORIGEN_STYLE: Record<string, { label: string; className: string }> = {
  COMPRA: { label: "Compra", className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200" },
  SALDO_INICIAL: { label: "Saldo inicial", className: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200" },
  DEVOLUCION_VENTA: { label: "Devolución", className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
  AJUSTE: { label: "Ajuste", className: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200" },
};

function OrigenBadge({ origen }: { origen: string }) {
  const style = ORIGEN_STYLE[origen] ?? { label: origen, className: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  );
}

export default function StockValorizadoPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");

  const sucursalId = isSuperAdmin
    ? sucursales.find((s) => s.nombre === filtroSucursal)?.sucursalId ?? 0
    : parseInt(user?.sucursalID ?? "0");

  const { stockValorizado, loadingStockValorizado, fetchStockValorizadoSucursal } = useStockValorizadoLista();
  const { actualizarFechaVencimiento, actualizandoLoteId } = useActualizarFechaVencimientoLote();
  const [expandido, setExpandido] = useState<number | null>(null);
  const [editandoLoteId, setEditandoLoteId] = useState<number | null>(null);
  const [valorEdicion, setValorEdicion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [confirmacionPendiente, setConfirmacionPendiente] = useState<{
    inventarioLoteId: number;
    mensaje: string;
  } | null>(null);

  const recargar = () => {
    if (sucursalId > 0) fetchStockValorizadoSucursal(sucursalId);
  };

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId]);

  const handleIniciarEdicion = (l: { inventarioLoteId: number; fechaVencimiento: string | null }) => {
    setEditandoLoteId(l.inventarioLoteId);
    setValorEdicion(l.fechaVencimiento ? l.fechaVencimiento.slice(0, 10) : "");
    setConfirmacionPendiente(null);
  };

  const handleCancelarEdicion = () => {
    setEditandoLoteId(null);
    setConfirmacionPendiente(null);
  };

  const handleGuardarEdicion = async (inventarioLoteId: number, confirmar = false) => {
    const resultado = await actualizarFechaVencimiento(inventarioLoteId, valorEdicion || null, confirmar);
    if (resultado.status === "ok") {
      setEditandoLoteId(null);
      setConfirmacionPendiente(null);
      recargar();
    } else if (resultado.status === "requiere_confirmacion") {
      setConfirmacionPendiente({ inventarioLoteId, mensaje: resultado.mensaje });
    }
  };

  const totalValor = useMemo(
    () => stockValorizado.reduce((acc, p) => acc + p.valorTotal, 0),
    [stockValorizado],
  );

  const stockFiltrado = useMemo(() => {
    if (!busqueda.trim()) return stockValorizado;
    return stockValorizado.filter((p) => coincideBusqueda(busqueda, p.nomProducto, p.codigo));
  }, [stockValorizado, busqueda]);

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
    <div className="animate-in fade-in duration-500 ">

      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isSuperAdmin && (
          <DropdownFiltro
            label="Sucursal"
            value={filtroSucursal}
            options={["Todos", ...sucursales.map((s) => s.nombre)]}
            onChange={setFiltroSucursal}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
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
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <div className="flex-1 sm:flex-none inline-flex items-center justify-between sm:justify-start min-h-9 gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 whitespace-nowrap shadow-xs">
            <div className="flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-[11px] font-medium text-gray-500">Productos con stock</span>
            </div>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{stockValorizado.length}</span>
          </div>
          <div className="flex-1 sm:flex-none inline-flex items-center justify-between sm:justify-start min-h-9 gap-2 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-3 py-1.5 whitespace-nowrap shadow-xs">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-brand-blue/70 shrink-0" />
              <span className="text-[11px] font-medium text-brand-blue/70">Valor del inventario</span>
            </div>
            <span className="text-sm font-bold text-brand-blue tabular-nums">S/ {totalValor.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white mt-2"
        style={{ maxHeight: "calc(100vh - 180px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr className="whitespace-nowrap">
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Código</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Producto</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Stock</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Prom.</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Valor Total</th>
              <th className="w-10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loadingStockValorizado &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={6}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingStockValorizado && sucursalId === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Selecciona una sucursal</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingStockValorizado && sucursalId > 0 && stockValorizado.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin stock valorizado</p>
                    <p className="text-gray-400 text-xs mt-1">
                      No hay lotes registrados todavía para esta sucursal
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingStockValorizado && sucursalId > 0 && stockValorizado.length > 0 && stockFiltrado.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
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

            {!loadingStockValorizado &&
              stockFiltrado.map((p, idx) => {
                const isOpen = expandido === p.sucursalProductoId;
                return (
                  <React.Fragment key={p.sucursalProductoId}>
                    <tr
                      onClick={() => setExpandido(isOpen ? null : p.sucursalProductoId)}
                      className={`cursor-pointer border-b transition-colors ${
                        isOpen
                          ? "bg-blue-50/70 border-blue-100"
                          : idx % 2 === 1
                            ? "bg-gray-50/50 border-gray-100 hover:bg-blue-50/40"
                            : "bg-white border-gray-100 hover:bg-blue-50/40"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.codigo ?? "—"}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{p.nomProducto ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{p.stockActual}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">S/ {p.costoPromedioActual.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-brand-blue whitespace-nowrap">S/ {p.valorTotal.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className={`inline-flex rounded-full p-1 transition-colors ${isOpen ? "text-brand-blue bg-blue-100" : "text-gray-400"}`}>
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-blue-50/30">
                        <td colSpan={6} className="px-3 pb-3 pt-0">
                          <div className="ml-1 rounded-lg border border-blue-100 bg-white overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/60 border-b border-blue-100">
                              <Layers className="w-3.5 h-3.5 text-brand-blue" />
                              <span className="text-[10px] font-bold text-brand-blue uppercase tracking-wide">
                                Lotes PEPS de {p.nomProducto}
                              </span>
                              <span className="text-[10px] text-gray-400">· más antiguo primero</span>
                            </div>
                            <table className="w-full text-[11px] tabular-nums">
                              <thead>
                                <tr className="text-gray-400 uppercase tracking-wide">
                                  <th className="text-left font-semibold px-3 py-1.5">Origen</th>
                                  <th className="text-left font-semibold px-3 py-1.5">Fecha</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Cant. Original</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Costo Unit.</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Saldo</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Valor</th>
                                  <th className="text-left font-semibold px-3 py-1.5">Vencimiento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.lotes.map((l, li) => {
                                  const editando = editandoLoteId === l.inventarioLoteId;
                                  const guardando = actualizandoLoteId === l.inventarioLoteId;
                                  return (
                                    <tr
                                      key={l.inventarioLoteId}
                                      className={`border-t border-gray-100 ${li % 2 === 1 ? "bg-gray-50/40" : ""}`}
                                    >
                                      <td className="px-3 py-1.5">
                                        <OrigenBadge origen={l.origen} />
                                      </td>
                                      <td className="px-3 py-1.5 text-gray-500">
                                        {new Date(l.fechaLote).toLocaleDateString("es-PE")}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-gray-600">{l.cantidadOriginal}</td>
                                      <td className="px-3 py-1.5 text-right text-gray-600">S/ {l.costoUnitario.toFixed(2)}</td>
                                      <td className="px-3 py-1.5 text-right font-semibold text-gray-700">{l.saldoCantidad}</td>
                                      <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">
                                        S/ {l.saldoValor.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-1.5">
                                        {editando && confirmacionPendiente?.inventarioLoteId === l.inventarioLoteId ? (
                                          <div className="flex flex-col gap-1 max-w-[220px]">
                                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 leading-snug">
                                              {confirmacionPendiente.mensaje}
                                            </p>
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => handleGuardarEdicion(l.inventarioLoteId, true)}
                                                disabled={guardando}
                                                className="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors disabled:opacity-50"
                                              >
                                                Sí, cambiar de todas formas
                                              </button>
                                              <button
                                                onClick={handleCancelarEdicion}
                                                disabled={guardando}
                                                className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                                title="Cancelar"
                                              >
                                                <XIcon className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ) : editando ? (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="date"
                                              value={valorEdicion}
                                              onChange={(e) => setValorEdicion(e.target.value)}
                                              className="text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-brand-blue/30"
                                            />
                                            <button
                                              onClick={() => handleGuardarEdicion(l.inventarioLoteId)}
                                              disabled={guardando}
                                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
                                              title="Guardar"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={handleCancelarEdicion}
                                              disabled={guardando}
                                              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                              title="Cancelar"
                                            >
                                              <XIcon className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 group/venc">
                                            {l.fechaVencimiento ? (
                                              <span className="text-gray-600">
                                                {new Date(l.fechaVencimiento).toLocaleDateString("es-PE")}
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1 text-gray-300">
                                                <CalendarOff className="w-3 h-3" /> Sin vencimiento
                                              </span>
                                            )}
                                            <button
                                              onClick={() => handleIniciarEdicion(l)}
                                              className="p-0.5 text-gray-300 hover:text-brand-blue opacity-0 group-hover/venc:opacity-100 transition-opacity"
                                              title="Corregir fecha de vencimiento"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
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
