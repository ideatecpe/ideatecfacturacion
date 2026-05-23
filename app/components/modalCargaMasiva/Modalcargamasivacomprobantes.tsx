"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import {
  X, Download, Upload, AlertCircle, CheckCircle2,
  Loader2, FileSpreadsheet, Building2, ChevronDown, Info,
  RefreshCw, TriangleAlert,
} from "lucide-react";
import axios from "axios";
import { ComprobanteAgrupado, ModalCargaMasivaProps } from "@/app/factufly/comprobantes/gestionComprobantes/gestionCargaMasiva/Cargamasivatypes";
import { calcularTotales } from "@/app/factufly/comprobantes/gestionComprobantes/gestionCargaMasiva/Cargamasivautils";
import { useCargaMasiva } from "@/app/factufly/comprobantes/gestionComprobantes/gestionCargaMasiva/Usecargamasiva";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hoy = new Date().toLocaleDateString("en-CA");
const dosAntesISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toLocaleDateString("en-CA");
})();

function formatFechaLarga(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Badge tipo comprobante ───────────────────────────────────────────────────
const BadgeTipo = ({ tipo }: { tipo: "03" | "01" }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap
    ${tipo === "03" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
    {tipo === "03" ? "Boleta" : "Factura"}
  </span>
);

// ─── Fila comprobante ─────────────────────────────────────────────────────────
const FilaComprobante = ({ comp, idx }: { comp: ComprobanteAgrupado; idx: number }) => {
  const [expanded, setExpanded] = useState(true);
  const { igv, importeTotal } = calcularTotales(comp);

  const esAdvertencia = (comp as any).tieneAdvertencia === true;
  const tieneError = comp.apiEncontrado === false && !esAdvertencia;
  const consultando = comp.consultandoApi;
  const simbolo = comp.moneda === "USD" ? "$" : "S/";

  const bgFila = tieneError
    ? "bg-red-50/60"
    : esAdvertencia
      ? "bg-amber-50/40"
      : consultando
        ? "bg-blue-50/30"
        : "bg-white hover:bg-gray-50/50";

  return (
    <>
      <tr className={`transition-colors ${bgFila} ${expanded ? "" : "border-b-2 border-gray-400"}`}>
        <td className="px-3 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
        <td className="px-3 py-3"><BadgeTipo tipo={comp.tipoComprobante} /></td>
        <td className="px-3 py-3">
          <span className="text-xs font-mono text-gray-800">{comp.rucDni}</span>
        </td>
        <td className="px-3 py-3 min-w-40">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-gray-800 leading-tight wrap-break-word whitespace-normal">
              {comp.razonSocial}
            </span>
            {comp.correo && <span className="text-[10px] text-gray-400 truncate max-w-50">{comp.correo}</span>}
            {comp.whatsapp && <span className="text-[10px] text-green-600 font-medium">{comp.whatsapp}</span>}
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          <button
            onClick={() => setExpanded((o) => !o)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 font-medium transition-colors"
          >
            {comp.items.length}
            <ChevronDown size={11} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </td>
        <td className="px-3 py-3 text-center">
          <span className="text-[10px] font-semibold text-gray-500">{comp.moneda}</span>
        </td>
        <td className="px-3 py-3 text-right">
          <span className="text-xs font-mono text-gray-600">{simbolo} {igv.toFixed(2)}</span>
        </td>
        <td className="px-3 py-3 text-right">
          <span className="text-xs font-mono font-bold text-gray-900">{simbolo} {importeTotal.toFixed(2)}</span>
        </td>
        <td className="px-3 py-3 text-center">
          {consultando ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium">
              <Loader2 size={11} className="animate-spin" /> Consultando
            </span>
          ) : tieneError ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-medium">
              <AlertCircle size={11} /> Error
            </span>
          ) : esAdvertencia ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
              <TriangleAlert size={11} /> Alerta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <CheckCircle2 size={11} /> OK
            </span>
          )}
        </td>
      </tr>

      {/* Alerta / Error */}
      {(tieneError || esAdvertencia) && comp.apiError && (
        <tr className={`${expanded ? "" : "border-b border-gray-100"} ${tieneError ? "bg-red-50/80" : "bg-amber-50/60"}`}>
          <td colSpan={9} className="px-4 py-2">
            <div className={`flex items-start gap-2 text-xs ${tieneError ? "text-red-700" : "text-amber-700"}`}>
              {tieneError
                ? <AlertCircle size={13} className="shrink-0 mt-0.5" />
                : <TriangleAlert size={13} className="shrink-0 mt-0.5" />}
              <span>{comp.apiError}</span>
            </div>
          </td>
        </tr>
      )}

      {/* Detalles expandidos con borde izquierdo para indicar pertenencia */}
      {expanded && (
        <tr className="border-b-2 border-gray-400">
          <td colSpan={9} className="p-0">
            <div className="ml-8 border-l-2 border-blue-300 bg-gray-50/80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">Descripción</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-400 uppercase w-16">Cant.</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-400 uppercase w-16">IGV%</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase w-24">P. Unit</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase w-24 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.items.map((item, i) => (
                    <tr key={i} className={i < comp.items.length - 1 ? "border-b border-gray-100" : ""}>
                      <td className="px-4 py-2 text-gray-700 leading-snug">{item.descripcion}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{item.cantidad}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{item.igvPct}%</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{item.precioUnitario.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800 pr-4">
                        {(item.precioUnitario * item.cantidad).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Modal Principal ──────────────────────────────────────────────────────────
export function ModalCargaMasivaComprobantes({
  onClose,
  onCargaExitosa,
  isSuperAdmin,
  sucursales = [],
  sucursalUsuario,
  empresa,
  accessToken,
  user,
}: ModalCargaMasivaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sucursalActual, setSucursalActual] = useState<any>(isSuperAdmin ? null : sucursalUsuario);
  const [showCerrarAviso, setShowCerrarAviso] = useState(false);

  // Refrescar sucursal al abrir el modal
  useEffect(() => {
    if (isSuperAdmin || !sucursalUsuario?.sucursalId) return;
    axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalUsuario.sucursalId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).then((res) => setSucursalActual(res.data)).catch(() => setSucursalActual(sucursalUsuario));
  }, []);

  const {
    state,
    setFechaEmision,
    descargarPlantilla,
    cargarExcel,
    guardarCargaMasiva,
    reset,
    puedeGuardar,
  } = useCargaMasiva(accessToken, empresa, user);

  const { comprobantes, erroresGlobales, cargando, guardando, progreso, resultado, fechaEmision } = state;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("Solo se aceptan archivos Excel (.xlsx o .xls)");
      return;
    }
    await cargarExcel(file);
    e.target.value = "";
  }, [cargarExcel]);

  const handleCerrar = () => {
    if (guardando) { setShowCerrarAviso(true); return; }
    onCargaExitosa();
    onClose();
  };

  const handleGuardar = async () => {
    if (!sucursalActual) return;
    await guardarCargaMasiva(sucursalActual);
  };

  const refrescarSucursal = async (id: number) => {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setSucursalActual((prev: any) => ({ ...prev, ...res.data }));
    } catch {}
  };

  const handleNuevaCarga = () => {
    reset();
    const id = sucursalActual?.sucursalId;
    if (id) refrescarSucursal(id);
  };

  const comprobantesValidos = comprobantes.filter(
    (c) => (c.apiEncontrado === true || (c as any).tieneAdvertencia === true) && c.errores.length === 0
  );
  const comprobantesConError = comprobantes.filter(
    (c) => c.apiEncontrado === false && !(c as any).tieneAdvertencia
  );
  const totalImporte = comprobantesValidos.reduce((acc, c) => acc + calcularTotales(c).importeTotal, 0);
  const hayComprobantes = comprobantes.length > 0;
  const sinSucursal = isSuperAdmin && !sucursalActual;

  return (
    <div className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-blue-600 to-blue-700 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Carga Masiva de Comprobantes</h2>
              <p className="text-xs text-blue-100">Los comprobantes se guardarán como PENDIENTE</p>
            </div>
          </div>
          <button onClick={handleCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Contenido scrollable ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Selector sucursal superadmin ── */}
          {isSuperAdmin && (
            <div className="px-6 pt-4">
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${!sucursalActual ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <Building2 size={16} className={`shrink-0 ${!sucursalActual ? "text-amber-500" : "text-green-600"}`} />
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">
                    Sucursal emisora <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sucursalActual?.sucursalId ?? ""}
                    onChange={(e) => {
                      const found = sucursales.find((s: any) => s.sucursalId === Number(e.target.value));
                      setSucursalActual(found ?? null);
                    }}
                    className="w-full py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">Seleccionar sucursal...</option>
                    {sucursales.map((s: any) => (
                      <option key={s.sucursalId} value={s.sucursalId}>
                        {s.nombre ?? s.codEstablecimiento} — {s.serieBoleta} / {s.serieFactura}
                      </option>
                    ))}
                  </select>
                </div>
                {!sucursalActual && <span className="text-xs text-amber-600 font-medium shrink-0">Requerido</span>}
              </div>
            </div>
          )}

          {/* ── Cabecera info ── */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex-wrap">
                {/* Fecha emisión */}
                <div className="flex-1 min-w-55">
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Fecha Emisión:
                    </label>
                    <input
                    type="date"
                    value={fechaEmision}
                    min={dosAntesISO}
                    max={hoy}
                    disabled
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                    />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                    {fechaEmision ? formatFechaLarga(fechaEmision) : "—"} Será Tomada del Excel (máx. 2 días antes)
                </p>
                </div>

              <div className="w-px h-12 bg-gray-200 shrink-0 hidden sm:block" />

              {/* Tipo pago */}
              <div className="shrink-0">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Tipo de Pago</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                  Contado <span className="text-gray-400 font-normal text-xs">(Efectivo)</span>
                </p>
              </div>

              <div className="w-px h-12 bg-gray-200 shrink-0 hidden sm:block" />
                
                {/* Aviso pendiente */}
              <div className="flex items-start gap-2">
                <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700">Guardado como PENDIENTE</p>
                  <p className="text-[10px] text-amber-600 leading-relaxed mt-0.5">
                    Envíalos a SUNAT desde el módulo de comprobantes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Errores de parseo del Excel (siempre visibles) ── */}
          {erroresGlobales.length > 0 && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
                <AlertCircle size={15} />
                Errores en el Excel ({erroresGlobales.length}) — corrija el archivo y vuelva a cargarlo
              </div>
              <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {erroresGlobales.map((err, i) => (
                  <li key={i} className="text-xs text-red-600 flex items-start gap-2 py-0.5 border-b border-red-100 last:border-0">
                    <span className="shrink-0 font-bold text-red-400 mt-0.5">{i + 1}.</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Zona sin comprobantes: drag area central ── */}
          {!hayComprobantes && (
            <div className="px-6 pt-4">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center gap-4 bg-gray-50/50">
                <FileSpreadsheet size={40} className="text-gray-300" />
                <p className="text-sm text-gray-400 font-medium">Descarga la plantilla o carga una con tus comprobantes</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={descargarPlantilla}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download size={14} /> Descargar Plantilla
                  </button>
                  <button
                    onClick={() => {
                      if (sinSucursal) { alert("Debe seleccionar una sucursal primero"); return; }
                      fileInputRef.current?.click();
                    }}
                    disabled={cargando}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-100"
                  >
                    {cargando
                      ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                      : <><Upload size={14} /> Cargar Comprobantes</>}
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* ── Con comprobantes ── */}
          {hayComprobantes && (
            <>
              {/* Stats + botones en una línea */}
              <div className="px-6 pt-4 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs">
                    <span className="text-blue-500">Total:</span>
                    <strong className="text-blue-700">{comprobantes.length}</strong>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                    <span className="text-emerald-600">Válidos:</span>
                    <strong className="text-emerald-700">{comprobantesValidos.length}</strong>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs">
                    <span className="text-red-500">Con error:</span>
                    <strong className="text-red-600">{comprobantesConError.length}</strong>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    <span className="text-gray-500">Importe:</span>
                    <strong className="text-gray-900">S/ {totalImporte.toFixed(2)}</strong>
                </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={descargarPlantilla} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold transition-colors">
                    <Download size={13} /> Plantilla
                  </button>
                  <button
                    onClick={() => {
                      if (sinSucursal) { alert("Debe seleccionar una sucursal primero"); return; }
                      fileInputRef.current?.click();
                    }}
                    disabled={cargando}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {cargando ? <><Loader2 size={13} className="animate-spin" /> Cargando...</> : <><Upload size={13} /> Cargar</>}
                  </button>
                  <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors">
                    <X size={12} /> Limpiar
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

              {/* Tabla */}
              <div className="px-6 pt-3 pb-2">
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-gray-400 font-semibold w-8">#</th>
                        <th className="px-3 py-2.5 text-left text-gray-400 font-semibold w-20">Tipo</th>
                        <th className="px-3 py-2.5 text-left text-gray-400 font-semibold w-28">RUC/DNI</th>
                        <th className="px-3 py-2.5 text-left text-gray-400 font-semibold">Razón Social / Contacto</th>
                        <th className="px-3 py-2.5 text-center text-gray-400 font-semibold w-16">Ítems</th>
                        <th className="px-3 py-2.5 text-center text-gray-400 font-semibold w-16">Moneda</th>
                        <th className="px-3 py-2.5 text-right text-gray-400 font-semibold w-20">IGV</th>
                        <th className="px-3 py-2.5 text-right text-gray-400 font-semibold w-24">Total</th>
                        <th className="px-3 py-2.5 text-center text-gray-400 font-semibold w-24">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comprobantes.map((comp, idx) => (
                        <FilaComprobante key={comp.id} comp={comp} idx={idx} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Resultado final ── */}
          {resultado && (
            <div className="mx-6 mt-3 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-3">
                <CheckCircle2 size={15} /> Carga finalizada
              </div>
                <div className="flex items-center gap-6 mb-2">
                {[
                    { label: "Total", val: resultado.total, color: "text-gray-800" },
                    { label: "Exitosos", val: resultado.exitosos, color: "text-emerald-700" },
                    { label: "Fallidos", val: resultado.fallidos, color: "text-red-600" },
                ].map(({ label, val, color }) => (
                    <div key={label} className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{val}</p>
                    </div>
                ))}
                </div>
              {resultado.resultados.filter((r) => !r.exitoso).map((r, i) => (
                <div key={i} className="text-xs text-red-600 flex items-start gap-1.5 mt-1">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>{r.numeroCompleto}: {r.mensaje}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl shrink-0">
          {showCerrarAviso && (
            <div className="mb-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Los comprobantes guardados quedarán como <strong>PENDIENTE</strong> en la BD. Podrá enviarlos a SUNAT desde el módulo de comprobantes.
              </p>
            </div>
          )}

          {guardando && (
            <div className="mb-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" /> Guardando comprobantes...
                </span>
                <span>{progreso}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}

          {resultado ? (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleNuevaCarga}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
              >
                <RefreshCw size={14} /> Nueva Carga
              </button>
              <button
                onClick={handleCerrar}
                className="flex items-center gap-2 px-5 py-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-600 hover:text-gray-800 rounded-xl text-sm font-medium transition-colors"
              >
                <X size={14} /> Cerrar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={handleCerrar}
                className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 bg-white rounded-xl transition-colors font-medium"
              >
                {showCerrarAviso ? "Cerrar de todas formas" : "Cancelar"}
              </button>
              <button
                onClick={handleGuardar}
                disabled={!puedeGuardar || sinSucursal || guardando || !!resultado}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-sm
                  ${puedeGuardar && !sinSucursal && !guardando
                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                    : "bg-gray-300 cursor-not-allowed opacity-60"}`}
              >
                {guardando
                  ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                  : `Guardar Carga Masiva (${comprobantesValidos.length})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}