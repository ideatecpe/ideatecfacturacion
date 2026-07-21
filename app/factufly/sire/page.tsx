"use client";
import { useState } from "react";
import {
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  Info,
  Calendar,
  History,
  ChevronDown,
  Eye,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { useSirePeriodos } from "./gestionSire/useSirePeriodos";
import { useSireAceptarPropuesta } from "./gestionSire/useSireAceptarPropuesta";
import { useSireCerrarPeriodo } from "./gestionSire/useSireCerrarPeriodo";
import { useSireHistorial } from "./gestionSire/useSireHistorial";
import { SirePeriodoDto } from "./gestionSire/types";
import { ModalPropuestaSire } from "@/app/components/sire/ModalPropuestaSire";

// ─── Helpers ────────────────────────────────────────────────────────────────
function mesActual(): { anio: number; mes: number } {
  const hoy = new Date();
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
}

function toPerTributario(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, "0")}`;
}

function formatPeriodoLabel(perTributario: string): string {
  if (!perTributario || perTributario.length !== 6) return perTributario;
  const anio = perTributario.slice(0, 4);
  const mes = perTributario.slice(4, 6);
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const idx = parseInt(mes, 10) - 1;
  return `${MESES[idx] ?? mes} ${anio}`;
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

// ─── Badge de estado ──────────────────────────────────────────────────────────
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SirePage() {
  const { user } = useAuth();
  const rucEmpresa = user?.ruc ?? "";
  const canManage = user?.rol === "admin" || user?.rol === "superadmin";

  const { anio: anioActual, mes: mesActualNum } = mesActual();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState(mesActualNum);

  const [periodos, setPeriodos] = useState<SirePeriodoDto[]>([]);
  const [consultado, setConsultado] = useState(false);
  const [historialExpandido, setHistorialExpandido] = useState(false);

  const { loading: loadingPeriodos, consultarPeriodos } = useSirePeriodos();
  const { loading: loadingAceptar, aceptarPropuesta } = useSireAceptarPropuesta();
  const { loading: loadingCerrar, cerrarPeriodo } = useSireCerrarPeriodo();
  const { historial, loading: loadingHistorial, fetchHistorial } = useSireHistorial();

  const [accionandoPeriodo, setAccionandoPeriodo] = useState<string | null>(null);
  const [periodoEnRevision, setPeriodoEnRevision] = useState<string | null>(null);

  const handleConsultar = async () => {
    if (!rucEmpresa) return;
    const data = await consultarPeriodos(rucEmpresa);
    setConsultado(true);
    setPeriodos(data?.periodos ?? []);
  };

  const handleAceptarPropuesta = async (perTributario: string) => {
    if (!rucEmpresa || !canManage) return;
    setAccionandoPeriodo(perTributario);
    try {
      await aceptarPropuesta(rucEmpresa, perTributario);
      if (historialExpandido) await fetchHistorial(rucEmpresa);
    } finally {
      setAccionandoPeriodo(null);
    }
  };

  const handleCerrarPeriodo = async (perTributario: string) => {
    if (!rucEmpresa || !canManage) return;
    setAccionandoPeriodo(perTributario);
    try {
      await cerrarPeriodo(rucEmpresa, perTributario);
      if (historialExpandido) await fetchHistorial(rucEmpresa);
    } finally {
      setAccionandoPeriodo(null);
    }
  };

  const toggleHistorial = async () => {
    const next = !historialExpandido;
    setHistorialExpandido(next);
    if (next && rucEmpresa) await fetchHistorial(rucEmpresa);
  };

  const perTributarioSeleccionado = toPerTributario(anio, mes);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {periodoEnRevision && (
        <ModalPropuestaSire
          ruc={rucEmpresa}
          perTributario={periodoEnRevision}
          onClose={() => setPeriodoEnRevision(null)}
        />
      )}

      {/* ── Info banner ── */}
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

      {/* ── Selector de periodo ── */}
      <Card title="Consultar Periodos" subtitle="Consulta el estado de tus periodos ante SUNAT">
        <div className="p-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value) || anioActual)}
              className="h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-blue/50 focus:bg-white transition-all w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              className="h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-blue/50 focus:bg-white transition-all"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {formatPeriodoLabel(`${anio}${String(m).padStart(2, "0")}`).split(" ")[0]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 pb-2">
            <Calendar className="w-3.5 h-3.5" />
            Periodo: <span className="font-semibold text-gray-600">{perTributarioSeleccionado}</span>
          </div>
          <div className="flex-1" />
          <Button
            type="button"
            className="h-9 text-xs"
            disabled={loadingPeriodos || !rucEmpresa}
            onClick={handleConsultar}
          >
            {loadingPeriodos ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {loadingPeriodos ? "Consultando..." : "Consultar periodos"}
          </Button>
        </div>
      </Card>

      {/* ── Resultado de la consulta ── */}
      <Card className="p-0 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Periodo</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado SUNAT</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingPeriodos ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-blue-400" />
                      <span className="text-sm text-gray-400">Consultando periodos en SUNAT...</span>
                    </div>
                  </td>
                </tr>
              ) : !consultado ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-sm text-gray-400">
                    Elige un periodo y presiona "Consultar periodos" para ver el estado en SUNAT.
                  </td>
                </tr>
              ) : periodos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-sm text-gray-400">
                    SUNAT no devolvió periodos pendientes.
                  </td>
                </tr>
              ) : (
                periodos.map((p) => {
                  const periodo = p.periodo ?? "";
                  const enProceso = accionandoPeriodo === periodo && (loadingAceptar || loadingCerrar);
                  return (
                    <tr key={periodo} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatPeriodoLabel(periodo)}
                        <p className="text-xs text-gray-400">{periodo}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold text-gray-700">{p.estado ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{p.descripcion ?? "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPeriodoEnRevision(periodo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Eye size={13} />
                            Ver propuesta
                          </button>
                          <button
                            onClick={() => handleAceptarPropuesta(periodo)}
                            disabled={!canManage || enProceso}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                          >
                            {enProceso && loadingAceptar ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            Aceptar propuesta
                          </button>
                          <button
                            onClick={() => handleCerrarPeriodo(periodo)}
                            disabled={!canManage || enProceso}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                          >
                            {enProceso && loadingCerrar ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <Lock size={13} />
                            )}
                            Cerrar mes
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Historial (acordeón) ── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
          onClick={toggleHistorial}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-base font-semibold text-gray-900">Historial de Cierres</p>
              <p className="text-xs text-gray-400 mt-0.5">Registro de acciones SIRE realizadas desde este sistema</p>
            </div>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", historialExpandido && "rotate-180")} />
        </div>

        {historialExpandido && (
          <div className="border-t border-gray-100">
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
          </div>
        )}
      </div>
    </div>
  );
}
