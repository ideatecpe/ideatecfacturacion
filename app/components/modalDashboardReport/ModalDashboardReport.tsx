"use client";

import React, { useState, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { FormatoDashboard } from "./useDashboardReport";

interface Sucursal {
  sucursalId: number;
  nombre: string;
  codEstablecimiento: string;
}

interface Usuario {
  usuarioID: number;
  username: string;
}

interface ModalDashboardReportProps {
  isOpen: boolean;
  onClose: () => void;
  loadingFormato: FormatoDashboard | null;
  isSuperAdmin: boolean;
  sucursales: Sucursal[];
  usuarios: Usuario[];
  ruc: string;
  onDescargar: (params: {
    ruc: string;
    codEstablecimiento?: string | null;
    desde?: string;
    hasta?: string;
    usuarioId?: number | null;
    nombreArchivo?: string;
    formato: FormatoDashboard;
  }) => Promise<void>;
}

export function ModalDashboardReport({
  isOpen,
  onClose,
  loadingFormato,
  isSuperAdmin,
  sucursales,
  usuarios,
  ruc,
  onDescargar,
}: ModalDashboardReportProps) {
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [periodoActivo, setPeriodoActivo] = useState<
    "hoy" | "semana" | "mes" | "anio" | null
  >(null);

  useEffect(() => {
    if (isOpen) {
      setSucursalId(null);
      setUsuarioId(null);
      setDesde("");
      setHasta("");
      setNombreArchivo("");
      setAtajo("hoy");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const sucursalSel = sucursales.find((s) => s.sucursalId === sucursalId);
  const codEstablecimiento = sucursalSel?.codEstablecimiento ?? null;

  const usuariosFiltrados = sucursalId
    ? usuarios.filter(
        (u) => (u as any).sucursalID === String(sucursalId) || !(u as any).sucursalID
      )
    : usuarios;

  const handleDescargar = (formato: FormatoDashboard) => {
    onDescargar({
      ruc,
      codEstablecimiento,
      desde: desde || undefined,
      hasta: hasta || undefined,
      usuarioId,
      nombreArchivo: nombreArchivo.trim() || undefined,
      formato,
    });
  };

  const setAtajo = (tipo: "hoy" | "semana" | "mes" | "anio") => {
    const hoy = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setPeriodoActivo(tipo);
    setHasta(fmt(hoy));

    switch (tipo) {
      case "hoy":
        setDesde(fmt(hoy));
        break;
      case "semana": {
        const inicio = new Date(hoy);
        inicio.setDate(hoy.getDate() - hoy.getDay() + 1);
        setDesde(fmt(inicio));
        break;
      }
      case "mes":
        setDesde(fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
        break;
      case "anio":
        setDesde(fmt(new Date(hoy.getFullYear(), 0, 1)));
        break;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reporte Dashboard" className="max-w-lg">
      <div className="space-y-5">
        {/* Sucursal — solo superadmin */}
        {isSuperAdmin && sucursales.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sucursal
            </label>
            <select
              value={sucursalId ?? ""}
              onChange={(e) =>
                setSucursalId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.sucursalId} value={s.sucursalId}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Usuario — solo superadmin */}
        {isSuperAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <select
              value={usuarioId ?? ""}
              onChange={(e) =>
                setUsuarioId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todos los usuarios</option>
              {usuariosFiltrados.map((u) => (
                <option key={u.usuarioID} value={u.usuarioID}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Fechas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período
          </label>
          <div className="flex gap-2 mb-2">
            {(["hoy", "semana", "mes", "anio"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAtajo(t)}
                className={
                  periodoActivo === t
                    ? "px-3 py-1 text-xs rounded-full border border-blue-600 bg-blue-600 text-white transition-colors"
                    : "px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                }
              >
                {t === "hoy"
                  ? "Hoy"
                  : t === "semana"
                  ? "Esta semana"
                  : t === "mes"
                  ? "Este mes"
                  : "Este año"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-gray-500">Desde</span>
              <input
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setPeriodoActivo(null);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <span className="text-xs text-gray-500">Hasta</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setPeriodoActivo(null);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Nombre del archivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del archivo{" "}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={nombreArchivo}
            onChange={(e) => setNombreArchivo(e.target.value)}
            placeholder="Se genera automáticamente si se deja vacío"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Botones de descarga */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => handleDescargar("pdf")}
            disabled={loadingFormato !== null}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loadingFormato === "pdf" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Descargar PDF
          </Button>
          <Button
            onClick={() => handleDescargar("excel")}
            disabled={loadingFormato !== null}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loadingFormato === "excel" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Descargar Excel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
