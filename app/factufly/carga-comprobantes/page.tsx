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
} from "lucide-react";
import { Button }  from "@/app/components/ui/Button";
import { Card }    from "@/app/components/ui/Card";
import { Modal }   from "@/app/components/ui/Modal";

import { useCargaComprobantes }  from "./useCargaComprobantes";
import { GrupoCard }             from "./GrupoCard";
import { ModalAgregarFila }      from "./ModalAgregarFila";
import { PERIODO_ORDER, PERIODO_CFG, COLUMNAS_EXCEL, columnas } from "./constants";
import { getTipoDoc, periodoTexto } from "./helpers";

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CargaComprobantesPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado del dropdown OPCIONES (igv + moneda + tipo)
  const [opcionId,  setOpcionId]  = useState<string | null>(null);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0 });

  // Modal agregar ítem manualmente
  const [modalAgregarOpen, setModalAgregarOpen] = useState(false);

  const abrirOpciones = (id: string, btn: HTMLButtonElement) => {
    if (opcionId === id) { setOpcionId(null); return; }
    const r = btn.getBoundingClientRect();
    // Posicionar a la izquierda del botón o ajustar si queda fuera de pantalla
    const left = Math.min(r.left, window.innerWidth - 220);
    setDropPos({ top: r.bottom + 4, left });
    setOpcionId(id);
  };

  const {
    filas,
    filasFiltradas,
    gruposFiltrados,
    periodosPresentes,
    stats,
    statsPorPeriodo,
    erroresPorFila,
    tabActiva,          setTabActiva,
    fechaEmision,       setFechaEmision,
    periodosExpandidos,
    loadingRazonSocialIds,
    emitiendo,
    modalPlantillaOpen, setModalPlantillaOpen,
    esUsuarioVelsat,
    sucursal,
    empresa,
    cargarExcel,
    descargarPlantilla,
    actualizarFila,
    agregarFila,
    emitir,
    limpiarCarga,
    togglePeriodo,
  } = useCargaComprobantes();

  // Filas con error dentro del filtro activo
  const nErrores = filasFiltradas.filter((f) => erroresPorFila.has(f.id)).length;

  // ── Guard ──
  if (!esUsuarioVelsat) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Acceso restringido</p>
          <p className="text-xs text-gray-400">Esta sección está disponible solo para el usuario Velsat.</p>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-3">

      {/* ── Cabecera ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Carga Comprobantes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Carga la plantilla Excel, revisa por período y emite todos los comprobantes agrupados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-500 font-medium whitespace-nowrap">Fecha emisión:</span>
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="outline-none text-gray-800 font-semibold bg-transparent cursor-pointer"
            />
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) cargarExcel(file);
              e.currentTarget.value = "";
            }}
          />
          <Button variant="outline" onClick={() => setModalPlantillaOpen(true)}>
            <Upload className="w-4 h-4" /> Cargar Excel
          </Button>
          <Button variant="outline" onClick={() => setModalAgregarOpen(true)}>
            <Plus className="w-4 h-4" /> Agregar ítem
          </Button>
          {filas.length > 0 && (
            <Button variant="outline" onClick={limpiarCarga}>
              <Trash2 className="w-4 h-4" /> Limpiar carga
            </Button>
          )}
          <Button
            onClick={emitir}
            disabled={emitiendo || gruposFiltrados.length === 0 || !sucursal || !empresa}
          >
            {emitiendo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {emitiendo
              ? "Emitiendo..."
              : gruposFiltrados.length > 0
                ? `Emitir (${gruposFiltrados.length})`
                : "Emitir"}
          </Button>
        </div>
      </div>

      {/* ── Tabs de período ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setTabActiva("todos")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tabActiva === "todos" ? "bg-gray-800 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Todos
          {filas.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tabActiva === "todos" ? "bg-white/20" : "bg-gray-100"}`}>
              {filas.length}
            </span>
          )}
        </button>

        {periodosPresentes.length > 0 && <span className="w-px h-5 bg-gray-200 mx-1" />}

        {periodosPresentes.map((p) => {
          const cfg    = PERIODO_CFG[p];
          const s      = statsPorPeriodo[p];
          const activo = tabActiva === p;
          return (
            <button
              key={p}
              onClick={() => setTabActiva(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activo ? cfg.activeClass : cfg.idleClass
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-white/70" : cfg.dotClass}`} />
              {cfg.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? "bg-white/20 text-white" : cfg.badgeClass}`}>
                {s.filas}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Strip de stats ── */}
      {filas.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-white rounded-xl border border-gray-100 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Placas</span>
            <span className="font-bold text-gray-800">{stats.filas}</span>
          </div>
          <span className="w-px h-3.5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Comprobantes a generar</span>
            <span className="font-bold text-gray-800">{stats.comprobantes}</span>
          </div>
          <span className="w-px h-3.5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Total</span>
            <span className="font-bold text-gray-800">S/ {stats.total.toFixed(2)}</span>
          </div>
          {tabActiva !== "todos" && (
            <>
              <span className="w-px h-3.5 bg-gray-200" />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PERIODO_CFG[tabActiva]?.badgeClass}`}>
                Solo {PERIODO_CFG[tabActiva]?.label}
              </span>
            </>
          )}
          {nErrores > 0 && (
            <>
              <span className="w-px h-3.5 bg-gray-200" />
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="font-bold text-[11px]">
                  {nErrores} fila{nErrores !== 1 ? "s" : ""} con errores
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tabla editable ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)]">
          <table className="w-full text-xs" style={{ tableLayout: "fixed", minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: 28 }} />
              <col style={{ width: 26 }} />
              <col style={{ width: 115 }} />
              {columnas.map((col) => (
                <col key={col.key} style={{ width: col.px ?? col.pct ?? "auto" }} />
              ))}
            </colgroup>

            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
              <tr>
                <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide text-[10px]">#</th>
                <th className="px-1 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide text-[10px]">·</th>
                <th className="px-2 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">OPCIONES</th>
                {columnas.map((col) => (
                  <th key={col.key} className="px-2 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px] truncate">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={columnas.length + 3} className="px-6 py-16 text-center">
                    <div className="space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-gray-400 font-medium">
                        {filas.length === 0
                          ? "Carga una plantilla Excel para ver y editar los datos."
                          : `No hay filas ${PERIODO_CFG[tabActiva]?.label?.toLowerCase() ?? ""} en esta carga.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((fila, idx) => {
                  const pt      = periodoTexto(fila.periodo);
                  const cfg     = PERIODO_CFG[pt];
                  const tipo    = getTipoDoc(fila);
                  const igvNum  = Number(fila.igv);
                  const hayError = erroresPorFila.has(fila.id);
                  return (
                    <tr key={fila.id} className={`hover:bg-blue-50/20 ${hayError ? "bg-red-50/40" : ""}`}>

                      {/* # / indicador de error */}
                      <td className="py-1.5 text-center">
                        {hayError ? (
                          <span
                            title={Object.values(erroresPorFila.get(fila.id)!).join(" · ")}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-500 cursor-help"
                          >
                            <AlertCircle className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="text-gray-300 font-medium text-[10px]">{idx + 1}</span>
                        )}
                      </td>

                      {/* Color del período */}
                      <td className="py-1.5 text-center">
                        <span
                          title={cfg?.label ?? pt}
                          className={`inline-block w-2.5 h-2.5 rounded-full ${cfg?.dotClass ?? "bg-gray-300"}`}
                        />
                      </td>

                      {/* ── OPCIONES: tipo + IGV + moneda ── */}
                      <td className="px-1 py-1.5">
                        <button
                          title="Tipo, IGV y moneda"
                          onClick={(e) => abrirOpciones(fila.id, e.currentTarget)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition-all w-full justify-between ${
                            opcionId === fila.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {/* Tipo */}
                            <span className={`flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-black ${
                              tipo === "B"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {tipo === "B"
                                ? <User className="w-2 h-2" />
                                : <Building2 className="w-2 h-2" />
                              }
                              {tipo}
                            </span>
                            {/* IGV */}
                            <span className="px-1 py-px rounded bg-amber-50 text-amber-600 text-[9px] font-bold">
                              18%
                            </span>
                            {/* Moneda */}
                            <span className="px-1 py-px rounded bg-slate-100 text-slate-600 text-[9px] font-bold">
                              {fila.moneda === "USD" ? "$ USD" : "S/ PEN"}
                            </span>
                          </div>
                          <ChevronDown className={`w-3 h-3 text-gray-300 shrink-0 transition-transform ${opcionId === fila.id ? "rotate-180" : ""}`} />
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
                                <span className="text-[10px] text-blue-400 truncate">Buscando...</span>
                              </div>
                            ) : (
                              <input
                                type={col.type ?? "text"}
                                value={String(fila[col.key] ?? "")}
                                onChange={(e) => actualizarFila(fila.id, col.key, e.target.value)}
                                title={campoError}
                                className={`w-full px-2 py-1 border rounded-md outline-none focus:ring-1 transition-all text-gray-800 text-xs ${
                                  campoError
                                    ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-100"
                                    : "border-gray-200 bg-white focus:border-blue-400 focus:ring-blue-100"
                                }`}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Preview comprobantes agrupados (acordeón) ── */}
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
                  <div key={p} className={`rounded-xl border ${cfg.borderClass} overflow-hidden`}>
                    <button
                      onClick={() => togglePeriodo(p)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 ${cfg.bgCard} hover:brightness-[0.97] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${cfg.badgeClass.split(" ")[1]} ${expandido ? "" : "-rotate-90"}`} />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                        <span className={`text-xs font-bold ${cfg.badgeClass.split(" ")[1]}`}>{cfg.label}</span>
                        <span className="text-[11px] text-gray-400">
                          {gs.length} comprobante{gs.length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {boletas > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <User className="w-2.5 h-2.5" /> {boletas} Boleta{boletas !== 1 ? "s" : ""}
                            </span>
                          )}
                          {facturas > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Building2 className="w-2.5 h-2.5" /> {facturas} Factura{facturas !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-black text-gray-700 tabular-nums">
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
                  <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border ${cfg.borderClass} rounded-xl bg-white`}>
                    {gruposFiltrados.map((grupo) => <GrupoCard key={grupo.key} grupo={grupo} cfg={cfg} />)}
                  </div>
                );
              })()}
        </div>
      )}

      {/* ── Modal cargar plantilla ── */}
      <Modal isOpen={modalPlantillaOpen} onClose={() => setModalPlantillaOpen(false)} title="Cargar plantilla Excel">
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Usa la plantilla con el formato correcto</p>
                <p className="text-xs text-blue-700 mt-1">
                  Descarga el Excel, completa las filas y luego súbelo. El sistema agrupa automáticamente por cliente y período.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">1</span>
                <p className="text-sm font-bold text-gray-800">Descarga el formato</p>
              </div>
              <p className="text-xs text-gray-500 min-h-10">Genera un Excel con cabecera, columnas ajustadas y filas de ejemplo.</p>
              <Button type="button" onClick={descargarPlantilla} className="w-full justify-center">
                <Download className="w-4 h-4" /> Descargar plantilla Excel
              </Button>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">2</span>
                <p className="text-sm font-bold text-gray-800">Sube el archivo listo</p>
              </div>
              <p className="text-xs text-gray-500 min-h-10">Revisarás y editarás cada fila antes de emitir. Los datos se guardan automáticamente.</p>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="w-full justify-center">
                <Upload className="w-4 h-4" /> Seleccionar Excel completado
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">Columnas del Excel</p>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {COLUMNAS_EXCEL.map((col) => (
                <span key={col.key} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono font-medium">
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

      {/* ── Modal: agregar ítem manualmente ── */}
      <ModalAgregarFila
        isOpen={modalAgregarOpen}
        onClose={() => setModalAgregarOpen(false)}
        onGuardar={agregarFila}
      />

      {/* ── Dropdown OPCIONES (fixed, fuera del overflow de la tabla) ── */}
      {opcionId && (() => {
        const filaActiva = filas.find((f) => f.id === opcionId);
        if (!filaActiva) return null;
        const tipo = getTipoDoc(filaActiva);
        return (
          <>
            {/* Overlay transparente para cerrar al hacer clic fuera */}
            <div className="fixed inset-0 z-30" onClick={() => setOpcionId(null)} />

            {/* Panel del dropdown */}
            <div
              style={{ top: dropPos.top, left: dropPos.left }}
              className="fixed z-40 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-44 space-y-2.5"
            >
              <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-100">
                <Settings2 className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Opciones</span>
              </div>

              {/* ── Tipo: solo informativo, determinado por numdoc ── */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tipo</p>
                <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${
                  tipo === "B" ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"
                }`}>
                  {tipo === "B"
                    ? <User className="w-3 h-3 text-blue-500 shrink-0" />
                    : <Building2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  }
                  <span className={`text-[10px] font-bold ${tipo === "B" ? "text-blue-700" : "text-emerald-700"}`}>
                    {tipo === "B" ? "Boleta" : "Factura"}
                  </span>
                  <span className="text-[9px] text-gray-400 ml-auto font-medium">
                    {tipo === "B" ? "DNI" : "RUC"}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">Según N° de documento</p>
              </div>

              {/* ── IGV: solo informativo, siempre 18% ── */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">IGV</p>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border bg-amber-50 border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700">18%</span>
                  <span className="text-[9px] text-gray-400 ml-auto font-medium">Gravado</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">IGV fijo para todos los ítems</p>
              </div>

              {/* ── Moneda ── */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Moneda</p>
                <div className="flex gap-1">
                  {(["PEN", "USD"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => actualizarFila(filaActiva.id, "moneda", m)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        filaActiva.moneda === m
                          ? "bg-slate-100 text-slate-700 border-slate-300"
                          : "border-gray-200 text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      {m === "PEN" ? "S/ PEN" : "$ USD"}
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
