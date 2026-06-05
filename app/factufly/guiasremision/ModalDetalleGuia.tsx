"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  RefreshCw,
  X,
  CheckCircle2,
  Eye,
  Download,
  ChevronDown,
  MapPin,
  Truck,
  User,
  FileText,
  Hash,
  Calendar,
  Package,
  AlertCircle,
  Weight,
  Navigation,
} from "lucide-react";
import { cn } from "@/app/utils/cn";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface GuiaDetalleDto {
  detalleId: number;
  cantidad: number;
  unidad: string;
  descripcion: string;
  codigo?: string;
}

interface GuiaDto {
  guiaId: number;
  sucursalId?: number;
  tipoDoc: string;
  serie: string;
  correlativo: number;
  numeroCompleto?: string;
  fechaEmision: string;
  fechaCreacion: string;
  empresaRuc?: string;
  empresaRazonSocial?: string;
  destinatarioTipoDoc?: string;
  destinatarioNumDoc?: string;
  destinatarioRznSocial?: string;
  observacion?: string;
  relDocTipoDoc?: string;
  relDocNroDoc?: string;
  terceroTipoDoc?: string;
  terceroNumDoc?: string;
  terceroRznSocial?: string;
  codTraslado?: string;
  desTraslado?: string;
  modTraslado?: string;
  fecTraslado?: string;
  pesoTotal?: number;
  undPesoTotal?: string;
  llegadaUbigeo?: string;
  llegadaDepartamento?: string;
  llegadaProvincia?: string;
  llegadaDistrito?: string;
  llegadaDireccion?: string;
  partidaUbigeo?: string;
  partidaDepartamento?: string;
  partidaProvincia?: string;
  partidaDistrito?: string;
  partidaDireccion?: string;
  choferTipoDoc?: string;
  choferDoc?: string;
  choferNombres?: string;
  choferApellidos?: string;
  choferLicencia?: string;
  transportistaNumDoc?: string;
  transportistaRznSocial?: string;
  transportistaRegistroMTC?: string;
  indVehiculoM1L: boolean;
  autorizacionVehiculoEntidad?: string;
  autorizacionVehiculoNumero?: string;
  transportistaPlaca?: string;
  placaSecundaria1?: string;
  placaSecundaria2?: string;
  placaSecundaria3?: string;
  choferSecundarioTipoDoc?: string;
  choferSecundarioDoc?: string;
  choferSecundarioNombres?: string;
  choferSecundarioApellidos?: string;
  choferSecundarioLicencia?: string;
  choferSecundario2TipoDoc?: string;
  choferSecundario2Doc?: string;
  choferSecundario2Nombres?: string;
  choferSecundario2Apellidos?: string;
  choferSecundario2Licencia?: string;
  estadoSunat: string;
  codigoRespuestaSunat?: string;
  mensajeRespuestaSunat?: string;
  ticketSunat?: string;
  fechaEnvioSunat?: string;
  indTransbordo: boolean;
  matPeligrosoClase?: string;
  matPeligrosoNroONU?: string;
  clienteCorreo?: string;
  enviadoPorCorreo: boolean;
  clienteWhatsapp?: string;
  enviadoPorWhatsapp: boolean;
  details: GuiaDetalleDto[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtFecha = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};

const TIPO_DOC_LABEL: Record<string, string> = {
  "09": "Guía de Remisión Remitente",
  "31": "Guía de Remisión Transportista",
};
const MOD_TRASLADO: Record<string, string> = {
  "01": "Transporte público",
  "02": "Transporte privado",
};
const SUNAT_CFG: Record<string, { badge: string }> = {
  ACEPTADO: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDIENTE: { badge: "bg-amber-50 text-amber-700 border-amber-200" },
  RECHAZADO: { badge: "bg-red-50 text-red-700 border-red-200" },
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────
const DataCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="bg-gray-50 rounded-xl px-3.5 py-3">
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </p>
    </div>
    <p className="text-sm font-semibold text-gray-900 leading-tight">{value}</p>
  </div>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
      {label}
    </p>
  </div>
);

const PlacaBadge = ({ placa }: { placa: string }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-md text-xs font-mono font-semibold text-gray-700">
    <Truck size={11} className="text-gray-500" /> {placa}
  </span>
);

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ModalDetalleGuiaProps {
  guiaId: number;
  accessToken: string;
  ruc: string;
  onClose: () => void;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export const ModalDetalleGuia = ({
  guiaId,
  accessToken,
  ruc,
  onClose,
}: ModalDetalleGuiaProps) => {
  const [guia, setGuia] = useState<GuiaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVer, setLoadingVer] = useState(false);
  const [loadingDescargar, setLoadingDescargar] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);

  // ── Cerrar size menu al click fuera ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node))
        setShowSizeMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Cargar detalle ──
  useEffect(() => {
    const fetchGuia = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/guias/detalle/${guiaId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) throw new Error();
        const data: GuiaDto = await res.json();
        setGuia(data);
      } catch {
        // silencioso — el modal mostrará error si guia es null
      } finally {
        setLoading(false);
      }
    };
    fetchGuia();
  }, [guiaId, accessToken]);

  // ── Descargar / ver PDF ──
  const obtenerPdf = useCallback(
    async (abrir: boolean) => {
      if (!guia) return;
      if (abrir) setLoadingVer(true);
      else setLoadingDescargar(true);
      try {
        const ventana = abrir ? window.open("", "_blank") : null;
        if (ventana) {
          ventana.document.write(`
                    <html><head><title>Cargando PDF...</title></head>
                    <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;flex-direction:column;gap:16px;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
                        <p style="color:#64748b;font-size:14px;margin:0">Cargando PDF, por favor espere...</p>
                    </body></html>
                `);
        }
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/guias/${guiaId}/pdf`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(
          new Blob([blob], { type: "application/pdf" }),
        );
        if (abrir && ventana) {
          ventana.location.href = url;
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = `${guia.numeroCompleto ?? guiaId}.pdf`;
          a.click();
        }
      } catch {
      } finally {
        if (abrir) setLoadingVer(false);
        else setLoadingDescargar(false);
        setShowSizeMenu(false);
      }
    },
    [guia, guiaId, accessToken],
  );

  // ── Derivados ──
  const estadoCfg =
    SUNAT_CFG[guia?.estadoSunat ?? "PENDIENTE"] ?? SUNAT_CFG.PENDIENTE;
  const iconoEstado =
    guia?.estadoSunat === "ACEPTADO" ? (
      <CheckCircle2 size={13} />
    ) : guia?.estadoSunat === "RECHAZADO" ? (
      <X size={13} />
    ) : (
      <RefreshCw size={13} />
    );
  const estadoLabel =
    guia?.estadoSunat === "ACEPTADO"
      ? "Aceptado"
      : guia?.estadoSunat === "RECHAZADO"
        ? "Rechazado"
        : "Pendiente";

  const placas = [
    guia?.transportistaPlaca,
    guia?.placaSecundaria1,
    guia?.placaSecundaria2,
    guia?.placaSecundaria3,
  ].filter(Boolean) as string[];
  const tieneChoferPrincipal = guia?.choferDoc;
  const tieneChoferSecundario = guia?.choferSecundarioDoc;
  const tieneChoferSecundario2 = guia?.choferSecundario2Doc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 min-h-screen h-full">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col animate-in zoom-in-95 duration-200"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ── */}
        <div className="bg-blue-600 rounded-t-2xl px-6 pt-6 pb-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Truck size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {loading ? "Cargando..." : (guia?.numeroCompleto ?? "—")}
                </h2>
                {loading && (
                  <RefreshCw size={14} className="animate-spin text-white/70" />
                )}
              </div>
              <p className="text-blue-200 text-sm mt-0.5">
                {loading
                  ? "..."
                  : `${TIPO_DOC_LABEL[guia?.tipoDoc ?? ""] ?? guia?.tipoDoc} · ${fmtFecha(guia?.fechaEmision)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors mt-0.5"
          >
            <X size={17} className="text-white" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <span className="text-sm text-blue-600 font-medium">
                Cargando detalles...
              </span>
            </div>
          ) : !guia ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <AlertCircle size={24} className="text-red-400" />
              <span className="text-sm text-red-500 font-medium">
                No se pudo cargar la guía
              </span>
            </div>
          ) : (
            <>
              {/* Estado SUNAT */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold",
                    estadoCfg.badge,
                  )}
                >
                  {iconoEstado} Estado SUNAT: {estadoLabel}
                </span>
                {guia.codigoRespuestaSunat && (
                  <span className="text-xs text-gray-400">
                    Código: {guia.codigoRespuestaSunat}
                  </span>
                )}
              </div>
              {/* Mensaje SUNAT */}
              {guia.mensajeRespuestaSunat && (
                <p
                  className={cn(
                    "text-xs rounded-xl px-3 py-2",
                    guia.estadoSunat === "ACEPTADO"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600",
                  )}
                >
                  {guia.mensajeRespuestaSunat}
                </p>
              )}

              {/* Info general */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DataCard
                  icon={<Hash size={14} className="text-gray-400" />}
                  label="N° Guía"
                  value={guia.numeroCompleto ?? "—"}
                />
                <DataCard
                  icon={<Calendar size={14} className="text-gray-400" />}
                  label="Fecha de Emisión"
                  value={fmtFecha(guia.fechaEmision)}
                />
                <DataCard
                  icon={<FileText size={14} className="text-gray-400" />}
                  label="Destinatario"
                  value={guia.destinatarioRznSocial ?? "—"}
                />
                <DataCard
                  icon={<Hash size={14} className="text-gray-400" />}
                  label={
                    guia.destinatarioTipoDoc === "6"
                      ? "RUC"
                      : guia.destinatarioTipoDoc === "1"
                        ? "DNI"
                        : "Doc. Destinatario"
                  }
                  value={guia.destinatarioNumDoc ?? "—"}
                />
              </div>

              {/* Traslado */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <SectionHeader label="Datos del traslado" />
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DataCard
                    icon={<Navigation size={14} className="text-gray-400" />}
                    label="Motivo"
                    value={guia.desTraslado ?? "—"}
                  />
                  <DataCard
                    icon={<Truck size={14} className="text-gray-400" />}
                    label="Modalidad"
                    value={
                      MOD_TRASLADO[guia.modTraslado ?? ""] ??
                      guia.modTraslado ??
                      "—"
                    }
                  />
                  <DataCard
                    icon={<Calendar size={14} className="text-gray-400" />}
                    label="Fecha de Traslado"
                    value={fmtFecha(guia.fecTraslado)}
                  />
                  {guia.pesoTotal && (
                    <DataCard
                      icon={<Weight size={14} className="text-gray-400" />}
                      label="Peso Total"
                      value={`${guia.pesoTotal} ${guia.undPesoTotal ?? ""}`}
                    />
                  )}
                  {guia.matPeligrosoClase && (
                    <DataCard
                      icon={<AlertCircle size={14} className="text-gray-400" />}
                      label="Mat. Peligroso"
                      value={`${guia.matPeligrosoClase} · ONU: ${guia.matPeligrosoNroONU ?? "—"}`}
                    />
                  )}
                  {guia.indTransbordo && (
                    <div className="col-span-2">
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                        Indica transbordo
                      </span>
                    </div>
                  )}
                </div>

                {/* Partida → Llegada */}
                <div className="border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                  <div className="p-4 space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={11} className="text-gray-400" /> Punto de
                      Partida
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {guia.partidaDireccion ?? "—"}
                    </p>
                    {guia.partidaDistrito && (
                      <p className="text-xs text-gray-500">
                        {[
                          guia.partidaDistrito,
                          guia.partidaProvincia,
                          guia.partidaDepartamento,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {guia.partidaUbigeo && (
                      <p className="text-[10px] text-gray-400">
                        Ubigeo: {guia.partidaUbigeo}
                      </p>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={11} className="text-blue-400" /> Punto de
                      Llegada
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {guia.llegadaDireccion ?? "—"}
                    </p>
                    {guia.llegadaDistrito && (
                      <p className="text-xs text-gray-500">
                        {[
                          guia.llegadaDistrito,
                          guia.llegadaProvincia,
                          guia.llegadaDepartamento,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {guia.llegadaUbigeo && (
                      <p className="text-[10px] text-gray-400">
                        Ubigeo: {guia.llegadaUbigeo}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Transportista */}
              {(guia.transportistaNumDoc || placas.length > 0) && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <SectionHeader label="Transportista y vehículo" />
                  <div className="p-4 space-y-3">
                    {guia.transportistaNumDoc && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DataCard
                          icon={
                            <FileText size={14} className="text-gray-400" />
                          }
                          label="RUC / Doc."
                          value={guia.transportistaNumDoc}
                        />
                        <DataCard
                          icon={<Hash size={14} className="text-gray-400" />}
                          label="Razón Social"
                          value={guia.transportistaRznSocial ?? "—"}
                        />
                        {guia.transportistaRegistroMTC && (
                          <DataCard
                            icon={<Hash size={14} className="text-gray-400" />}
                            label="Reg. MTC"
                            value={guia.transportistaRegistroMTC}
                          />
                        )}
                        {guia.autorizacionVehiculoNumero && (
                          <DataCard
                            icon={<Hash size={14} className="text-gray-400" />}
                            label="Autorización vehículo"
                            value={`${guia.autorizacionVehiculoEntidad ?? ""} ${guia.autorizacionVehiculoNumero}`.trim()}
                          />
                        )}
                      </div>
                    )}
                    {placas.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Placas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {placas.map((p, i) => (
                            <PlacaBadge key={i} placa={p} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Conductores */}
              {(tieneChoferPrincipal ||
                tieneChoferSecundario ||
                tieneChoferSecundario2) && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <SectionHeader label="Conductores" />
                  <div className="divide-y divide-gray-100">
                    {tieneChoferPrincipal && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <User size={11} /> Conductor principal
                          </p>
                        </div>
                        <DataCard
                          icon={<Hash size={14} className="text-gray-400" />}
                          label="Doc."
                          value={`${guia.choferTipoDoc ?? ""} ${guia.choferDoc ?? ""}`.trim()}
                        />
                        <DataCard
                          icon={<User size={14} className="text-gray-400" />}
                          label="Nombres"
                          value={
                            `${guia.choferNombres ?? ""} ${guia.choferApellidos ?? ""}`.trim() ||
                            "—"
                          }
                        />
                        {guia.choferLicencia && (
                          <DataCard
                            icon={<Hash size={14} className="text-gray-400" />}
                            label="Licencia"
                            value={guia.choferLicencia}
                          />
                        )}
                      </div>
                    )}
                    {tieneChoferSecundario && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <User size={11} /> Conductor secundario
                          </p>
                        </div>
                        <DataCard
                          icon={<Hash size={14} className="text-gray-400" />}
                          label="Doc."
                          value={`${guia.choferSecundarioTipoDoc ?? ""} ${guia.choferSecundarioDoc ?? ""}`.trim()}
                        />
                        <DataCard
                          icon={<User size={14} className="text-gray-400" />}
                          label="Nombres"
                          value={
                            `${guia.choferSecundarioNombres ?? ""} ${guia.choferSecundarioApellidos ?? ""}`.trim() ||
                            "—"
                          }
                        />
                        {guia.choferSecundarioLicencia && (
                          <DataCard
                            icon={<Hash size={14} className="text-gray-400" />}
                            label="Licencia"
                            value={guia.choferSecundarioLicencia}
                          />
                        )}
                      </div>
                    )}
                    {tieneChoferSecundario2 && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <User size={11} /> Conductor secundario 2
                          </p>
                        </div>
                        <DataCard
                          icon={<Hash size={14} className="text-gray-400" />}
                          label="Doc."
                          value={`${guia.choferSecundario2TipoDoc ?? ""} ${guia.choferSecundario2Doc ?? ""}`.trim()}
                        />
                        <DataCard
                          icon={<User size={14} className="text-gray-400" />}
                          label="Nombres"
                          value={
                            `${guia.choferSecundario2Nombres ?? ""} ${guia.choferSecundario2Apellidos ?? ""}`.trim() ||
                            "—"
                          }
                        />
                        {guia.choferSecundario2Licencia && (
                          <DataCard
                            icon={<Hash size={14} className="text-gray-400" />}
                            label="Licencia"
                            value={guia.choferSecundario2Licencia}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detalle de bienes */}
              {guia.details?.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <SectionHeader label="Bienes trasladados" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50/80 border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold w-20">
                            Código
                          </th>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold">
                            Descripción
                          </th>
                          <th className="px-3 py-2 text-right text-gray-400 font-semibold w-20">
                            Cantidad
                          </th>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold w-20">
                            Unidad
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {guia.details.map((d, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 text-gray-500">
                              {d.codigo ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800">
                              {d.descripcion}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 font-mono">
                              {d.cantidad}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">
                              {d.unidad}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-gray-100 shrink-0">
          <button
            onClick={() => obtenerPdf(true)}
            disabled={loadingVer || loading || !guia}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loadingVer ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Eye size={15} />
            )}
            Ver PDF
          </button>
          <button
            onClick={() => obtenerPdf(false)}
            disabled={loadingDescargar || loading || !guia}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-colors"
          >
            {loadingDescargar ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            Descargar PDF
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors whitespace-nowrap"
          >
            <X size={15} /> Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
