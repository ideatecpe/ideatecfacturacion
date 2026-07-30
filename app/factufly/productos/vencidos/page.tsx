"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PackageSearch, ChevronDown, ChevronUp, Lock, AlertTriangle, Trash2, XCircle, History, Search, X, PackageX, Coins } from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useLotesVencidosLista } from "../useLotesVencidosLista";
import { useHistorialVencidosLista } from "../useHistorialVencidosLista";
import { LoteVencido } from "../Inventario";

interface ProductoVencidoGrupo {
  sucursalProductoId: number;
  nomProducto: string | null;
  codigo: string | null;
  lotes: LoteVencido[];
  totalCantidad: number;
  totalCosto: number;
}

function agruparPorProducto(lotes: LoteVencido[]): ProductoVencidoGrupo[] {
  const mapa = new Map<number, ProductoVencidoGrupo>();
  for (const l of lotes) {
    const grupo = mapa.get(l.sucursalProductoId);
    if (grupo) {
      grupo.lotes.push(l);
      grupo.totalCantidad += l.saldoCantidad;
      grupo.totalCosto += l.saldoCantidad * l.costoUnitario;
    } else {
      mapa.set(l.sucursalProductoId, {
        sucursalProductoId: l.sucursalProductoId,
        nomProducto: l.nomProducto,
        codigo: l.codigo,
        lotes: [l],
        totalCantidad: l.saldoCantidad,
        totalCosto: l.saldoCantidad * l.costoUnitario,
      });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => a.lotes[0].fechaVencimiento.localeCompare(b.lotes[0].fechaVencimiento));
}

function diasVencido(fechaVencimiento: string): number {
  const ms = new Date().setHours(0, 0, 0, 0) - new Date(fechaVencimiento).setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(ms / 86400000));
}

interface ModalRetirarProps {
  isOpen: boolean;
  grupo: ProductoVencidoGrupo | null;
  onClose: () => void;
  onConfirm: () => void;
}

function ModalRetirarVencido({ isOpen, grupo, onClose, onConfirm }: ModalRetirarProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar retiro de vencidos">
      <div className="space-y-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-800">¿Estás seguro?</p>
            <p className="text-xs text-rose-600 mt-0.5">
              Se dará de baja el stock vencido de <strong>{grupo?.nomProducto ?? "este producto"}</strong>
              {grupo?.codigo && ` (${grupo.codigo})`}: {grupo?.totalCantidad} unidad(es) por un costo de{" "}
              S/ {grupo?.totalCosto.toFixed(2)}. Esta acción descuenta el stock y no se puede deshacer.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
          >
            <Trash2 size={14} /> Retirar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ProductosVencidosPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");

  const sucursalId = isSuperAdmin
    ? sucursales.find((s) => s.nombre === filtroSucursal)?.sucursalId ?? 0
    : parseInt(user?.sucursalID ?? "0");

  const {
    lotesVencidos,
    loadingLotesVencidos,
    fetchLotesVencidosSucursal,
    retirarVencidosProducto,
    retirandoId,
  } = useLotesVencidosLista();

  const { historial, loadingHistorial, fetchHistorialVencidos } = useHistorialVencidosLista();

  const [expandido, setExpandido] = useState<number | null>(null);
  const [retirarTarget, setRetirarTarget] = useState<ProductoVencidoGrupo | null>(null);
  const [isRetirarOpen, setIsRetirarOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const recargar = () => {
    if (sucursalId > 0) {
      fetchLotesVencidosSucursal(sucursalId);
      fetchHistorialVencidos(sucursalId);
    }
  };

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId]);

  const totalHistorialCantidad = useMemo(() => historial.reduce((acc, h) => acc + h.cantidad, 0), [historial]);
  const totalHistorialCosto = useMemo(() => historial.reduce((acc, h) => acc + h.costoTotal, 0), [historial]);

  const grupos = useMemo(() => agruparPorProducto(lotesVencidos), [lotesVencidos]);

  const totalCostoVencido = useMemo(
    () => grupos.reduce((acc, g) => acc + g.totalCosto, 0),
    [grupos],
  );

  const gruposFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return grupos;
    return grupos.filter(
      (g) =>
        (g.nomProducto ?? "").toLowerCase().includes(termino) ||
        (g.codigo ?? "").toLowerCase().includes(termino),
    );
  }, [grupos, busqueda]);

  const handleOpenRetirar = (grupo: ProductoVencidoGrupo) => {
    setRetirarTarget(grupo);
    setIsRetirarOpen(true);
  };

  const handleConfirmRetirar = async () => {
    if (!retirarTarget) return;
    const ok = await retirarVencidosProducto(retirarTarget.sucursalProductoId);
    if (ok) recargar();
    setRetirarTarget(null);
  };

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
    <div className="animate-in fade-in duration-500">
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
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="inline-flex items-center h-9 gap-2 rounded-lg border border-gray-200 bg-white px-3">
            <PackageX className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-[11px] font-medium text-gray-500">Productos vencidos</span>
            <span className="text-base font-bold text-gray-900 tabular-nums">{grupos.length}</span>
          </div>
          <div className="inline-flex items-center h-9 gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3">
            <Coins className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="text-[11px] font-medium text-rose-500/80">Costo total vencido</span>
            <span className="text-base font-bold text-rose-700 tabular-nums">S/ {totalCostoVencido.toFixed(2)}</span>
          </div>
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
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cantidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Vencido</th>
              <th className="text-center font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Acción</th>
              <th className="w-10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loadingLotesVencidos &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={6}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingLotesVencidos && sucursalId === 0 && (
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

            {!loadingLotesVencidos && sucursalId > 0 && grupos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-emerald-50 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-emerald-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin productos vencidos</p>
                    <p className="text-gray-400 text-xs mt-1">
                      No hay lotes vencidos pendientes de retirar en esta sucursal
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingLotesVencidos && sucursalId > 0 && grupos.length > 0 && gruposFiltrados.length === 0 && (
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

            {!loadingLotesVencidos &&
              gruposFiltrados.map((g, idx) => {
                const isOpen = expandido === g.sucursalProductoId;
                const retirando = retirandoId === g.sucursalProductoId;
                return (
                  <React.Fragment key={g.sucursalProductoId}>
                    <tr
                      className={`border-b transition-colors ${
                        isOpen
                          ? "bg-rose-50/60 border-rose-100"
                          : idx % 2 === 1
                            ? "bg-gray-50/50 border-gray-100"
                            : "bg-white border-gray-100"
                      }`}
                    >
                      <td
                        className="px-3 py-2.5 text-gray-500 cursor-pointer"
                        onClick={() => setExpandido(isOpen ? null : g.sucursalProductoId)}
                      >
                        {g.codigo ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 font-semibold text-gray-800 cursor-pointer"
                        onClick={() => setExpandido(isOpen ? null : g.sucursalProductoId)}
                      >
                        {g.nomProducto ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right text-gray-700 cursor-pointer"
                        onClick={() => setExpandido(isOpen ? null : g.sucursalProductoId)}
                      >
                        {g.totalCantidad}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-bold text-rose-700 cursor-pointer"
                        onClick={() => setExpandido(isOpen ? null : g.sucursalProductoId)}
                      >
                        S/ {g.totalCosto.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleOpenRetirar(g)}
                          disabled={retirando}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> {retirando ? "Retirando..." : "Retirar"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={() => setExpandido(isOpen ? null : g.sucursalProductoId)}>
                        <div className={`inline-flex rounded-full p-1 transition-colors cursor-pointer ${isOpen ? "text-rose-600 bg-rose-100" : "text-gray-400"}`}>
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-rose-50/30">
                        <td colSpan={6} className="px-3 pb-3 pt-0">
                          <div className="ml-1 rounded-lg border border-rose-100 bg-white overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-rose-50/60 border-b border-rose-100">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                                Lotes vencidos de {g.nomProducto}
                              </span>
                            </div>
                            <table className="w-full text-[11px] tabular-nums">
                              <thead>
                                <tr className="text-gray-400 uppercase tracking-wide">
                                  <th className="text-left font-semibold px-3 py-1.5">Fecha Vencimiento</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Días vencido</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Saldo</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Costo Unit.</th>
                                  <th className="text-right font-semibold px-3 py-1.5">Costo Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.lotes.map((l, li) => (
                                  <tr
                                    key={l.inventarioLoteId}
                                    className={`border-t border-gray-100 ${li % 2 === 1 ? "bg-gray-50/40" : ""}`}
                                  >
                                    <td className="px-3 py-1.5 text-gray-600">
                                      {new Date(l.fechaVencimiento).toLocaleDateString("es-PE")}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-rose-600 font-semibold">
                                      {diasVencido(l.fechaVencimiento)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-semibold text-gray-700">{l.saldoCantidad}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-600">S/ {l.costoUnitario.toFixed(2)}</td>
                                    <td className="px-3 py-1.5 text-right font-semibold text-rose-700">
                                      S/ {(l.saldoCantidad * l.costoUnitario).toFixed(2)}
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

      {/* ── Historial de retirados ── */}
      {sucursalId > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* Cabecera con totales */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-wrap">
            <div className="flex items-center gap-1.5 text-gray-500">
              <History className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wide">Historial de retirados</span>
            </div>
            <div className="flex items-center gap-3 ml-auto text-[11px] text-gray-500">
              <span>
                Total retirado:{" "}
                <span className="font-semibold text-gray-700 tabular-nums">{totalHistorialCantidad} und.</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Costo total:{" "}
                <span className="font-semibold text-rose-700 tabular-nums">S/ {totalHistorialCosto.toFixed(2)}</span>
              </span>
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "220px", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}>
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2">Fecha</th>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2">Código</th>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2">Producto</th>
                  <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2">Cantidad</th>
                  <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2">Costo Unit.</th>
                  <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2">Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistorial &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 animate-pulse">
                      <td className="px-3 py-2.5" colSpan={6}>
                        <div className="h-3 bg-gray-200 rounded w-full" />
                      </td>
                    </tr>
                  ))}

                {!loadingHistorial && historial.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                      Sin retiros registrados en esta sucursal
                    </td>
                  </tr>
                )}

                {!loadingHistorial &&
                  historial.map((h, idx) => (
                    <tr
                      key={h.kardexMovimientoId}
                      className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-gray-50/50" : "bg-white"}`}
                    >
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(h.fechaMovimiento).toLocaleDateString("es-PE")}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{h.codigo ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{h.nomProducto ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{h.cantidad}</td>
                      <td className="px-3 py-2 text-right text-gray-600">S/ {h.costoUnitarioPromedio.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-700">S/ {h.costoTotal.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalRetirarVencido
        isOpen={isRetirarOpen}
        grupo={retirarTarget}
        onClose={() => setIsRetirarOpen(false)}
        onConfirm={handleConfirmRetirar}
      />
    </div>
  );
}
