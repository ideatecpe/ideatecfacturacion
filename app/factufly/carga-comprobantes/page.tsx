"use client";

import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  RefreshCw,
  Send,
  Upload,
  Download,
  Calendar,
  Trash2,
  ChevronDown,
  AlertCircle,
  User,
  Building2,
  Settings2,
  Plus,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button }  from "@/app/components/ui/Button";
import { Card }    from "@/app/components/ui/Card";
import { Modal }   from "@/app/components/ui/Modal";

import { useCargaComprobantes }  from "./useCargaComprobantes";
import { GrupoCard }             from "./GrupoCard";
import { ModalAgregarFila }      from "./ModalAgregarFila";
import { PERIODO_ORDER, PERIODO_CFG, COLUMNAS_EXCEL, columnas } from "./constants";
import { getTipoDoc, periodoTexto } from "./helpers";
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
  const [modalAgregarOpen,    setModalAgregarOpen]    = useState(false);
  const [modalConfirmarOpen,  setModalConfirmarOpen]  = useState(false);

  // tooltip de errores (fixed, escapa el overflow de la tabla)
  const [errorTipId,  setErrorTipId]  = useState<string | null>(null);
  const [errorTipPos, setErrorTipPos] = useState({ top: 0, left: 0 });
  const mostrarErrorTip = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    // prefiere abrirse a la derecha; si no cabe, a la izquierda
    const left = Math.min(r.right + 8, window.innerWidth - 232);
    setErrorTipPos({ top: r.top - 6, left });
    setErrorTipId(id);
  };

  const abrirOpciones = (id: string, btn: HTMLButtonElement) => {
    if (opcionId === id) { setOpcionId(null); return; }
    const r    = btn.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - 216);
    setDropPos({ top: r.bottom + 6, left });
    setOpcionId(id);
  };

  const {
    filas, filasFiltradas, gruposFiltrados, periodosPresentes,
    stats, statsPorPeriodo, erroresPorFila,
    tabActiva, setTabActiva, fechaEmision, setFechaEmision,
    periodosExpandidos, loadingRazonSocialIds, emitiendo,
    modalPlantillaOpen, setModalPlantillaOpen,
    esUsuarioVelsat, sucursal, empresa,
    cargarExcel, descargarPlantilla, actualizarFila,
    agregarFila, eliminarFila, emitir, limpiarCarga, togglePeriodo,
  } = useCargaComprobantes();

  const nErrores = filasFiltradas.filter((f) => erroresPorFila.has(f.id)).length;
  const hayFilas = filas.length > 0;

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
    <div className="space-y-4">

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Carga Comprobantes</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {hayFilas
              ? `${filas.length} ítem${filas.length !== 1 ? "s" : ""} · revisa y emite cuando estés listo`
              : "Carga el Excel o agrega ítems manualmente para empezar"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
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
          <Button variant="outline" onClick={() => setModalPlantillaOpen(true)}>
            <Upload className="w-4 h-4" /> Cargar Excel
          </Button>
          <Button variant="outline" onClick={() => setModalAgregarOpen(true)}>
            <Plus className="w-4 h-4" /> Agregar ítem
          </Button>
          {hayFilas && (
            <Button variant="outline" onClick={limpiarCarga}>
              <Trash2 className="w-4 h-4" /> Limpiar
            </Button>
          )}
          <Button
            onClick={() => setModalConfirmarOpen(true)}
            disabled={emitiendo || tabActiva === "todos" || gruposFiltrados.length === 0 || !sucursal || !empresa}
          >
            {emitiendo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {emitiendo
              ? "Emitiendo…"
              : tabActiva === "todos" && hayFilas
                ? "Selecciona un período para emitir"
                : gruposFiltrados.length > 0
                  ? `Emitir ${gruposFiltrados.length} comprobante${gruposFiltrados.length !== 1 ? "s" : ""}`
                  : "Emitir"}
          </Button>
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

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {hayFilas && (
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { label: "Placas",            value: String(stats.filas) },
            { label: "Comprobantes",      value: String(stats.comprobantes) },
            { label: "Total",             value: `S/ ${stats.total.toFixed(2)}` },
          ].map(({ label, value }, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <span className="w-px h-6 bg-gray-200 mx-3" />}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-gray-400 font-medium">{label}</span>
                <span className="text-sm font-bold text-gray-800 tabular-nums">{value}</span>
              </div>
            </div>
          ))}
          {tabActiva !== "todos" && (
            <>
              <span className="w-px h-6 bg-gray-200 mx-3" />
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${PERIODO_CFG[tabActiva]?.badgeClass}`}>
                {PERIODO_CFG[tabActiva]?.label}
              </span>
            </>
          )}
          {nErrores === 0 && (
            <>
              <span className="w-px h-6 bg-gray-200 mx-3" />
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Listo para emitir
              </span>
            </>
          )}
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
              Corrígelas antes de emitir. Los campos con error se marcan en rojo — pasa el cursor sobre el ícono para ver el detalle.
            </p>
          </div>
        </div>
      )}

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      {!hayFilas ? (

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
          </div>
        </div>

      ) : (

        /* Tabla editable */
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)]">
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
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={columnas.length + 4} className="px-6 py-12 text-center">
                      <p className="text-[12px] text-gray-400">
                        No hay ítems {PERIODO_CFG[tabActiva]?.label?.toLowerCase() ?? ""} en esta carga.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((fila, idx) => {
                    const pt       = periodoTexto(fila.periodo);
                    const cfg      = PERIODO_CFG[pt];
                    const tipo     = getTipoDoc(fila);
                    const hayError = erroresPorFila.has(fila.id);
                    return (
                      <tr key={fila.id}
                        className={`group/row transition-colors ${
                          hayError ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-gray-50"
                        }`}
                      >
                        {/* # / error */}
                        <td className="py-1.5 text-center">
                          {hayError ? (
                            <button
                              onMouseEnter={(e) => mostrarErrorTip(fila.id, e.currentTarget)}
                              onMouseLeave={() => setErrorTipId(null)}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-500 transition-colors cursor-default"
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
                          const isRazonSocial = col.key === "razonSocial";
                          const consultando   = isRazonSocial && loadingRazonSocialIds.has(fila.id);
                          const campoError    = erroresPorFila.get(fila.id)?.[col.key];
                          return (
                            <td key={col.key} className="px-1 py-1.5">
                              {consultando ? (
                                <div className="w-full px-2 py-1 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1.5 h-[26px]">
                                  <RefreshCw className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                                  <span className="text-[10px] text-blue-400 truncate">Buscando…</span>
                                </div>
                              ) : (
                                <input
                                  type={col.type ?? "text"}
                                  value={String(fila[col.key] ?? "")}
                                  onChange={(e) => actualizarFila(fila.id, col.key, e.target.value)}
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

                        {/* Eliminar */}
                        <td className="px-1 py-1.5 text-center">
                          <button
                            onClick={() => eliminarFila(fila.id)}
                            title="Eliminar fila"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-md text-transparent group-hover/row:text-gray-300 hover:!text-red-400 hover:bg-red-50 transition-all"
                          >
                            <X className="w-3 h-3" />
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
                return (
                  <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border ${cfg.borderClass} rounded-xl bg-white shadow-sm`}>
                    {gruposFiltrados.map((grupo) => <GrupoCard key={grupo.key} grupo={grupo} cfg={cfg} />)}
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
                action: descargarPlantilla, label: "Descargar plantilla", Icon: Download, variant: "default" as const,
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

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Columnas del Excel</p>
            </div>
            <div className="flex flex-wrap gap-1.5 p-3">
              {COLUMNAS_EXCEL.map((col) => (
                <span key={col.key} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-mono font-medium">
                  {col.label}
                </span>
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
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Resumen de emisión</p>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                {
                  label: "Comprobantes",
                  value: `${gruposFiltrados.length} comprobante${gruposFiltrados.length !== 1 ? "s" : ""}`,
                  color: "text-gray-900",
                },
                {
                  label: "Ítems (placas)",
                  value: `${gruposFiltrados.flatMap((g) => g.items).length} ítem${gruposFiltrados.flatMap((g) => g.items).length !== 1 ? "s" : ""}`,
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
                  value: `S/ ${stats.total.toFixed(2)}`,
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

          {/* Boletas vs facturas */}
          {(() => {
            const boletas  = gruposFiltrados.filter((g) => g.tipoDoc === "B").length;
            const facturas = gruposFiltrados.filter((g) => g.tipoDoc === "F").length;
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
                setModalConfirmarOpen(false);
                emitir();
              }}
              disabled={emitiendo}
            >
              {emitiendo
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Emitiendo…</>
                : <><Send className="w-4 h-4" /> Sí, emitir {gruposFiltrados.length} comprobante{gruposFiltrados.length !== 1 ? "s" : ""}</>
              }
            </Button>
          </div>

        </div>
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
            <div className="absolute -left-1.5 top-4 w-3 h-3 bg-white border-l border-t border-red-100 rotate-[-45deg] rounded-sm shadow-[-2px_-2px_4px_rgba(0,0,0,0.04)]" />

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

    </div>
  );
}
