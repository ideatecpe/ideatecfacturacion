"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Truck,
  History,
  Mail,
  Phone,
  User,
  MapPin,
  ChevronLeft,
} from "lucide-react";

import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";

import { Proveedor } from "./gestionProveedorCompra/Proveedor";
import { useProveedoresLista } from "./gestionProveedorCompra/useProveedoresLista";
import { useEliminarProveedor } from "./gestionProveedorCompra/useEliminarProveedor";

import AgregarProveedor from "@/app/components/provedores/AgregarProveedor";
import EditarProveedor from "@/app/components/provedores/EditarProveedor";
import HistorialCompras from "@/app/components/provedores/HistorialCompras";

export default function ProveedoresPage() {
  const router = useRouter();
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
      p.numDocumento.toLowerCase().includes(search.toLowerCase()) ||
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
      {/* Cabecera: volver + título */}
      <div className="flex items-center gap-3 animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => router.push("/factufly/compras")}
          className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
          style={{ background: "rgba(15,46,100,0.08)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,46,100,0.15)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15,46,100,0.08)")}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "#0f2e64" }} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold leading-tight" style={{ color: "#0f2e64" }}>
            Gestión de Proveedores
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Administra tu lista de proveedores</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative min-w-48 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor por documento o razón social..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm text-xs"
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

      {/* Grid */}
      <div
        className="overflow-y-auto rounded-xl"
        style={{
          maxHeight: "calc(100vh - 170px)",
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 transparent",
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pb-2">
          {loadingProveedores &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse border border-gray-200 rounded-xl p-4 space-y-4"
              >
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}

          {!loadingProveedores && filtered.length === 0 && (
            <div className="col-span-4 flex flex-col items-center justify-center py-16 text-center">
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
          )}

          {!loadingProveedores &&
            filtered.map((prov) => (
              <Card
                key={prov.proveedorId}
                className="group hover:border-brand-blue transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {prov.numDocumento}
                    </p>
                    <h4 className="font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-2">
                      {prov.razonSocial}
                    </h4>
                    {prov.nombreComercial && (
                      <p className="text-[10px] font-medium text-gray-400 bg-gray-100 w-fit px-1.5 py-0.5 rounded uppercase">
                        {prov.nombreComercial}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(prov)}
                      className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(prov)}
                      className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {prov.personaContacto && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-gray-400" /> {prov.personaContacto}
                    </p>
                  )}
                  {prov.telefono && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-gray-400" /> {prov.telefono}
                    </p>
                  )}
                  {prov.email && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-gray-400 shrink-0" /> {prov.email}
                    </p>
                  )}
                  {prov.direccion && (
                    <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0 self-center" />
                      <span className="whitespace-pre-line break-words">{prov.direccion}</span>
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleOpenHistorial(prov)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                  >
                    <History className="w-3.5 h-3.5" /> Historial de compras
                  </button>
                </div>
              </Card>
            ))}
        </div>
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
        documento={deleteTarget?.numDocumento}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
