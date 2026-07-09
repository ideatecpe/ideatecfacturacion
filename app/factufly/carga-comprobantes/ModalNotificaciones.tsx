"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  User,
  Building2,
  Settings,
  Clock,
  Pencil,
  X,
  Bell,
  Search,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import type { GrupoData, FilaCarga } from "./types";
import type { EstadoEnvio } from "./useNotificaciones";
import { PERIODO_CFG } from "./constants";

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  isOpen: boolean;
  onClose: () => void;
  diasAviso: number;
  diasAvisoCargado: boolean;
  setDiasAviso: (n: number) => void;
  gruposParaNotificar: GrupoData[];
  estadoEmail: Record<string, EstadoEnvio>;
  estadoWsp: Record<string, EstadoEnvio>;
  enviandoBulk: boolean;
  progresoBulk: { actual: number; total: number } | null;
  getDiasRestantes: (fechafin: string) => number;
  getFirstFechaFin: (g: GrupoData) => string;
  getItemsProximosAVencer: (g: GrupoData) => FilaCarga[];
  buildMensajeGrupo: (g: GrupoData) => string;
  buildMensajeWsp: (g: GrupoData) => string;
  SUBJECT_DEFAULT: string;
  enviarEmail: (
    g: GrupoData,
    subject: string,
    mensaje: string,
  ) => Promise<boolean>;
  enviarWhatsApp: (g: GrupoData, mensajeOverride?: string) => Promise<void>;
  enviarTodosEmail: (
    lista: GrupoData[],
  ) => Promise<{ ok: number; err: number }>;
  enviarTodosWsp: (lista: GrupoData[]) => Promise<{ ok: number; err: number }>;
};

// ─── Helper visual días ───────────────────────────────────────────────────────
const getDiasInfo = (dias: number) => {
  if (dias < 0)
    return {
      label: `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}`,
      chip: "bg-red-100 text-red-600",
      dot: "bg-red-400",
    };
  if (dias === 0)
    return {
      label: "Vence hoy",
      chip: "bg-red-100 text-red-600",
      dot: "bg-red-400",
    };
  if (dias <= 7)
    return {
      label: `Vence en ${dias} día${dias !== 1 ? "s" : ""}`,
      chip: "bg-amber-100 text-amber-600",
      dot: "bg-amber-400",
    };
  return {
    label: `Vence en ${dias} días`,
    chip: "bg-blue-100 text-blue-600",
    dot: "bg-blue-400",
  };
};

// ─── Componente ───────────────────────────────────────────────────────────────
export function ModalNotificaciones({
  isOpen,
  onClose,
  diasAviso,
  diasAvisoCargado,
  setDiasAviso,
  gruposParaNotificar,
  estadoEmail,
  estadoWsp,
  enviandoBulk,
  progresoBulk,
  getDiasRestantes,
  getFirstFechaFin,
  getItemsProximosAVencer,
  buildMensajeGrupo,
  buildMensajeWsp,
  SUBJECT_DEFAULT,
  enviarEmail,
  enviarWhatsApp,
  enviarTodosEmail,
  enviarTodosWsp,
}: Props) {
  const [diasInput, setDiasInput] = useState(String(diasAviso));
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "vencidos" | "proximos"
  >("todos");

  // ── Editor email individual ───────────────────────────────────────────────
  const [grupoEditando, setGrupoEditando] = useState<GrupoData | null>(null);
  const [subjectEdit, setSubjectEdit] = useState("");
  const [mensajeEdit, setMensajeEdit] = useState("");
  const [enviandoEdit, setEnviandoEdit] = useState(false);

  // ── Editor WhatsApp individual ────────────────────────────────────────────
  const [grupoEditandoWsp, setGrupoEditandoWsp] = useState<GrupoData | null>(
    null,
  );
  const [mensajeEditWsp, setMensajeEditWsp] = useState("");
  const [enviandoEditWsp, setEnviandoEditWsp] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDiasInput(String(diasAviso));
    setSeleccionados(
      new Set(
        gruposParaNotificar.filter((g) => g.correo?.trim()).map((g) => g.key),
      ),
    );
    setGrupoEditando(null);
    setGrupoEditandoWsp(null);
    setBusqueda("");
    setFiltroEstado("todos");
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEditor = (g: GrupoData) => {
    setSubjectEdit(SUBJECT_DEFAULT);
    setMensajeEdit(buildMensajeGrupo(g));
    setGrupoEditando(g);
    setGrupoEditandoWsp(null); // cierra editor WSP si estaba abierto
  };
  const cerrarEditor = () => setGrupoEditando(null);
  const confirmarEnvio = async () => {
    if (!grupoEditando) return;
    setEnviandoEdit(true);
    await enviarEmail(grupoEditando, subjectEdit, mensajeEdit);
    setEnviandoEdit(false);
    setGrupoEditando(null);
  };

  const abrirEditorWsp = (g: GrupoData) => {
    setMensajeEditWsp(buildMensajeWsp(g));
    setGrupoEditandoWsp(g);
    setGrupoEditando(null); // cierra editor email si estaba abierto
  };
  const cerrarEditorWsp = () => setGrupoEditandoWsp(null);
  const confirmarEnvioWsp = async () => {
    if (!grupoEditandoWsp) return;
    setEnviandoEditWsp(true);
    await enviarWhatsApp(grupoEditandoWsp, mensajeEditWsp);
    setEnviandoEditWsp(false);
    setGrupoEditandoWsp(null);
  };

  const toggle = (key: string) =>
    setSeleccionados((p) => {
      const n = new Set(p);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const conCorreo = gruposParaNotificar.filter((g) => g.correo?.trim());
  const conWsp = gruposParaNotificar.filter((g) => g.whatsapp?.trim());

  // Filtrado por estado (vencido / próximo)
  const vencidos = gruposParaNotificar.filter(
    (g) => getDiasRestantes(getFirstFechaFin(g)) < 0,
  ).length;
  const porVencer = gruposParaNotificar.length - vencidos;

  const gruposPorEstado =
    filtroEstado === "vencidos"
      ? gruposParaNotificar.filter(
          (g) => getDiasRestantes(getFirstFechaFin(g)) < 0,
        )
      : filtroEstado === "proximos"
        ? gruposParaNotificar.filter(
            (g) => getDiasRestantes(getFirstFechaFin(g)) >= 0,
          )
        : gruposParaNotificar;

  // Filtrado por búsqueda
  const q = busqueda.trim().toLowerCase();
  const gruposFiltrados = q
    ? gruposPorEstado.filter(
        (g) =>
          g.razonSocial.toLowerCase().includes(q) ||
          g.numdoc.includes(q) ||
          g.items.some((i) => i.placa.toLowerCase().includes(q)),
      )
    : gruposPorEstado;

  const conCorreoFiltrado = gruposFiltrados.filter((g) => g.correo?.trim());
  const conWspFiltrado = gruposFiltrados.filter((g) => g.whatsapp?.trim());
  const selConCorreo = conCorreoFiltrado.filter((g) =>
    seleccionados.has(g.key),
  );
  const todosSeleccionados =
    conCorreoFiltrado.length > 0 &&
    conCorreoFiltrado.every((g) => seleccionados.has(g.key));
  const toggleTodos = () =>
    setSeleccionados(
      todosSeleccionados
        ? new Set(
            [...seleccionados].filter(
              (k) => !conCorreoFiltrado.some((g) => g.key === k),
            ),
          )
        : new Set([...seleccionados, ...conCorreoFiltrado.map((g) => g.key)]),
    );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel full-screen */}
      <div className="relative flex flex-col w-full h-full bg-white animate-in fade-in slide-in-from-bottom-2 duration-200">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-900">
              Notificaciones de pago previo
            </h3>
            {gruposParaNotificar.length > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
                {gruposParaNotificar.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Config días inline en header */}
            <div className="flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] font-medium text-gray-700">
                Avisar
              </span>
              {!diasAvisoCargado ? (
                <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
              ) : (
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={diasInput}
                  onChange={(e) => setDiasInput(e.target.value)}
                  onBlur={() => {
                    const n = Number(diasInput);
                    if (n > 0) setDiasAviso(n);
                    else setDiasInput(String(diasAviso));
                  }}
                  className="w-12 px-1.5 py-0.5 text-[11px] font-bold text-center text-gray-800 border border-gray-300 rounded-md outline-none focus:border-brand-blue/50"
                />
              )}
              <span className="text-[11px] font-medium text-gray-700">
                días
              </span>
            </div>
            {/* Switch Todos / Vencidos / Próximos */}
            <div className="flex items-center gap-0.5 bg-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setFiltroEstado("todos")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  filtroEstado === "todos"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Todos{" "}
                <span className="font-black">{gruposParaNotificar.length}</span>
              </button>
              <button
                onClick={() => setFiltroEstado("vencidos")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  filtroEstado === "vencidos"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-red-600"
                }`}
              >
                Vencidos <span className="font-black">{vencidos}</span>
              </button>
              <button
                onClick={() => setFiltroEstado("proximos")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  filtroEstado === "proximos"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-amber-600"
                }`}
              >
                Próximos <span className="font-black">{porVencer}</span>
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Editor inline (visible cuando se edita un grupo) ────────────── */}
        {grupoEditando && (
          <div className="shrink-0 mx-4 mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pencil className="w-3 h-3 text-blue-500" />
                <span className="text-[11px] font-bold text-blue-700">
                  Email para{" "}
                  <span className="font-black">
                    {grupoEditando.razonSocial}
                  </span>
                </span>
              </div>
              <button
                onClick={cerrarEditor}
                className="text-blue-300 hover:text-blue-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-blue-500">
              <Mail className="w-3 h-3" />
              <span>
                Para:{" "}
                <span className="font-semibold text-blue-700">
                  {grupoEditando.correo}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">
                  Asunto
                </label>
                <input
                  type="text"
                  value={subjectEdit}
                  onChange={(e) => setSubjectEdit(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">
                  Mensaje{" "}
                  <span className="font-normal text-blue-300 normal-case">
                    (editable)
                  </span>
                </label>
                <textarea
                  value={mensajeEdit}
                  onChange={(e) => setMensajeEdit(e.target.value)}
                  rows={7}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-blue-100 resize-y leading-relaxed text-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarEditor}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <Button
                onClick={confirmarEnvio}
                disabled={
                  enviandoEdit || !subjectEdit.trim() || !mensajeEdit.trim()
                }
                className="py-1 px-3 text-xs rounded-lg h-auto"
              >
                {enviandoEdit ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" /> Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Editor WhatsApp inline ──────────────────────────────────────── */}
        {grupoEditandoWsp && (
          <div className="shrink-0 mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pencil className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px] font-bold text-emerald-700">
                  WhatsApp para{" "}
                  <span className="font-black">
                    {grupoEditandoWsp.razonSocial}
                  </span>
                </span>
              </div>
              <button
                onClick={cerrarEditorWsp}
                className="text-emerald-300 hover:text-emerald-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <MessageCircle className="w-3 h-3" />
              <span>
                Para:{" "}
                <span className="font-semibold text-emerald-700">
                  {grupoEditandoWsp.whatsapp}
                </span>
              </span>
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
                Mensaje{" "}
                <span className="font-normal text-emerald-300 normal-case">
                  (editable)
                </span>
              </label>
              <textarea
                value={mensajeEditWsp}
                onChange={(e) => setMensajeEditWsp(e.target.value)}
                rows={9}
                className="w-full px-2 py-1.5 text-xs border border-emerald-200 rounded-lg bg-white outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-emerald-100 resize-y leading-relaxed text-gray-700"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarEditorWsp}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <Button
                onClick={confirmarEnvioWsp}
                disabled={enviandoEditWsp || !mensajeEditWsp.trim()}
                className="py-1 px-3 text-xs rounded-lg h-auto bg-emerald-600 hover:bg-emerald-700"
              >
                {enviandoEditWsp ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" /> Enviar WSP
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Cuerpo scrollable ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col px-4 py-3 gap-2 min-h-0">
          {gruposParaNotificar.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                ¡Todo al día!
              </p>
              <p className="text-xs text-gray-400">
                Ningún cliente vence en los próximos{" "}
                <span className="font-semibold">{diasAviso} días</span>.
              </p>
            </div>
          ) : (
            <>
              {/* Resumen canales — compacto en fila */}
              <div className="flex gap-2 shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg flex-1">
                  <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-600">
                    Con correo
                  </span>
                  <span className="text-sm font-black text-blue-800 ml-auto">
                    {conCorreo.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg flex-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-600">
                    Con WhatsApp
                  </span>
                  <span className="text-sm font-black text-emerald-800 ml-auto">
                    {conWsp.length}
                  </span>
                </div>
              </div>

              {/* Buscador */}
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, RUC/DNI o placa…"
                  className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-blue-100 bg-white placeholder:text-gray-400"
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Select-all bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg shrink-0">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                  disabled={conCorreoFiltrado.length === 0}
                  className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                />
                <span className="text-[11px] font-semibold text-gray-600 flex-1">
                  {selConCorreo.length > 0
                    ? `${selConCorreo.length} seleccionado${selConCorreo.length !== 1 ? "s" : ""} para email masivo`
                    : "Seleccionar todos para envío masivo"}
                </span>
                <Clock className="w-3.5 h-3.5 text-gray-300" />
                <span className="text-[10px] text-gray-400">
                  {q
                    ? `${gruposFiltrados.length} de ${gruposParaNotificar.length}`
                    : gruposParaNotificar.length}{" "}
                  cliente{gruposParaNotificar.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Lista — ocupa todo el espacio restante */}
              <div className="flex-1 overflow-y-auto custom-scrollbar rounded-xl border border-gray-200 divide-y divide-gray-100 min-h-0">
                {gruposFiltrados.length === 0 && q ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Search className="w-6 h-6 text-gray-300" />
                    <p className="text-sm text-gray-400">
                      Sin resultados para{" "}
                      <span className="font-semibold text-gray-500">
                        &ldquo;{busqueda}&rdquo;
                      </span>
                    </p>
                    <button
                      onClick={() => setBusqueda("")}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                ) : (
                  gruposFiltrados.map((grupo) => {
                    const fechafin = getFirstFechaFin(grupo);
                    const dias = getDiasRestantes(fechafin);
                    const info = getDiasInfo(dias);
                    const cfg = PERIODO_CFG[grupo.periodoTipo];
                    const eEmail = estadoEmail[grupo.key] ?? "pendiente";
                    const eWsp = estadoWsp[grupo.key] ?? "pendiente";
                    const tieneEmail = !!grupo.correo?.trim();
                    const tieneWsp = !!grupo.whatsapp?.trim();
                    const isSel = seleccionados.has(grupo.key);
                    const isEditing = grupoEditando?.key === grupo.key;
                    const itemsProximos = getItemsProximosAVencer(grupo);
                    const totalProximos = itemsProximos.reduce(
                      (s, i) => s + (i.importe || 0),
                      0,
                    );
                    const simbolo = grupo.moneda === "USD" ? "$" : "S/";

                    return (
                      <div
                        key={grupo.key}
                        className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                          isEditing
                            ? "bg-blue-50/70"
                            : dias < 0
                              ? "bg-red-50/40"
                              : "bg-white hover:bg-gray-50/60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(grupo.key)}
                          disabled={!tieneEmail}
                          className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-25 shrink-0"
                        />
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${cfg?.dotClass ?? "bg-gray-300"}`}
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold ring-1 ring-inset ${
                                grupo.tipoDoc === "B"
                                  ? "bg-blue-50 text-blue-600 ring-blue-200"
                                  : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                              }`}
                            >
                              {grupo.tipoDoc === "B" ? (
                                <User className="w-2.5 h-2.5" />
                              ) : (
                                <Building2 className="w-2.5 h-2.5" />
                              )}
                              {grupo.tipoDoc}
                            </span>
                            <p className="text-[11px] font-semibold text-gray-800 truncate">
                              {grupo.razonSocial}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg?.badgeClass ?? "bg-gray-100 text-gray-500"}`}
                            >
                              {cfg?.label ?? grupo.periodoTipo}
                            </span>
                          </div>

                          {itemsProximos.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {itemsProximos.map((item) => {
                                const infoItem = getDiasInfo(
                                  getDiasRestantes(item.fechafin),
                                );
                                return (
                                  <span
                                    key={item.id}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold"
                                    title={`Vence ${item.fechafin} · ${simbolo} ${item.importe.toFixed(2)}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${infoItem.dot}`}
                                    />
                                    {item.placa || "—"}
                                    <span className="text-gray-400 font-normal">
                                      {simbolo}
                                      {item.importe.toFixed(2)}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${info.chip}`}
                            >
                              {info.label}
                            </span>
                            <span className="text-[10px] text-gray-500 tabular-nums font-semibold">
                              {simbolo} {totalProximos.toFixed(2)}
                              {itemsProximos.length !== grupo.items.length && (
                                <span className="text-gray-400 font-normal ml-0.5">
                                  ({itemsProximos.length}/{grupo.items.length}{" "}
                                  placas)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Botones acción */}
                        <div className="flex items-center gap-1 shrink-0">
                          {tieneEmail ? (
                            <button
                              onClick={() => {
                                if (eEmail === "enviando") return;
                                abrirEditor(grupo);
                              }}
                              disabled={eEmail === "enviando"}
                              title={
                                eEmail === "enviado"
                                  ? `Enviado — clic para reenviar`
                                  : eEmail === "error"
                                    ? "Error — reintentar"
                                    : `Editar y enviar a ${grupo.correo}`
                              }
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                                eEmail === "enviado"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                  : eEmail === "enviando"
                                    ? "bg-blue-50 text-blue-400 border-blue-100 cursor-wait"
                                    : eEmail === "error"
                                      ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                                      : isEditing
                                        ? "bg-blue-100 text-blue-600 border-blue-300"
                                        : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                              }`}
                            >
                              {eEmail === "enviando" ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : eEmail === "enviado" ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : eEmail === "error" ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <Pencil className="w-3 h-3" />
                              )}
                              {eEmail === "enviado"
                                ? "Enviado"
                                : eEmail === "error"
                                  ? "Error"
                                  : "Email"}
                            </button>
                          ) : (
                            <span className="px-2 py-1 rounded-lg text-[10px] text-gray-300 border border-gray-100 select-none cursor-not-allowed">
                              Sin correo
                            </span>
                          )}

                          {tieneWsp ? (
                            <button
                              onClick={() => {
                                if (eWsp === "enviando") return;
                                abrirEditorWsp(grupo);
                              }}
                              disabled={eWsp === "enviando"}
                              title={
                                eWsp === "enviado"
                                  ? "Enviado — clic para reenviar"
                                  : eWsp === "error"
                                    ? "Error — reintentar"
                                    : `Editar y enviar WhatsApp a ${grupo.whatsapp}`
                              }
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                                eWsp === "enviado"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                  : eWsp === "enviando"
                                    ? "bg-emerald-50 text-emerald-400 border-emerald-100 cursor-wait"
                                    : eWsp === "error"
                                      ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                                      : grupoEditandoWsp?.key === grupo.key
                                        ? "bg-emerald-100 text-emerald-600 border-emerald-300"
                                        : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                            >
                              {eWsp === "enviando" ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : eWsp === "enviado" ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : eWsp === "error" ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <Pencil className="w-3 h-3" />
                              )}
                              {eWsp === "enviado"
                                ? "Enviado"
                                : eWsp === "error"
                                  ? "Error"
                                  : eWsp === "enviando"
                                    ? "…"
                                    : "WSP"}
                            </button>
                          ) : (
                            <span className="px-2 py-1 rounded-lg text-[10px] text-gray-300 border border-gray-100 select-none cursor-not-allowed">
                              Sin WSP
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Progreso envío masivo */}
              {enviandoBulk && progresoBulk && (
                <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Enviando {progresoBulk.actual} de {progresoBulk.total}…
                    </span>
                    <span className="text-xs font-bold text-blue-600 tabular-nums">
                      {Math.round(
                        (progresoBulk.actual / progresoBulk.total) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${(progresoBulk.actual / progresoBulk.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Footer envío masivo */}
              <div className="flex items-center justify-between gap-3 py-2 border-t border-gray-100 shrink-0">
                <p className="text-[11px] text-gray-500">
                  {selConCorreo.length > 0 ? (
                    <>
                      <span className="font-semibold text-gray-700">
                        {selConCorreo.length}
                      </span>{" "}
                      email{selConCorreo.length !== 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-gray-700">
                        {conWspFiltrado.length}
                      </span>{" "}
                      WSP listos
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-gray-700">
                        {conWspFiltrado.length}
                      </span>{" "}
                      WSP listos
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => enviarTodosWsp(conWspFiltrado)}
                    disabled={conWspFiltrado.length === 0 || enviandoBulk}
                    className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                  >
                    {enviandoBulk ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Enviando…
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" /> Enviar{" "}
                        {conWspFiltrado.length > 0 ? conWspFiltrado.length : ""}{" "}
                        WSP
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => enviarTodosEmail(selConCorreo)}
                    disabled={selConCorreo.length === 0 || enviandoBulk}
                  >
                    {enviandoBulk ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Enviando…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Enviar{" "}
                        {selConCorreo.length > 0 ? selConCorreo.length : ""}{" "}
                        email{selConCorreo.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
