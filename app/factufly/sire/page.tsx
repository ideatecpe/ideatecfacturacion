"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Info, Lock, History, CalendarDays } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/app/components/ui/Card";
import { useSirePeriodos } from "./gestionSire/useSirePeriodos";
import { useSireHistorial } from "./gestionSire/useSireHistorial";
import { SireEjercicioDto, SirePeriodoDto } from "./gestionSire/types";
import { PeriodoWorkspace } from "@/app/components/sire/PeriodoWorkspace";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatPeriodoLabel(perTributario: string): string {
  if (!perTributario || perTributario.length !== 6) return perTributario;
  const anio = perTributario.slice(0, 4);
  const mes = perTributario.slice(4, 6);
  const idx = parseInt(mes, 10) - 1;
  return `${MESES[idx] ?? mes} ${anio}`;
}

function formatMesEstadoLabel(p: SirePeriodoDto): string {
  const perTributario = p.periodo ?? "";
  const mes = perTributario.length === 6 ? MESES[parseInt(perTributario.slice(4, 6), 10) - 1] : perTributario;
  return `${mes ?? perTributario} — ${p.estado ?? "—"}`;
}

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

const ESTADO_CFG: Record<string, { badge: string; label: string }> = {
  PENDIENTE: { badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Pendiente" },
  PROPUESTA_ACEPTADA: { badge: "bg-blue-50 text-blue-700 border-blue-200", label: "Propuesta Aceptada" },
  CERRADO: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Cerrado" },
  ERROR: { badge: "bg-rose-50 text-rose-700 border-rose-200", label: "Error" },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG.PENDIENTE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap",
        cfg.badge,
      )}
    >
      {cfg.label}
    </span>
  );
}

export default function SirePage() {
  const { user } = useAuth();
  const rucEmpresa = user?.ruc ?? "";
  const canManage = user?.rol === "admin" || user?.rol === "superadmin";

  const [ejercicios, setEjercicios] = useState<SireEjercicioDto[]>([]);
  const [anioSel, setAnioSel] = useState<string | null>(null);
  const [mesSel, setMesSel] = useState<string | null>(null);

  const { loading: loadingPeriodos, consultarPeriodos } = useSirePeriodos();
  const { historial, loading: loadingHistorial, fetchHistorial } = useSireHistorial();

  const cargarPeriodos = useCallback(async () => {
    if (!rucEmpresa) return;
    const data = await consultarPeriodos(rucEmpresa);
    const ejs = data?.ejercicios ?? [];
    setEjercicios(ejs);
    setAnioSel((prev) => (prev && ejs.some((e) => e.anio === prev) ? prev : (ejs[0]?.anio ?? null)));
  }, [rucEmpresa, consultarPeriodos]);

  useEffect(() => {
    if (rucEmpresa) {
      cargarPeriodos();
      fetchHistorial(rucEmpresa);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rucEmpresa]);

  const periodosDelAnio = useMemo(
    () => ejercicios.find((e) => e.anio === anioSel)?.periodos ?? [],
    [ejercicios, anioSel],
  );

  const periodoActivo = useMemo(
    () => periodosDelAnio.find((p) => p.periodo === mesSel) ?? null,
    [periodosDelAnio, mesSel],
  );

  const handleAnioChange = (anio: string) => {
    setAnioSel(anio);
    setMesSel(null);
  };

  const refrescarHistorial = () => {
    if (rucEmpresa) fetchHistorial(rucEmpresa);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Info banner */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700 font-medium">
          El SIRE (Registro de Ventas - RVIE) consolida todos los comprobantes emitidos bajo tu RUC. No hay ambiente de pruebas: cada consulta y cierre se hace directamente contra producción de SUNAT.
        </p>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Lock className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Solo un administrador puede aceptar propuestas o cerrar periodos. Puedes consultar el estado de los periodos.
          </p>
        </div>
      )}

      {/* Selector Año / Mes */}
      <Card className="p-0 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-base font-semibold text-gray-900">Periodo a consultar</p>
              <p className="text-xs text-gray-400 mt-0.5">Selecciona el año y mes para revisar su estado ante SUNAT</p>
            </div>
          </div>
          <button
            onClick={cargarPeriodos}
            disabled={loadingPeriodos}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={cn(loadingPeriodos && "animate-spin")} />
            Actualizar
          </button>
        </div>

        <div className="p-5 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Año</label>
            <select
              value={anioSel ?? ""}
              onChange={(e) => handleAnioChange(e.target.value)}
              disabled={loadingPeriodos || ejercicios.length === 0}
              className="h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white min-w-32 disabled:opacity-50"
            >
              {ejercicios.length === 0 && <option value="">—</option>}
              {ejercicios.map((e) => (
                <option key={e.anio ?? "—"} value={e.anio ?? ""}>
                  {e.anio ?? "—"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Mes</label>
            <select
              value={mesSel ?? ""}
              onChange={(e) => setMesSel(e.target.value || null)}
              disabled={loadingPeriodos || periodosDelAnio.length === 0}
              className="h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white min-w-56 disabled:opacity-50"
            >
              <option value="">Seleccionar...</option>
              {periodosDelAnio.map((p) => (
                <option key={p.periodo ?? "—"} value={p.periodo ?? ""}>
                  {formatMesEstadoLabel(p)}
                </option>
              ))}
            </select>
          </div>

          {loadingPeriodos && (
            <span className="text-xs text-gray-400 flex items-center gap-1.5 pb-2.5">
              <RefreshCw size={12} className="animate-spin" /> Consultando periodos en SUNAT...
            </span>
          )}
        </div>
      </Card>

      {/* Workspace del periodo seleccionado */}
      {periodoActivo ? (
        <PeriodoWorkspace
          ruc={rucEmpresa}
          perTributario={periodoActivo.periodo ?? ""}
          estadoSunat={periodoActivo.estado}
          descripcion={periodoActivo.descripcion}
          canManage={canManage}
          onAccionExitosa={refrescarHistorial}
        />
      ) : (
        !loadingPeriodos && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 px-5 py-12 text-center">
            <p className="text-sm text-gray-400">Selecciona un año y un mes para ver el detalle del periodo.</p>
          </div>
        )
      )}

      {/* Historial de Cierres */}
      <Card className="p-0 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-base font-semibold text-gray-900">Historial de Cierres</p>
              <p className="text-xs text-gray-400 mt-0.5">Registro de acciones SIRE realizadas desde este sistema</p>
            </div>
          </div>
          <button
            onClick={refrescarHistorial}
            disabled={loadingHistorial}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={cn(loadingHistorial && "animate-spin")} />
            Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Periodo</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Última consulta</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha de cierre</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mensaje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingHistorial ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={20} className="animate-spin text-blue-400" />
                      <span className="text-sm text-gray-400">Cargando historial...</span>
                    </div>
                  </td>
                </tr>
              ) : historial.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    Aún no hay registros de cierres SIRE.
                  </td>
                </tr>
              ) : (
                historial.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {formatPeriodoLabel(h.perTributario)}
                    </td>
                    <td className="px-5 py-3">
                      <EstadoBadge estado={h.estado} />
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600 font-mono">{h.numTicket ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatFecha(h.fechaConsulta)}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatFecha(h.fechaCierre)}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-64 truncate" title={h.mensaje ?? ""}>
                      {h.mensaje ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
