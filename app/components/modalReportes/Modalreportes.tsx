"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Download, FileSpreadsheet,
  Calendar, User, Building2, Hash,
  SortAsc, FileText, Loader2, ChevronDown, Check,
  Printer, FileBarChart2, Receipt,
} from "lucide-react";
import { FormatoReporte } from "@/app/factufly/reportes/gestionReportes/UseReportesAvanzados";
import { cn } from "@/app/utils/cn";
import { Button } from "@/app/components/ui/Button";
import { FiltrosReporteModal, FiltroNV } from "@/app/factufly/reportes/gestionReportes/Reportes";
import { UsuarioReporte } from "@/app/factufly/reportes/gestionReportes/UseUsuariosReporte";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Sucursal {
  sucursalId: number;
  nombre: string;
  codEstablecimiento: string;
}

interface ModalReportesProps {
  abierto: boolean;
  onCerrar: () => void;
  filtros: FiltrosReporteModal;
  onSetFiltro: <K extends keyof FiltrosReporteModal>(key: K, value: FiltrosReporteModal[K]) => void;
  onResetFiltros: () => void;
  usuarios: UsuarioReporte[];
  sucursales: Sucursal[];
  isSuperAdmin: boolean;
  puedeVerUsuarios: boolean;
  loadingExcelListado: boolean;
  loadingExcelProductos: boolean;
  loadingExcelMedios: boolean;
  loadingExcelControlCaja: boolean;
  loadingTicketControlCaja: boolean;
  loadingPdfTicketControlCaja: boolean;
  onDescargarListado: (filtros: FiltrosReporteModal, formato: FormatoReporte) => Promise<void>;
  onDescargarProductos: (filtros: FiltrosReporteModal, formato: FormatoReporte) => Promise<void>;
  onDescargarMedios: (filtros: FiltrosReporteModal, formato: FormatoReporte) => Promise<void>;
  onDescargarControlCaja: (filtros: FiltrosReporteModal, formato: FormatoReporte) => Promise<void>;
  onDescargarTicket: (filtros: FiltrosReporteModal) => Promise<void>;
  onDescargarPdfTicket: (filtros: FiltrosReporteModal) => Promise<void>;
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getHoyString    = () => fmt(new Date());
const getLunesString  = () => { const h = new Date(); const l = new Date(h); l.setDate(h.getDate() - ((h.getDay() + 6) % 7)); return fmt(l); };
const getPrimeroMes   = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-01`; };
const getPrimeroAnio  = () => `${new Date().getFullYear()}-01-01`;

// ── Dropdown genérico reutilizable (mismo estilo que SucursalSelect) ──────────
function CustomSelect<T extends string | number>({
  opciones, seleccionado, onSelect, placeholder,
}: {
  opciones: { value: T | null; label: string }[];
  seleccionado: T | null;
  onSelect: (v: T | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const actual = opciones.find((o) => o.value === seleccionado);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs transition-all hover:border-gray-300",
          open && "border-blue-400 ring-2 ring-blue-50"
        )}
      >
        <span className={cn("font-medium truncate", actual && actual.value !== null ? "text-gray-800" : "text-gray-400")}>
          {actual?.label || placeholder || "Seleccionar"}
        </span>
        <ChevronDown size={14} className={cn("text-gray-400 transition-transform shrink-0 ml-2", open && "rotate-180 text-blue-500")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-1.5 max-h-48 overflow-y-auto">
              {opciones.map((o) => (
                <button key={String(o.value)} type="button"
                  onClick={() => { onSelect(o.value); setOpen(false); }}
                  className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors",
                    seleccionado === o.value ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-600")}>
                  {o.label}
                  {seleccionado === o.value && <Check size={12} className="text-blue-600" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Botón de reporte ──────────────────────────────────────────────────────────
function ReporteBtn({ icon: Icon, label, descripcion, loading, onClick, color, badge }: {
  icon: React.ElementType; label: string; descripcion: string;
  loading: boolean; onClick: () => void; color: string; badge?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className={cn(
        "group flex-1 flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all text-center relative",
        "hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed", color
      )}
    >
      {badge && <span className="absolute top-2 right-2">{badge}</span>}
      <div className="p-2 rounded-lg bg-white shadow-sm">
        {loading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <Icon size={16} className="text-current" />}
      </div>
      <div>
        <p className="text-[12px] font-black text-gray-800 leading-tight">{label}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{descripcion}</p>
      </div>
      <Download size={11} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
    </button>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export function ModalReportes({
  abierto, onCerrar, filtros, onSetFiltro, onResetFiltros,
  usuarios, sucursales, isSuperAdmin, puedeVerUsuarios,
  loadingExcelListado, loadingExcelProductos, loadingExcelMedios, loadingExcelControlCaja,
  loadingTicketControlCaja, loadingPdfTicketControlCaja,
  onDescargarListado, onDescargarProductos, onDescargarMedios, onDescargarControlCaja,
  onDescargarTicket, onDescargarPdfTicket,
}: ModalReportesProps) {

  const [formato, setFormato] = useState<FormatoReporte>('excel');

  const hayDescarga = loadingExcelListado || loadingExcelProductos || loadingExcelMedios || loadingExcelControlCaja || loadingTicketControlCaja;

  const hoy       = getHoyString();
  const lunes     = getLunesString();
  const primMes   = getPrimeroMes();
  const primAnio  = getPrimeroAnio();

  type Shortcut = 'hoy' | 'semana' | 'mes' | 'año' | null;

  const shortcutActivo: Shortcut = useMemo(() => {
    const d = filtros.fechaDesde;
    const h = filtros.fechaHasta;
    if (!d || !h) return null;
    if (d === hoy     && h === hoy) return 'hoy';
    if (d === lunes   && h === hoy) return 'semana';
    if (d === primMes && h === hoy) return 'mes';
    if (d === primAnio && h === hoy) return 'año';
    return null;
  }, [filtros.fechaDesde, filtros.fechaHasta, hoy, lunes, primMes, primAnio]);

  const usuariosDelModal = useMemo(() => {
    if (!isSuperAdmin || !filtros.codEstablecimiento) return usuarios;
    const suc = sucursales.find(s => s.codEstablecimiento === filtros.codEstablecimiento);
    if (!suc) return usuarios;
    return usuarios.filter(u => String(u.sucursalID) === String(suc.sucursalId) || u.rol === 'superadmin');
  }, [usuarios, filtros.codEstablecimiento, sucursales, isSuperAdmin]);

  const shortcuts: { label: string; key: Shortcut; fn: () => void }[] = [
    { label: "Hoy",         key: 'hoy',    fn: () => { onSetFiltro("fechaDesde", hoy);      onSetFiltro("fechaHasta", hoy); } },
    { label: "Esta semana", key: 'semana', fn: () => { onSetFiltro("fechaDesde", lunes);    onSetFiltro("fechaHasta", hoy); } },
    { label: "Este mes",    key: 'mes',    fn: () => { onSetFiltro("fechaDesde", primMes);  onSetFiltro("fechaHasta", hoy); } },
    { label: "Este año",    key: 'año',    fn: () => { onSetFiltro("fechaDesde", primAnio); onSetFiltro("fechaHasta", hoy); } },
  ];

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-black/40 backdrop-blur-sm z-50" onClick={onCerrar} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <FileSpreadsheet size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-900">Generar Reportes Excel</h2>
                    <p className="text-[10px] text-gray-500">Configura los filtros y descarga el reporte</p>
                  </div>
                </div>
                <button onClick={onCerrar} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-3">

                {/* ── FILA 1 ────────────────────────────────────────────────── */}
                {isSuperAdmin && sucursales.length > 0 ? (
                  /* superadmin: Sucursal | Usuario | Doc. Cliente */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                        <Building2 size={11} className="text-gray-400" /> Sucursal
                      </label>
                      <CustomSelect
                        opciones={[
                          { value: null, label: "Todas las sucursales" },
                          ...sucursales.map((s) => ({ value: s.codEstablecimiento, label: s.nombre })),
                        ]}
                        seleccionado={filtros.codEstablecimiento ?? null}
                        onSelect={(cod) => {
                          onSetFiltro("codEstablecimiento", cod);
                          onSetFiltro("usuarioCreacion", null);
                        }}
                        placeholder="Todas las sucursales"
                      />
                    </div>
                    {puedeVerUsuarios && (
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                          <User size={11} className="text-gray-400" /> Usuario
                        </label>
                        <CustomSelect
                          opciones={[
                            { value: null, label: "Todos los usuarios" },
                            ...usuariosDelModal.map((u) => ({ value: u.usuarioID, label: u.username })),
                          ]}
                          seleccionado={filtros.usuarioCreacion ?? null}
                          onSelect={(id) => onSetFiltro("usuarioCreacion", id)}
                          placeholder="Todos los usuarios"
                        />
                      </div>
                    )}
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                        <Hash size={11} className="text-gray-400" /> Doc. Cliente
                      </label>
                      <input type="text" placeholder="RUC o DNI"
                        value={filtros.clienteNumDoc ?? ""}
                        onChange={(e) => onSetFiltro("clienteNumDoc", e.target.value || null)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50 placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                ) : (
                  /* no superadmin: Usuario (inicio) | Doc. Cliente (final), responsive stack */
                  <div className="flex flex-col sm:flex-row gap-2">
                    {puedeVerUsuarios && (
                      <div className="flex-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                          <User size={11} className="text-gray-400" /> Usuario
                        </label>
                        <CustomSelect
                          opciones={[
                            { value: null, label: "Todos los usuarios" },
                            ...usuariosDelModal.map((u) => ({ value: u.usuarioID, label: u.username })),
                          ]}
                          seleccionado={filtros.usuarioCreacion ?? null}
                          onSelect={(id) => onSetFiltro("usuarioCreacion", id)}
                          placeholder="Todos los usuarios"
                        />
                      </div>
                    )}
                    <div className="flex-1 sm:flex sm:justify-end">
                      <div className="w-full sm:max-w-xs">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                          <Hash size={11} className="text-gray-400" /> Doc. Cliente
                        </label>
                        <input type="text" placeholder="RUC o DNI"
                          value={filtros.clienteNumDoc ?? ""}
                          onChange={(e) => onSetFiltro("clienteNumDoc", e.target.value || null)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50 placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FILA 2: Desde | Hasta | Límite | Ordenar por ──────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  {/* Desde */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                      <Calendar size={11} className="text-gray-400" /> Desde
                    </label>
                    <input type="date" value={filtros.fechaDesde ?? ""} max={hoy}
                      onChange={(e) => {
                        onSetFiltro("fechaDesde", e.target.value || null);
                        if (filtros.fechaHasta && e.target.value > filtros.fechaHasta)
                          onSetFiltro("fechaHasta", null);
                      }}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50"
                    />
                  </div>
                  {/* Hasta */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                      <Calendar size={11} className="text-gray-400" /> Hasta
                    </label>
                    <input type="date" value={filtros.fechaHasta ?? ""}
                      min={filtros.fechaDesde ?? undefined} max={hoy}
                      onChange={(e) => onSetFiltro("fechaHasta", e.target.value || null)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50"
                    />
                  </div>
                  {/* Límite */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                      <Hash size={11} className="text-gray-400" /> Límite
                    </label>
                    <input type="number" placeholder="Sin límite" min={1}
                      value={filtros.limit ?? ""}
                      onChange={(e) => onSetFiltro("limit", e.target.value ? Number(e.target.value) : null)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50 placeholder:text-gray-300"
                    />
                  </div>
                  {/* Ordenar por */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                      <SortAsc size={11} className="text-gray-400" /> Ordenar productos por
                    </label>
                    <select value={filtros.orderBy ?? "monto"}
                      onChange={(e) => onSetFiltro("orderBy", e.target.value as "monto" | "cantidad" | "veces")}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50"
                    >
                      <option value="monto">Mayor monto</option>
                      <option value="cantidad">Mayor cantidad</option>
                      <option value="veces">Más vendido</option>
                    </select>
                  </div>
                </div>

                {/* Shortcuts de fecha */}
                <div className="flex gap-1.5 -mt-1">
                  {shortcuts.map((s) => (
                    <button key={s.label} type="button" onClick={s.fn}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all",
                        shortcutActivo === s.key
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* ── Nota de Venta ─────────────────────────────────────────── */}
                <div className="flex items-center gap-3 py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <Receipt size={13} className="text-gray-400 shrink-0" />
                  <span className="text-[11px] font-bold text-gray-600 shrink-0">Nota de Venta</span>
                  <div className="flex gap-1.5 ml-auto">
                    {([
                      { value: 'excluir' as FiltroNV, label: 'Sin NV' },
                      { value: 'incluir' as FiltroNV, label: 'Con NV' },
                      { value: 'solo'    as FiltroNV, label: 'Solo NV' },
                    ]).map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => onSetFiltro('filtroNV', opt.value)}
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all",
                          (filtros.filtroNV ?? 'excluir') === opt.value
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── FILA 3: Nombre del archivo (ancho completo) ───────────── */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-1.5">
                    <FileText size={11} className="text-gray-400" />
                    Nombre del archivo
                    <span className="text-[10px] text-gray-400 font-normal">(auto-generado si no lo completas)</span>
                  </label>
                  <input type="text" placeholder="Ej: ventas-mayo-2025"
                    value={filtros.tituloPersonalizado ?? ""}
                    onChange={(e) => onSetFiltro("tituloPersonalizado", e.target.value || null)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 bg-gray-50 placeholder:text-gray-300"
                  />
                </div>

                {/* ── Botones de descarga ──────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Download size={13} className="text-gray-400" />
                      <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Descargar Reporte</span>
                    </div>
                    {/* Toggle Excel / PDF */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      {(['excel', 'pdf'] as FormatoReporte[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFormato(f)}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-all",
                            formato === f
                              ? "bg-white text-gray-800 shadow-sm"
                              : "text-gray-400 hover:text-gray-600"
                          )}
                        >
                          {f === 'excel'
                            ? <><FileSpreadsheet size={11} /> Excel</>
                            : <><FileBarChart2 size={11} /> PDF</>
                          }
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 reportes con formato seleccionado */}
                  <div className="flex gap-2 mb-2">
                    {/* Libro Contable 
                    <ReporteBtn
                      icon={formato === 'pdf' ? FileBarChart2 : FileSpreadsheet}
                      label="Libro Contable"
                      descripcion="Comprobantes aceptados con detalle"
                      loading={loadingExcelListado}
                      onClick={() => onDescargarListado(filtros, formato)}
                      color="border-blue-100 hover:border-blue-300 hover:bg-blue-50/50 text-blue-600"
                    />
                    */}
                    <ReporteBtn
                      icon={formato === 'pdf' ? FileBarChart2 : FileSpreadsheet}
                      label="Control de Caja"
                      descripcion="Movimientos incluyendo pendientes"
                      loading={loadingExcelControlCaja}
                      onClick={() => onDescargarControlCaja(filtros, formato)}
                      color="border-green-100 hover:border-green-300 hover:bg-green-50/50 text-green-600"
                    />
                    <ReporteBtn
                      icon={formato === 'pdf' ? FileBarChart2 : SortAsc}
                      label="Top Productos"
                      descripcion="Ranking por cantidad o monto"
                      loading={loadingExcelProductos}
                      onClick={() => onDescargarProductos(filtros, formato)}
                      color="border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-emerald-600"
                    />
                    <ReporteBtn
                      icon={formato === 'pdf' ? FileBarChart2 : Hash}
                      label="Medios de Pago"
                      descripcion="Análisis de medios usados"
                      loading={loadingExcelMedios}
                      onClick={() => onDescargarMedios(filtros, formato)}
                      color="border-orange-100 hover:border-orange-300 hover:bg-orange-50/50 text-orange-600"
                    />
                  </div>

                  {/* Ticket térmico — imprimir 80mm + descargar PDF A4 */}
                  <div className="flex gap-2">
                    <ReporteBtn
                      icon={Printer}
                      label="Caja Ticket"
                      descripcion="Imprime ticket 80mm en térmica"
                      loading={loadingTicketControlCaja}
                      onClick={() => onDescargarTicket(filtros)}
                      color="border-purple-100 hover:border-purple-300 hover:bg-purple-50/50 text-purple-600"
                      badge={<span className="text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">80mm</span>}
                    />
                    <ReporteBtn
                      icon={FileBarChart2}
                      label="Descargar PDF"
                      descripcion="Control de caja en PDF A4"
                      loading={loadingPdfTicketControlCaja}
                      onClick={() => onDescargarPdfTicket(filtros)}
                      color="border-rose-100 hover:border-rose-300 hover:bg-rose-50/50 text-rose-600"
                      badge={<span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">A4</span>}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-100 rounded-b-2xl sticky bottom-0">
                <button type="button" onClick={onResetFiltros} disabled={hayDescarga}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                  Limpiar filtros
                </button>
                <Button variant="outline" onClick={onCerrar} disabled={hayDescarga} className="text-xs">
                  Cerrar
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
