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
} from "lucide-react";
import { Modal }   from "@/app/components/ui/Modal";
import { Button }  from "@/app/components/ui/Button";
import type { GrupoData, FilaCarga } from "./types";
import type { EstadoEnvio } from "./useNotificaciones";
import { PERIODO_CFG } from "./constants";

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  isOpen:               boolean;
  onClose:              () => void;
  diasAviso:            number;
  diasAvisoCargado:     boolean;
  setDiasAviso:         (n: number) => void;
  gruposParaNotificar:  GrupoData[];
  estadoEmail:          Record<string, EstadoEnvio>;
  estadoWsp:            Record<string, EstadoEnvio>;
  enviandoBulk:         boolean;
  progresoBulk:         { actual: number; total: number } | null;
  getDiasRestantes:           (fechafin: string) => number;
  getFirstFechaFin:           (g: GrupoData) => string;
  getItemsProximosAVencer:    (g: GrupoData) => FilaCarga[];
  buildMensajeGrupo:    (g: GrupoData) => string;
  SUBJECT_DEFAULT:      string;
  enviarEmail:          (g: GrupoData, subject: string, mensaje: string) => Promise<boolean>;
  enviarWhatsApp:       (g: GrupoData) => Promise<void>;
  enviarTodosEmail:     (lista: GrupoData[]) => Promise<{ ok: number; err: number }>;
};

// ─── Helper visual días ───────────────────────────────────────────────────────
const getDiasInfo = (dias: number) => {
  if (dias < 0)   return { label: `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}`, chip: "bg-red-100 text-red-600",    dot: "bg-red-400"   };
  if (dias === 0) return { label: "Vence hoy",                                                             chip: "bg-red-100 text-red-600",    dot: "bg-red-400"   };
  if (dias <= 3)  return { label: `Vence en ${dias} día${dias !== 1 ? "s" : ""}`,                         chip: "bg-red-50 text-red-500",     dot: "bg-red-300"   };
  if (dias <= 7)  return { label: `Vence en ${dias} días`,                                                 chip: "bg-amber-100 text-amber-600",dot: "bg-amber-400" };
  return           { label: `Vence en ${dias} días`,                                                       chip: "bg-blue-100 text-blue-600",  dot: "bg-blue-400"  };
};

// ─── Componente ───────────────────────────────────────────────────────────────
export function ModalNotificaciones({
  isOpen, onClose,
  diasAviso, diasAvisoCargado, setDiasAviso,
  gruposParaNotificar,
  estadoEmail, estadoWsp,
  enviandoBulk, progresoBulk,
  getDiasRestantes, getFirstFechaFin, getItemsProximosAVencer,
  buildMensajeGrupo, SUBJECT_DEFAULT,
  enviarEmail, enviarWhatsApp, enviarTodosEmail,
}: Props) {
  const [diasInput,     setDiasInput]     = useState(String(diasAviso));
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // ── Editor individual ──────────────────────────────────────────────────────
  const [grupoEditando, setGrupoEditando] = useState<GrupoData | null>(null);
  const [subjectEdit,   setSubjectEdit]   = useState("");
  const [mensajeEdit,   setMensajeEdit]   = useState("");
  const [enviandoEdit,  setEnviandoEdit]  = useState(false);

  // Reinicializar al abrir
  useEffect(() => {
    if (!isOpen) return;
    setDiasInput(String(diasAviso));
    setSeleccionados(
      new Set(gruposParaNotificar.filter((g) => g.correo?.trim()).map((g) => g.key)),
    );
    setGrupoEditando(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abrir editor para un grupo
  const abrirEditor = (g: GrupoData) => {
    setSubjectEdit(SUBJECT_DEFAULT);
    setMensajeEdit(buildMensajeGrupo(g));
    setGrupoEditando(g);
  };

  const cerrarEditor = () => setGrupoEditando(null);

  const confirmarEnvio = async () => {
    if (!grupoEditando) return;
    setEnviandoEdit(true);
    await enviarEmail(grupoEditando, subjectEdit, mensajeEdit);
    setEnviandoEdit(false);
    setGrupoEditando(null);
  };

  // ── Selección ──────────────────────────────────────────────────────────────
  const toggle = (key: string) =>
    setSeleccionados((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const conCorreo          = gruposParaNotificar.filter((g) => g.correo?.trim());
  const conWsp             = gruposParaNotificar.filter((g) => g.whatsapp?.trim());
  const selConCorreo       = conCorreo.filter((g) => seleccionados.has(g.key));
  const todosSeleccionados = conCorreo.length > 0 && selConCorreo.length === conCorreo.length;

  const toggleTodos = () =>
    setSeleccionados(todosSeleccionados ? new Set() : new Set(conCorreo.map((g) => g.key)));

  const vencidos  = gruposParaNotificar.filter((g) => getDiasRestantes(getFirstFechaFin(g)) < 0).length;
  const porVencer = gruposParaNotificar.length - vencidos;

  const handleEnviarTodos = () => enviarTodosEmail(selConCorreo);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notificaciones de pago previo">
      <div className="space-y-4">

        {/* ── Config días ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <Settings className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 whitespace-nowrap">Avisar</span>
          {!diasAvisoCargado ? (
            <div className="w-14 h-7 flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-gray-300 animate-spin" />
            </div>
          ) : (
            <input
              type="number" min={1} max={365}
              value={diasInput}
              onChange={(e) => setDiasInput(e.target.value)}
              onBlur={() => {
                const n = Number(diasInput);
                if (n > 0) setDiasAviso(n);
                else setDiasInput(String(diasAviso));
              }}
              className="w-14 px-2 py-1 text-xs font-bold text-center border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          )}
          <span className="text-xs text-gray-500 flex-1 whitespace-nowrap">días antes del vencimiento</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {vencidos > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                {vencidos} vencido{vencidos !== 1 ? "s" : ""}
              </span>
            )}
            {porVencer > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600">
                {porVencer} por vencer
              </span>
            )}
          </div>
        </div>

        {/* ── Editor inline de mensaje individual ─────────────────────────── */}
        {grupoEditando && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            {/* Cabecera editor */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-bold text-blue-700">
                  Editando email para{" "}
                  <span className="font-black">{grupoEditando.razonSocial}</span>
                </span>
              </div>
              <button
                onClick={cerrarEditor}
                className="text-blue-300 hover:text-blue-600 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Destinatario */}
            <div className="flex items-center gap-1.5 text-[11px] text-blue-500">
              <Mail className="w-3 h-3" />
              <span className="font-medium">Para:</span>
              <span className="font-semibold text-blue-700">{grupoEditando.correo}</span>
            </div>

            {/* Asunto */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                Asunto
              </label>
              <input
                type="text"
                value={subjectEdit}
                onChange={(e) => setSubjectEdit(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-blue-200 rounded-lg bg-white outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Mensaje */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1">
                Mensaje
                <span className="font-normal text-blue-300 normal-case">(editable)</span>
              </label>
              <textarea
                value={mensajeEdit}
                onChange={(e) => setMensajeEdit(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-xs border border-blue-200 rounded-lg bg-white outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100 resize-none leading-relaxed text-gray-700"
              />
            </div>

            {/* Acciones editor */}
            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarEditor}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <Button
                onClick={confirmarEnvio}
                disabled={enviandoEdit || !subjectEdit.trim() || !mensajeEdit.trim()}
                className="py-1.5 px-3 text-xs rounded-lg h-auto"
              >
                {enviandoEdit ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Enviando…</>
                ) : (
                  <><Send className="w-3 h-3" /> Enviar</>
                )}
              </Button>
            </div>
          </div>
        )}

        {gruposParaNotificar.length === 0 ? (

          /* ── Estado vacío ──────────────────────────────────────────────── */
          <div className="py-14 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">¡Todo al día!</p>
            <p className="text-xs text-gray-400">
              Ningún cliente vence en los próximos <span className="font-semibold">{diasAviso} días</span>.
            </p>
          </div>

        ) : (
          <>
            {/* ── Resumen canales ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] text-blue-400 font-medium leading-none">Con correo</p>
                  <p className="text-sm font-black text-blue-700 leading-tight">
                    {conCorreo.length}
                    <span className="text-[11px] font-semibold ml-0.5">cliente{conCorreo.length !== 1 ? "s" : ""}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-400 font-medium leading-none">Con WhatsApp</p>
                  <p className="text-sm font-black text-emerald-700 leading-tight">
                    {conWsp.length}
                    <span className="text-[11px] font-semibold ml-0.5">cliente{conWsp.length !== 1 ? "s" : ""}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ── Cabecera tabla + select-all ───────────────────────────── */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <input
                type="checkbox"
                checked={todosSeleccionados}
                onChange={toggleTodos}
                disabled={conCorreo.length === 0}
                className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
              />
              <span className="text-[11px] font-semibold text-gray-600 flex-1">
                {selConCorreo.length > 0
                  ? `${selConCorreo.length} seleccionado${selConCorreo.length !== 1 ? "s" : ""} para email masivo`
                  : "Seleccionar para envío masivo de email"}
              </span>
              <Clock className="w-3.5 h-3.5 text-gray-300" />
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {gruposParaNotificar.length} cliente{gruposParaNotificar.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* ── Lista ────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 max-h-85 overflow-y-auto">
              {gruposParaNotificar.map((grupo) => {
                const fechafin      = getFirstFechaFin(grupo);
                const dias          = getDiasRestantes(fechafin);
                const info          = getDiasInfo(dias);
                const cfg           = PERIODO_CFG[grupo.periodoTipo];
                const eEmail        = estadoEmail[grupo.key] ?? "pendiente";
                const eWsp          = estadoWsp[grupo.key]   ?? "pendiente";
                const tieneEmail    = !!grupo.correo?.trim();
                const tieneWsp      = !!grupo.whatsapp?.trim();
                const isSel         = seleccionados.has(grupo.key);
                const isEditing     = grupoEditando?.key === grupo.key;
                const itemsProximos = getItemsProximosAVencer(grupo);
                const totalProximos = itemsProximos.reduce((s, i) => s + (i.importe || 0), 0);
                const simbolo       = grupo.moneda === "USD" ? "$" : "S/";

                return (
                  <div
                    key={grupo.key}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      isEditing   ? "bg-blue-50/70"
                      : dias < 0  ? "bg-red-50/50"
                      : "bg-white hover:bg-gray-50/60"
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(grupo.key)}
                      disabled={!tieneEmail}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
                    />

                    {/* Dot período */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg?.dotClass ?? "bg-gray-300"}`} />

                    {/* Info cliente */}
                    <div className="flex-1 min-w-0">
                      {/* Fila 1: tipo doc + razón social + periodo */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold ring-1 ring-inset ${
                          grupo.tipoDoc === "B"
                            ? "bg-blue-50 text-blue-600 ring-blue-200"
                            : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                        }`}>
                          {grupo.tipoDoc === "B" ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                          {grupo.tipoDoc}
                        </span>
                        <p className="text-[11px] font-semibold text-gray-800 truncate">{grupo.razonSocial}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg?.badgeClass ?? "bg-gray-100 text-gray-500"}`}>
                          {cfg?.label ?? grupo.periodoTipo}
                        </span>
                      </div>

                      {/* Fila 2: placas que vencen */}
                      {itemsProximos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {itemsProximos.map((item) => {
                            const dItem = getDiasRestantes(item.fechafin);
                            const infoItem = getDiasInfo(dItem);
                            return (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold"
                                title={`Vence ${item.fechafin} · ${simbolo} ${item.importe.toFixed(2)}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${infoItem.dot}`} />
                                {item.placa || "—"}
                                <span className="text-gray-400 font-normal">{simbolo}{item.importe.toFixed(2)}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Fila 3: días restantes + total de placas próximas */}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${info.chip}`}>
                          {info.label}
                        </span>
                        <span className="text-[10px] text-gray-500 tabular-nums font-semibold">
                          {simbolo} {totalProximos.toFixed(2)}
                          {itemsProximos.length !== grupo.items.length && (
                            <span className="text-gray-400 font-normal ml-0.5">
                              ({itemsProximos.length}/{grupo.items.length} placas)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Botones acción */}
                    <div className="flex items-center gap-1 shrink-0">

                      {/* Email — abre editor en vez de enviar directo */}
                      {tieneEmail ? (
                        <button
                          onClick={() => {
                            if (eEmail === "enviando") return;
                            abrirEditor(grupo);
                          }}
                          disabled={eEmail === "enviando"}
                          title={
                            eEmail === "enviado"  ? `Enviado a ${grupo.correo} — clic para reenviar`
                            : eEmail === "error"  ? "Error — clic para editar y reintentar"
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
                          {eEmail === "enviando"
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : eEmail === "enviado"
                              ? <CheckCircle2 className="w-3 h-3" />
                              : eEmail === "error"
                                ? <AlertCircle className="w-3 h-3" />
                                : <Pencil className="w-3 h-3" />
                          }
                          {eEmail === "enviado" ? "Enviado" : eEmail === "error" ? "Error" : "Email"}
                        </button>
                      ) : (
                        <span
                          title="Sin correo registrado"
                          className="px-2 py-1 rounded-lg text-[10px] text-gray-300 border border-gray-100 select-none cursor-not-allowed"
                        >
                          Sin correo
                        </span>
                      )}

                      {/* WhatsApp */}
                      {tieneWsp ? (
                        <button
                          onClick={() => { if (eWsp === "enviando") return; enviarWhatsApp(grupo); }}
                          disabled={eWsp === "enviando"}
                          title={
                            eWsp === "enviado"  ? `Enviado a ${grupo.whatsapp} — clic para reenviar`
                            : eWsp === "error"  ? "Error — clic para reintentar"
                            : eWsp === "enviando" ? "Enviando…"
                            : `Enviar WhatsApp a ${grupo.whatsapp}`
                          }
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                            eWsp === "enviado"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                              : eWsp === "enviando"
                                ? "bg-emerald-50 text-emerald-400 border-emerald-100 cursor-wait"
                                : eWsp === "error"
                                  ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                                  : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {eWsp === "enviando"
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : eWsp === "enviado"
                              ? <CheckCircle2 className="w-3 h-3" />
                              : eWsp === "error"
                                ? <AlertCircle className="w-3 h-3" />
                                : <MessageCircle className="w-3 h-3" />
                          }
                          {eWsp === "enviado" ? "Enviado" : eWsp === "error" ? "Error" : eWsp === "enviando" ? "…" : "WSP"}
                        </button>
                      ) : (
                        <span
                          title="Sin WhatsApp registrado"
                          className="px-2 py-1 rounded-lg text-[10px] text-gray-300 border border-gray-100 select-none cursor-not-allowed"
                        >
                          Sin WSP
                        </span>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Progreso envío masivo ─────────────────────────────────── */}
            {enviandoBulk && progresoBulk && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Enviando email {progresoBulk.actual} de {progresoBulk.total}…
                  </span>
                  <span className="text-xs font-bold text-blue-600 tabular-nums">
                    {Math.round((progresoBulk.actual / progresoBulk.total) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(progresoBulk.actual / progresoBulk.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* ── Footer acciones masivas ───────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">
                {selConCorreo.length > 0
                  ? <><span className="font-semibold text-gray-600">{selConCorreo.length}</span> email{selConCorreo.length !== 1 ? "s" : ""} listos para enviar</>
                  : "Selecciona clientes para el envío masivo de emails"}
              </p>
              <Button
                type="button"
                onClick={handleEnviarTodos}
                disabled={selConCorreo.length === 0 || enviandoBulk}
              >
                {enviandoBulk
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando…</>
                  : <><Send className="w-4 h-4" /> Enviar {selConCorreo.length > 0 ? selConCorreo.length : ""} email{selConCorreo.length !== 1 ? "s" : ""}</>
                }
              </Button>
            </div>

          </>
        )}

      </div>
    </Modal>
  );
}
