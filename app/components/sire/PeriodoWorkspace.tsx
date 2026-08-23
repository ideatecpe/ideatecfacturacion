"use client";
import { useEffect, useMemo, useState, forwardRef, useImperativeHandle, type ReactNode } from "react";
import {
  RefreshCw,
  FileWarning,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
  Trash2,
  Plus,
  DollarSign,
  Search,
  X,
} from "lucide-react";
import ExcelJS from "exceljs";
import { cn } from "@/app/utils/cn";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { useSireDescargarPropuesta } from "@/app/factufly/sire/gestionSire/useSireDescargarPropuesta";
import { useSireAceptarPropuesta } from "@/app/factufly/sire/gestionSire/useSireAceptarPropuesta";
import { useSireCerrarPeriodo } from "@/app/factufly/sire/gestionSire/useSireCerrarPeriodo";
import { useSireEliminarComprobante } from "@/app/factufly/sire/gestionSire/useSireEliminarComprobante";
import { useSireImportarComprobante } from "@/app/factufly/sire/gestionSire/useSireImportarComprobante";
import { useSireEditarTipoCambio } from "@/app/factufly/sire/gestionSire/useSireEditarTipoCambio";
import { SireComprobanteDto, SireComprobanteNuevoDto } from "@/app/factufly/sire/gestionSire/types";

const TIPO_COMPROBANTE: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de Crédito",
  "08": "Nota de Débito",
};

function formatMoneda(valor: number, moneda: string | null) {
  const simbolo = moneda === "USD" ? "$" : "S/";
  return `${simbolo} ${valor.toFixed(2)}`;
}

function fechaAIso(fecha: string | null): string {
  if (!fecha) return "";
  const [d, m, y] = fecha.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function formatPeriodoLabel(perTributario: string): string {
  if (!perTributario || perTributario.length !== 6) return perTributario;
  const anio = perTributario.slice(0, 4);
  const mes = perTributario.slice(4, 6);
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const idx = parseInt(mes, 10) - 1;
  return `${MESES[idx] ?? mes} ${anio}`;
}

const COLOR_NAVY = "FF1A2B4A";
const COLOR_TH_BG = "FFE2E8F0";
const COLOR_GRIS = "FFF8FAFC";
const COLOR_BORDE = "FFCBD5E1";

async function exportarExcel(
  comprobantes: SireComprobanteDto[],
  perTributario: string,
  ruc: string,
  nombreEmpresa?: string | null,
) {
  const columnas: { header: string; key: string; width: number; numero?: boolean }[] = [
    { header: "Fecha Emisión", key: "fecha", width: 14 },
    { header: "Tipo", key: "tipo", width: 16 },
    { header: "Serie", key: "serie", width: 10 },
    { header: "Número", key: "numero", width: 12 },
    { header: "Cliente", key: "cliente", width: 42 },
    { header: "Doc. Cliente", key: "docCliente", width: 16 },
    { header: "Base Imponible", key: "base", width: 16, numero: true },
    { header: "IGV", key: "igv", width: 14, numero: true },
    { header: "Total", key: "total", width: 14, numero: true },
    { header: "Moneda", key: "moneda", width: 10 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Inconsistencias", key: "inconsistencias", width: 34 },
  ];
  const totalCols = columnas.length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FactuFly";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Propuesta SIRE", {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
  });
  sheet.columns = columnas.map((c) => ({ key: c.key, width: c.width }));

  // Título
  sheet.mergeCells(1, 1, 1, totalCols);
  const tituloCell = sheet.getCell(1, 1);
  tituloCell.value = "SIRE — Registro de Ventas e Ingresos Electrónico (RVIE)";
  tituloCell.font = { bold: true, size: 14, color: { argb: COLOR_NAVY } };
  tituloCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;

  // Empresa / RUC / Periodo
  sheet.mergeCells(2, 1, 2, totalCols);
  const infoCell = sheet.getCell(2, 1);
  const partesInfo = [
    nombreEmpresa ? nombreEmpresa : null,
    `RUC: ${ruc}`,
    `Periodo: ${formatPeriodoLabel(perTributario)} (${perTributario})`,
    `Generado: ${new Date().toLocaleDateString("es-PE")}`,
  ].filter(Boolean);
  infoCell.value = partesInfo.join("   |   ");
  infoCell.font = { size: 10, color: { argb: COLOR_NAVY } };
  infoCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2).height = 18;

  sheet.getRow(3).height = 6;

  // Encabezados de la tabla
  const headerRowIndex = 4;
  const headerRow = sheet.getRow(headerRowIndex);
  columnas.forEach((c, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: COLOR_NAVY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TH_BG } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLOR_BORDE } },
      bottom: { style: "thin", color: { argb: COLOR_BORDE } },
      left: { style: "thin", color: { argb: COLOR_BORDE } },
      right: { style: "thin", color: { argb: COLOR_BORDE } },
    };
  });
  headerRow.height = 22;

  // Filas de datos
  comprobantes.forEach((c, i) => {
    const row = sheet.getRow(headerRowIndex + 1 + i);
    const valores: (string | number)[] = [
      c.fechaEmision ?? "",
      TIPO_COMPROBANTE[c.tipoComprobante ?? ""] ?? c.tipoComprobante ?? "",
      c.serie ?? "",
      c.numero ?? "",
      c.razonSocialCliente ?? "",
      c.numDocCliente ?? "",
      c.baseImponible,
      c.igv,
      c.importeTotal,
      c.codMoneda ?? "",
      c.activo ? "Activo" : "Anulado",
      c.inconsistencias ?? "",
    ];

    valores.forEach((valor, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = valor;
      cell.font = { size: 10, color: { argb: COLOR_NAVY } };
      cell.alignment = { vertical: "middle", horizontal: columnas[ci].numero ? "right" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? COLOR_GRIS : "FFFFFFFF" } };
      cell.border = {
        top: { style: "hair", color: { argb: COLOR_BORDE } },
        bottom: { style: "hair", color: { argb: COLOR_BORDE } },
        left: { style: "hair", color: { argb: COLOR_BORDE } },
        right: { style: "hair", color: { argb: COLOR_BORDE } },
      };
      if (columnas[ci].numero) cell.numFmt = "#,##0.00";
    });
  });

  // Fila de totales
  const totales = comprobantes.reduce(
    (acc, c) => ({ base: acc.base + c.baseImponible, igv: acc.igv + c.igv, total: acc.total + c.importeTotal }),
    { base: 0, igv: 0, total: 0 },
  );
  const totalRowIndex = headerRowIndex + 1 + comprobantes.length;
  const totalRow = sheet.getRow(totalRowIndex);
  sheet.mergeCells(totalRowIndex, 1, totalRowIndex, 6);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = `TOTAL (${comprobantes.length})`;
  totalLabelCell.font = { bold: true, size: 10, color: { argb: COLOR_NAVY } };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "right" };
  totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TH_BG } };

  const totalValores = [totales.base, totales.igv, totales.total];
  [7, 8, 9].forEach((colIdx, i) => {
    const cell = totalRow.getCell(colIdx);
    cell.value = totalValores[i];
    cell.font = { bold: true, size: 10, color: { argb: COLOR_NAVY } };
    cell.numFmt = "#,##0.00";
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TH_BG } };
  });
  [10, 11, 12].forEach((colIdx) => {
    totalRow.getCell(colIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TH_BG } };
  });
  totalRow.height = 20;

  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `propuesta-sire-${perTributario}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = "resumen" | "propuesta" | "acciones";

interface Props {
  ruc: string;
  nombreEmpresa?: string | null;
  perTributario: string;
  estadoSunat: string | null;
  descripcion: string | null;
  estadoLocal?: string | null;
  canManage: boolean;
  onAccionExitosa: () => void;
}

export interface PeriodoWorkspaceHandle {
  cargarPropuesta: () => void;
}

export const PeriodoWorkspace = forwardRef<PeriodoWorkspaceHandle, Props>(function PeriodoWorkspace(
  { ruc, nombreEmpresa, perTributario, estadoSunat, descripcion, estadoLocal, canManage, onAccionExitosa },
  ref,
) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [comprobantes, setComprobantes] = useState<SireComprobanteDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<"aceptar" | "cerrar" | null>(null);
  const [comprobanteAEliminar, setComprobanteAEliminar] = useState<SireComprobanteDto | null>(null);
  const [destinoEliminar, setDestinoEliminar] = useState<"propuesta" | "preliminar">("propuesta");
  const [mostrarFormAgregar, setMostrarFormAgregar] = useState(false);
  const [comprobanteEditarCambio, setComprobanteEditarCambio] = useState<SireComprobanteDto | null>(null);
  const [nuevoTipoCambio, setNuevoTipoCambio] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const { loading: cargandoPropuesta, descargarPropuesta } = useSireDescargarPropuesta();
  const { loading: aceptando, aceptarPropuesta } = useSireAceptarPropuesta();
  const { loading: cerrando, cerrarPeriodo } = useSireCerrarPeriodo();
  const { loading: eliminando, eliminarComprobante } = useSireEliminarComprobante();
  const { loading: agregando, importarComprobante } = useSireImportarComprobante();
  const { loading: editandoCambio, editarTipoCambio } = useSireEditarTipoCambio();

  useEffect(() => {
    setComprobantes(null);
    setError(null);
    setTab("resumen");
  }, [ruc, perTributario]);

  const cargarPropuesta = async () => {
    setError(null);
    const data = await descargarPropuesta(ruc, perTributario);
    if (data?.success) {
      setComprobantes(data.comprobantes);
    } else {
      setError(data?.mensaje ?? "No se pudo generar la propuesta");
    }
  };

  useImperativeHandle(ref, () => ({
    cargarPropuesta: () => {
      setTab("resumen");
      cargarPropuesta();
    },
  }));

  const confirmarAceptar = async () => {
    setConfirmando(null);
    await aceptarPropuesta(ruc, perTributario);
    onAccionExitosa();
  };

  const confirmarCerrar = async () => {
    setConfirmando(null);
    await cerrarPeriodo(ruc, perTributario);
    onAccionExitosa();
  };

  const confirmarEliminar = async () => {
    if (!comprobanteAEliminar) return;
    const c = comprobanteAEliminar;
    setComprobanteAEliminar(null);
    const resultado = await eliminarComprobante(ruc, perTributario, destinoEliminar === "preliminar", {
      numSerieCDP: c.serie ?? "",
      numCDP: c.numero ?? "",
      codCar: c.carSunat ?? "",
      codTipoCDP: c.tipoComprobante ?? "",
    });
    if (resultado?.success) {
      setComprobantes((prev) => prev?.filter((x) => x !== c) ?? null);
    }
    onAccionExitosa();
  };

  const confirmarEditarCambio = async () => {
    if (!comprobanteEditarCambio) return;
    const valor = Number(nuevoTipoCambio);
    if (!valor || valor <= 0) return;

    const resultado = await editarTipoCambio(ruc, perTributario, {
      codCar: comprobanteEditarCambio.carSunat ?? "",
      codMoneda: comprobanteEditarCambio.codMoneda ?? "USD",
      mtoTipoCambio: valor,
    });
    if (resultado?.success) {
      setComprobantes((prev) =>
        prev?.map((x) => (x === comprobanteEditarCambio ? { ...x, tipoCambio: valor } : x)) ?? null,
      );
    }
    setComprobanteEditarCambio(null);
    setNuevoTipoCambio("");
    onAccionExitosa();
  };

  const confirmarAgregar = async (nuevo: SireComprobanteNuevoDto, destino: "propuesta" | "preliminar") => {
    const resultado = await importarComprobante(ruc, perTributario, destino === "preliminar", nuevo);
    if (resultado?.success) {
      setMostrarFormAgregar(false);
      setComprobantes(null); // fuerza recargar la propuesta para ver el comprobante agregado
    }
    onAccionExitosa();
  };

  const periodoCerrado = estadoLocal === "CERRADO";
  const propuestaAceptada = periodoCerrado || estadoLocal === "PROPUESTA_ACEPTADA";

  const activos = comprobantes?.filter((c) => c.activo) ?? [];
  const conInconsistencias = comprobantes?.filter((c) => !!c.inconsistencias) ?? [];
  const totales = activos.reduce(
    (acc, c) => ({ base: acc.base + c.baseImponible, igv: acc.igv + c.igv, total: acc.total + c.importeTotal }),
    { base: 0, igv: 0, total: 0 },
  );
  const porTipo = activos.reduce<Record<string, { cantidad: number; total: number }>>((acc, c) => {
    const key = c.tipoComprobante ?? "—";
    if (!acc[key]) acc[key] = { cantidad: 0, total: 0 };
    acc[key].cantidad += 1;
    acc[key].total += c.importeTotal;
    return acc;
  }, {});

  const rangoFechaPeriodo = useMemo(() => {
    if (!/^\d{6}$/.test(perTributario)) return null;
    const anio = Number(perTributario.slice(0, 4));
    const mes = Number(perTributario.slice(4, 6));
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      min: `${anio}-${pad(mes)}-01`,
      max: `${anio}-${pad(mes)}-${pad(ultimoDia)}`,
    };
  }, [perTributario]);

  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    (comprobantes ?? []).forEach((c) => {
      if (c.tipoComprobante) set.add(c.tipoComprobante);
    });
    return Array.from(set);
  }, [comprobantes]);

  const comprobantesFiltrados = useMemo(() => {
    if (!comprobantes) return [];
    const q = busqueda.trim().toLowerCase();
    return comprobantes.filter((c) => {
      if (filtroTipo && c.tipoComprobante !== filtroTipo) return false;
      if (filtroFecha && fechaAIso(c.fechaEmision) !== filtroFecha) return false;
      if (q) {
        const campos = [c.serie, c.numero, c.numDocCliente, c.razonSocialCliente].map((v) => (v ?? "").toLowerCase());
        if (!campos.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [comprobantes, busqueda, filtroFecha, filtroTipo]);

  const totalesTabla = comprobantesFiltrados.reduce(
    (acc, c) => ({ base: acc.base + c.baseImponible, igv: acc.igv + c.igv, total: acc.total + c.importeTotal }),
    { base: 0, igv: 0, total: 0 },
  );

  const hayFiltrosActivos = !!(busqueda || filtroFecha || filtroTipo);
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroFecha("");
    setFiltroTipo("");
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-100">
        {([
          { id: "resumen", label: "Resumen" },
          { id: "propuesta", label: "Propuesta" },
          { id: "acciones", label: "Acciones" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px",
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* ── Resumen y Propuesta comparten el mismo dataset (comprobantes) ── */}
        {(tab === "resumen" || tab === "propuesta") && !comprobantes && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            {cargandoPropuesta ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                <p className="text-sm text-gray-500">Generando propuesta en SUNAT...</p>
                <p className="text-xs text-gray-400">Esto puede tardar hasta un minuto, SUNAT procesa el reporte de forma asíncrona.</p>
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center max-w-sm">
                Aún no se ha cargado la propuesta de este periodo. Usa el botón <strong>&quot;Cargar propuesta&quot;</strong> de la parte superior para consultarla directamente contra producción de SUNAT.
              </p>
            )}
          </div>
        )}

        {(tab === "resumen" || tab === "propuesta") && error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <FileWarning className="w-8 h-8 text-amber-400" />
            <p className="text-sm text-gray-600 font-medium text-center max-w-md">{error}</p>
            <Button variant="outline" onClick={cargarPropuesta} className="h-9 text-xs">
              <RefreshCw size={13} />
              Reintentar
            </Button>
          </div>
        )}

        {/* Resumen */}
        {tab === "resumen" && comprobantes && (
          comprobantes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">SUNAT no reportó comprobantes para este periodo.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Comprobantes" value={String(comprobantes.length)} />
                <StatCard label="Activos" value={String(activos.length)} />
                <StatCard
                  label="Con inconsistencias"
                  value={String(conInconsistencias.length)}
                  warn={conInconsistencias.length > 0}
                />
                <StatCard label="Total (activos)" value={formatMoneda(totales.total, null)} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo de Documento</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Cantidad</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(porTipo).map(([tipo, v]) => (
                      <tr key={tipo}>
                        <td className="px-4 py-2 text-xs text-gray-700">{TIPO_COMPROBANTE[tipo] ?? tipo}</td>
                        <td className="px-4 py-2 text-xs text-gray-700 text-right">{v.cantidad}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-900 text-right">{formatMoneda(v.total, null)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-xs text-gray-800">Total</td>
                      <td className="px-4 py-2 text-xs text-gray-800 text-right">{activos.length}</td>
                      <td className="px-4 py-2 text-xs text-gray-900 text-right">{formatMoneda(totales.total, null)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Propuesta */}
        {tab === "propuesta" && comprobantes && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {comprobantes.length > 0 && (
                <>
                  <div className="relative min-w-40 max-w-96 flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por serie, número, doc. o nombre..."
                      className="h-9 pl-8 pr-7 rounded-lg border border-gray-200 text-xs w-full"
                    />
                    {busqueda && (
                      <button
                        onClick={() => setBusqueda("")}
                        title="Borrar búsqueda"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                    min={rangoFechaPeriodo?.min}
                    max={rangoFechaPeriodo?.max}
                    className="h-9 px-2 rounded-lg border border-gray-200 text-xs text-gray-700 w-36"
                    title="Filtrar por fecha de emisión"
                  />
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="h-9 px-2 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white"
                  >
                    <option value="">Todos los tipos</option>
                    {tiposDisponibles.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_COMPROBANTE[t] ?? t}
                      </option>
                    ))}
                  </select>
                  {hayFiltrosActivos && (
                    <button
                      onClick={limpiarFiltros}
                      className="text-xs text-rose-500 hover:text-rose-700 font-medium underline underline-offset-2"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={cargarPropuesta}
                  disabled={cargandoPropuesta}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw size={13} className={cn(cargandoPropuesta && "animate-spin")} />
                  Recargar propuesta
                </button>
                {canManage && (
                  <button
                    onClick={() => setMostrarFormAgregar(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Plus size={13} />
                    Agregar comprobante
                  </button>
                )}
                {comprobantes.length > 0 && (
                  <button
                    onClick={() => exportarExcel(comprobantes, perTributario, ruc, nombreEmpresa)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet size={13} />
                    Exportar Excel
                  </button>
                )}
              </div>
            </div>

            {comprobantes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">SUNAT no reportó comprobantes para este periodo.</p>
            ) : comprobantesFiltrados.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Ningún comprobante coincide con los filtros aplicados.</p>
            ) : (
                  <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[240px] rounded-lg border border-gray-100">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Base Imp.</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">IGV</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                          {canManage && <th className="px-4 py-2.5" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {comprobantesFiltrados.map((c, idx) => (
                      <tr key={`${c.carSunat}-${idx}`} className={cn("hover:bg-gray-50/50 transition-colors", !c.activo && "opacity-50")}>
                        <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">{c.fechaEmision ?? "—"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <p className="text-xs font-medium text-gray-900">{c.serie}-{c.numero}</p>
                          <p className="text-[10px] text-gray-400">{TIPO_COMPROBANTE[c.tipoComprobante ?? ""] ?? c.tipoComprobante}</p>
                          {c.inconsistencias && (
                            <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                              <FileWarning size={10} /> {c.inconsistencias}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-xs font-medium text-gray-900 truncate max-w-52">{c.razonSocialCliente ?? "—"}</p>
                          <p className="text-[10px] text-gray-400">{c.numDocCliente ?? "—"}</p>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.baseImponible, c.codMoneda)}</td>
                        <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.igv, c.codMoneda)}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-900 text-right whitespace-nowrap">{formatMoneda(c.importeTotal, c.codMoneda)}</td>
                        <td className="px-4 py-2 text-center">
                          {c.activo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-semibold">
                              <CheckCircle2 size={10} /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[10px] font-semibold">
                              <XCircle size={10} /> Anulado
                            </span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {c.codMoneda && c.codMoneda !== "PEN" && (
                                <button
                                  onClick={() => {
                                    setComprobanteEditarCambio(c);
                                    setNuevoTipoCambio(c.tipoCambio ? String(c.tipoCambio) : "");
                                  }}
                                  title="Editar tipo de cambio"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                  <DollarSign size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => setComprobanteAEliminar(c)}
                                title="Eliminar comprobante"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-4 py-2 text-xs text-gray-700" colSpan={3}>
                            Totales ({comprobantesFiltrados.length})
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTabla.base, null)}</td>
                          <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTabla.igv, null)}</td>
                          <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTabla.total, null)}</td>
                          <td className="px-4 py-2" />
                          {canManage && <td className="px-4 py-2" />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
            )}
          </div>
        )}

        {/* Acciones */}
        {tab === "acciones" && (
          <div className="max-w-md">
            {!canManage && (
              <div className="flex items-center gap-2.5 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  Solo un administrador puede aceptar propuestas o cerrar periodos.
                </p>
              </div>
            )}

            {/* Indicador de pasos: Aceptar propuesta → Cerrar mes */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1 mb-5">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0",
                    propuestaAceptada
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-blue-600 text-blue-600",
                  )}
                >
                  {propuestaAceptada ? <CheckCircle2 size={16} /> : "1"}
                </div>
                <p className={cn("text-xs font-semibold text-center", propuestaAceptada ? "text-blue-700" : "text-gray-700")}>
                  Aceptar propuesta
                </p>
              </div>

              <div className={cn("h-0.5 w-8 mt-[18px]", propuestaAceptada ? "bg-blue-600" : "bg-gray-200")} />

              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0",
                    periodoCerrado
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : propuestaAceptada
                        ? "bg-white border-emerald-600 text-emerald-600"
                        : "bg-white border-gray-300 text-gray-400",
                  )}
                >
                  {periodoCerrado ? <CheckCircle2 size={16} /> : "2"}
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold text-center",
                    periodoCerrado ? "text-emerald-700" : propuestaAceptada ? "text-emerald-700" : "text-gray-400",
                  )}
                >
                  Cerrar mes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1">
              <button
                onClick={() => setConfirmando("aceptar")}
                disabled={!canManage || aceptando || cerrando}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {aceptando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Aceptar
              </button>

              <div className="w-8" />

              <button
                onClick={() => setConfirmando("cerrar")}
                disabled={!canManage || aceptando || cerrando || !propuestaAceptada}
                title={!propuestaAceptada ? "Primero debes aceptar la propuesta" : undefined}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {cerrando ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                Cerrar mes
              </button>
            </div>

            {!propuestaAceptada && (
              <p className="text-xs text-gray-400 text-center mt-3">
                Primero acepta la propuesta para poder cerrar el mes.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confirmación: Aceptar propuesta */}
      <Modal
        isOpen={confirmando === "aceptar"}
        onClose={() => setConfirmando(null)}
        title="Confirmar aceptación de propuesta"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">¿Aceptar la propuesta de SUNAT?</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Se aceptará la propuesta del periodo <strong>{formatPeriodoLabel(perTributario)}</strong> ({perTributario}) para el RUC <strong>{ruc}</strong> directamente en producción de SUNAT.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmando(null)}>Cancelar</Button>
            <Button onClick={confirmarAceptar}>
              <CheckCircle2 size={14} /> Aceptar propuesta
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmación: Cerrar mes */}
      <Modal
        isOpen={confirmando === "cerrar"}
        onClose={() => setConfirmando(null)}
        title="Confirmar cierre de periodo"
      >
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800">¿Cerrar este periodo?</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Se registrará el preliminar del periodo <strong>{formatPeriodoLabel(perTributario)}</strong> ({perTributario}) para el RUC <strong>{ruc}</strong> directamente en producción de SUNAT. Esta acción puede tardar hasta un minuto.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmando(null)}>Cancelar</Button>
            <button
              onClick={confirmarCerrar}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
            >
              <Lock size={14} /> Cerrar mes
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmación: Eliminar comprobante */}
      <Modal
        isOpen={!!comprobanteAEliminar}
        onClose={() => setComprobanteAEliminar(null)}
        title="Confirmar eliminación de comprobante"
      >
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-800">
                ¿Eliminar {comprobanteAEliminar?.serie}-{comprobanteAEliminar?.numero}?
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                Se eliminará directamente en producción de SUNAT para el RUC <strong>{ruc}</strong>, periodo <strong>{formatPeriodoLabel(perTributario)}</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">¿Dónde está este periodo actualmente?</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDestinoEliminar("propuesta")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors",
                  destinoEliminar === "propuesta" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500",
                )}
              >
                En propuesta (aún no cerré el mes)
              </button>
              <button
                onClick={() => setDestinoEliminar("preliminar")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors",
                  destinoEliminar === "preliminar" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500",
                )}
              >
                Ya cerré el mes (preliminar)
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Si ya aceptaste la propuesta pero aún no le diste a &quot;Cerrar mes&quot;, sigues en propuesta.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setComprobanteAEliminar(null)}>Cancelar</Button>
            <button
              onClick={confirmarEliminar}
              disabled={eliminando}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors"
            >
              {eliminando ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />} Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* Editar tipo de cambio individual */}
      <Modal
        isOpen={!!comprobanteEditarCambio}
        onClose={() => setComprobanteEditarCambio(null)}
        title="Editar tipo de cambio"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Comprobante <strong>{comprobanteEditarCambio?.serie}-{comprobanteEditarCambio?.numero}</strong> ({comprobanteEditarCambio?.codMoneda}). Se actualizará directamente en la propuesta de SUNAT (solo aplica antes de aceptar la propuesta).
          </p>
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
            Tipo de cambio actual (propuesto por SUNAT):{" "}
            <strong className="text-gray-800">
              {comprobanteEditarCambio?.tipoCambio ? comprobanteEditarCambio.tipoCambio.toFixed(3) : "SUNAT no propuso un tipo de cambio para este comprobante"}
            </strong>
          </div>
          <Campo label={`Nuevo tipo de cambio (PEN a ${comprobanteEditarCambio?.codMoneda ?? "USD"})`}>
            <input
              type="number"
              step="0.001"
              autoFocus
              value={nuevoTipoCambio}
              onChange={(e) => setNuevoTipoCambio(e.target.value)}
              placeholder="3.750"
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm w-full"
            />
          </Campo>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setComprobanteEditarCambio(null)}>Cancelar</Button>
            <Button
              onClick={confirmarEditarCambio}
              disabled={editandoCambio || !nuevoTipoCambio || Number(nuevoTipoCambio) <= 0}
            >
              {editandoCambio ? <RefreshCw size={14} className="animate-spin" /> : <DollarSign size={14} />} Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Agregar comprobante no incluido en la propuesta */}
      <ModalAgregarComprobante
        isOpen={mostrarFormAgregar}
        onClose={() => setMostrarFormAgregar(false)}
        onSubmit={confirmarAgregar}
        loading={agregando}
      />
    </div>
  );
});

PeriodoWorkspace.displayName = "PeriodoWorkspace";

const FECHA_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

// Validación básica según RS 112-2021/SUNAT, Anexo N°2 (campos obligatorios y reglas condicionales)
function validarComprobanteNuevo(form: SireComprobanteNuevoDto, esNota: boolean): Partial<Record<keyof SireComprobanteNuevoDto, string>> {
  const errores: Partial<Record<keyof SireComprobanteNuevoDto, string>> = {};

  if (!form.fechaEmision.trim()) errores.fechaEmision = "Ingresa la fecha de emisión";
  else if (!FECHA_REGEX.test(form.fechaEmision)) errores.fechaEmision = "Formato dd/mm/aaaa";

  if (!form.serie.trim()) errores.serie = "Ingresa la serie";
  else if (form.serie.length > 20) errores.serie = "Máximo 20 caracteres";

  if (!form.numero.trim()) errores.numero = "Ingresa el número";
  else if (form.numero.length > 20) errores.numero = "Máximo 20 caracteres";

  // Campo 11-13 (RS 112-2021): obligatorio en Factura y Notas; en Boleta solo si el total es >= S/700
  const requiereCliente = form.tipoComprobante === "01" || esNota || (form.tipoComprobante === "03" && form.importeTotal >= 700);
  if (requiereCliente) {
    if (!form.tipoDocCliente?.trim()) errores.tipoDocCliente = "Requerido para este tipo de comprobante";
    if (!form.numDocCliente?.trim()) errores.numDocCliente = "Requerido para este tipo de comprobante";
    if (!form.razonSocialCliente?.trim()) errores.razonSocialCliente = "Requerido para este tipo de comprobante";
  }

  if (form.baseImponible < 0) errores.baseImponible = "No puede ser negativo";
  if (form.igv < 0) errores.igv = "No puede ser negativo";
  if (!form.importeTotal) errores.importeTotal = "Ingresa el importe total";

  if (form.codMoneda !== "PEN" && (!form.tipoCambio || form.tipoCambio <= 0)) {
    errores.tipoCambio = "Obligatorio para moneda distinta a soles";
  }

  // Campos 29-32 (RS 112-2021): obligatorios solo en Notas de Crédito/Débito
  if (esNota) {
    if (!form.fechaEmisionDocModificado?.trim()) errores.fechaEmisionDocModificado = "Requerido en notas de crédito/débito";
    else if (!FECHA_REGEX.test(form.fechaEmisionDocModificado)) errores.fechaEmisionDocModificado = "Formato dd/mm/aaaa";
    if (!form.tipoCPModificado?.trim()) errores.tipoCPModificado = "Requerido en notas de crédito/débito";
    if (!form.serieCPModificado?.trim()) errores.serieCPModificado = "Requerido en notas de crédito/débito";
    if (!form.nroCPModificado?.trim()) errores.nroCPModificado = "Requerido en notas de crédito/débito";
  }

  return errores;
}

function ModalAgregarComprobante({
  isOpen,
  onClose,
  onSubmit,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nuevo: SireComprobanteNuevoDto, destino: "propuesta" | "preliminar") => void;
  loading: boolean;
}) {
  const vacio: SireComprobanteNuevoDto = {
    fechaEmision: "",
    tipoComprobante: "01",
    serie: "",
    numero: "",
    tipoDocCliente: "6",
    numDocCliente: "",
    razonSocialCliente: "",
    baseImponible: 0,
    igv: 0,
    importeTotal: 0,
    codMoneda: "PEN",
  };
  const [form, setForm] = useState<SireComprobanteNuevoDto>(vacio);
  const [destino, setDestino] = useState<"propuesta" | "preliminar">("propuesta");
  const [intentado, setIntentado] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(vacio);
      setDestino("propuesta");
      setIntentado(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const update = <K extends keyof SireComprobanteNuevoDto>(campo: K, valor: SireComprobanteNuevoDto[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const esNota = ["07", "08", "87", "88"].includes(form.tipoComprobante);
  const errores = validarComprobanteNuevo(form, esNota);
  const valido = Object.keys(errores).length === 0;
  const err = (campo: keyof SireComprobanteNuevoDto) => (intentado ? errores[campo] : undefined);

  const sumaBaseIgv = form.baseImponible + form.igv;
  const totalNoCoincide =
    form.importeTotal !== 0 && form.codMoneda === "PEN" && Math.abs(sumaBaseIgv - form.importeTotal) > 0.05;

  const handleSubmit = () => {
    if (!valido) {
      setIntentado(true);
      return;
    }
    onSubmit(form, destino);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar comprobante no incluido en la propuesta">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Se enviará directamente a producción de SUNAT (§5.4/§5.5 del manual RVIE). Verifica bien los datos antes de confirmar.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">¿Dónde agregar este comprobante?</label>
          <div className="flex gap-2">
            <button
              onClick={() => setDestino("propuesta")}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors",
                destino === "propuesta" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500",
              )}
            >
              En propuesta (aún no cerré el mes)
            </button>
            <button
              onClick={() => setDestino("preliminar")}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors",
                destino === "preliminar" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500",
              )}
            >
              Ya cerré el mes (preliminar)
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Si ya aceptaste la propuesta pero aún no le diste a &quot;Cerrar mes&quot;, sigues en propuesta.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha emisión" error={err("fechaEmision")}>
            <input
              value={form.fechaEmision}
              onChange={(e) => update("fechaEmision", e.target.value)}
              placeholder="dd/mm/aaaa, ej. 15/07/2026"
              maxLength={10}
              className={inputCls(!!err("fechaEmision"))}
            />
          </Campo>
          <Campo label="Tipo de comprobante">
            <select
              value={form.tipoComprobante}
              onChange={(e) => update("tipoComprobante", e.target.value)}
              className={inputCls(false) + " bg-white"}
            >
              <option value="01">Factura</option>
              <option value="03">Boleta</option>
              <option value="07">Nota de Crédito</option>
              <option value="08">Nota de Débito</option>
            </select>
          </Campo>
          <Campo label="Serie" error={err("serie")}>
            <input
              value={form.serie}
              onChange={(e) => update("serie", e.target.value)}
              placeholder="Ej. F001"
              maxLength={20}
              className={inputCls(!!err("serie"))}
            />
          </Campo>
          <Campo label="Número" error={err("numero")}>
            <input
              value={form.numero}
              onChange={(e) => update("numero", e.target.value)}
              placeholder="Ej. 15077"
              maxLength={20}
              className={inputCls(!!err("numero"))}
            />
          </Campo>
          <Campo label="Tipo doc. cliente" error={err("tipoDocCliente")}>
            <input
              value={form.tipoDocCliente ?? ""}
              onChange={(e) => update("tipoDocCliente", e.target.value)}
              placeholder="6 = RUC, 1 = DNI"
              className={inputCls(!!err("tipoDocCliente"))}
            />
          </Campo>
          <Campo label="Número doc. cliente" error={err("numDocCliente")}>
            <input
              value={form.numDocCliente ?? ""}
              onChange={(e) => update("numDocCliente", e.target.value)}
              placeholder="Ej. 20548114897"
              className={inputCls(!!err("numDocCliente"))}
            />
          </Campo>
          <Campo label="Cliente (razón social)" full error={err("razonSocialCliente")}>
            <input
              value={form.razonSocialCliente ?? ""}
              onChange={(e) => update("razonSocialCliente", e.target.value)}
              placeholder="Nombre o razón social del cliente"
              className={inputCls(!!err("razonSocialCliente"))}
            />
          </Campo>
          <Campo label="Base imponible" error={err("baseImponible")}>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.baseImponible}
              onChange={(e) => update("baseImponible", Number(e.target.value))}
              placeholder="0.00"
              className={inputCls(!!err("baseImponible"))}
            />
          </Campo>
          <Campo label="IGV" error={err("igv")}>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.igv}
              onChange={(e) => update("igv", Number(e.target.value))}
              placeholder="0.00"
              className={inputCls(!!err("igv"))}
            />
          </Campo>
          <Campo label="Total" error={err("importeTotal")}>
            <input
              type="number"
              step="0.01"
              value={form.importeTotal}
              onChange={(e) => update("importeTotal", Number(e.target.value))}
              placeholder="0.00"
              className={inputCls(!!err("importeTotal"))}
            />
            {!err("importeTotal") && totalNoCoincide && (
              <p className="text-[11px] text-amber-600">
                Base + IGV = {sumaBaseIgv.toFixed(2)}, pero el Total es {form.importeTotal.toFixed(2)}. Revisa los montos.
              </p>
            )}
          </Campo>
          <Campo label="Moneda">
            <select
              value={form.codMoneda}
              onChange={(e) => update("codMoneda", e.target.value)}
              className={inputCls(false) + " bg-white"}
            >
              <option value="PEN">PEN — Soles</option>
              <option value="USD">USD — Dólares</option>
            </select>
          </Campo>
          {form.codMoneda !== "PEN" && (
            <Campo label="Tipo de cambio" error={err("tipoCambio")}>
              <input
                type="number"
                step="0.001"
                min={0}
                value={form.tipoCambio ?? ""}
                onChange={(e) => update("tipoCambio", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="Ej. 3.750"
                className={inputCls(!!err("tipoCambio"))}
              />
            </Campo>
          )}

          {esNota && (
            <>
              <Campo label="Fecha emisión doc. modificado" error={err("fechaEmisionDocModificado")}>
                <input
                  value={form.fechaEmisionDocModificado ?? ""}
                  onChange={(e) => update("fechaEmisionDocModificado", e.target.value)}
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  className={inputCls(!!err("fechaEmisionDocModificado"))}
                />
              </Campo>
              <Campo label="Tipo doc. modificado" error={err("tipoCPModificado")}>
                <input
                  value={form.tipoCPModificado ?? ""}
                  onChange={(e) => update("tipoCPModificado", e.target.value)}
                  placeholder="Ej. 01 = Factura"
                  className={inputCls(!!err("tipoCPModificado"))}
                />
              </Campo>
              <Campo label="Serie doc. modificado" error={err("serieCPModificado")}>
                <input
                  value={form.serieCPModificado ?? ""}
                  onChange={(e) => update("serieCPModificado", e.target.value)}
                  placeholder="Ej. F001"
                  className={inputCls(!!err("serieCPModificado"))}
                />
              </Campo>
              <Campo label="Número doc. modificado" error={err("nroCPModificado")}>
                <input
                  value={form.nroCPModificado ?? ""}
                  onChange={(e) => update("nroCPModificado", e.target.value)}
                  placeholder="Ej. 15070"
                  className={inputCls(!!err("nroCPModificado"))}
                />
              </Campo>
            </>
          )}
        </div>

        {intentado && !valido && (
          <p className="text-xs text-rose-600 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Revisa los campos marcados en rojo antes de continuar.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} Agregar comprobante
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "h-9 px-3 rounded-lg border text-sm w-full",
    hasError ? "border-rose-400 focus:outline-rose-400" : "border-gray-200",
  );
}

function Campo({ label, full, error, children }: { label: string; full?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1", full && "col-span-2")}>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", warn ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100")}>
      <p className="text-[11px] text-gray-500 font-medium">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", warn ? "text-amber-700" : "text-gray-900")}>{value}</p>
    </div>
  );
}
