"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PackageSearch, ChevronDown, ChevronUp, Lock, Layers } from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useStockValorizadoLista } from "../useStockValorizadoLista";

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
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    if (sucursalId > 0) fetchStockValorizadoSucursal(sucursalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId]);

  const totalValor = useMemo(
    () => stockValorizado.reduce((acc, p) => acc + p.valorTotal, 0),
    [stockValorizado],
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

      <div className="grid grid-cols-2 sm:grid-cols-[auto_1fr] gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Productos con stock</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{stockValorizado.length}</span>
        </div>
        <div className="rounded-xl border border-brand-blue/20 bg-gradient-to-br from-brand-blue/5 to-brand-blue/10 px-4 py-3 flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-brand-blue/70 uppercase tracking-wide">Valor total del inventario</span>
          <span className="text-2xl font-bold text-brand-blue tabular-nums">S/ {totalValor.toFixed(2)}</span>
        </div>
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{ maxHeight: "calc(100vh - 220px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr>
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

            {!loadingStockValorizado &&
              stockValorizado.map((p, idx) => {
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
                      <td className="px-3 py-2.5 text-gray-500">{p.codigo ?? "—"}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{p.nomProducto ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{p.stockActual}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">S/ {p.costoPromedioActual.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-brand-blue">S/ {p.valorTotal.toFixed(2)}</td>
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
                                </tr>
                              </thead>
                              <tbody>
                                {p.lotes.map((l, li) => (
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
                                  </tr>
                                ))}
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
