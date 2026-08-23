"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RefreshCw, Info, Lock, History, CalendarDays, FileStack } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/app/components/ui/Card";
import { useSirePeriodos } from "./gestionSire/useSirePeriodos";
import { useSireHistorial } from "./gestionSire/useSireHistorial";
import { SireEjercicioDto, SirePeriodoDto } from "./gestionSire/types";
import { PeriodoWorkspace, type PeriodoWorkspaceHandle } from "@/app/components/sire/PeriodoWorkspace";

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
  const [pageTab, setPageTab] = useState<"consultar" | "historial">("consultar");
  const workspaceRef = useRef<PeriodoWorkspaceHandle>(null);

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

  const estadoLocalPeriodoActivo = useMemo(
    () => historial.find((h) => h.perTributario === periodoActivo?.periodo)?.estado ?? null,
    [historial, periodoActivo],
  );

  const handleAnioChange = (anio: string) => {
    setAnioSel(anio);
    setMesSel(null);
  };

  const refrescarHistorial = () => {
    if (rucEmpresa) fetchHistorial(rucEmpresa);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Título — solo visible en móvil, en desktop ya lo indica el breadcrumb del sistema */}
      <h1 className="md:hidden text-base font-bold text-gray-900 flex items-center gap-2">
        <FileStack className="w-4 h-4 text-blue-600" />
        SIRE
      </h1>

      {/* Info banner */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700 font-medium">
          El SIRE (Registro de Ventas - RVIE) consolida todos los comprobantes emitidos bajo tu RUC. No hay ambiente de pruebas: cada consulta y cierre se hace directamente contra producción de SUNAT.
        </p>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <Lock className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Solo un administrador puede aceptar propuestas o cerrar periodos. Puedes consultar el estado de los periodos.
          </p>
        </div>
      )}

      {/* Tabs a nivel de página: Consultar / Historial */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-1">
          {([
            { id: "consultar", label: "Consultar", icon: CalendarDays },
            { id: "historial", label: "Historial de Cierres", icon: History },
          ] as { id: "consultar" | "historial"; label: string; icon: typeof CalendarDays }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setPageTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
                pageTab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-400 hover:text-gray-600",
              )}
            >
              <t.icon size={13} />
              {t.label}
              {t.id === "historial" && historial.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
                  {historial.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {pageTab === "consultar" && (
          <button
            onClick={cargarPeriodos}
            disabled={loadingPeriodos}
            className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={cn(loadingPeriodos && "animate-spin")} />
            Actualizar
          </button>
        )}
      </div>

      {pageTab === "consultar" && (
        <div className="space-y-3">
          {/* Selector Año / Mes */}
          <Card className="p-0 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              {periodoActivo ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatPeriodoLabel(periodoActivo.periodo ?? "")}</p>
                  <p className="text-[11px] text-gray-400">
                    {periodoActivo.periodo} · Estado SUNAT:{" "}
                    <span className="font-medium text-gray-600">{periodoActivo.estado ?? "—"}</span>
                    {periodoActivo.descripcion ? ` (${periodoActivo.descripcion})` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-gray-900">Periodo a consultar</p>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3 px-4 py-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Año</label>
                <select
                  value={anioSel ?? ""}
                  onChange={(e) => handleAnioChange(e.target.value)}
                  disabled={loadingPeriodos || ejercicios.length === 0}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white min-w-28 disabled:opacity-50"
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
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white min-w-48 disabled:opacity-50"
                >
                  <option value="">Seleccionar...</option>
                  {periodosDelAnio.map((p) => (
                    <option key={p.periodo ?? "—"} value={p.periodo ?? ""}>
                      {formatMesEstadoLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => workspaceRef.current?.cargarPropuesta()}
                disabled={!periodoActivo || loadingPeriodos}
                className="h-9 inline-flex items-center gap-1.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <RefreshCw size={13} />
                Cargar propuesta
              </button>
            </div>

            {loadingPeriodos && (
              <div className="px-4 pb-2.5">
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" /> Consultando periodos en SUNAT...
                </span>
              </div>
            )}
          </Card>

          {/* Workspace del periodo seleccionado */}
          {periodoActivo ? (
            <PeriodoWorkspace
              ref={workspaceRef}
              ruc={rucEmpresa}
              nombreEmpresa={user?.nombreEmpresa ?? null}
              perTributario={periodoActivo.periodo ?? ""}
              estadoSunat={periodoActivo.estado}
              descripcion={periodoActivo.descripcion}
              estadoLocal={estadoLocalPeriodoActivo}
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
        </div>
      )}

      {pageTab === "historial" && (
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
      )}
    </div>
  );
}
