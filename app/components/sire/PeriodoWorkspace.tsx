"use client";
import { useEffect, useState } from "react";
import {
  RefreshCw,
  FileWarning,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/app/utils/cn";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { useSireDescargarPropuesta } from "@/app/factufly/sire/gestionSire/useSireDescargarPropuesta";
import { useSireAceptarPropuesta } from "@/app/factufly/sire/gestionSire/useSireAceptarPropuesta";
import { useSireCerrarPeriodo } from "@/app/factufly/sire/gestionSire/useSireCerrarPeriodo";
import { SireComprobanteDto } from "@/app/factufly/sire/gestionSire/types";

const TIPO_COMPROBANTE: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de Crédito",
  "08": "Nota de Débito",
};

function formatMoneda(valor: number, moneda: string | null) {
  const simbolo = moneda === "USD" ? "$" : "S/";
  return `${simbolo} ${valor.toFixed(2)}`;
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

function exportarExcel(comprobantes: SireComprobanteDto[], perTributario: string) {
  const filas = comprobantes.map((c) => ({
    "Fecha Emisión": c.fechaEmision ?? "",
    Tipo: TIPO_COMPROBANTE[c.tipoComprobante ?? ""] ?? c.tipoComprobante ?? "",
    Serie: c.serie ?? "",
    Número: c.numero ?? "",
    Cliente: c.razonSocialCliente ?? "",
    "Doc. Cliente": c.numDocCliente ?? "",
    "Base Imponible": c.baseImponible,
    IGV: c.igv,
    Total: c.importeTotal,
    Moneda: c.codMoneda ?? "",
    Estado: c.activo ? "Activo" : "Anulado",
    Inconsistencias: c.inconsistencias ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Propuesta SIRE");
  XLSX.writeFile(libro, `propuesta-sire-${perTributario}.xlsx`);
}

type Tab = "resumen" | "propuesta" | "acciones";

interface Props {
  ruc: string;
  perTributario: string;
  estadoSunat: string | null;
  descripcion: string | null;
  canManage: boolean;
  onAccionExitosa: () => void;
}

export function PeriodoWorkspace({ ruc, perTributario, estadoSunat, descripcion, canManage, onAccionExitosa }: Props) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [comprobantes, setComprobantes] = useState<SireComprobanteDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<"aceptar" | "cerrar" | null>(null);

  const { loading: cargandoPropuesta, descargarPropuesta } = useSireDescargarPropuesta();
  const { loading: aceptando, aceptarPropuesta } = useSireAceptarPropuesta();
  const { loading: cerrando, cerrarPeriodo } = useSireCerrarPeriodo();

  useEffect(() => {
    setComprobantes(null);
    setError(null);
    setTab("resumen");
  }, [ruc, perTributario]);

  const cargarPropuesta = async () => {
    setError(null);
    const data = await descargarPropuesta(ruc, perTributario);
    if (data?.success) {
      setComprobantes(data.comprobantes);
    } else {
      setError(data?.mensaje ?? "No se pudo generar la propuesta");
    }
  };

  const confirmarAceptar = async () => {
    setConfirmando(null);
    await aceptarPropuesta(ruc, perTributario);
    onAccionExitosa();
  };

  const confirmarCerrar = async () => {
    setConfirmando(null);
    await cerrarPeriodo(ruc, perTributario);
    onAccionExitosa();
  };

  const activos = comprobantes?.filter((c) => c.activo) ?? [];
  const conInconsistencias = comprobantes?.filter((c) => !!c.inconsistencias) ?? [];
  const totales = activos.reduce(
    (acc, c) => ({ base: acc.base + c.baseImponible, igv: acc.igv + c.igv, total: acc.total + c.importeTotal }),
    { base: 0, igv: 0, total: 0 },
  );
  const porTipo = activos.reduce<Record<string, { cantidad: number; total: number }>>((acc, c) => {
    const key = c.tipoComprobante ?? "—";
    if (!acc[key]) acc[key] = { cantidad: 0, total: 0 };
    acc[key].cantidad += 1;
    acc[key].total += c.importeTotal;
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header del periodo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div>
          <p className="text-base font-semibold text-gray-900">{formatPeriodoLabel(perTributario)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {perTributario} · Estado SUNAT: <span className="font-medium text-gray-600">{estadoSunat ?? "—"}</span>
            {descripcion ? ` (${descripcion})` : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-100">
        {([
          { id: "resumen", label: "Resumen" },
          { id: "propuesta", label: "Propuesta" },
          { id: "acciones", label: "Acciones" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px",
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* ── Resumen y Propuesta comparten el mismo dataset (comprobantes) ── */}
        {(tab === "resumen" || tab === "propuesta") && !comprobantes && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            {cargandoPropuesta ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                <p className="text-sm text-gray-500">Generando propuesta en SUNAT...</p>
                <p className="text-xs text-gray-400">Esto puede tardar hasta un minuto, SUNAT procesa el reporte de forma asíncrona.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 text-center max-w-sm">
                  Aún no se ha cargado la propuesta de este periodo. Esta consulta se hace directamente contra producción de SUNAT.
                </p>
                <Button onClick={cargarPropuesta} className="h-9 text-xs">
                  <RefreshCw size={13} />
                  Cargar propuesta
                </Button>
              </>
            )}
          </div>
        )}

        {(tab === "resumen" || tab === "propuesta") && error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <FileWarning className="w-8 h-8 text-amber-400" />
            <p className="text-sm text-gray-600 font-medium text-center max-w-md">{error}</p>
            <Button variant="outline" onClick={cargarPropuesta} className="h-9 text-xs">
              <RefreshCw size={13} />
              Reintentar
            </Button>
          </div>
        )}

        {/* Resumen */}
        {tab === "resumen" && comprobantes && (
          comprobantes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">SUNAT no reportó comprobantes para este periodo.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Comprobantes" value={String(comprobantes.length)} />
                <StatCard label="Activos" value={String(activos.length)} />
                <StatCard
                  label="Con inconsistencias"
                  value={String(conInconsistencias.length)}
                  warn={conInconsistencias.length > 0}
                />
                <StatCard label="Total (activos)" value={formatMoneda(totales.total, null)} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo de Documento</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Cantidad</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(porTipo).map(([tipo, v]) => (
                      <tr key={tipo}>
                        <td className="px-4 py-2 text-xs text-gray-700">{TIPO_COMPROBANTE[tipo] ?? tipo}</td>
                        <td className="px-4 py-2 text-xs text-gray-700 text-right">{v.cantidad}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-900 text-right">{formatMoneda(v.total, null)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-xs text-gray-800">Total</td>
                      <td className="px-4 py-2 text-xs text-gray-800 text-right">{activos.length}</td>
                      <td className="px-4 py-2 text-xs text-gray-900 text-right">{formatMoneda(totales.total, null)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Propuesta */}
        {tab === "propuesta" && comprobantes && (
          <div className="space-y-3">
            {comprobantes.length > 0 && (
              <div className="flex items-center justify-end">
                <button
                  onClick={() => exportarExcel(comprobantes, perTributario)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <FileSpreadsheet size={13} />
                  Exportar Excel
                </button>
              </div>
            )}

            {comprobantes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">SUNAT no reportó comprobantes para este periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Base Imp.</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">IGV</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comprobantes.map((c, idx) => (
                      <tr key={`${c.carSunat}-${idx}`} className={cn("hover:bg-gray-50/50 transition-colors", !c.activo && "opacity-50")}>
                        <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">{c.fechaEmision ?? "—"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <p className="text-xs font-medium text-gray-900">{c.serie}-{c.numero}</p>
                          <p className="text-[10px] text-gray-400">{TIPO_COMPROBANTE[c.tipoComprobante ?? ""] ?? c.tipoComprobante}</p>
                          {c.inconsistencias && (
                            <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                              <FileWarning size={10} /> {c.inconsistencias}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-xs font-medium text-gray-900 truncate max-w-52">{c.razonSocialCliente ?? "—"}</p>
                          <p className="text-[10px] text-gray-400">{c.numDocCliente ?? "—"}</p>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.baseImponible, c.codMoneda)}</td>
                        <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.igv, c.codMoneda)}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-900 text-right whitespace-nowrap">{formatMoneda(c.importeTotal, c.codMoneda)}</td>
                        <td className="px-4 py-2 text-center">
                          {c.activo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-semibold">
                              <CheckCircle2 size={10} /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[10px] font-semibold">
                              <XCircle size={10} /> Anulado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        {tab === "acciones" && (
          <div className="space-y-3 max-w-md">
            {!canManage && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  Solo un administrador puede aceptar propuestas o cerrar periodos.
                </p>
              </div>
            )}
            <button
              onClick={() => setConfirmando("aceptar")}
              disabled={!canManage || aceptando || cerrando}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {aceptando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Aceptar propuesta
            </button>
            <button
              onClick={() => setConfirmando("cerrar")}
              disabled={!canManage || aceptando || cerrando}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {cerrando ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
              Cerrar mes
            </button>
          </div>
        )}
      </div>

      {/* Confirmación: Aceptar propuesta */}
      <Modal
        isOpen={confirmando === "aceptar"}
        onClose={() => setConfirmando(null)}
        title="Confirmar aceptación de propuesta"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">¿Aceptar la propuesta de SUNAT?</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Se aceptará la propuesta del periodo <strong>{formatPeriodoLabel(perTributario)}</strong> ({perTributario}) para el RUC <strong>{ruc}</strong> directamente en producción de SUNAT.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmando(null)}>Cancelar</Button>
            <Button onClick={confirmarAceptar}>
              <CheckCircle2 size={14} /> Aceptar propuesta
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmación: Cerrar mes */}
      <Modal
        isOpen={confirmando === "cerrar"}
        onClose={() => setConfirmando(null)}
        title="Confirmar cierre de periodo"
      >
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800">¿Cerrar este periodo?</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Se registrará el preliminar del periodo <strong>{formatPeriodoLabel(perTributario)}</strong> ({perTributario}) para el RUC <strong>{ruc}</strong> directamente en producción de SUNAT. Esta acción puede tardar hasta un minuto.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmando(null)}>Cancelar</Button>
            <button
              onClick={confirmarCerrar}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
            >
              <Lock size={14} /> Cerrar mes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", warn ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100")}>
      <p className="text-[11px] text-gray-500 font-medium">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", warn ? "text-amber-700" : "text-gray-900")}>{value}</p>
    </div>
  );
}
