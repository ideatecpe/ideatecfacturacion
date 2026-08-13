"use client";

import React from "react";
import { Modal } from "@/app/components/ui/Modal";
import {
  Loader2,
  PackageSearch,
  Search,
  Calendar,
  X,
  Receipt,
  Building2,
  Boxes,
  Wallet,
  Layers,
  List,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";
import { Proveedor, CompraProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/Proveedor";
import { useComprasProveedorLista } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/useComprasProveedorLista";
import { contarOrdenes, agruparPorDocumento } from "@/app/factufly/compras/ingresos-stock/gestionOrdenes/agruparOrdenes";

interface Props {
  isOpen: boolean;
  proveedor: Proveedor | null;
  onClose: () => void;
}

function hoyISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function HistorialCompras({ isOpen, proveedor, onClose }: Props) {
  const hoy = hoyISO();
  const { compras, loadingCompras, fetchComprasByProveedor } = useComprasProveedorLista();

  const [search, setSearch] = React.useState("");
  const [filtroSucursal, setFiltroSucursal] = React.useState("Todas");
  const [fechaDesde, setFechaDesde] = React.useState("");
  const [fechaHasta, setFechaHasta] = React.useState("");
  // Agrupar por documento: desactivado por defecto, muestra la lista plana actual.
  const [agruparPorDoc, setAgruparPorDoc] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && proveedor) fetchComprasByProveedor(proveedor.proveedorId);
  }, [isOpen, proveedor]);

  React.useEffect(() => {
    if (isOpen) {
      setSearch("");
      setFiltroSucursal("Todas");
      setFechaDesde("");
      setFechaHasta("");
    }
  }, [isOpen, proveedor]);

  const sucursales = React.useMemo(
    () => Array.from(new Set(compras.map((c) => c.nomSucursal).filter(Boolean))) as string[],
    [compras],
  );

  const filtradas = React.useMemo(() => {
    return compras.filter((c) => {
      const matchSearch =
        !search || coincideBusqueda(search, c.nomProducto, c.docReferencia);

      const matchSucursal = filtroSucursal === "Todas" || c.nomSucursal === filtroSucursal;

      const fecha = c.fechaCreacion ? new Date(c.fechaCreacion) : null;
      const matchDesde = !fechaDesde || (fecha && fecha >= new Date(fechaDesde));
      const matchHasta = !fechaHasta || (fecha && fecha <= new Date(fechaHasta + "T23:59:59"));

      return matchSearch && matchSucursal && matchDesde && matchHasta;
    });
  }, [compras, search, filtroSucursal, fechaDesde, fechaHasta]);

  const totalInvertido = filtradas.reduce(
    (acc, c) => acc + (c.precioCompra ?? 0) * (c.cantidad ?? 0),
    0,
  );
  const productosDistintos = new Set(filtradas.map((c) => c.productoId)).size;
  const numeroOrdenes = contarOrdenes(filtradas);
  const grupos = React.useMemo(() => agruparPorDocumento(filtradas), [filtradas]);

  const filtrosActivos =
    filtroSucursal !== "Todas" || !!fechaDesde || !!fechaHasta || !!search;

  const limpiarFiltros = () => {
    setSearch("");
    setFiltroSucursal("Todas");
    setFechaDesde("");
    setFechaHasta("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Historial de compras — ${proveedor?.razonSocial ?? ""}`}
      className="max-w-6xl"
    >
      <div className="flex flex-col gap-3">
        {/* Resumen */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Órdenes</p>
              <p className="text-sm font-bold text-blue-900">{numeroOrdenes}</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="bg-emerald-100 p-1.5 rounded-lg">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Total invertido</p>
              <p className="text-sm font-bold text-emerald-900">S/ {totalInvertido.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="bg-amber-100 p-1.5 rounded-lg">
              <Boxes className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Productos distintos</p>
              <p className="text-sm font-bold text-amber-900">{productosDistintos}</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative min-w-40 flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o doc. referencia..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
            />
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {sucursales.length > 1 && (
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filtroSucursal}
                onChange={(e) => setFiltroSucursal(e.target.value)}
                className="pl-7 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-md outline-none focus:border-brand-blue/50 shadow-sm"
              >
                <option value="Todas">Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-2 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || hoy}
              onChange={(e) => {
                const v = e.target.value;
                setFechaDesde(v);
                if (v && fechaHasta && v > fechaHasta) setFechaHasta(v);
              }}
              className="text-xs outline-none w-[105px]"
            />
            <span className="text-gray-300">–</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              max={hoy}
              onChange={(e) => {
                const v = e.target.value;
                setFechaHasta(v);
                if (v && fechaDesde && v < fechaDesde) setFechaDesde(v);
              }}
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

          <button
            type="button"
            onClick={() => setAgruparPorDoc((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold border rounded-md transition-all whitespace-nowrap",
              agruparPorDoc
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
            )}
          >
            {agruparPorDoc ? <List className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
            {agruparPorDoc ? "Ver todo" : "Agrupar por documento"}
          </button>
        </div>

        {/* Tabla / resumen agrupado */}
        <div className="overflow-y-auto rounded-xl border border-gray-200 custom-scrollbar max-h-[55vh]">
          {loadingCompras ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-gray-100 rounded-full p-4 mb-3">
                <PackageSearch className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-semibold text-sm">
                {compras.length === 0
                  ? "Este proveedor aún no tiene compras registradas"
                  : "No se encontraron compras con estos filtros"}
              </p>
            </div>
          ) : agruparPorDoc ? (
            <div className="space-y-2 p-2">
              {grupos.map((g) => (
                <div key={g.clave} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">
                        {g.docReferencia || "Sin documento"}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {g.nomSucursal ?? "—"} ·{" "}
                        {g.fechaCreacion ? new Date(g.fechaCreacion).toLocaleDateString("es-PE") : "—"}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-brand-blue whitespace-nowrap">
                      S/ {g.totalInvertido.toFixed(2)}
                    </p>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {g.items.map((c) => (
                        <tr key={c.compraProveedorId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 text-gray-700">{c.nomProducto ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                            {c.cantidad} {c.unidadMedida}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                            S/ {(c.precioCompra ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                            S/ {((c.precioCompra ?? 0) * (c.cantidad ?? 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Producto</th>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Sucursal</th>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Fecha</th>
                  <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Doc. Referencia</th>
                  <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cantidad</th>
                  <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Precio c/u</th>
                  <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filtradas.map((c: CompraProveedor) => (
                  <tr key={c.compraProveedorId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-gray-800">{c.nomProducto ?? "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{c.nomSucursal ?? "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {c.fechaCreacion ? new Date(c.fechaCreacion).toLocaleDateString("es-PE") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{c.docReferencia || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {c.cantidad} {c.unidadMedida}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">S/ {(c.precioCompra ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-brand-blue">
                      S/ {((c.precioCompra ?? 0) * (c.cantidad ?? 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
