"use client";

import React, { useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Truck,
  History,
  MapPin,
} from "lucide-react";

import { Button } from "@/app/components/ui/Button";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";

import { Proveedor } from "./gestionProveedorCompra/Proveedor";
import { useProveedoresLista } from "./gestionProveedorCompra/useProveedoresLista";
import { useEliminarProveedor } from "./gestionProveedorCompra/useEliminarProveedor";

import AgregarProveedor from "@/app/components/provedores/AgregarProveedor";
import EditarProveedor from "@/app/components/provedores/EditarProveedor";
import HistorialCompras from "@/app/components/provedores/HistorialCompras";

export default function ProveedoresPage() {
  const { proveedores, loadingProveedores, setProveedores } = useProveedoresLista();
  const { eliminarProveedor } = useEliminarProveedor();

  const [search, setSearch] = useState("");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHistorialOpen, setIsHistorialOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<Proveedor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);
  const [historialTarget, setHistorialTarget] = useState<Proveedor | null>(null);

  const filtered = proveedores.filter(
    (p) =>
      p.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      (p.numDocumento ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.nombreComercial ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenEdit = (prov: Proveedor) => {
    setEditTarget(prov);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (prov: Proveedor) => {
    setDeleteTarget(prov);
    setIsDeleteOpen(true);
  };

  const handleOpenHistorial = (prov: Proveedor) => {
    setHistorialTarget(prov);
    setIsHistorialOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const ok = await eliminarProveedor(deleteTarget.proveedorId);
    if (ok) {
      setProveedores((prev) =>
        prev.filter((p) => p.proveedorId !== deleteTarget.proveedorId),
      );
    }
    setDeleteTarget(null);
    setIsDeleteOpen(false);
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative min-w-48 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor por documento o razón social..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-xs"
          />
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsNewOpen(true)}
            className="py-2.5 px-3 text-xs rounded-md h-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Proveedor
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-500">
          Mostrando{" "}
          <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          proveedores
        </p>
      </div>

      {/* Tabla */}
      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
        style={{
          maxHeight: "calc(100vh - 170px)",
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 transparent",
        }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Documento</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Proveedor</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Contacto</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Teléfono</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Email</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingProveedores &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={6}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingProveedores && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <Truck className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">
                      No se encontraron proveedores
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Registra tu primer proveedor para empezar
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingProveedores &&
              filtered.map((prov, idx) => (
                <tr
                  key={prov.proveedorId}
                  className={`border-b transition-colors ${
                    idx % 2 === 1
                      ? "bg-gray-50/50 border-gray-100 hover:bg-blue-50/40"
                      : "bg-white border-gray-100 hover:bg-blue-50/40"
                  }`}
                >
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {prov.numDocumento || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 line-clamp-1">{prov.razonSocial}</p>
                        {prov.nombreComercial && (
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide line-clamp-1">
                            {prov.nombreComercial}
                          </p>
                        )}
                      </div>
                      {prov.direccion && (
                        <span
                          title={prov.direccion}
                          className="shrink-0 text-gray-300 hover:text-brand-blue cursor-help mt-0.5"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{prov.personaContacto || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{prov.telefono || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[200px]">
                    {prov.email ? (
                      <span title={prov.email} className="block truncate">{prov.email}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenHistorial(prov)}
                        title="Historial de compras"
                        className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(prov)}
                        title="Editar"
                        className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(prov)}
                        title="Eliminar"
                        className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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

      <AgregarProveedor
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onProveedorAgregado={(prov) => setProveedores((prev) => [...prev, prov])}
      />

      <EditarProveedor
        isOpen={isEditOpen}
        proveedor={editTarget}
        onClose={() => setIsEditOpen(false)}
        onProveedorEditado={(provEditado) =>
          setProveedores((prev) =>
            prev.map((p) =>
              p.proveedorId === provEditado.proveedorId ? provEditado : p,
            ),
          )
        }
      />

      <HistorialCompras
        isOpen={isHistorialOpen}
        proveedor={historialTarget}
        onClose={() => setIsHistorialOpen(false)}
      />

      <ModalEliminar
        isOpen={isDeleteOpen}
        mensaje="Eliminarás al proveedor"
        nombre={deleteTarget?.razonSocial ?? ""}
        documento={deleteTarget?.numDocumento ?? undefined}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
