"use client";
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Calendar,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Building2,
  Hash,
  Store,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { ComprobanteListado } from "@/app/factufly/comprobantes/gestionComprobantes/Comprobante";
import { Sucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/Boleta";
import { useProximoNumeroResumen } from "@/app/factufly/comprobantes/gestionComprobantes/gestionComprobanteResumen/useProximoNumeroResumen";
import { useResumenComprobante } from "@/app/factufly/comprobantes/gestionComprobantes/gestionComprobanteResumen/useResumenComprobante";
import {
  buildResumenDTO,
  formatFechaISO,
} from "@/app/factufly/comprobantes/gestionComprobantes/gestionComprobanteResumen/resumenComprobantetypes";

const TIPOS_RESUMEN = ["03", "07", "08"];
const formatCurrency = (n: number) =>
  n.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const tipoLabel: Record<string, string> = {
  "03": "Boleta",
  "07": "NC Boleta",
  "08": "ND Boleta",
};
const getFechasDisponibles = (): string[] => {
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return formatFechaISO(d);
  });
};

interface ModalResumenProps {
  comprobantes: ComprobanteListado[];
  onClose: () => void;
  onEmitido?: (resumenId: number, estadoSunat: string) => void;
  isSuperAdmin: boolean;
  sucursales?: Sucursal[];
  sucursalActual?: Sucursal;
}

export function ModalResumen({
  comprobantes,
  onClose,
  onEmitido,
  isSuperAdmin,
  sucursales = [],
  sucursalActual,
}: ModalResumenProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { loadingRegistrar, loadingEnviar, registrar, enviarSunat } =
    useResumenComprobante();
  const {
    numeroEnvio,
    identificador,
    loading: loadingNumero,
    fetchProximoNumero,
    reset: resetNumero,
  } = useProximoNumeroResumen();

  const fechasDisponibles = useMemo(() => getFechasDisponibles(), []);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    fechasDisponibles[0],
  );
  const [sucursalSeleccionada, setSucursalSeleccionada] =
    useState<Sucursal | null>(isSuperAdmin ? null : (sucursalActual ?? null));
  const [condicionMap, setCondicionMap] = useState<Record<number, "1" | "3">>(
    {},
  );
  const [resultado, setResultado] = useState<{
    exitoso: boolean;
    mensaje: string;
    estadoSunat: string;
  } | null>(null);

  const candidatos = useMemo(() => {
    if (!sucursalSeleccionada) return [];
    return comprobantes.filter(
      (c) =>
        TIPOS_RESUMEN.includes(c.tipoComprobante) &&
        c.estadoSunat === "PENDIENTE" &&
        c.fechaEmision?.startsWith(fechaSeleccionada) &&
        c.company.establecimientoAnexo ===
          sucursalSeleccionada.codEstablecimiento,
    );
  }, [comprobantes, fechaSeleccionada, sucursalSeleccionada]);

  useEffect(() => {
    const mapa: Record<number, "1" | "3"> = {};
    candidatos.forEach((c) => {
      mapa[c.comprobanteId] = condicionMap[c.comprobanteId] ?? "1";
    });
    setCondicionMap(mapa);
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos.length, fechaSeleccionada, sucursalSeleccionada]);

  useEffect(() => {
    if (!sucursalSeleccionada) {
      resetNumero();
      return;
    }
    fetchProximoNumero(
      sucursalSeleccionada.empresaRuc ?? user?.ruc ?? "",
      sucursalSeleccionada.codEstablecimiento,
      fechaSeleccionada,
    );
  }, [fechaSeleccionada, sucursalSeleccionada]);

  const totales = useMemo(
    () =>
      candidatos.reduce(
        (acc, c) => {
          if ((condicionMap[c.comprobanteId] ?? "1") !== "3") {
            acc.importe += c.importeTotal ?? 0;
            acc.igv += c.totalIGV ?? 0;
          }
          return acc;
        },
        { importe: 0, igv: 0 },
      ),
    [candidatos, condicionMap],
  );

  const cantAnulaciones = Object.values(condicionMap).filter(
    (v) => v === "3",
  ).length;
  const loading = loadingRegistrar || loadingEnviar;
  const isDisabled =
    loading ||
    candidatos.length === 0 ||
    !!resultado?.exitoso ||
    !sucursalSeleccionada ||
    !identificador;

  const handleEmitir = async () => {
    if (!sucursalSeleccionada) {
      showToast("Selecciona una sucursal antes de emitir", "error");
      return;
    }
    if (candidatos.length === 0) {
      showToast("No hay comprobantes para incluir en el resumen", "error");
      return;
    }

    const dto = buildResumenDTO(
      candidatos,
      condicionMap,
      fechaSeleccionada,
      user?.id ? Number(user.id) : null,
      sucursalSeleccionada,
      numeroEnvio ?? 1,
    );
    const resumenId = await registrar(dto);
    if (!resumenId) return;

    const resp = await enviarSunat(resumenId);
    if (!resp) return;

    setResultado({
      exitoso: resp.exitoso,
      mensaje: resp.mensaje ?? resp.mensajeRespuesta ?? "",
      estadoSunat: resp.estadoSunat ?? "DESCONOCIDO",
    });
    if (resp.exitoso) {
      showToast(resp.mensaje ?? "Resumen enviado correctamente", "success");
      onEmitido?.(resumenId, resp.estadoSunat ?? "ACEPTADO");
    } else {
      showToast(resp.mensaje ?? "SUNAT rechazó el resumen", "error");
    }
  };

  const inputCls =
    "w-full pl-2.5 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all appearance-none disabled:opacity-50";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Generar Resumen Diario
              </h2>
              <p className="text-xs text-gray-400">
                Envío de boletas y notas mediante resumen RC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-700 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Sucursal superadmin */}
            {isSuperAdmin && (
              <div className="col-span-2 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  <Store size={11} />
                  Sucursal
                </label>
                <div className="relative">
                  <select
                    value={sucursalSeleccionada?.sucursalId ?? ""}
                    onChange={(e) =>
                      setSucursalSeleccionada(
                        sucursales.find(
                          (s) => s.sucursalId === Number(e.target.value),
                        ) ?? null,
                      )
                    }
                    disabled={loading}
                    className={inputCls}
                  >
                    <option value="">Selecciona una sucursal...</option>
                    {sucursales.map((s) => (
                      <option key={s.sucursalId} value={s.sucursalId}>
                        {s.codEstablecimiento} · {s.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
            )}

            {/* Sucursal rol normal */}
            {!isSuperAdmin && sucursalSeleccionada && (
              <div className="col-span-2 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  <Store size={11} />
                  Sucursal
                </label>
                <div className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 truncate">
                  <span className="font-semibold">
                    {sucursalSeleccionada.codEstablecimiento}
                  </span>
                  {" · "}
                  <span className="text-gray-500">
                    {sucursalSeleccionada.nombre}
                  </span>
                </div>
              </div>
            )}

            {/* Fecha */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                <Calendar size={11} />
                Fecha emisión docs
              </label>
              <div className="relative">
                <select
                  value={fechaSeleccionada}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                  disabled={loading}
                  className={inputCls}
                >
                  {fechasDisponibles.map((f, i) => (
                    <option key={f} value={f}>
                      {i === 0 ? `${f} (hoy)` : f}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Identificador */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                <Hash size={11} />
                Identificador
              </label>
              <div className="px-2.5 py-1.5 text-xs bg-indigo-50 border border-indigo-100 rounded-lg font-mono font-semibold flex items-center gap-1.5">
                {loadingNumero ? (
                  <Loader2 size={11} className="animate-spin text-indigo-400" />
                ) : identificador ? (
                  <span className="text-indigo-700">{identificador}</span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertCircle size={11} />
                    No disponible
                  </span>
                )}
              </div>
            </div>

            {/* Empresa emisora */}
            {sucursalSeleccionada && (
              <div className="col-span-2 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  <Building2 size={11} />
                  Empresa emisora
                </label>
                <div className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 truncate">
                  <span className="font-semibold">
                    {sucursalSeleccionada.empresaRuc}
                  </span>
                  {candidatos[0]?.company?.razonSocial && (
                    <span className="text-gray-500">
                      {" "}
                      · {candidatos[0].company.razonSocial}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              {!sucursalSeleccionada && isSuperAdmin ? (
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <AlertCircle size={13} />
                  Selecciona una sucursal para ver los comprobantes
                </span>
              ) : (
                <>
                  Comprobantes pendientes:{" "}
                  <span className="font-semibold text-gray-800">
                    {candidatos.length}
                  </span>
                </>
              )}
            </p>
            {candidatos.length > 0 && (
              <p className="text-xs text-gray-400">
                Total:{" "}
                <span className="font-semibold text-gray-700">
                  S/ {formatCurrency(totales.importe)}
                </span>
                {" · "}IGV:{" "}
                <span className="font-semibold text-gray-700">
                  S/ {formatCurrency(totales.igv)}
                </span>
              </p>
            )}
          </div>

          {!sucursalSeleccionada && isSuperAdmin ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-gray-300">
              <Store size={36} className="opacity-40" />
              <p className="text-sm text-gray-400">
                Selecciona una sucursal para continuar
              </p>
            </div>
          ) : candidatos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
              <FileText size={32} className="opacity-30" />
              <p className="text-sm">
                No hay boletas/notas pendientes para{" "}
                <span className="font-semibold">{fechaSeleccionada}</span>
              </p>
              <p className="text-xs">
                Cambia la fecha o verifica el estado de los comprobantes
              </p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      "N° Comprobante",
                      "Tipo",
                      "Cliente",
                      "Importe",
                      "IGV",
                      "Condición",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2.5 font-semibold text-[10px] text-gray-500 uppercase tracking-wide",
                          i >= 3 && i < 5 && "text-right",
                          i === 5 && "text-center",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {candidatos.map((c) => {
                    const cond = condicionMap[c.comprobanteId] ?? "1";
                    const esAnulacion = cond === "3";
                    return (
                      <tr
                        key={c.comprobanteId}
                        className={cn(
                          "hover:bg-gray-50/70 transition-colors",
                          esAnulacion && "bg-red-50/40",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-gray-800">
                            {c.numeroCompleto}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold">
                            {tipoLabel[c.tipoComprobante] ?? c.tipoComprobante}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-45">
                          <p className="font-medium text-gray-700 truncate">
                            {c.cliente?.razonSocial || "Consumidor final"}
                          </p>
                          {c.cliente?.numeroDocumento && (
                            <p className="text-[10px] text-gray-400">
                              {c.cliente.numeroDocumento}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          <span
                            className={cn(
                              "font-semibold",
                              esAnulacion
                                ? "text-gray-400 line-through"
                                : "text-gray-800",
                            )}
                          >
                            S/ {formatCurrency(c.importeTotal ?? 0)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          <span
                            className={cn(
                              "text-gray-600",
                              esAnulacion && "text-gray-400 line-through",
                            )}
                          >
                            S/ {formatCurrency(c.totalIGV ?? 0)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="relative inline-block">
                            <select
                              value={cond}
                              onChange={(e) =>
                                setCondicionMap((prev) => ({
                                  ...prev,
                                  [c.comprobanteId]: e.target.value as
                                    | "1"
                                    | "3",
                                }))
                              }
                              disabled
                              className={cn(
                                "pl-2 pr-6 py-1 text-[10px] font-semibold rounded-lg border outline-none appearance-none transition-all disabled:opacity-50",
                                esAnulacion
                                  ? "bg-red-50 border-red-200 text-red-700 focus:ring-2 focus:ring-red-100"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-2 focus:ring-emerald-100",
                              )}
                            >
                              <option value="1">Alta (1)</option>
                              <option value="3">Anulación (3)</option>
                            </select>
                            <ChevronDown
                              size={10}
                              className={cn(
                                "absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none",
                                esAnulacion
                                  ? "text-red-400"
                                  : "text-emerald-400",
                              )}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resultado */}
        {resultado && (
          <div
            className={cn(
              "mx-6 mb-3 px-4 py-3 rounded-xl flex items-start gap-3",
              resultado.exitoso
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-red-50 border border-red-200 text-red-800",
            )}
          >
            {resultado.exitoso ? (
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-emerald-600"
              />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
            )}
            <div>
              <p className="font-semibold text-xs">{resultado.estadoSunat}</p>
              <p className="text-xs mt-0.5 opacity-80">{resultado.mensaje}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-gray-400">
            {candidatos.length > 0 && (
              <>
                <span className="font-semibold text-gray-600">
                  {candidatos.length}
                </span>{" "}
                comprobante{candidatos.length !== 1 ? "s" : ""} ·{" "}
                <span className="font-semibold text-gray-600">
                  {cantAnulaciones}
                </span>{" "}
                anulación{cantAnulaciones !== 1 ? "es" : ""}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleEmitir}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl transition-all",
                isDisabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md",
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {loadingRegistrar ? "Registrando..." : "Enviando a SUNAT..."}
                </>
              ) : resultado?.exitoso ? (
                <>
                  <CheckCircle2 size={13} />
                  Emitido
                </>
              ) : (
                <>
                  <Send size={13} />
                  Emitir Resumen
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

