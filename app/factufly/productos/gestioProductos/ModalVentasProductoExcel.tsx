"use client";
import React, { useState } from "react";
import axios from "axios";
import { X, FileSpreadsheet, Loader2, Calendar, BarChart2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { cn } from "@/app/utils/cn";

type Agrupacion = "diario" | "mensual" | "semanal" | "quincenal";

interface Props {
  sucursalId: number;
  onClose: () => void;
}

const AGRUPACIONES: { id: Agrupacion; label: string; descripcion: string }[] = [
  { id: "diario",    label: "Día específico", descripcion: "Total del día seleccionado" },
  { id: "mensual",   label: "Mensual",        descripcion: "Columnas: días 1 al 31" },
  { id: "semanal",   label: "Semanal",        descripcion: "7 días desde la fecha elegida" },
  { id: "quincenal", label: "Quincenal",      descripcion: "Primera o segunda quincena" },
];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS  = Array.from({ length: 5 }, (_, i) => currentYear - i);
const MONTHS = [
  { value: 1,  label: "Enero"      },
  { value: 2,  label: "Febrero"    },
  { value: 3,  label: "Marzo"      },
  { value: 4,  label: "Abril"      },
  { value: 5,  label: "Mayo"       },
  { value: 6,  label: "Junio"      },
  { value: 7,  label: "Julio"      },
  { value: 8,  label: "Agosto"     },
  { value: 9,  label: "Septiembre" },
  { value: 10, label: "Octubre"    },
  { value: 11, label: "Noviembre"  },
  { value: 12, label: "Diciembre"  },
];

export function ModalVentasProductoExcel({ sucursalId, onClose }: Props) {
  const { accessToken } = useAuth();
  const { showToast }   = useToast();

  const [agrupacion,    setAgrupacion]    = useState<Agrupacion>("mensual");
  // diario y semanal usan fecha puntual
  const [fecha,         setFecha]         = useState("");
  // mensual y quincenal usan mes + año
  const [mes,           setMes]           = useState(currentMonth);
  const [anio,          setAnio]          = useState(currentYear);
  // quincenal: 1 = primera (1-15), 2 = segunda (16-31)
  const [quincena,      setQuincena]      = useState<1 | 2>(1);
  const [isDescargando, setIsDescargando] = useState(false);

  // ── Validación ────────────────────────────────────────────────
  const handleDescargar = async () => {
    if ((agrupacion === "diario" || agrupacion === "semanal") && !fecha) {
      showToast("Selecciona una fecha.", "info");
      return;
    }

    setIsDescargando(true);
    try {
      // Construir params según la agrupación
      const params: Record<string, string | number> = { agrupacion };

      switch (agrupacion) {
        case "diario":
          params.fecha = fecha;
          break;
        case "semanal":
          params.fecha = fecha;
          break;
        case "mensual":
          params.mes  = mes;
          params.anio = anio;
          break;
        case "quincenal":
          params.mes      = mes;
          params.anio     = anio;
          params.quincena = quincena;
          break;
      }

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Reportes/ventas-producto-excel/${sucursalId}`,
        {
          params,
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: "blob",
        },
      );

      // Nombre descriptivo del archivo
      let nombreBase: string;
      switch (agrupacion) {
        case "diario":
          nombreBase = `ventas-productos-diario-${fecha}`;
          break;
        case "semanal":
          nombreBase = `ventas-productos-semanal-${fecha}`;
          break;
        case "mensual":
          nombreBase = `ventas-productos-mensual-${String(mes).padStart(2, "0")}-${anio}`;
          break;
        case "quincenal":
          nombreBase = `ventas-productos-quincenal-${quincena}q-${String(mes).padStart(2, "0")}-${anio}`;
          break;
      }

      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href     = url;
      link.download = `${nombreBase}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch {
      showToast("No se pudo generar el reporte. Intenta nuevamente.", "error");
    } finally {
      setIsDescargando(false);
    }
  };

  // ── Helpers UI ────────────────────────────────────────────────
  const usaFecha  = agrupacion === "diario" || agrupacion === "semanal";
  const usaMesAnio = agrupacion === "mensual" || agrupacion === "quincenal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-semibold text-gray-900">Reporte Productos</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">

          {/* Selector de agrupación */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Tipo de agrupación
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AGRUPACIONES.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setAgrupacion(op.id)}
                  className={cn(
                    "flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all",
                    agrupacion === op.id
                      ? "border-brand-blue bg-blue-50 text-brand-blue"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  )}
                >
                  <span className="text-xs font-semibold">{op.label}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                    {op.descripcion}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Parámetros: fecha (diario / semanal) ── */}
          {usaFecha && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {agrupacion === "semanal"
                  ? "Fecha de inicio de semana"
                  : "Fecha"}
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
              />
              {agrupacion === "semanal" && fecha && (
                <p className="text-[10px] text-gray-400">
                  El reporte incluirá los 7 días a partir de esta fecha.
                </p>
              )}
            </div>
          )}

          {/* ── Parámetros: mes + año (mensual / quincenal) ── */}
          {usaMesAnio && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Mes</label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all bg-white"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Año</label>
                  <select
                    value={anio}
                    onChange={(e) => setAnio(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all bg-white"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selector de quincena (solo quincenal) */}
              {agrupacion === "quincenal" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Quincena</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([1, 2] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuincena(q)}
                        className={cn(
                          "flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all",
                          quincena === q
                            ? "border-brand-blue bg-blue-50 text-brand-blue"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                        )}
                      >
                        <span className="text-xs font-semibold">
                          {q === 1 ? "Primera" : "Segunda"}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          {q === 1 ? "Días 1 – 15" : "Días 16 – 31"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
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
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Descargando...</>
            ) : (
              <><FileSpreadsheet className="w-3.5 h-3.5" /> Descargar Excel</>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
