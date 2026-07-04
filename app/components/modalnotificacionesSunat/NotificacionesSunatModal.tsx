"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  FileText,
  ShieldCheck,
  X,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import {
  useNotificationsDashboard,
  type NotifDoc,
  type CertInfo,
} from "@/hooks/useNotificationsDashboard"; // ajusta el path si es necesario

// ─── Tipos internos ───────────────────────────────────────────────────────────

type NotifType = "success" | "warning" | "error" | "info";

interface ModalNotif {
  id: string;
  title: string;
  desc: string;
  type: NotifType;
  detail: string;
  hora: string;
  numeroCompleto?: string;
  codigoSunat?: string;
  mensaje?: string;
  esCert?: boolean;
}

// ─── Iconos por tipo ──────────────────────────────────────────────────────────

const ICON_CFG: Record<
  NotifType,
  {
    icon: React.ReactNode;
    dot: string;
    badge: string;
    label: string;
    iconBg: string;
  }
> = {
  success: {
    icon: <CheckCircle2 size={16} />,
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    label: "Éxito",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
    label: "Advertencia",
    iconBg: "bg-amber-100 text-amber-600",
  },
  info: {
    icon: <ShieldCheck size={16} />,
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700",
    label: "Vigente",
    iconBg: "bg-blue-100 text-blue-600",
  },
  error: {
    icon: <XCircle size={16} />,
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700",
    label: "Error",
    iconBg: "bg-rose-100 text-rose-600",
  },
};

// ─── Conversores doc → ModalNotif ─────────────────────────────────────────────

function labelTipoDoc(doc: NotifDoc) {
  if (doc.tipo === "guia") return "Guía de Remisión";
  const map: Record<string, string> = {
    "01": "Factura",
    "03": "Boleta",
    "07": "Nota de Crédito",
    "08": "Nota de Débito",
  };
  return map[doc.tipoComprobante] ?? "Comprobante";
}

function formatHora(fechaStr?: string) {
  if (!fechaStr) return "";
  return new Date(fechaStr).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function docAceptadoToNotif(doc: NotifDoc): ModalNotif {
  const label = labelTipoDoc(doc);
  const monto = doc.importeTotal
    ? ` por ${doc.tipoMoneda ?? "S/"} ${doc.importeTotal}`
    : "";
  return {
    id: `a-${doc.id}`,
    title: "CDR Aceptado",
    desc: `${label} ${doc.numeroCompleto} aceptada.`,
    type: "success",
    detail: `El comprobante ${doc.numeroCompleto} emitido a ${doc.destinatario}${monto} fue aceptado correctamente por SUNAT.`,
    hora: formatHora(doc.fechaActualizacion),
    numeroCompleto: doc.numeroCompleto,
  };
}

function docRechazadoToNotif(doc: NotifDoc): ModalNotif {
  const label = labelTipoDoc(doc);
  return {
    id: `r-${doc.id}`,
    title: "Rechazado por SUNAT",
    desc: `${label} ${doc.numeroCompleto} rechazada (${doc.codigoRespuestaSunat ?? "—"}).`,
    type: "error",
    detail:
      doc.mensajeRespuestaSunat ??
      "SUNAT rechazó el comprobante. Revisa el código de error.",
    hora: formatHora(doc.fechaActualizacion),
    numeroCompleto: doc.numeroCompleto,
    codigoSunat: doc.codigoRespuestaSunat,
    mensaje: doc.mensajeRespuestaSunat,
  };
}

function docPendienteToNotif(doc: NotifDoc): ModalNotif {
  const label = labelTipoDoc(doc);
  return {
    id: `p-${doc.id}`,
    title: "Pendiente de Envío",
    desc: `${label} ${doc.numeroCompleto} pendiente.`,
    type: "warning",
    detail: `El comprobante ${doc.numeroCompleto} aún no ha sido procesado por SUNAT.`,
    hora: formatHora(doc.fechaActualizacion),
    numeroCompleto: doc.numeroCompleto,
  };
}

function certToNotif(cert: CertInfo): ModalNotif {
  const fecha = new Date(cert.expiryDate).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const type: NotifType = cert.isExpired
    ? "error"
    : cert.isExpiringSoon
      ? "warning"
      : "info";

  const title = cert.isExpired
    ? "Certificado Expirado"
    : cert.isExpiringSoon
      ? "Certificado por Vencer"
      : "Certificado Vigente";

  const desc = cert.isExpired
    ? "El certificado digital ha expirado."
    : `Vence el ${fecha} — ${cert.daysLeft} día(s) restantes.`;

  const detail = cert.isExpired
    ? `Su certificado digital expiró el ${fecha}. Renuévelo para continuar emitiendo comprobantes.`
    : cert.isExpiringSoon
      ? `Su certificado digital vence el ${fecha}. Le quedan ${cert.daysLeft} día(s) para renovarlo.`
      : `Su certificado digital está vigente hasta el ${fecha}. Quedan ${cert.daysLeft} día(s) de validez.`;

  return { id: "cert", title, desc, type, detail, hora: "", esCert: true };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  sucursalId?: number | null;
  empresaRuc?: string | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const NotificacionesSunatModal: React.FC<Props> = ({
  onClose,
  sucursalId,
  empresaRuc,
}) => {
  const {
    recentDocs,
    certInfo,
    loading,
    error,
    refetch,
  } = useNotificationsDashboard({ sucursalId, empresaRuc });

  // Carga al montar
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Últimos N documentos (sin importar el día), convertidos según su estado
  const notifs: ModalNotif[] = useMemo(() => {
    const docNotifs = recentDocs.map((doc) => {
      if (doc.estadoSunat === "RECHAZADO") return docRechazadoToNotif(doc);
      if (doc.estadoSunat === "ACEPTADO") return docAceptadoToNotif(doc);
      return docPendienteToNotif(doc);
    });
    return [...docNotifs, ...(certInfo ? [certToNotif(certInfo)] : [])];
  }, [recentDocs, certInfo]);

  const [selected, setSelected] = useState<ModalNotif | null>(null);

  // Selecciona el primero automáticamente cuando llegan los datos
  useEffect(() => {
    if (notifs.length > 0 && !selected) {
      setSelected(notifs[0]);
    }
  }, [notifs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600 shrink-0">
            <Bell size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900">
              Notificaciones SUNAT
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading
                ? "Cargando eventos recientes..."
                : `${notifs.length} evento(s) reciente(s)`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex flex-1 overflow-hidden"
          style={{ minHeight: 0, height: "520px" }}
        >
          {/* ── Lista izquierda ── */}
          <div className="w-[42%] border-r border-slate-100 overflow-y-auto shrink-0">
            {/* Loading skeleton */}
            {loading && (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm text-rose-500">{error}</p>
                <button
                  onClick={refetch}
                  className="text-xs text-blue-600 underline"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Sin notificaciones */}
            {!loading && !error && notifs.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                Sin notificaciones recientes
              </div>
            )}

            {/* Lista */}
            {!loading &&
              !error &&
              notifs.map((notif) => {
                const cfg = ICON_CFG[notif.type];
                return (
                  <button
                    key={notif.id}
                    onClick={() => setSelected(notif)}
                    className={cn(
                      "w-full text-left flex gap-3 p-4 border-b border-slate-50 transition-colors border-l-2",
                      selected?.id === notif.id
                        ? "bg-blue-50 border-l-blue-600"
                        : "hover:bg-slate-50 border-l-transparent",
                    )}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        cfg.dot,
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {notif.title}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                            cfg.badge,
                          )}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.desc}
                      </p>
                      {notif.hora && (
                        <p className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
                          <Calendar size={9} />
                          {notif.hora}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>

          {/* ── Detalle derecho ── */}
          {selected ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Título */}
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    ICON_CFG[selected.type].iconBg,
                  )}
                >
                  {ICON_CFG[selected.type].icon}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {selected.title}
                  </h4>
                  {selected.hora && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={11} />
                      {selected.hora}
                    </p>
                  )}
                </div>
              </div>

              {/* Detalle */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selected.detail}
                </p>
              </div>

              {/* Comprobante relacionado */}
              {selected.numeroCompleto && (
                <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/50">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">
                    Comprobante Relacionado
                  </p>
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <span className="text-sm font-bold text-blue-800">
                      {selected.numeroCompleto}
                    </span>
                  </div>
                </div>
              )}

              {/* Código SUNAT (rechazados) */}
              {selected.codigoSunat && (
                <div className="border border-rose-100 rounded-xl p-4 bg-rose-50/50">
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-1">
                    Código de Error SUNAT
                  </p>
                  <p className="text-sm font-mono font-bold text-rose-800">
                    {selected.codigoSunat}
                  </p>
                  {selected.mensaje && (
                    <p className="text-xs text-rose-600 mt-2 leading-relaxed">
                      {selected.mensaje}
                    </p>
                  )}
                </div>
              )}

              {/* Certificado */}
              {selected.esCert && (
                <div className="border border-amber-100 rounded-xl p-4 bg-amber-50/50 flex items-start gap-3">
                  <ShieldCheck
                    size={20}
                    className="text-amber-600 shrink-0 mt-0.5"
                  />
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Renueve el certificado digital para continuar emitiendo
                    comprobantes electrónicos sin interrupciones.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Selecciona una notificación para ver el detalle
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
