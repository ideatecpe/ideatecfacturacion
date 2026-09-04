"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, CalendarDays, FileWarning, FileSpreadsheet, Search, X, CheckCircle2, XCircle } from "lucide-react";
import ExcelJS from "exceljs";
import { cn } from "@/app/utils/cn";
import { Card } from "@/app/components/ui/Card";
import { useSirePeriodosRce } from "@/app/factufly/sire/gestionSire/useSirePeriodosRce";
import { useSireDescargarPropuestaCompras } from "@/app/factufly/sire/gestionSire/useSireDescargarPropuestaCompras";
import { SireEjercicioDto, SirePeriodoDto, SireComprobanteCompraDto } from "@/app/factufly/sire/gestionSire/types";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_COMPROBANTE: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de Crédito",
  "08": "Nota de Débito",
};

function formatPeriodoLabel(perTributario: string): string {
  if (!perTributario || perTributario.length !== 6) return perTributario;
  const anio = perTributario.slice(0, 4);
  const mes = perTributario.slice(4, 6);
  const idx = parseInt(mes, 10) - 1;
  return `${MESES[idx] ?? mes} ${anio}`;
}

function formatMesEstadoLabel(p: SirePeriodoDto): string {
  const perTributario = p.periodo ?? "";
  const mes = perTributario.length === 6 ? MESES[parseInt(perTributario.slice(4, 6), 10) - 1] : perTributario;
  return `${mes ?? perTributario} — ${p.estado ?? "—"}`;
}

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

// Misma paleta que el Excel de RVIE (PeriodoWorkspace.tsx) para mantener el mismo diseño
const COLOR_NAVY = "FF1A2B4A";
const COLOR_TH_BG = "FFE2E8F0";
const COLOR_GRIS = "FFF8FAFC";
const COLOR_BORDE = "FFCBD5E1";
const COLOR_BLANCO = "FFFFFFFF";
const COLOR_NC_BG = "FFF6E9DC";
const COLOR_ND_BG = "FFE8EAED";

async function exportarExcelRce(
  comprobantes: SireComprobanteCompraDto[],
  perTributario: string,
  ruc: string,
  nombreEmpresa?: string | null,
) {
  const hayExonerado = comprobantes.some((c) => c.mtoExonerado !== 0);
  const hayInafecto = comprobantes.some((c) => c.mtoInafecto !== 0);

  const columnas: { header: string; key: string; width: number; numero?: boolean }[] = [
    { header: "Fecha Emisión", key: "fecha", width: 14 },
    { header: "Tipo", key: "tipo", width: 16 },
    { header: "Serie", key: "serie", width: 10 },
    { header: "Número", key: "numero", width: 12 },
    { header: "Proveedor", key: "proveedor", width: 42 },
    { header: "RUC Proveedor", key: "rucProveedor", width: 14 },
    { header: "Base Imponible", key: "base", width: 16, numero: true },
    { header: "IGV", key: "igv", width: 14, numero: true },
    ...(hayExonerado ? [{ header: "Exonerado", key: "exonerado", width: 14, numero: true }] : []),
    ...(hayInafecto ? [{ header: "Inafecto", key: "inafecto", width: 14, numero: true }] : []),
    { header: "Total", key: "total", width: 14, numero: true },
    { header: "Moneda", key: "moneda", width: 10 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Inconsistencias", key: "inconsistencias", width: 34 },
  ];
  const totalCols = columnas.length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FactuFly";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Propuesta RCE", {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
  });
  sheet.columns = columnas.map((c) => ({ key: c.key, width: c.width }));

  sheet.mergeCells(1, 1, 1, totalCols);
  const tituloCell = sheet.getCell(1, 1);
  tituloCell.value = "SIRE — Registro de Compras Electrónico (RCE)";
  tituloCell.font = { bold: true, size: 14, color: { argb: COLOR_BLANCO } };
  tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_NAVY } };
  tituloCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 28;

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

  comprobantes.forEach((c, i) => {
    const row = sheet.getRow(headerRowIndex + 1 + i);
    const esNotaCredito = c.tipoComprobante === "07" || c.tipoComprobante === "87";
    const esNotaDebito = c.tipoComprobante === "08" || c.tipoComprobante === "88";
    const colorFila = esNotaCredito
      ? COLOR_NC_BG
      : esNotaDebito
        ? COLOR_ND_BG
        : i % 2 === 0
          ? COLOR_GRIS
          : COLOR_BLANCO;
    const valores: (string | number)[] = [
      c.fechaEmision ?? "",
      TIPO_COMPROBANTE[c.tipoComprobante ?? ""] ?? c.tipoComprobante ?? "",
      c.serie ?? "",
      c.numero ?? "",
      c.razonSocialProveedor ?? "",
      c.rucProveedor ?? "",
      c.baseImponible,
      c.igv,
      ...(hayExonerado ? [c.mtoExonerado] : []),
      ...(hayInafecto ? [c.mtoInafecto] : []),
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
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorFila } };
      cell.border = {
        top: { style: "hair", color: { argb: COLOR_BORDE } },
        bottom: { style: "hair", color: { argb: COLOR_BORDE } },
        left: { style: "hair", color: { argb: COLOR_BORDE } },
        right: { style: "hair", color: { argb: COLOR_BORDE } },
      };
      if (columnas[ci].numero) cell.numFmt = "#,##0.00";
    });
  });

  const totales = comprobantes.reduce(
    (acc, c) => ({
      base: acc.base + c.baseImponible,
      igv: acc.igv + c.igv,
      exonerado: acc.exonerado + c.mtoExonerado,
      inafecto: acc.inafecto + c.mtoInafecto,
      total: acc.total + c.importeTotal,
    }),
    { base: 0, igv: 0, exonerado: 0, inafecto: 0, total: 0 },
  );
  const totalRowIndex = headerRowIndex + 1 + comprobantes.length;
  const totalRow = sheet.getRow(totalRowIndex);
  sheet.mergeCells(totalRowIndex, 1, totalRowIndex, 6);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = `TOTAL (${comprobantes.length})`;
  totalLabelCell.font = { bold: true, size: 10, color: { argb: COLOR_BLANCO } };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "right" };
  totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_NAVY } };

  const colTotal = 7 + 2 + (hayExonerado ? 1 : 0) + (hayInafecto ? 1 : 0);
  const totalValores = [
    totales.base,
    totales.igv,
    ...(hayExonerado ? [totales.exonerado] : []),
    ...(hayInafecto ? [totales.inafecto] : []),
    totales.total,
  ];
  totalValores.forEach((val, i) => {
    const cell = totalRow.getCell(7 + i);
    cell.value = val;
    cell.font = { bold: true, size: 10, color: { argb: COLOR_BLANCO } };
    cell.numFmt = "#,##0.00";
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_NAVY } };
  });
  for (let ci = colTotal + 1; ci <= totalCols; ci++) {
    totalRow.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_NAVY } };
  }
  totalRow.height = 20;

  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `propuesta-rce-${perTributario}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  ruc: string;
  nombreEmpresa?: string | null;
}

export function RceWorkspace({ ruc, nombreEmpresa }: Props) {
  const [ejercicios, setEjercicios] = useState<SireEjercicioDto[]>([]);
  const [anioSel, setAnioSel] = useState<string | null>(null);
  const [mesSel, setMesSel] = useState<string | null>(null);
  const [comprobantes, setComprobantes] = useState<SireComprobanteCompraDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const { loading: loadingPeriodos, consultarPeriodosRce } = useSirePeriodosRce();
  const { loading: cargandoPropuesta, descargarPropuestaCompras } = useSireDescargarPropuestaCompras();

  const cargarPeriodos = useCallback(async () => {
    if (!ruc) return;
    const data = await consultarPeriodosRce(ruc);
    const ejs = data?.ejercicios ?? [];
    setEjercicios(ejs);
    setAnioSel((prev) => (prev && ejs.some((e) => e.anio === prev) ? prev : (ejs[0]?.anio ?? null)));
  }, [ruc, consultarPeriodosRce]);

  useEffect(() => {
    if (ruc) cargarPeriodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruc]);

  useEffect(() => {
    setComprobantes(null);
    setError(null);
    setBusqueda("");
    setFiltroFecha("");
    setFiltroTipo("");
  }, [ruc, mesSel]);

  const periodosDelAnio = useMemo(
    () => ejercicios.find((e) => e.anio === anioSel)?.periodos ?? [],
    [ejercicios, anioSel],
  );

  const periodoActivo = useMemo(
    () => periodosDelAnio.find((p) => p.periodo === mesSel) ?? null,
    [periodosDelAnio, mesSel],
  );

  const handleAnioChange = (anio: string) => {
    setAnioSel(anio);
    setMesSel(null);
  };

  const cargarPropuesta = useCallback(async () => {
    if (!periodoActivo?.periodo) return;
    setError(null);
    const data = await descargarPropuestaCompras(ruc, periodoActivo.periodo);
    if (data?.success) {
      setComprobantes(data.comprobantes);
    } else {
      setError(data?.mensaje ?? "No se pudo generar la propuesta de compras");
    }
  }, [ruc, periodoActivo, descargarPropuestaCompras]);

  const activos = comprobantes?.filter((c) => c.activo) ?? [];
  const conInconsistencias = comprobantes?.filter((c) => !!c.inconsistencias) ?? [];
  const totales = activos.reduce(
    (acc, c) => ({ base: acc.base + c.baseImponible, igv: acc.igv + c.igv, total: acc.total + c.importeTotal }),
    { base: 0, igv: 0, total: 0 },
  );

  const hayExonerado = useMemo(() => (comprobantes ?? []).some((c) => c.mtoExonerado !== 0), [comprobantes]);
  const hayInafecto = useMemo(() => (comprobantes ?? []).some((c) => c.mtoInafecto !== 0), [comprobantes]);

  const rangoFechaPeriodo = useMemo(() => {
    const per = periodoActivo?.periodo ?? "";
    if (!/^\d{6}$/.test(per)) return null;
    const anio = Number(per.slice(0, 4));
    const mes = Number(per.slice(4, 6));
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return { min: `${anio}-${pad(mes)}-01`, max: `${anio}-${pad(mes)}-${pad(ultimoDia)}` };
  }, [periodoActivo]);

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
        const campos = [c.serie, c.numero, c.rucProveedor, c.razonSocialProveedor].map((v) => (v ?? "").toLowerCase());
        if (!campos.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [comprobantes, busqueda, filtroFecha, filtroTipo]);

  const totalesTabla = comprobantesFiltrados.reduce(
    (acc, c) => ({ base: acc.base + c.baseImponible, igv: acc.igv + c.igv, total: acc.total + c.importeTotal }),
    { base: 0, igv: 0, total: 0 },
  );
  const totalesTablaExonerado = comprobantesFiltrados.reduce((acc, c) => acc + c.mtoExonerado, 0);
  const totalesTablaInafecto = comprobantesFiltrados.reduce((acc, c) => acc + c.mtoInafecto, 0);

  const hayFiltrosActivos = !!(busqueda || filtroFecha || filtroTipo);
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroFecha("");
    setFiltroTipo("");
  };

  return (
    <div className="space-y-3">
      <Card className="p-0 rounded-2xl overflow-hidden">
        <div className="flex divide-x divide-gray-200">
          <div className="flex-1 min-w-0 px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-900">Periodo (RCE)</p>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1 w-28 shrink-0">
                <label className="text-xs font-medium text-gray-500">Año</label>
                <select
                  value={anioSel ?? ""}
                  onChange={(e) => handleAnioChange(e.target.value)}
                  disabled={loadingPeriodos || ejercicios.length === 0}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white w-full disabled:opacity-50"
                >
                  {ejercicios.length === 0 && <option value="">—</option>}
                  {ejercicios.map((e) => (
                    <option key={e.anio ?? "—"} value={e.anio ?? ""}>
                      {e.anio ?? "—"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 w-44 shrink-0">
                <label className="text-xs font-medium text-gray-500">Mes</label>
                <select
                  value={mesSel ?? ""}
                  onChange={(e) => setMesSel(e.target.value || null)}
                  disabled={loadingPeriodos || periodosDelAnio.length === 0}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white w-full disabled:opacity-50"
                >
                  <option value="">Seleccionar...</option>
                  {periodosDelAnio.map((p) => (
                    <option key={p.periodo ?? "—"} value={p.periodo ?? ""}>
                      {formatMesEstadoLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={cargarPropuesta}
                disabled={!periodoActivo || loadingPeriodos || cargandoPropuesta}
                className="h-9 shrink-0 inline-flex items-center gap-1.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <RefreshCw size={13} className={cn(cargandoPropuesta && "animate-spin")} />
                Cargar propuesta
              </button>
            </div>

            {loadingPeriodos && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <RefreshCw size={12} className="animate-spin" /> Consultando periodos en SUNAT...
              </span>
            )}
          </div>

          {periodoActivo && (
            <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
              <p className="text-sm font-semibold text-gray-900">{formatPeriodoLabel(periodoActivo.periodo ?? "")} ·</p>
              <p className="text-xs text-gray-500">
                {periodoActivo.periodo} · Estado SUNAT:{" "}
                <span className="font-medium text-gray-600">{periodoActivo.estado ?? "—"}</span>
                {periodoActivo.descripcion ? ` (${periodoActivo.descripcion})` : ""}
              </p>
            </div>
          )}
        </div>
      </Card>

      {!periodoActivo ? (
        !loadingPeriodos && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 px-5 py-12 text-center">
            <p className="text-sm text-gray-400">Selecciona un año y un mes para ver los comprobantes de compra (RCE).</p>
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5">
            {!comprobantes && !error && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                {cargandoPropuesta ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                    <p className="text-sm text-gray-500">Generando propuesta de compras en SUNAT...</p>
                    <p className="text-xs text-gray-400">Esto puede tardar hasta un minuto, SUNAT procesa el reporte de forma asíncrona.</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center max-w-sm">
                    Aún no se ha cargado la propuesta de este periodo. Usa el botón <strong>&quot;Cargar propuesta&quot;</strong> de la parte superior para consultar directamente contra producción de SUNAT los comprobantes que otras empresas emitieron a favor de tu RUC.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <FileWarning className="w-8 h-8 text-amber-400" />
                <p className="text-sm text-gray-600 font-medium text-center max-w-md">{error}</p>
                <button
                  onClick={cargarPropuesta}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RefreshCw size={13} />
                  Reintentar
                </button>
              </div>
            )}

            {comprobantes && (
              <div className="space-y-3">
                {comprobantes.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                    <StatCard label="Comprobantes" value={String(comprobantes.length)} />
                    <StatCard label="Activos" value={String(activos.length)} />
                    <StatCard
                      label="Con inconsistencias"
                      value={String(conInconsistencias.length)}
                      warn={conInconsistencias.length > 0}
                    />
                    <StatCard label="Total (activos)" value={formatMoneda(totales.total, null)} />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {comprobantes.length > 0 && (
                    <>
                      <div className="relative min-w-40 max-w-96 flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar por serie, número, RUC o proveedor..."
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
                    {comprobantes.length > 0 && (
                      <button
                        onClick={() => exportarExcelRce(comprobantes, periodoActivo.periodo ?? "", ruc, nombreEmpresa)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <FileSpreadsheet size={13} />
                        Exportar Excel
                      </button>
                    )}
                  </div>
                </div>

                {comprobantes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">SUNAT no reportó comprobantes de compra para este periodo.</p>
                ) : comprobantesFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">Ningún comprobante coincide con los filtros aplicados.</p>
                ) : (
                  <div className="overflow-auto max-h-[calc(100vh-410px)] min-h-[240px] rounded-lg border border-gray-100">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Base Imp.</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">IGV</th>
                          {hayExonerado && <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Exonerado</th>}
                          {hayInafecto && <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Inafecto</th>}
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
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
                              <p className="text-xs font-medium text-gray-900 truncate max-w-52">{c.razonSocialProveedor ?? "—"}</p>
                              <p className="text-[10px] text-gray-400">{c.rucProveedor ?? "—"}</p>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.baseImponible, c.codMoneda)}</td>
                            <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.igv, c.codMoneda)}</td>
                            {hayExonerado && <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.mtoExonerado, c.codMoneda)}</td>}
                            {hayInafecto && <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.mtoInafecto, c.codMoneda)}</td>}
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
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-4 py-2 text-xs text-gray-700" colSpan={3}>
                            Totales ({comprobantesFiltrados.length})
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTabla.base, null)}</td>
                          <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTabla.igv, null)}</td>
                          {hayExonerado && <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTablaExonerado, null)}</td>}
                          {hayInafecto && <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTablaInafecto, null)}</td>}
                          <td className="px-4 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatMoneda(totalesTabla.total, null)}</td>
                          <td className="px-4 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5", warn ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50")}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wider", warn ? "text-amber-600" : "text-gray-400")}>{label}</p>
      <p className={cn("text-base font-bold mt-0.5", warn ? "text-amber-700" : "text-gray-900")}>{value}</p>
    </div>
  );
}
