"use client";

import React, { useRef, useState, useMemo } from "react";
import {
  FileSpreadsheet,
  RefreshCw,
  Send,
  Upload,
  Download,
  Calendar,
  Bell,
  ChevronDown,
  AlertCircle,
  User,
  Building2,
  Settings2,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  Search,
} from "lucide-react";
import { Button }  from "@/app/components/ui/Button";
import { Card }    from "@/app/components/ui/Card";
import { Modal }   from "@/app/components/ui/Modal";

import { useCargaComprobantes }  from "./useCargaComprobantes";
import { useNotificaciones }     from "./useNotificaciones";
import { GrupoCard }             from "./GrupoCard";
import { ModalAgregarFila }      from "./ModalAgregarFila";
import { ModalNotificaciones }   from "./ModalNotificaciones";
import { PERIODO_ORDER, PERIODO_CFG, columnas } from "./constants";
import { getTipoDoc, periodoTexto, formatFechaEs } from "./helpers";
import type { FilaCarga } from "./types";

// Etiquetas legibles para cada campo con posible error
const CAMPO_LABEL: Partial<Record<keyof FilaCarga, string>> = {
  numdoc:      "Documento",
  razonSocial: "Razón social",
  importe:     "Importe",
  igv:         "IGV",
  placa:       "Placa",
  fechaini:    "Fecha inicio",
  fechafin:    "Fecha fin",
};

export default function CargaComprobantesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [opcionId,  setOpcionId]  = useState<string | null>(null);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0 });
  const [modalAgregarOpen,         setModalAgregarOpen]         = useState(false);
  const [modalConfirmarOpen,       setModalConfirmarOpen]       = useState(false);
  const [modalDeshabilitadosOpen,  setModalDeshabilitadosOpen]  = useState(false);
  const [modalNotificacionesOpen,  setModalNotificacionesOpen]  = useState(false);
  const [fechasRehab, setFechasRehab] = useState<Record<string, string>>({});


  // tooltip de errores (fixed, escapa el overflow de la tabla)
  const [errorTipId,  setErrorTipId]  = useState<string | null>(null);
  const [errorTipPos, setErrorTipPos] = useState({ top: 0, left: 0 });
  const mostrarErrorTip = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const left = Math.min(r.right + 8, window.innerWidth - 232);
    setErrorTipPos({ top: r.top - 6, left });
    setErrorTipId(id);
  };

  // tooltip de advertencias
  const [warnTipId,  setWarnTipId]  = useState<string | null>(null);
  const [warnTipPos, setWarnTipPos] = useState({ top: 0, left: 0 });
  const mostrarWarnTip = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const left = Math.min(r.right + 8, window.innerWidth - 232);
    setWarnTipPos({ top: r.top - 6, left });
    setWarnTipId(id);
  };

  const abrirOpciones = (id: string, btn: HTMLButtonElement) => {
    if (opcionId === id) { setOpcionId(null); return; }
    const r    = btn.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - 216);
    setDropPos({ top: r.bottom + 6, left });
    setOpcionId(id);
  };

  const {
    filas, filasDeshabilitadas, filasFiltradas, gruposFiltrados, grupos, periodosPresentes,
    stats, statsPorPeriodo, erroresPorFila, advertenciasPorFila,
    cargandoPlantilla, cargarDesdeApi,
    tabActiva, setTabActiva, fechaEmision, setFechaEmision,
    periodosExpandidos, loadingRazonSocialIds, emitiendo,
    modalPlantillaOpen,    setModalPlantillaOpen,
    modalResultadoOpen,    setModalResultadoOpen,
    erroresCarga,
    modalErroresCargaOpen, setModalErroresCargaOpen,
    resultadoEmision, progresoEmision, advertenciaTemprana: advertenciaTempranaBruta,
    accessToken, esUsuarioVelsat, sucursal, empresa,
    cargarExcel, descargarPlantilla, actualizarFila,
    agregarFila, deshabilitarFila, habilitarFila, ajustarFechasInicioMes,
    emitir, recuperarDatos, togglePeriodo,
  } = useCargaComprobantes();

  // ── Notificaciones de vencimiento ─────────────────────────────────────────
  const {
    diasAviso, diasAvisoCargado, setDiasAviso,
    gruposParaNotificar,
    estadoEmail, estadoWsp,
    enviandoBulk, progresoBulk,
    getDiasRestantes, getFirstFechaFin,
    buildMensajeGrupo, SUBJECT_DEFAULT,
    enviarEmail, abrirWhatsApp, enviarTodosEmail,
  } = useNotificaciones(grupos, accessToken);

  const nErrores = filasFiltradas.filter((f) => erroresPorFila.has(f.id)).length;
  const hayFilas = filas.length > 0;

  // Primer día del mes actual (default para rehabilitar)
  const primerDiaMes = (() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const abrirModalDeshabilitados = () => {
    const defaults: Record<string, string> = {};
    filasDeshabilitadas.forEach((f) => { defaults[f.id] = primerDiaMes; });
    setFechasRehab(defaults);
    setModalDeshabilitadosOpen(true);
  };

  // ── Selección de grupos para emisión parcial ──────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const toggleSelected = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedKeys((prev) =>
      prev.size === gruposFiltrados.length
        ? new Set()
        : new Set(gruposFiltrados.map((g) => g.key)),
    );

  // Limpiar selección al cambiar de tab
  React.useEffect(() => { setSelectedKeys(new Set()); }, [tabActiva]);

  // Limpiar selección cuando termina la emisión (emitiendo pasa de true → false)
  const prevEmitiendo = React.useRef(false);
  React.useEffect(() => {
    if (prevEmitiendo.current && !emitiendo) {
      setSelectedKeys(new Set());
    }
    prevEmitiendo.current = emitiendo;
  }, [emitiendo]);

  // Cuando hay selección explícita, recalcular la advertencia solo para los grupos seleccionados
  const advertenciaTemprana = useMemo(() => {
    if (selectedKeys.size === 0) return advertenciaTempranaBruta;
    // Calcular sobre los grupos seleccionados
    const gruposSelec = gruposFiltrados.filter((g) => selectedKeys.has(g.key));
    const fechas = gruposSelec.flatMap((g) => g.items.map((i) => i.fechafin)).filter(Boolean);
    if (!fechas.length) return null;
    const fechaFinMin = [...fechas].sort()[0];
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const fin = fechaFinMin ? new Date(`${fechaFinMin}T00:00:00`) : null;
    if (!fin) return null;
    const diasHasta = Math.floor((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diasHasta <= 7) return null;
    const cfg = PERIODO_CFG[tabActiva];
    return { diasHasta, fechaFinMin, periodoLabel: cfg?.label ?? tabActiva };
  }, [selectedKeys, gruposFiltrados, advertenciaTempranaBruta, tabActiva]);

  // ── Búsqueda dentro de la tabla ───────────────────────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const filasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filasFiltradas;
    return filasFiltradas.filter(
      (f) =>
        f.numdoc.toLowerCase().includes(q) ||
        f.razonSocial.toLowerCase().includes(q) ||
        f.placa.toLowerCase().includes(q),
    );
  }, [filasFiltradas, busqueda]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!esUsuarioVelsat) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Acceso restringido</p>
            <p className="text-xs text-gray-400 mt-0.5">Sección disponible solo para el usuario Velsat.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">

        {/* Izquierda: stats */}
        {hayFilas && (
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Placas",       value: String(stats.filas) },
              { label: "Comprobantes", value: String(stats.comprobantes) },
              { label: "Total",        value: `S/ ${stats.total.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-100 border border-gray-200 rounded-lg shadow-sm">
                <span className="text-[11px] text-gray-600 font-medium">{label}:</span>
                <span className="text-[13px] font-bold text-gray-800 tabular-nums">{value}</span>
              </div>
            ))}
            {nErrores === 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Listo para emitir
              </span>
            )}
          </div>
        )}

        {/* Derecha: controles + emitir */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">

          {/* Fila de botones secundarios */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Fecha de emisión */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500 whitespace-nowrap">Emisión:</span>
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="outline-none text-gray-900 font-semibold bg-transparent cursor-pointer text-xs"
              />
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) cargarExcel(f); e.currentTarget.value = ""; }}
            />
            {/* Notificaciones */}
            <button
              onClick={() => setModalNotificacionesOpen(true)}
              title="Notificaciones de vencimiento de servicio"
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                gruposParaNotificar.length > 0
                  ? "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
                  : "border-gray-200 bg-white hover:border-gray-300 text-gray-500 hover:text-gray-700"
              }`}
            >
              <Bell className={`w-3.5 h-3.5 ${gruposParaNotificar.length > 0 ? "text-amber-500" : ""}`} />
              {gruposParaNotificar.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black">
                  {gruposParaNotificar.length}
                </span>
              )}
              <span className="hidden sm:inline">Avisos</span>
            </button>
            {filasDeshabilitadas.length > 0 && (
              <button
                onClick={abrirModalDeshabilitados}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50 text-xs font-semibold text-gray-500 hover:text-amber-700 transition-all shadow-sm"
              >
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-[10px] font-black">{filasDeshabilitadas.length}</span>
                <span className="hidden sm:inline">Deshabilitados</span>
              </button>
            )}
            <Button variant="outline" onClick={() => setModalPlantillaOpen(true)}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Cargar Excel</span>
            </Button>
            <Button variant="outline" onClick={() => setModalAgregarOpen(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Agregar ítem</span>
            </Button>
          </div>

          {/* Botón Emitir — full width en móvil, auto en desktop */}
          {(() => {
            const nEmitir = selectedKeys.size > 0 ? selectedKeys.size : gruposFiltrados.length;
            return (
              <Button
                className="w-full sm:w-auto"
                onClick={() => setModalConfirmarOpen(true)}
                disabled={emitiendo || tabActiva === "todos" || gruposFiltrados.length === 0 || !sucursal || !empresa}
              >
                {emitiendo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="truncate">
                  {emitiendo
                    ? "Emitiendo…"
                    : tabActiva === "todos" && hayFilas
                      ? "Selecciona un período"
                      : nEmitir > 0
                        ? `Emitir ${nEmitir} comprobante${nEmitir !== 1 ? "s" : ""}${selectedKeys.size > 0 ? " ✓" : ""}`
                        : "Emitir"}
                </span>
              </Button>
            );
          })()}
        </div>
      </div>

      {/* ── Tabs de período ──────────────────────────────────────────────── */}
      {hayFilas && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setTabActiva("todos")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              tabActiva === "todos"
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Todos
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tabActiva === "todos" ? "bg-white/15" : "bg-gray-100 text-gray-500"
            }`}>
              {filas.length}
            </span>
          </button>
          {periodosPresentes.length > 0 && <span className="w-px h-4 bg-gray-200 mx-0.5" />}
          {periodosPresentes.map((p) => {
            const cfg    = PERIODO_CFG[p];
            const s      = statsPorPeriodo[p];
            const activo = tabActiva === p;
            return (
              <button key={p} onClick={() => setTabActiva(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  activo ? cfg.activeClass : cfg.idleClass
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-white/70" : cfg.dotClass}`} />
                {cfg.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activo ? "bg-white/20 text-white" : cfg.badgeClass
                }`}>{s.filas}</span>
              </button>
            );
          })}
        </div>
      )}


      {/* ── Banner de notificaciones de vencimiento ──────────────────────── */}
      {gruposParaNotificar.length > 0 && (
        <div className="flex items-center gap-3 pl-4 pr-3 py-3 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-xl">
          <Bell className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-800">
              {gruposParaNotificar.filter((g) => getDiasRestantes(getFirstFechaFin(g)) < 0).length > 0
                ? `${gruposParaNotificar.filter((g) => getDiasRestantes(getFirstFechaFin(g)) < 0).length} vencido${gruposParaNotificar.filter((g) => getDiasRestantes(getFirstFechaFin(g)) < 0).length !== 1 ? "s" : ""} · `
                : ""}
              {gruposParaNotificar.length} cliente{gruposParaNotificar.length !== 1 ? "s" : ""} próximo{gruposParaNotificar.length !== 1 ? "s" : ""} a vencer
            </p>
            <p className="text-[11px] text-amber-600/80 mt-0.5 truncate">
              Envía recordatorios por email o WhatsApp antes de que venzan.
            </p>
          </div>
          <button
            onClick={() => setModalNotificacionesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors shrink-0 shadow-sm"
          >
            <Bell className="w-3 h-3" />
            Ver avisos
          </button>
        </div>
      )}

      {/* ── Banner de errores ────────────────────────────────────────────── */}
      {nErrores > 0 && (
        <div className="flex items-start gap-3 pl-4 pr-5 py-3.5 bg-red-50 border border-red-100 border-l-4 border-l-red-400 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-700">
              {nErrores} fila{nErrores !== 1 ? "s" : ""} con datos incompletos
            </p>
            <p className="text-xs text-red-500/80 mt-0.5">
              Corrígelas antes de emitir. Los campos con error se marcan en rojo - pasa el cursor sobre el ícono para ver el detalle.
            </p>
          </div>
        </div>
      )}

      {/* ── Banner de advertencias ───────────────────────────────────────── */}
      {(() => {
        const nAdvert = filasFiltradas.filter((f) => advertenciasPorFila.has(f.id)).length;
        if (nAdvert === 0) return null;
        return (
          <div className="flex items-start gap-3 pl-4 pr-5 py-3.5 bg-amber-50 border border-amber-100 border-l-4 border-l-amber-400 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-amber-700">
                {nAdvert} fila{nAdvert !== 1 ? "s" : ""} con advertencia{nAdvert !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                No bloquean la emisión, pero revísalas. Las filas con advertencia se marcan en amarillo - pasa el cursor sobre el ícono para ver el detalle.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Barra de progreso de emisión ─────────────────────────────────── */}
      {emitiendo && progresoEmision && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
              <span className="text-xs font-semibold text-blue-700">
                Emitiendo{" "}
                <span className="tabular-nums font-black">{progresoEmision.actual}</span>
                {" "}de{" "}
                <span className="tabular-nums font-black">{progresoEmision.total}</span>
                {" "}comprobante{progresoEmision.total !== 1 ? "s" : ""}…
              </span>
            </div>
            <span className="text-xs font-bold text-blue-600 tabular-nums">
              {Math.round((progresoEmision.actual / progresoEmision.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(progresoEmision.actual / progresoEmision.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      {cargandoPlantilla && !hayFilas ? (

        /* Skeleton de carga inicial */
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          {/* Barra de búsqueda falsa */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/60 animate-pulse">
            <div className="h-7 flex-1 max-w-sm bg-gray-200/60 rounded-lg" />
            <div className="ml-auto h-7 w-24 bg-gray-200/60 rounded-lg" />
          </div>
          {/* Cabecera de tabla falsa */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 animate-pulse">
            {[20, 16, 72, 80, 40, "flex-1", 56, 60, 80, 80, 52, 20].map((w, i) => (
              <div
                key={i}
                className={`h-3 bg-gray-100 rounded shrink-0 ${w === "flex-1" ? "flex-1" : ""}`}
                style={w !== "flex-1" ? { width: w } : undefined}
              />
            ))}
          </div>
          {/* Filas falsas */}
          <div className="divide-y divide-gray-100 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <div className={`w-5 h-5 rounded-full shrink-0 ${i % 7 === 0 ? "bg-red-100" : "bg-gray-100"}`} />
                <div className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />
                <div className="w-18 h-6 bg-gray-100 rounded-md shrink-0" />
                <div className={`h-6 bg-gray-100 rounded-md shrink-0 ${i % 2 === 0 ? "w-20" : "w-16"}`} />
                <div className="flex-1 h-6 bg-gray-100 rounded-md min-w-0" style={{ maxWidth: "18%" }} />
                <div className={`h-6 bg-gray-100 rounded-md shrink-0 ${i % 3 === 0 ? "w-14" : "w-10"}`} />
                <div className="flex-1 h-6 bg-gray-100 rounded-md min-w-0" style={{ maxWidth: "22%" }} />
                <div className={`h-6 bg-gray-100 rounded-md shrink-0 ${i % 2 === 0 ? "w-16" : "w-14"}`} />
                <div className="w-16 h-6 bg-gray-100 rounded-md shrink-0" />
                <div className="w-22 h-6 bg-gray-100 rounded-md shrink-0" />
                <div className="w-22 h-6 bg-gray-100 rounded-md shrink-0" />
                <div className="w-14 h-6 bg-gray-100 rounded-md shrink-0" />
                <div className="w-4 h-4 bg-gray-100 rounded-md shrink-0" />
              </div>
            ))}
          </div>
          {/* Footer de carga */}
          <div className="flex items-center justify-center gap-2 py-3.5 border-t border-gray-100 bg-gray-50/40">
            <RefreshCw className="w-3.5 h-3.5 text-gray-300 animate-spin" />
            <span className="text-[12px] text-gray-300 font-medium">Cargando registros desde el servidor…</span>
          </div>
        </div>

      ) : !hayFilas ? (

        /* Pantalla de inicio */
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <div className="py-16 px-8 space-y-10">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto shadow-sm">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">¿Por dónde empezamos?</h2>
                <p className="text-[13px] text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Elige cómo quieres cargar los comprobantes que necesitas emitir.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto w-full">
              <button onClick={() => setModalPlantillaOpen(true)}
                className="group rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md p-5 text-left transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-700 transition-colors shadow-sm">
                  <Upload className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Cargar desde Excel</p>
                <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed">
                  Descarga la plantilla, llénala y súbela. Ideal para muchos clientes.
                </p>
                <p className="mt-4 text-[11px] font-semibold text-blue-600 flex items-center gap-0.5">
                  Abrir plantilla <span className="ml-0.5">→</span>
                </p>
              </button>
              <button onClick={() => setModalAgregarOpen(true)}
                className="group rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md p-5 text-left transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-700 transition-colors shadow-sm">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Agregar uno por uno</p>
                <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed">
                  Ingresa cada ítem manualmente. Perfecto para cambios rápidos.
                </p>
                <p className="mt-4 text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                  Agregar ítem <span className="ml-0.5">→</span>
                </p>
              </button>
            </div>

            {/* Recuperar datos borrados */}
            <div className="max-w-lg mx-auto w-full">
              <button
                onClick={recuperarDatos}
                disabled={cargandoPlantilla}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-200 text-[12px] text-gray-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargandoPlantilla ? "animate-spin" : ""}`} />
                ¿Borraste los datos sin querer? Recuperar registros anteriores
              </button>
            </div>
          </div>
        </div>

      ) : (

        /* Tabla editable */
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

          {/* Barra de búsqueda */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por numdoc, razón social o placa…"
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400 text-gray-800"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {busqueda.trim() && (
              <span className="text-[11px] text-gray-400 shrink-0">
                {filasVisibles.length === 0
                  ? "Sin resultados"
                  : <><span className="font-semibold text-gray-700">{filasVisibles.length}</span> de {filasFiltradas.length}</>
                }
              </span>
            )}

            {/* Botón ajuste masivo de fecha */}
            <div className="ml-auto shrink-0">
              <button
                onClick={ajustarFechasInicioMes}
                title={`Poner fechaini al 1° del mes actual en las ${filasFiltradas.length} filas visibles`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-[11px] font-semibold text-gray-600 hover:text-blue-700 transition-all"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">1° del mes</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-350px)]">
            <table className="w-full text-xs" style={{ tableLayout: "fixed", minWidth: 1100 }}>
              <colgroup>
                <col style={{ width: 28 }} />
                <col style={{ width: 24 }} />
                <col style={{ width: 98 }} />
                {columnas.map((col) => (
                  <col key={col.key} style={{ width: col.px ?? col.pct ?? "auto" }} />
                ))}
                <col style={{ width: 30 }} />
              </colgroup>

              <thead className="sticky top-0 z-10 bg-white border-b border-gray-200">
                <tr>
                  <th className="px-2 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">#</th>
                  <th className="px-1 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" title="Período" />
                  <th className="px-2 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Comprobante</th>
                  {columnas.map((col) => (
                    <th key={col.key} className="px-2 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-1 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filasVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={columnas.length + 4} className="px-6 py-12 text-center">
                      {busqueda.trim() ? (
                        <div className="space-y-1.5">
                          <Search className="w-5 h-5 text-gray-300 mx-auto" />
                          <p className="text-[12px] text-gray-400">
                            Sin resultados para <span className="font-semibold text-gray-600">"{busqueda}"</span>
                          </p>
                          <button onClick={() => setBusqueda("")} className="text-[11px] text-blue-500 hover:underline">
                            Limpiar búsqueda
                          </button>
                        </div>
                      ) : (
                        <p className="text-[12px] text-gray-400">
                          No hay ítems {PERIODO_CFG[tabActiva]?.label?.toLowerCase() ?? ""} en esta carga.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filasVisibles.map((fila, idx) => {
                    const pt            = periodoTexto(fila.periodo);
                    const cfg           = PERIODO_CFG[pt];
                    const tipo          = getTipoDoc(fila);
                    const hayError      = erroresPorFila.has(fila.id);
                    const hayAdvertencia = advertenciasPorFila.has(fila.id);
                    return (
                      <tr key={fila.id}
                        className={`group/row transition-colors ${
                          hayError
                            ? "bg-red-50/60 hover:bg-red-50"
                            : hayAdvertencia
                              ? "bg-amber-50/60 hover:bg-amber-50"
                              : "hover:bg-gray-50"
                        }`}
                      >
                        {/* # / error / advertencia */}
                        <td className="py-1.5 text-center">
                          {hayError && hayAdvertencia ? (
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                onMouseEnter={(e) => mostrarErrorTip(fila.id, e.currentTarget)}
                                onMouseLeave={() => setErrorTipId(null)}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-500 transition-colors cursor-default"
                              >
                                <AlertCircle className="w-3 h-3" />
                              </button>
                              <button
                                onMouseEnter={(e) => mostrarWarnTip(fila.id, e.currentTarget)}
                                onMouseLeave={() => setWarnTipId(null)}
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-500 transition-colors cursor-default"
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : hayError ? (
                            <button
                              onMouseEnter={(e) => mostrarErrorTip(fila.id, e.currentTarget)}
                              onMouseLeave={() => setErrorTipId(null)}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-500 transition-colors cursor-default"
                            >
                              <AlertCircle className="w-3 h-3" />
                            </button>
                          ) : hayAdvertencia ? (
                            <button
                              onMouseEnter={(e) => mostrarWarnTip(fila.id, e.currentTarget)}
                              onMouseLeave={() => setWarnTipId(null)}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-500 transition-colors cursor-default"
                            >
                              <AlertCircle className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[10px] tabular-nums">{idx + 1}</span>
                          )}
                        </td>

                        {/* Punto de período */}
                        <td className="py-1.5 text-center">
                          <span
                            title={cfg?.label ?? pt}
                            className={`inline-block w-2 h-2 rounded-full ${cfg?.dotClass ?? "bg-gray-300"}`}
                          />
                        </td>

                        {/* Comprobante: tipo (B/F) + IGV + moneda */}
                        <td className="px-1 py-1.5">
                          <button
                            title={`${tipo === "B" ? "Boleta" : "Factura"} · IGV 18% · ${fila.moneda}`}
                            onClick={(e) => abrirOpciones(fila.id, e.currentTarget)}
                            className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-[10px] transition-all w-full justify-between ${
                              opcionId === fila.id
                                ? "border-blue-300 bg-blue-50/80"
                                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {/* Tipo: solo B o F */}
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ring-1 ring-inset ${
                                tipo === "B"
                                  ? "bg-blue-50 text-blue-600 ring-blue-200"
                                  : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                              }`}>
                                {tipo === "B" ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                                {tipo}
                              </span>
                              {/* IGV */}
                              <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
                                18%
                              </span>
                              {/* Moneda */}
                              <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200">
                                {fila.moneda === "USD" ? "$" : "S/"}
                              </span>
                            </div>
                            <ChevronDown className={`w-2.5 h-2.5 text-gray-300 shrink-0 transition-transform ${opcionId === fila.id ? "rotate-180" : ""}`} />
                          </button>
                        </td>

                        {/* Campos editables */}
                        {columnas.map((col) => {
                          const isRazonSocial  = col.key === "razonSocial";
                          const consultando    = isRazonSocial && loadingRazonSocialIds.has(fila.id);
                          const campoError     = erroresPorFila.get(fila.id)?.[col.key];
                          return (
                            <td key={col.key} className="px-1 py-1.5">
                              {consultando ? (
                                <div className="w-full px-2 py-1 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1.5 h-6.5">
                                  <RefreshCw className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                                  <span className="text-[10px] text-blue-400 truncate">Buscando…</span>
                                </div>
                              ) : (
                                <input
                                  type={col.type ?? "text"}
                                  value={String(fila[col.key] ?? "")}
                                  onChange={(e) => actualizarFila(fila.id, col.key, e.target.value)}
                                  onDragStart={(e) => e.preventDefault()}
                                  title={campoError ?? col.label}
                                  className={`w-full px-2 py-1 rounded-md border outline-none transition-all text-gray-800 text-[11px] focus:ring-2 ${
                                    campoError
                                      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                                      : "border-gray-200 bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-blue-100 focus:bg-white"
                                  }`}
                                />
                              )}
                            </td>
                          );
                        })}

                        {/* Deshabilitar */}
                        <td className="px-1 py-1.5 text-center">
                          <button
                            onClick={() => deshabilitarFila(fila.id)}
                            title="Eliminar fila"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* ── Acordeón de comprobantes ─────────────────────────────────────── */}
      {gruposFiltrados.length > 0 && (
        <div className="space-y-2">
          {tabActiva === "todos"
            ? PERIODO_ORDER.filter((p) => periodosPresentes.includes(p)).map((p) => {
                const gs           = gruposFiltrados.filter((g) => g.periodoTipo === p);
                if (!gs.length) return null;
                const cfg          = PERIODO_CFG[p];
                const totalPeriodo = gs.reduce((s, g) => s + g.total, 0);
                const expandido    = periodosExpandidos.has(p);
                const boletas      = gs.filter((g) => g.tipoDoc === "B").length;
                const facturas     = gs.filter((g) => g.tipoDoc === "F").length;
                return (
                  <div key={p} className={`rounded-xl border ${cfg.borderClass} overflow-hidden shadow-sm`}>
                    <button
                      onClick={() => togglePeriodo(p)}
                      className={`w-full flex items-center justify-between px-4 py-3 ${cfg.bgCard} hover:brightness-[0.97] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${cfg.badgeClass.split(" ")[1]} ${expandido ? "" : "-rotate-90"}`} />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                        <span className={`text-[11px] font-bold ${cfg.badgeClass.split(" ")[1]}`}>{cfg.label}</span>
                        <span className="text-[11px] text-gray-400">{gs.length} comprobante{gs.length !== 1 ? "s" : ""}</span>
                        <div className="flex items-center gap-1.5">
                          {boletas > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                              <User className="w-2.5 h-2.5" /> {boletas}B
                            </span>
                          )}
                          {facturas > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <Building2 className="w-2.5 h-2.5" /> {facturas}F
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-800 tabular-nums">
                        S/&nbsp;{totalPeriodo.toFixed(2)}
                      </span>
                    </button>
                    {expandido && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 bg-white border-t border-gray-100">
                        {gs.map((grupo) => <GrupoCard key={grupo.key} grupo={grupo} cfg={cfg} />)}
                      </div>
                    )}
                  </div>
                );
              })
            : (() => {
                const cfg = PERIODO_CFG[tabActiva] ?? PERIODO_CFG["mensual"];
                const todosSeleccionados = selectedKeys.size === gruposFiltrados.length && gruposFiltrados.length > 0;
                const algunoSeleccionado = selectedKeys.size > 0;
                return (
                  <div className="space-y-2">
                    {/* Barra de selección */}
                    <div className="flex items-center gap-3 px-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          ref={(el) => { if (el) el.indeterminate = algunoSeleccionado && !todosSeleccionados; }}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 accent-brand-blue cursor-pointer"
                        />
                        <span className="text-[11px] font-semibold text-gray-500">
                          {todosSeleccionados
                            ? "Deseleccionar todo"
                            : algunoSeleccionado
                              ? `${selectedKeys.size} de ${gruposFiltrados.length} seleccionados`
                              : "Seleccionar todo"}
                        </span>
                      </label>
                      {algunoSeleccionado && (
                        <span className="text-[11px] text-gray-400">
                          → Se emitirán solo los seleccionados
                        </span>
                      )}
                    </div>
                    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border ${cfg.borderClass} rounded-xl bg-white shadow-sm`}>
                      {gruposFiltrados.map((grupo) => (
                        <GrupoCard
                          key={grupo.key}
                          grupo={grupo}
                          cfg={cfg}
                          selected={selectedKeys.has(grupo.key)}
                          onToggle={() => toggleSelected(grupo.key)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
        </div>
      )}

      {/* ── Modal plantilla Excel ────────────────────────────────────────── */}
      <Modal isOpen={modalPlantillaOpen} onClose={() => setModalPlantillaOpen(false)} title="Cargar plantilla Excel">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">Usa la plantilla con el formato correcto</p>
              <p className="text-xs text-blue-600/80 mt-0.5 leading-relaxed">
                Descarga el Excel, completa las filas y súbelo. El sistema agrupa automáticamente por cliente y período.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
                {
                n: "1", color: "blue", title: "Descarga el formato",
                desc: "Genera un Excel con cabecera, columnas ajustadas y filas de ejemplo.",
                action: descargarPlantilla, label: "Descargar plantilla", Icon: Download, variant: "primary" as const,
              },
              {
                n: "2", color: "emerald", title: "Sube el archivo listo",
                desc: "Revisarás y editarás cada fila antes de emitir. Los datos se guardan automáticamente.",
                action: () => inputRef.current?.click(), label: "Seleccionar archivo", Icon: Upload, variant: "outline" as const,
              },
            ].map(({ n, color, title, desc, action, label, Icon, variant }) => (
              <div key={n} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full bg-${color}-100 text-${color}-700 text-[10px] font-black flex items-center justify-center`}>{n}</span>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                <Button type="button" variant={variant} onClick={action} className="w-full justify-center">
                  <Icon className="w-4 h-4" /> {label}
                </Button>
              </div>
            ))}
          </div>

          {/* Parámetros fijos aplicados a todos los comprobantes */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Parámetros fijos (aplicados automáticamente)</p>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: "Tipo de comprobante", value: "Boleta (DNI 8 dígitos) · Factura (RUC 11 dígitos)" },
                { label: "IGV aplicado",         value: "18% — Operación gravada" },
                { label: "Unidad de medida",     value: "ZZ — Servicio" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setModalPlantillaOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal agregar ítem ───────────────────────────────────────────── */}
      <ModalAgregarFila
        isOpen={modalAgregarOpen}
        onClose={() => setModalAgregarOpen(false)}
        onGuardar={agregarFila}
      />

      {/* ── Modal de confirmación de emisión ────────────────────────────── */}
      <Modal
        isOpen={modalConfirmarOpen}
        onClose={() => setModalConfirmarOpen(false)}
        title="Confirmar emisión"
      >
        <div className="space-y-4">

          {/* Ícono + mensaje principal */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <Send className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800 text-center">
              ¿Estás seguro de que deseas emitir?
            </p>
            <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
              Esta acción generará los comprobantes en el sistema y no se puede deshacer.
            </p>
          </div>

          {/* Resumen de lo que se va a emitir */}
          {(() => {
            const gruposAMostrar = selectedKeys.size > 0
              ? gruposFiltrados.filter((g) => selectedKeys.has(g.key))
              : gruposFiltrados;
            return (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {selectedKeys.size > 0 && (
              <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-600">
                  Emitiendo {selectedKeys.size} de {gruposFiltrados.length} comprobantes seleccionados
                </span>
              </div>
            )}
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Resumen de emisión</p>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                {
                  label: "Comprobantes",
                  value: `${gruposAMostrar.length} comprobante${gruposAMostrar.length !== 1 ? "s" : ""}`,
                  color: "text-gray-900",
                },
                {
                  label: "Ítems (placas)",
                  value: `${gruposAMostrar.flatMap((g) => g.items).length} ítem${gruposAMostrar.flatMap((g) => g.items).length !== 1 ? "s" : ""}`,
                  color: "text-gray-900",
                },
                {
                  label: "Período",
                  value: tabActiva === "todos" ? "Todos los períodos" : (PERIODO_CFG[tabActiva]?.label ?? tabActiva),
                  color: "text-gray-900",
                },
                {
                  label: "Fecha de emisión",
                  value: fechaEmision ? fechaEmision.split("-").reverse().join("/") : "—",
                  color: "text-gray-900",
                },
                {
                  label: "Importe total",
                  value: `S/ ${gruposAMostrar.reduce((s, g) => s + g.total, 0).toFixed(2)}`,
                  color: "text-gray-900 font-black",
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          );
          })()}

          {/* Boletas vs facturas */}
          {(() => {
            const gruposAMostrar2 = selectedKeys.size > 0
              ? gruposFiltrados.filter((g) => selectedKeys.has(g.key))
              : gruposFiltrados;
            const boletas  = gruposAMostrar2.filter((g) => g.tipoDoc === "B").length;
            const facturas = gruposAMostrar2.filter((g) => g.tipoDoc === "F").length;
            return (boletas > 0 || facturas > 0) ? (
              <div className="flex items-center gap-2">
                {boletas > 0 && (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-blue-100 bg-blue-50">
                    <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-blue-400 font-medium">Boletas</p>
                      <p className="text-sm font-black text-blue-700">{boletas}</p>
                    </div>
                  </div>
                )}
                {facturas > 0 && (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-100 bg-emerald-50">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-emerald-400 font-medium">Facturas</p>
                      <p className="text-sm font-black text-emerald-700">{facturas}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null;
          })()}

          {/* ⏱ Advertencia temprana: aún no es momento de emitir */}
          {advertenciaTemprana && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-800">
                    Aún no es momento de emitir estos comprobantes
                  </p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    El período <span className="font-semibold">{advertenciaTemprana.periodoLabel}</span> termina el{" "}
                    <span className="font-semibold">{formatFechaEs(advertenciaTemprana.fechaFinMin)}</span>,
                    que es en <span className="font-black text-amber-900">{advertenciaTemprana.diasHasta} día{advertenciaTemprana.diasHasta !== 1 ? "s" : ""}</span>.
                  </p>
                  <p className="text-[11px] text-amber-600">
                    Se recomienda emitir cuando falten 7 días o menos para el fin del período.
                  </p>
                </div>
              </div>
              {/* barra de progreso visual hacia la fecha */}
              {(() => {
                const totalDias = advertenciaTemprana.diasHasta;
                // estimamos el período en días (7 = ventana mínima, más = período más largo)
                const periodoEstimado = Math.max(totalDias + 7, 30);
                const pct = Math.max(5, Math.round(((periodoEstimado - totalDias) / periodoEstimado) * 100));
                return (
                  <div className="px-4 pb-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-amber-500 font-medium">
                      <span>Hoy</span>
                      <span className="font-bold text-amber-700">{formatFechaEs(advertenciaTemprana.fechaFinMin)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-amber-800 text-center">
                      Faltan <span className="font-bold">{advertenciaTemprana.diasHasta} días</span> para la ventana de emisión
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Advertencia si hay errores */}
          {nErrores > 0 && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 leading-relaxed">
                <span className="font-bold">{nErrores} fila{nErrores !== 1 ? "s" : ""} con errores</span> serán omitidas al emitir.
                Corrígelas para incluirlas.
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalConfirmarOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                const gruposSeleccionados = selectedKeys.size > 0
                  ? gruposFiltrados.filter((g) => selectedKeys.has(g.key))
                  : undefined;
                setModalConfirmarOpen(false);
                emitir(gruposSeleccionados);
              }}
              disabled={emitiendo}
              className={advertenciaTemprana ? "bg-amber-500! hover:bg-amber-600!" : ""}
            >
              {(() => {
                const n = selectedKeys.size > 0 ? selectedKeys.size : gruposFiltrados.length;
                return emitiendo
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Emitiendo…</>
                  : advertenciaTemprana
                    ? <><Send className="w-4 h-4" /> Emitir igual (no recomendado)</>
                    : <><Send className="w-4 h-4" /> Sí, emitir {n} comprobante{n !== 1 ? "s" : ""}</>;
              })()}
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── Modal resultado post-emisión ────────────────────────────────── */}
      <Modal
        isOpen={modalResultadoOpen}
        onClose={() => setModalResultadoOpen(false)}
        title="Comprobantes generados"
      >
        {resultadoEmision && (
          <div className="space-y-4">

            {/* Banner resumen */}
            {(() => {
              const ok  = resultadoEmision.filter((r) => r.ok).length;
              const err = resultadoEmision.filter((r) => !r.ok).length;
              return (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  err === 0
                    ? "bg-emerald-50 border-emerald-200"
                    : ok === 0
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    err === 0 ? "bg-emerald-100" : ok === 0 ? "bg-red-100" : "bg-amber-100"
                  }`}>
                    {err === 0
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <AlertCircle className={`w-4 h-4 ${ok === 0 ? "text-red-500" : "text-amber-500"}`} />
                    }
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${
                      err === 0 ? "text-emerald-800" : ok === 0 ? "text-red-700" : "text-amber-800"
                    }`}>
                      {ok > 0 && `${ok} generado${ok !== 1 ? "s" : ""} correctamente`}
                      {ok > 0 && err > 0 && " · "}
                      {err > 0 && `${err} con error`}
                    </p>
                    {ok > 0 && (
                      <p className={`text-xs mt-0.5 ${err === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        Estado: <span className="font-semibold">Pendiente</span> · Ve a Comprobantes para enviarlos a SUNAT
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Lista de comprobantes */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Detalle</p>
                <span className="text-[10px] text-gray-400 tabular-nums">
                  Total: <span className="font-bold text-gray-700">
                    S/ {resultadoEmision.reduce((s, r) => s + r.importeTotal, 0).toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {resultadoEmision.map((r) => (
                  <div key={`${r.serie}-${r.correlativo}`}
                    className={`flex items-center gap-3 px-3 py-2.5 ${!r.ok ? "bg-red-50/60" : ""}`}
                  >
                    {/* ok / error */}
                    <div className="shrink-0">
                      {r.ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        : <AlertCircle  className="w-3.5 h-3.5 text-red-400"     />
                      }
                    </div>

                    {/* tipo B/F */}
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ring-1 ring-inset shrink-0 ${
                      r.tipoDoc === "B"
                        ? "bg-blue-50 text-blue-600 ring-blue-200"
                        : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                    }`}>
                      {r.tipoDoc === "B" ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                      {r.tipoDoc}
                    </span>

                    {/* serie-correlativo */}
                    <span className="text-[11px] font-mono font-semibold text-gray-700 shrink-0 w-28">
                      {r.serie}-{r.correlativo}
                    </span>

                    {/* cliente */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 truncate">{r.razonSocial || r.numdoc}</p>
                      {r.ok
                        ? <p className="text-[10px] text-gray-400 font-mono">{r.numdoc}</p>
                        : <p className="text-[10px] text-red-400 truncate" title={r.error}>{r.error}</p>
                      }
                    </div>

                    {/* importe + estado */}
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-gray-800 tabular-nums">
                        {r.moneda === "USD" ? "$" : "S/"} {r.importeTotal.toFixed(2)}
                      </p>
                      {r.ok
                        ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">Pendiente</span>
                        : <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-50 text-red-500 ring-1 ring-inset ring-red-100">Error</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón cerrar */}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setModalResultadoOpen(false)}>
                <CheckCircle2 className="w-4 h-4" /> Entendido
              </Button>
            </div>

          </div>
        )}
      </Modal>

      {/* ── Tooltip de errores (fixed, escapa overflow de la tabla) ───────── */}
      {errorTipId && (() => {
        const errs = erroresPorFila.get(errorTipId);
        if (!errs) return null;
        const entries = Object.entries(errs) as [keyof FilaCarga, string][];
        return (
          <div
            style={{ top: errorTipPos.top, left: errorTipPos.left }}
            className="fixed z-50 w-56 pointer-events-none"
          >
            {/* flecha izquierda */}
            <div className="absolute -left-1.5 top-4 w-3 h-3 bg-white border-l border-t border-red-100 -rotate-45 rounded-sm shadow-[-2px_-2px_4px_rgba(0,0,0,0.04)]" />

            <div className="bg-white border border-red-100 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] overflow-hidden">
              {/* cabecera */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border-b border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                </div>
                <span className="text-[11px] font-bold text-red-600">
                  {entries.length} error{entries.length !== 1 ? "es" : ""} encontrado{entries.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* lista de errores */}
              <div className="px-3 py-2.5 space-y-2">
                {entries.map(([field, msg]) => (
                  <div key={field} className="flex items-start gap-2">
                    <span className="inline-block mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">
                        {CAMPO_LABEL[field] ?? field}
                      </p>
                      <p className="text-[11px] text-red-500 font-medium leading-tight">{msg}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* pie */}
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-[9px] text-gray-400">Edita el campo directamente en la tabla</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Tooltip de advertencias (fixed, escapa overflow de la tabla) ── */}
      {warnTipId && (() => {
        const warns = advertenciasPorFila.get(warnTipId);
        if (!warns) return null;
        const entries = Object.entries(warns) as [keyof FilaCarga, string][];
        return (
          <div
            style={{ top: warnTipPos.top, left: warnTipPos.left }}
            className="fixed z-50 w-56 pointer-events-none"
          >
            {/* flecha izquierda */}
            <div className="absolute -left-1.5 top-4 w-3 h-3 bg-white border-l border-t border-amber-100 -rotate-45 rounded-sm shadow-[-2px_-2px_4px_rgba(0,0,0,0.04)]" />

            <div className="bg-white border border-amber-100 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] overflow-hidden">
              {/* cabecera */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border-b border-amber-100">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                </div>
                <span className="text-[11px] font-bold text-amber-600">
                  {entries.length} advertencia{entries.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* lista de advertencias */}
              <div className="px-3 py-2.5 space-y-2">
                {entries.map(([field, msg]) => (
                  <div key={field} className="flex items-start gap-2">
                    <span className="inline-block mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">
                        {CAMPO_LABEL[field] ?? field}
                      </p>
                      <p className="text-[9px] text-amber-600 font-medium leading-tight">{msg}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* pie */}
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-[9px] text-gray-400">No bloquea la emisión — revisa si es correcto</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Dropdown comprobante (fixed) ─────────────────────────────────── */}
      {opcionId && (() => {
        const filaActiva = filas.find((f) => f.id === opcionId);
        if (!filaActiva) return null;
        const tipo = getTipoDoc(filaActiva);
        return (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpcionId(null)} />
            <div
              style={{ top: dropPos.top, left: dropPos.left }}
              className="fixed z-40 bg-white border border-gray-200/80 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-3.5 w-52 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Settings2 className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Comprobante</span>
                </div>
              </div>

              {/* Tipo */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Tipo de comprobante</p>
                <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${
                  tipo === "B" ? "bg-blue-50 border-blue-100" : "bg-emerald-50 border-emerald-100"
                }`}>
                  {tipo === "B"
                    ? <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    : <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <div>
                    <p className={`text-[11px] font-bold ${tipo === "B" ? "text-blue-700" : "text-emerald-700"}`}>
                      {tipo === "B" ? "Boleta de venta" : "Factura electrónica"}
                    </p>
                    <p className="text-[9px] text-gray-400">{tipo === "B" ? "DNI detectado" : "RUC detectado"}</p>
                  </div>
                </div>
              </div>

              {/* IGV */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">IGV aplicado</p>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-amber-50 border-amber-100">
                  <span className="text-sm font-black text-amber-600">18%</span>
                  <div>
                    <p className="text-[11px] font-semibold text-amber-700">Gravado</p>
                    <p className="text-[9px] text-gray-400">Fijo para todos los ítems</p>
                  </div>
                </div>
              </div>

              {/* Moneda */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Moneda</p>
                <div className="grid grid-cols-2 gap-1">
                  {(["PEN", "USD"] as const).map((m) => (
                    <button key={m}
                      onClick={() => actualizarFila(filaActiva.id, "moneda", m)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        filaActiva.moneda === m
                          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                          : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {m === "PEN" ? "S/ Soles" : "$ Dólares"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Modal notificaciones de vencimiento ─────────────────────────── */}
      <ModalNotificaciones
        isOpen={modalNotificacionesOpen}
        onClose={() => setModalNotificacionesOpen(false)}
        diasAviso={diasAviso}
        diasAvisoCargado={diasAvisoCargado}
        setDiasAviso={setDiasAviso}
        gruposParaNotificar={gruposParaNotificar}
        estadoEmail={estadoEmail}
        estadoWsp={estadoWsp}
        enviandoBulk={enviandoBulk}
        progresoBulk={progresoBulk}
        getDiasRestantes={getDiasRestantes}
        getFirstFechaFin={getFirstFechaFin}
        buildMensajeGrupo={buildMensajeGrupo}
        SUBJECT_DEFAULT={SUBJECT_DEFAULT}
        enviarEmail={enviarEmail}
        abrirWhatsApp={abrirWhatsApp}
        enviarTodosEmail={enviarTodosEmail}
      />

      {/* ── Modal registros deshabilitados ──────────────────────────────── */}
      <Modal
        isOpen={modalDeshabilitadosOpen}
        onClose={() => setModalDeshabilitadosOpen(false)}
        title={`Registros deshabilitados (${filasDeshabilitadas.length})`}
      >
        <div className="space-y-4">

          {/* Explicación */}
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Estos registros están pausados y <span className="font-semibold">no se emitirán</span>. Para reactivar uno, elige la nueva fecha de inicio y pulsa <span className="font-semibold">Habilitar</span>. Las fechas de fin y el concepto se recalcularán solos.
            </p>
          </div>

          {/* Lista */}
          {filasDeshabilitadas.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No hay registros deshabilitados</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 max-h-105 overflow-y-auto">
              {filasDeshabilitadas.map((fila) => {
                const cfg  = PERIODO_CFG[periodoTexto(fila.periodo)];
                const tipo = getTipoDoc(fila);
                const fechaRehab = fechasRehab[fila.id] ?? primerDiaMes;
                return (
                  <div key={fila.id} className="px-4 py-3 bg-white hover:bg-gray-50/60 transition-colors">
                    {/* Info del registro */}
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <span className={`mt-1 inline-block w-2 h-2 rounded-full shrink-0 ${cfg?.dotClass ?? "bg-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ring-1 ring-inset ${
                            tipo === "B" ? "bg-blue-50 text-blue-600 ring-blue-200" : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                          }`}>
                            {tipo === "B" ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                            {tipo}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-gray-700 truncate">{fila.placa}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg?.badgeClass ?? "bg-gray-100 text-gray-500"}`}>
                            {cfg?.label ?? fila.periodo}
                          </span>
                        </div>
                        <p className="text-[12px] font-semibold text-gray-800 truncate mt-0.5">{fila.razonSocial || fila.numdoc}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{fila.numdoc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-gray-800 tabular-nums">
                          {fila.moneda === "USD" ? "$" : "S/"} {Number(fila.importe).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-400">por período</p>
                      </div>
                    </div>

                    {/* Fecha + botón habilitar */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">Nueva fecha ini:</span>
                        <input
                          type="date"
                          value={fechaRehab}
                          onChange={(e) =>
                            setFechasRehab((prev) => ({ ...prev, [fila.id]: e.target.value }))
                          }
                          className="flex-1 min-w-0 outline-none text-[11px] font-semibold text-gray-800 bg-transparent cursor-pointer"
                        />
                      </div>
                      <button
                        onClick={() => habilitarFila(fila.id, fechaRehab)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors shadow-sm shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Habilitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setModalDeshabilitadosOpen(false)}>
              Cerrar
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── Modal errores de carga Excel ────────────────────────────────── */}
      <Modal
        isOpen={modalErroresCargaOpen}
        onClose={() => setModalErroresCargaOpen(false)}
        title="Filas con error al cargar"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            Las siguientes filas no pudieron guardarse. Corrígelas en el Excel y vuelve a cargarlas.
          </p>

          <div className="rounded-xl border border-red-100 overflow-hidden divide-y divide-red-50 max-h-80 overflow-y-auto">
            {erroresCarga.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 bg-white hover:bg-red-50/40 transition-colors">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {e.numdoc && (
                      <span className="text-[11px] font-semibold text-gray-800">{e.numdoc}</span>
                    )}
                    {e.placa && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        {e.placa}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{e.mensaje}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setModalErroresCargaOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
