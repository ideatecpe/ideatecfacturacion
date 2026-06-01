"use client";
import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { Search, Plus, Edit2, Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useTrabajadoresSucursal } from "./gestionTrabajadores/useTrabajadoresSucursal";
import { AgregarTrabajador } from "./gestionTrabajadores/AgregarTrabajador";
import { EditarTrabajador } from "./gestionTrabajadores/EditarTrabajador";
import { ReporteIndividual } from "./gestionTrabajadores/reportes/ReporteIndividual";
import { RankingTrabajadores } from "./gestionTrabajadores/reportes/RankingTrabajadores";
import { ServiciosTop } from "./gestionTrabajadores/reportes/ServiciosTop";
import {
  Trabajador,
  RegistrarTrabajadorDTO,
  EditarTrabajadorDTO,
} from "./gestionTrabajadores/typesTrabajador";
import { ReporteCliente } from "./gestionTrabajadores/reportes/Reportecliente";

type Tab = "crud" | "reporte" | "ranking" | "servicios" | "cliente";

const TABS: { id: Tab; label: string }[] = [
  { id: "crud", label: "Trabajadores" },
  { id: "reporte", label: "Reporte Individual" },
  { id: "ranking", label: "Ranking" },
  { id: "servicios", label: "Servicios Top" },
  { id: "cliente", label: "Buscar por Cliente" },
];

const formatFecha = (fecha: string | null): string => {
  if (!fecha) return "-";
  try {
    return new Date(fecha).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

export default function TrabajadoresPage() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const sucursalId = parseInt(user?.sucursalID ?? "0");
  const [activeTab, setActiveTab] = useState<Tab>("crud");

  useEffect(() => {
    if (user?.ruc !== "10073587382") {
      router.replace("/factufly/dashboard");
      return;
    }
    // facturador de velsat no puede acceder
    if (user?.rol === "facturador") {
      router.replace("/factufly/dashboard");
    }
  }, [user]);

  const { trabajadores, setTrabajadores, loadingTrabajadores } =
    useTrabajadoresSucursal(sucursalId);

  const [search, setSearch] = useState("");
  const [isNuevoOpen, setIsNuevoOpen] = useState(false);
  const [trabajadorEditar, setTrabajadorEditar] = useState<Trabajador | null>(
    null,
  );
  const [trabajadorEliminar, setTrabajadorEliminar] =
    useState<Trabajador | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(
    () =>
      trabajadores.filter((t) => {
        const q = search.toLowerCase();
        return (
          t.nombres.toLowerCase().includes(q) ||
          t.apellidos.toLowerCase().includes(q) ||
          t.dni.includes(q) ||
          (t.email ?? "").toLowerCase().includes(q)
        );
      }),
    [trabajadores, search],
  );

  const handleCrear = async (dto: RegistrarTrabajadorDTO) => {
    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador`,
        dto,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Trabajador registrado correctamente.", "success");
      setTrabajadores((prev) => [res.data, ...prev]);
      setIsNuevoOpen(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 409) showToast(error.response?.data?.mensaje, "info");
        else if (status === 400)
          showToast("Los datos ingresados no son válidos.", "error");
        else
          showToast(
            "No se pudo registrar el trabajador. Intenta nuevamente.",
            "error",
          );
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditar = async (id: number, dto: EditarTrabajadorDTO) => {
    setIsSubmitting(true);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/${id}`,
        dto,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Trabajador actualizado correctamente.", "success");
      setTrabajadores((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                nombres: dto.nombres,
                apellidos: dto.apellidos,
                nombreCompleto: `${dto.nombres} ${dto.apellidos}`.trim(),
                dni: dto.dni,
                celular: dto.celular ?? null,
                email: dto.email ?? null,
              }
            : t,
        ),
      );
      setTrabajadorEditar(null);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) showToast("No se encontró el trabajador.", "error");
        else
          showToast(
            "No se pudo actualizar el trabajador. Intenta nuevamente.",
            "error",
          );
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEliminar = async (id: number) => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Trabajador eliminado correctamente.", "success");
      setTrabajadores((prev) => prev.filter((t) => t.id !== id));
      setTrabajadorEliminar(null);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404)
          showToast("No se encontró el trabajador a eliminar.", "error");
        else
          showToast(
            "No se pudo eliminar el trabajador. Intenta nuevamente.",
            "error",
          );
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* ── Modales ── */}
      <AgregarTrabajador
        isOpen={isNuevoOpen}
        sucursalId={sucursalId}
        isSubmitting={isSubmitting}
        onSubmit={handleCrear}
        onClose={() => setIsNuevoOpen(false)}
      />
      {trabajadorEditar && (
        <EditarTrabajador
          trabajador={trabajadorEditar}
          isSubmitting={isSubmitting}
          onSave={handleEditar}
          onClose={() => setTrabajadorEditar(null)}
        />
      )}
      {trabajadorEliminar && (
        <ModalEliminar
          isOpen={true}
          mensaje="Eliminarás permanentemente al trabajador"
          nombre={trabajadorEliminar.nombreCompleto}
          documento={trabajadorEliminar.dni}
          onClose={() => setTrabajadorEliminar(null)}
          onConfirm={() => handleEliminar(trabajadorEliminar.id)}
        />
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: CRUD ── */}
      {activeTab === "crud" && (
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, DNI o correo..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm text-xs"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button
              onClick={() => setIsNuevoOpen(true)}
              className="py-2.5 px-3 text-xs rounded-md h-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Trabajador
            </Button>
          </div>

          <p className="text-sm text-gray-500">
            Mostrando{" "}
            <span className="font-semibold text-gray-900">
              {filtered.length}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-gray-900">
              {trabajadores.length}
            </span>{" "}
            trabajadores
          </p>

          <style>{`
            .trabajadores-table tbody {
              display: block; overflow-y: auto;
              max-height: calc(100vh - 330px);
              scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent;
            }
            .trabajadores-table thead tr, .trabajadores-table tbody tr {
              display: table; width: 100%; table-layout: fixed;
            }
            .trabajadores-table thead { width: 100%; }
          `}</style>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full text-left border-collapse trabajadores-table"
                style={{ minWidth: 800 }}
              >
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                      DNI
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                      NOMBRE COMPLETO
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                      CELULAR
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                      CORREO
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                      FECHA
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                      ESTADO
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingTrabajadores ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                          <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin" />
                          Cargando trabajadores...
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-16 text-center text-sm text-gray-400"
                      >
                        No se encontraron trabajadores con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-3 py-2 w-28">
                          <p className="text-xs font-bold text-gray-400 uppercase">
                            DNI
                          </p>
                          <p className="text-sm font-mono text-gray-700">
                            {t.dni}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-900 w-48">
                          {t.nombreCompleto}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 w-32">
                          {t.celular ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 w-48 whitespace-normal wrap-break-word">
                          {t.email ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 w-24">
                          {formatFecha(t.createdAt)}
                        </td>
                        <td className="px-3 py-2 w-16">
                          <Badge variant={t.estado ? "success" : "default"}>
                            {t.estado ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 w-24">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setTrabajadorEditar(t)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => setTrabajadorEliminar(t)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "reporte" && (
        <ReporteIndividual
          trabajadores={trabajadores}
          sucursalId={sucursalId}
        />
      )}
      {activeTab === "cliente" && <ReporteCliente sucursalId={sucursalId} />}

      {activeTab === "ranking" && (
        <RankingTrabajadores sucursalId={sucursalId} />
      )}
      {activeTab === "servicios" && <ServiciosTop sucursalId={sucursalId} />}
    </div>
  );
}
