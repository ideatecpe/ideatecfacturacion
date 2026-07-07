"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, PackageSearch, ChevronDown, ChevronUp, Lock } from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useStockValorizadoLista } from "../useStockValorizadoLista";

export default function StockValorizadoPage() {
  const router = useRouter();
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
      <div className="flex items-center gap-3 animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => router.push("/factufly/productos/lista")}
          className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
          style={{ background: "rgba(15,46,100,0.08)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,46,100,0.15)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15,46,100,0.08)")}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "#0f2e64" }} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold leading-tight" style={{ color: "#0f2e64" }}>
            Stock Valorizado (PEPS)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Valor actual del inventario según el costo de sus lotes de compra
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isSuperAdmin && (
          <DropdownFiltro
            label="Sucursal"
            value={filtroSucursal}
            options={["Todos", ...sucursales.map((s) => s.nombre)]}
            onChange={setFiltroSucursal}
          />
        )}

        <p className="text-[12px] text-gray-500 ml-auto">
          <span className="font-semibold text-gray-900">{stockValorizado.length}</span> producto(s) con stock ·
          Valor total:{" "}
          <span className="font-semibold text-gray-900">S/ {totalValor.toFixed(2)}</span>
        </p>
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
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Stock</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Prom.</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Valor Total</th>
              <th className="text-center font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Lotes</th>
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
              stockValorizado.map((p) => (
                <React.Fragment key={p.sucursalProductoId}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-gray-500">{p.codigo ?? "—"}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800">{p.nomProducto ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{p.stockActual}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">S/ {p.costoPromedioActual.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-brand-blue">S/ {p.valorTotal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setExpandido(expandido === p.sucursalProductoId ? null : p.sucursalProductoId)}
                        className="p-1 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors"
                      >
                        {expandido === p.sucursalProductoId ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandido === p.sucursalProductoId && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={6} className="px-3 py-2">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-gray-400 uppercase tracking-wide">
                              <th className="text-left font-semibold py-1">Origen</th>
                              <th className="text-left font-semibold py-1">Fecha</th>
                              <th className="text-right font-semibold py-1">Cant. Original</th>
                              <th className="text-right font-semibold py-1">Costo Unit.</th>
                              <th className="text-right font-semibold py-1">Saldo</th>
                              <th className="text-right font-semibold py-1">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.lotes.map((l) => (
                              <tr key={l.inventarioLoteId} className="border-t border-gray-200">
                                <td className="py-1.5 text-gray-600">{l.origen}</td>
                                <td className="py-1.5 text-gray-500">
                                  {new Date(l.fechaLote).toLocaleDateString("es-PE")}
                                </td>
                                <td className="py-1.5 text-right text-gray-600">{l.cantidadOriginal}</td>
                                <td className="py-1.5 text-right text-gray-600">S/ {l.costoUnitario.toFixed(2)}</td>
                                <td className="py-1.5 text-right font-semibold text-gray-700">{l.saldoCantidad}</td>
                                <td className="py-1.5 text-right font-semibold text-gray-700">
                                  S/ {l.saldoValor.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
