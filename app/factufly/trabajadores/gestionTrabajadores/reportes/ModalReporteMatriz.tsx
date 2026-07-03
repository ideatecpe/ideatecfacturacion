"use client";
import React, { useState } from "react";
import axios from "axios";
import { X, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

interface Props {
  sucursalId: number;
  onClose: () => void;
}

export function ModalReporteMatriz({ sucursalId, onClose }: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const [fechaDesde, setFechaDesde] = useState(formatDate(today));
  const [fechaHasta, setFechaHasta] = useState("");
  const [isDescargando, setIsDescargando] = useState(false);

  const handleDescargar = async () => {
    if (!fechaDesde) {
      showToast("Selecciona la fecha desde.", "info");
      return;
    }
    const fechaHastaFinal = fechaHasta || fechaDesde;
    setIsDescargando(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/trabajador/matriz-excel/${sucursalId}`,
        {
          params: { fechaDesde, fechaHasta: fechaHastaFinal },
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-trabajadores-${fechaDesde}-${fechaHastaFinal}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch {
      showToast("No se pudo generar el reporte. Intenta nuevamente.", "error");
    } finally {
      setIsDescargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Reporte Trabajadores
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Fecha desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Fecha hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <Button
            onClick={handleDescargar}
            disabled={isDescargando}
            className="py-2 px-3 text-xs rounded-md h-auto"
          >
            {isDescargando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Descargando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Descargar Excel
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
