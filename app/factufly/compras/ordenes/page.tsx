"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  PackagePlus,
  Pencil,
  Trash2,
  PackageSearch,
  Calendar,
  X,
  Layers,
  List,
} from "lucide-react";

import { Button } from "@/app/components/ui/Button";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { cn } from "@/app/utils/cn";

import { CompraProveedor } from "../proveedores/gestionProveedorCompra/Proveedor";
import { useProveedoresLista } from "../proveedores/gestionProveedorCompra/useProveedoresLista";
import { useOrdenesLista } from "./gestionOrdenes/useOrdenesLista";
import { useEliminarCompraProveedor } from "./gestionOrdenes/useEliminarCompraProveedor";
import { contarOrdenes, agruparPorDocumento } from "./gestionOrdenes/agruparOrdenes";

import RegistrarCompra from "@/app/components/provedores/RegistrarCompra";
import EditarCompraModal from "@/app/components/provedores/EditarCompraModal";
import { useAuth } from "@/context/AuthContext";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";

function hoyISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function OrdenesCompraPage() {
  const hoy = hoyISO();
  const { user } = useAuth();
  const isSuperAdmin = user?.rol === "superadmin";

  const { proveedores, setProveedores } = useProveedoresLista();
  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const { ordenes, setOrdenes, loadingOrdenes, fetchOrdenes } = useOrdenesLista();
  const { eliminarCompraProveedor } = useEliminarCompraProveedor();

  const [search, setSearch] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState<string>("Todos");
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [isCompraOpen, setIsCompraOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompraProveedor | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompraProveedor | null>(null);
  // Agrupar por documento: desactivado por defecto, muestra la lista plana actual.
  const [agruparPorDoc, setAgruparPorDoc] = useState(false);

  const proveedorIdSeleccionado =
    filtroProveedor === "Todos"
      ? 0
      : proveedores.find((p) => p.razonSocial === filtroProveedor)?.proveedorId ?? 0;

  const sucursalIdSeleccionado =
    filtroSucursal === "Todos"
      ? 0
      : sucursales.find((s) => s.nombre === filtroSucursal)?.sucursalId ?? 0;

  const sucursalPropia = !isSuperAdmin ? parseInt(user?.sucursalID ?? "0") : 0;

  const recargar = () => {
    fetchOrdenes({
      proveedorId: proveedorIdSeleccionado,
      sucursalId: isSuperAdmin ? sucursalIdSeleccionado : sucursalPropia,
      sucursalesEmpresa: isSuperAdmin ? sucursales : [],
    });
  };

  useEffect(() => {
    if (!user?.ruc) return;
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.ruc, proveedorIdSeleccionado, sucursalIdSeleccionado, sucursales.length]);

  const filtered = useMemo(() => {
    return ordenes.filter((o) => {
      const matchSearch =
        !search ||
        (o.nomProducto ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (o.razonSocialProveedor ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (o.docReferencia ?? "").toLowerCase().includes(search.toLowerCase());

      const fecha = o.fechaCreacion ? new Date(o.fechaCreacion) : null;
      const matchDesde = !fechaDesde || (fecha && fecha >= new Date(fechaDesde));
      const matchHasta =
        !fechaHasta || (fecha && fecha <= new Date(fechaHasta + "T23:59:59"));

      return matchSearch && matchDesde && matchHasta;
    });
  }, [ordenes, search, fechaDesde, fechaHasta]);

  const totalOrdenes = contarOrdenes(filtered);
  const totalInvertido = filtered.reduce(
    (acc, o) => acc + (o.precioCompra ?? 0) * (o.cantidad ?? 0),
    0,
  );

  const grupos = useMemo(() => agruparPorDocumento(filtered), [filtered]);

  const filtrosActivos =
    filtroProveedor !== "Todos" ||
    filtroSucursal !== "Todos" ||
    !!fechaDesde ||
    !!fechaHasta;

  const limpiarFiltros = () => {
    setFiltroProveedor("Todos");
    setFiltroSucursal("Todos");
    setFechaDesde("");
    setFechaHasta("");
    setSearch("");
  };

  const handleOpenDelete = (orden: CompraProveedor) => {
    setDeleteTarget(orden);
    setIsDeleteOpen(true);
  };

  const handleOpenEdit = (orden: CompraProveedor) => {
    setEditTarget(orden);
    setIsEditOpen(true);
  };

  const handleSaveEdit = (compraEditada: CompraProveedor) => {
    setOrdenes((prev) => {
      const sinVieja = prev.filter(
        (o) => o.compraProveedorId !== editTarget?.compraProveedorId,
      );
      return [compraEditada, ...sinVieja].sort(
        (a, b) =>
          new Date(b.fechaCreacion).getTime() -
          new Date(a.fechaCreacion).getTime(),
      );
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const ok = await eliminarCompraProveedor(deleteTarget.compraProveedorId);
    if (ok) {
      setOrdenes((prev) =>
        prev.filter((o) => o.compraProveedorId !== deleteTarget.compraProveedorId),
      );
    }
    setDeleteTarget(null);
    setIsDeleteOpen(false);
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="relative min-w-48 flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto, proveedor o doc. referencia..."
              className="w-full h-9 pl-10 pr-4 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
            />
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <DropdownFiltro
              label="Proveedor: Todos"
              value={filtroProveedor}
              options={["Todos", ...proveedores.map((p) => p.razonSocial)]}
              onChange={setFiltroProveedor}
            />
            {isSuperAdmin && (
              <DropdownFiltro
                label="Sucursal: Todas"
                value={filtroSucursal}
                options={["Todos", ...sucursales.map((s) => s.nombre)]}
                onChange={setFiltroSucursal}
              />
            )}

            <div className="flex items-center h-9 gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="date"
                value={fechaDesde}
                max={fechaHasta || hoy}
                onChange={(e) => {
                  const v = e.target.value;
                  setFechaDesde(v);
                  if (v && fechaHasta && v > fechaHasta) setFechaHasta(v);
                }}
                className="text-xs outline-none w-[105px] h-full"
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
                className="text-xs outline-none w-[105px] h-full"
              />
            </div>

            {filtrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center h-9 gap-1 text-xs text-gray-400 hover:text-rose-500 font-semibold transition-colors px-2"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}

            <button
              type="button"
              onClick={() => setAgruparPorDoc((prev) => !prev)}
              className={cn(
                "flex items-center h-9 gap-1.5 px-2.5 text-xs font-semibold border rounded-md shadow-sm transition-all whitespace-nowrap",
                agruparPorDoc
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              {agruparPorDoc ? <List className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
              {agruparPorDoc ? "Ver todo" : "Agrupar por documento"}
            </button>

            <div className="w-px h-6 bg-gray-200" />

            <Button
              onClick={() => setIsCompraOpen(true)}
              className="h-9 px-3 text-xs rounded-md"
            >
              <PackagePlus className="w-3.5 h-3.5" /> Registrar Compra
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] text-gray-500">
          <span className="font-semibold text-gray-900">{totalOrdenes}</span> orden(es) ·{" "}
          <span className="font-semibold text-gray-900">{filtered.length}</span> línea(s) de producto
        </p>
        <p className="text-[12px] text-gray-500">
          Total invertido:{" "}
          <span className="font-semibold text-gray-900">S/ {totalInvertido.toFixed(2)}</span>
        </p>
      </div>

      {/* Resumen por documento */}
      {agruparPorDoc && (
        <div
          className="overflow-y-auto rounded-xl border border-gray-200 bg-white space-y-2 p-2"
          style={{
            maxHeight: "calc(100vh - 220px)",
            scrollbarWidth: "thin",
            scrollbarColor: "#CBD5E1 transparent",
          }}
        >
          {!loadingOrdenes && grupos.length === 0 && (
            <div className="py-16 text-center">
              <div className="bg-gray-100 rounded-full p-4 mb-3 inline-flex">
                <PackageSearch className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-semibold text-sm">No se encontraron órdenes de compra</p>
              <p className="text-gray-400 text-xs mt-1">Ajusta los filtros o registra una nueva compra</p>
            </div>
          )}

          {grupos.map((g) => (
            <div key={g.clave} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 border-b border-gray-200">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800">
                    {g.docReferencia || "Sin documento"}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {g.razonSocialProveedor ?? "—"}
                    {isSuperAdmin && g.nomSucursal ? ` · ${g.nomSucursal}` : ""} ·{" "}
                    {g.fechaCreacion ? new Date(g.fechaCreacion).toLocaleDateString("es-PE") : "—"}
                  </p>
                </div>
                <p className="text-xs font-bold text-brand-blue whitespace-nowrap">
                  S/ {g.totalInvertido.toFixed(2)}
                </p>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {g.items.map((o) => (
                    <tr key={o.compraProveedorId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-gray-700">{o.nomProducto ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        {o.cantidad} {o.unidadMedida}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        S/ {(o.precioCompra ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                        S/ {((o.precioCompra ?? 0) * (o.cantidad ?? 0)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap text-[11px]">
                        {o.fechaVencimiento
                          ? new Date(o.fechaVencimiento).toLocaleDateString("es-PE")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center w-16">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => handleOpenEdit(o)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(o)}
                            className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      {!agruparPorDoc && (
      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{
          maxHeight: "calc(100vh - 200px)",
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 transparent",
        }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Fecha</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Proveedor</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Producto</th>
              {isSuperAdmin && (
                <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Sucursal</th>
              )}
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cantidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Precio</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Subtotal</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Doc. Referencia</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Vencimiento</th>
              <th className="text-center font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingOrdenes &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={isSuperAdmin ? 10 : 9}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingOrdenes && filtered.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 10 : 9} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">No se encontraron órdenes de compra</p>
                    <p className="text-gray-400 text-xs mt-1">Ajusta los filtros o registra una nueva compra</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingOrdenes &&
              filtered.map((o) => (
                <tr key={o.compraProveedorId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {o.fechaCreacion ? new Date(o.fechaCreacion).toLocaleDateString("es-PE") : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{o.razonSocialProveedor ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-700">{o.nomProducto ?? "—"}</td>
                  {isSuperAdmin && (
                    <td className="px-3 py-2.5 text-gray-500">{o.nomSucursal ?? "—"}</td>
                  )}
                  <td className="px-3 py-2.5 text-right text-gray-700">
                    {o.cantidad} {o.unidadMedida}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700">S/ {(o.precioCompra ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-brand-blue">
                    S/ {((o.precioCompra ?? 0) * (o.cantidad ?? 0)).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{o.docReferencia || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {o.fechaVencimiento
                      ? new Date(o.fechaVencimiento).toLocaleDateString("es-PE")
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(o)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar orden"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(o)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar orden"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      )}

      <RegistrarCompra
        isOpen={isCompraOpen}
        onClose={() => setIsCompraOpen(false)}
        proveedores={proveedores}
        proveedorPreseleccionado={null}
        onCompraRegistrada={() => recargar()}
        onProveedorCreado={(nuevo) => setProveedores((prev) => [...prev, nuevo])}
      />

      <ModalEliminar
        isOpen={isDeleteOpen}
        mensaje="Eliminarás la orden de compra de"
        nombre={deleteTarget?.nomProducto ?? ""}
        documento={deleteTarget?.docReferencia ?? undefined}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <EditarCompraModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        compra={editTarget}
        proveedores={proveedores}
        onGuardado={handleSaveEdit}
      />
    </div>
  );
}
