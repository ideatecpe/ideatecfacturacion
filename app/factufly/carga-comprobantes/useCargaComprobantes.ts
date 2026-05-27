"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { useEmpresaEmisor } from "@/app/factufly/operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";

import type { FilaCarga, FilaErrores, PeriodoKey } from "./types";
import { PERIODO_ORDER, PERIODO_CFG, STORAGE_FILAS_KEY } from "./constants";
import {
  normalizar,
  alias,
  getTipoDoc,
  toIsoDate,
  toLocalIso,
  parseIsoLocalDate,
  finPeriodo,
  sumarPeriodo,
  periodoTexto,
  generarConcepto,
  calcItemVelsat,
  calcTotalesGrupo,
  leerFilasGuardadas,
  validarFila,
} from "./helpers";

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useCargaComprobantes() {
  const { user, accessToken } = useAuth();
  const { showToast }         = useToast();
  const { sucursal }          = useSucursal();
  const { empresa }           = useEmpresaEmisor();

  // ── Estado ──
  const [filas,                 setFilas]                = useState<FilaCarga[]>(leerFilasGuardadas);
  const [emitiendo,             setEmitiendo]            = useState(false);
  const [modalPlantillaOpen,    setModalPlantillaOpen]   = useState(false);
  const [tabActiva,             setTabActiva]            = useState<PeriodoKey>("todos");
  const [fechaEmision,          setFechaEmision]         = useState<string>(toLocalIso(new Date()));
  const [periodosExpandidos,    setPeriodosExpandidos]   = useState<Set<string>>(() => new Set(PERIODO_ORDER));
  const [loadingRazonSocialIds, setLoadingRazonSocialIds] = useState<Set<string>>(new Set());

  const esUsuarioVelsat =
    user?.username?.toLowerCase() === "velsat" || user?.ruc === "10073587382";

  // ── Persistencia ──
  const persistirFilas = (nuevasFilas: FilaCarga[]) => {
    setFilas(nuevasFilas);
    localStorage.setItem(STORAGE_FILAS_KEY, JSON.stringify(nuevasFilas));
  };

  // ── Acordeón ──
  const togglePeriodo = (p: string) =>
    setPeriodosExpandidos((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  // ── Computed ──
  const grupos = useMemo(() => {
    const map = new Map<string, FilaCarga[]>();
    filas.forEach((fila) => {
      const pt     = periodoTexto(fila.periodo);
      const moneda = (fila.moneda || "PEN").toUpperCase().trim();
      const tipo   = getTipoDoc(fila);
      const key    = `${fila.numdoc.trim()}||${pt}||${moneda}||${tipo}`;
      if (!fila.numdoc.trim()) return;
      map.set(key, [...(map.get(key) ?? []), fila]);
    });
    return Array.from(map.entries()).map(([key, items]) => {
      const [numdoc, periodoTipo, moneda, tipoDoc] = key.split("||");
      const totales = calcTotalesGrupo(items);
      return {
        key,
        numdoc,
        periodoTipo,
        moneda:      moneda || "PEN",
        tipoDoc:     (tipoDoc ?? "B") as "B" | "F",
        razonSocial: items[0]?.razonSocial ?? "",
        correo:      items[0]?.correo      ?? "",
        whatsapp:    items[0]?.whatsapp    ?? "",
        items,
        total:   totales.importeTotal,
        totales,
      };
    });
  }, [filas]);

  const periodosPresentes = useMemo(() => {
    const set = new Set(filas.map((f) => periodoTexto(f.periodo)));
    return PERIODO_ORDER.filter((p) => set.has(p));
  }, [filas]);

  const filasFiltradas = useMemo(
    () => (tabActiva === "todos" ? filas : filas.filter((f) => periodoTexto(f.periodo) === tabActiva)),
    [filas, tabActiva],
  );

  const gruposFiltrados = useMemo(
    () => (tabActiva === "todos" ? grupos : grupos.filter((g) => g.periodoTipo === tabActiva)),
    [grupos, tabActiva],
  );

  const stats = useMemo(
    () => ({
      filas:         filasFiltradas.length,
      comprobantes:  gruposFiltrados.length,
      total:         gruposFiltrados.reduce((s, g) => s + g.total, 0),
    }),
    [filasFiltradas, gruposFiltrados],
  );

  const statsPorPeriodo = useMemo(() => {
    const result: Record<string, { filas: number; total: number; comprobantes: number }> = {};
    for (const p of PERIODO_ORDER) {
      const fs = filas.filter((f) => periodoTexto(f.periodo) === p);
      const gs = grupos.filter((g) => g.periodoTipo === p);
      result[p] = {
        filas:         fs.length,
        total:         gs.reduce((s, g) => s + g.total, 0),
        comprobantes:  gs.length,
      };
    }
    return result;
  }, [filas, grupos]);

  /** Mapa id → errores de validación; solo contiene filas con al menos un error */
  const erroresPorFila = useMemo(() => {
    const map = new Map<string, FilaErrores>();
    for (const fila of filas) {
      const errs = validarFila(fila);
      if (Object.keys(errs).length > 0) map.set(fila.id, errs);
    }
    return map;
  }, [filas]);

  // ── Resolución masiva de razón social (al cargar Excel) ──
  const resolverRazonSociales = async (rows: FilaCarga[]): Promise<FilaCarga[]> => {
    const pendientes = [
      ...new Set(
        rows
          .filter((r) => !r.razonSocial.trim() && (r.numdoc.length === 8 || r.numdoc.length === 11))
          .map((r) => r.numdoc),
      ),
    ];
    if (!pendientes.length) return rows;
    const mapa = new Map<string, string>();
    await Promise.allSettled(
      pendientes.map(async (numdoc) => {
        try {
          const nombre =
            numdoc.length === 11
              ? ((await consultaRuc(numdoc))?.razonSocial ?? "")
              : ((await consultaDni(numdoc))?.nombreCompleto ?? "");
          mapa.set(numdoc, nombre);
        } catch {
          mapa.set(numdoc, "");
        }
      }),
    );
    return rows.map((r) => ({
      ...r,
      razonSocial: !r.razonSocial.trim() && mapa.has(r.numdoc) ? (mapa.get(r.numdoc) ?? "") : r.razonSocial,
    }));
  };

  // ── Agregar fila manualmente ──
  const agregarFila = (filaSinId: Omit<FilaCarga, "id">) => {
    const nueva: FilaCarga = {
      ...filaSinId,
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
    };
    persistirFilas([...filas, nueva]);
  };

  // ── Limpiar carga ──
  const limpiarCarga = () => {
    setFilas([]);
    setTabActiva("todos");
    localStorage.removeItem(STORAGE_FILAS_KEY);
    showToast("Carga limpiada. Vuelve a subir el Excel.", "success");
  };

  // ── Cargar Excel ──
  const cargarExcel = async (file: File) => {
    const buffer  = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet   = workbook.Sheets[workbook.SheetNames[0]];
    const raw     = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    const headerIndex = raw.findIndex((row) => {
      const normalized = (row as unknown[]).map((cell) => normalizar(String(cell ?? "")));
      return normalized.includes("numdoc");
    });

    if (headerIndex === -1) {
      showToast("No se encontró la columna 'numdoc' en el Excel", "error");
      return;
    }

    const headers = (raw[headerIndex] as unknown[]).map((cell) => String(cell ?? ""));
    const rows    = raw.slice(headerIndex + 1).map((row) =>
      headers.reduce<Record<string, unknown>>((acc, header, index) => {
        if (header.trim()) acc[header] = (row as unknown[])[index] ?? "";
        return acc;
      }, {}),
    );

    const parsed = rows
      .map((row, index) => {
        const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizar(key), value]);
        const getValue = (field: keyof Omit<FilaCarga, "id" | "tipoOverride">) => {
          const match = normalizedEntries.find(([key]) =>
            alias[field].map(normalizar).includes(key as string),
          );
          return match?.[1] ?? "";
        };
        const fechaini      = toIsoDate(getValue("fechaini"));
        const periodo       = String(getValue("periodo") || "1");
        const placa         = String(getValue("placa")).trim();
        const fechafin      = toIsoDate(getValue("fechafin")) || finPeriodo(fechaini, periodo);
        const conceptoExcel = String(getValue("concepto")).trim();
        const concepto      = conceptoExcel || generarConcepto(periodo, fechaini, fechafin, placa);
        const igvRaw        = getValue("igv");
        const igv           = igvRaw !== "" ? Number(igvRaw) : 0;
        const monedaRaw     = String(getValue("moneda")).trim().toUpperCase();
        const moneda        = monedaRaw === "USD" ? "USD" : "PEN";
        return {
          id:          crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
          numdoc:      String(getValue("numdoc")).trim(),
          razonSocial: String(getValue("razonSocial")).trim(),
          periodo,
          concepto,
          importe:     Number(getValue("importe")) || 0,
          igv,
          moneda,
          correo:      String(getValue("correo")).trim(),
          whatsapp:    String(getValue("whatsapp")).trim(),
          fechaini,
          fechafin,
          placa,
        };
      })
      .filter((fila) => fila.numdoc || fila.importe || fila.fechaini || fila.placa);

    persistirFilas(parsed);
    setTabActiva("todos");
    setModalPlantillaOpen(false);
    showToast(`${parsed.length} fila(s) cargadas correctamente`, "success");

    const conNombres = await resolverRazonSociales(parsed);
    persistirFilas(conNombres);
  };

  // ── Descarga plantilla Excel ──
  const descargarPlantilla = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "FactuFly";
    wb.created = new Date();

    const ws = wb.addWorksheet("Carga Velsat", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    ws.columns = [
      { key: "numdoc",   width: 14 },
      { key: "periodo",  width: 10 },
      { key: "importe",  width: 12 },
      { key: "igv",      width: 8  },
      { key: "moneda",   width: 8  },
      { key: "fechaini", width: 14 },
      { key: "fechafin", width: 14 },
      { key: "placa",    width: 12 },
      { key: "correo",   width: 28 },
      { key: "whatsapp", width: 14 },
    ];

    const AZUL   = "2563EB";
    const OSCURO = "1E3A5F";
    const BLANCO = "FFFFFF";
    const AMBER  = "FEF3C7";
    const VERDE  = "DCFCE7";

    ws.mergeCells("A1:J1");
    ws.getRow(1).height = 34;
    const title = ws.getCell("A1");
    title.value     = "CARGA COMPROBANTES VELSAT — PLANTILLA";
    title.font      = { name: "Calibri", bold: true, size: 14, color: { argb: `FF${BLANCO}` } };
    title.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${OSCURO}` } };
    title.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells("A2:J2");
    ws.getRow(2).height = 30;
    const instr = ws.getCell("A2");
    instr.value     = "Una fila por placa. Mismo numdoc + mismo período = un solo comprobante. IGV=0 → exonerada, IGV=18 → gravada. Moneda: PEN o USD.";
    instr.font      = { name: "Calibri", size: 9, italic: true, color: { argb: "FF92400E" } };
    instr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AMBER}` } };
    instr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const cabeceras = ["numdoc", "periodo", "importe", "igv", "moneda", "fechaini", "fechafin", "placa", "correo", "whatsapp"];
    ws.getRow(3).height = 30;
    cabeceras.forEach((header, index) => {
      const cell      = ws.getCell(3, index + 1);
      cell.value      = header;
      cell.font       = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${BLANCO}` } };
      cell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AZUL}` } };
      cell.alignment  = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border     = {
        top:    { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        left:   { style: "thin", color: { argb: "FFFFFFFF" } },
        right:  { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });

    const ejemplos = [
      ["41431773",    1,     39,  0,  "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "M3N-046", "cliente1@gmail.com", "987654321"],
      ["09647995",    1,     50,  0,  "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "BHR-277", "cliente2@gmail.com", ""],
      ["09647995",    1,     50,  0,  "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "ADE-442", "",                   ""],
      ["09647995",   "1/2",  25,  0,  "PEN", new Date(2026, 4, 16), new Date(2026, 4, 31), "ABC-123", "",                   ""],
      ["20601234567", 1,    295, 18,  "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "XYZ-999", "empresa@ruc.com",    ""],
    ];

    ejemplos.forEach((row, rowIndex) => {
      const excelRow = ws.getRow(rowIndex + 4);
      excelRow.height = 23;
      row.forEach((value, colIdx) => {
        const cell    = ws.getCell(rowIndex + 4, colIdx + 1);
        cell.value    = value === "" ? null : value;
        cell.font     = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
        const isAmber = colIdx === 1 || colIdx === 2 || colIdx === 3 || colIdx === 4;
        cell.fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: isAmber ? `FF${AMBER}` : rowIndex % 2 === 0 ? "FFF0F9FF" : "FFEFF6FF" },
        };
        cell.border    = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right:  { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = { horizontal: isAmber ? "center" : "left", vertical: "middle" };
        if (colIdx === 2) { cell.numFmt = "#,##0.00"; cell.alignment = { horizontal: "right", vertical: "middle" }; }
        if (colIdx === 5 || colIdx === 6) { cell.numFmt = "dd/mm/yyyy"; cell.alignment = { horizontal: "center", vertical: "middle" }; }
      });
    });

    ws.views       = [{ state: "frozen", ySplit: 3, topLeftCell: "A4" }];
    ws.autoFilter  = "A3:J3";

    const wsI = wb.addWorksheet("Instrucciones");
    wsI.columns = [{ width: 100 }];
    const lines: [string, boolean, string, string?][] = [
      ["INSTRUCCIONES — CARGA COMPROBANTES VELSAT", true, `FF${BLANCO}`, `FF${OSCURO}`],
      ["", false, "FF1E293B"],
      ["COLUMNAS:", true, `FF${AZUL}`],
      ["numdoc: DNI (8 dígitos = Boleta) o RUC (11 dígitos = Factura) del cliente.", false, "FF1E293B"],
      ["periodo: 1/2=quincenal, 1=mensual, 2=bimestral, 3=trimestral, 6=semestral, 12=anual. Para días exactos use Nd (ej: 17d).", false, "FF1E293B"],
      ["importe: monto por placa CON IGV incluido (o monto exonerado si igv=0).", false, "FF1E293B"],
      ["igv: porcentaje de IGV. Use 0 para exonerado, 18 para gravado al 18%.", false, "FF1E293B"],
      ["moneda: PEN (soles) o USD (dólares).", false, "FF1E293B"],
      ["fechaini / fechafin: fechas del servicio. Formato DD/MM/YYYY.", false, "FF1E293B"],
      ["placa: placa de la unidad (requerido).", false, "FF1E293B"],
      ["correo: correo del cliente para envío de comprobante (opcional).", false, "FF1E293B"],
      ["whatsapp: número WhatsApp, 9 dígitos empezando con 9 (opcional).", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["REGLAS:", true, `FF${AZUL}`],
      ["• Una fila = una placa.", false, "FF1E293B"],
      ["• Mismo numdoc + mismo período + misma moneda → un solo comprobante agrupado.", false, "FF1E293B"],
      ["• Correo y WhatsApp se leen de la primera fila del cliente.", false, "FF1E293B"],
      ["• Tras emitir, las fechas avanzan automáticamente al siguiente período.", false, "FF1E293B"],
      ["• Los comprobantes se crean como PENDIENTE, envíelos a SUNAT desde Comprobantes.", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["IMPORTANTE:", true, "FFDC2626"],
      ["No agregue ni elimine columnas. Mantenga los nombres de cabecera tal como están.", false, "FF1E293B", `FF${VERDE}`],
    ];
    lines.forEach(([text, bold, color, fill], index) => {
      const row  = wsI.getRow(index + 1);
      row.height = index === 0 ? 34 : 21;
      const cell = wsI.getCell(index + 1, 1);
      cell.value     = text;
      cell.font      = { name: "Calibri", size: index === 0 ? 13 : 11, bold, color: { argb: color } };
      cell.alignment = { wrapText: true, vertical: "middle" };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = "Plantilla Carga Comprobantes Velsat.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Edición inline ──
  const actualizarFila = (id: string, campo: keyof FilaCarga, valor: string) => {
    const actualizadas = filas.map((fila) => {
      if (fila.id !== id) return fila;
      const next = {
        ...fila,
        [campo]: (campo === "importe" || campo === "igv") ? Number(valor) : valor,
      };
      if (campo === "numdoc") {
        next.razonSocial  = "";
        next.tipoOverride = undefined;
      }
      if (campo === "fechaini" || campo === "periodo") {
        next.fechafin = finPeriodo(String(next.fechaini), String(next.periodo));
      }
      if (campo === "periodo" || campo === "fechaini" || campo === "fechafin" || campo === "placa") {
        next.concepto = generarConcepto(
          String(next.periodo), String(next.fechaini), String(next.fechafin), String(next.placa),
        );
      }
      return next;
    });
    persistirFilas(actualizadas);

    // Auto-consulta razón social cuando numdoc alcanza 8 (DNI) u 11 (RUC) dígitos
    if (campo === "numdoc" && (valor.length === 8 || valor.length === 11)) {
      setLoadingRazonSocialIds((prev) => new Set(prev).add(id));
      (async () => {
        try {
          const nombre =
            valor.length === 11
              ? ((await consultaRuc(valor))?.razonSocial ?? "")
              : ((await consultaDni(valor))?.nombreCompleto ?? "");
          if (nombre) {
            setFilas((prev) => {
              const updated = prev.map((f) => f.id === id ? { ...f, razonSocial: nombre } : f);
              localStorage.setItem(STORAGE_FILAS_KEY, JSON.stringify(updated));
              return updated;
            });
          }
        } catch {
          // silencioso — el usuario puede ingresar el nombre manualmente
        } finally {
          setLoadingRazonSocialIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    }
  };

  // ── Emitir → POST /api/Comprobantes/GenerarMasivo ──
  const emitir = async () => {
    if (!filasFiltradas.length || !gruposFiltrados.length) {
      showToast("Carga una plantilla antes de emitir", "error");
      return;
    }
    if (!sucursal || !empresa) {
      showToast("Esperando datos de sucursal y empresa, intenta en un momento", "error");
      return;
    }
    if (!fechaEmision) {
      showToast("Selecciona una fecha de emisión", "error");
      return;
    }

    // Validar filas que se van a emitir
    const filasAEmitir    = gruposFiltrados.flatMap((g) => g.items);
    const filasConErrores = filasAEmitir.filter((f) => erroresPorFila.has(f.id));
    if (filasConErrores.length > 0) {
      const n = filasConErrores.length;
      showToast(
        `${n} fila${n !== 1 ? "s" : ""} con errores — corrígelas antes de emitir`,
        "error",
      );
      return;
    }

    setEmitiendo(true);
    try {
      const resSucursal    = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursal.sucursalId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const sucursalActual  = resSucursal.data;
      let correlativoBoleta: number = sucursalActual.correlativoBoleta;
      let correlativoFactura: number = sucursalActual.correlativoFactura;

      const fechaISO        = `${fechaEmision}T00:00:00`;
      const gruposAEmitir   = gruposFiltrados;
      const idsFilasEmitidas = new Set(gruposAEmitir.flatMap((g) => g.items.map((i) => i.id)));

      const payloads = gruposAEmitir.map((grupo) => {
        const esBoleta       = grupo.tipoDoc === "B";
        const tipoComp       = esBoleta ? "03" : "01";
        const tipoDoc        = esBoleta ? "01" : "06";
        const tipoDocCliente = esBoleta ? "01" : "6";
        const serie          = esBoleta ? sucursalActual.serieBoleta : sucursalActual.serieFactura;
        const correlativo    = esBoleta ? correlativoBoleta++ : correlativoFactura++;
        const monedaLabel    = grupo.moneda === "USD" ? "DÓLARES" : "SOLES";
        const { gravadas, exoneradas, igvTotal, importeTotal } = grupo.totales;

        const details = grupo.items.map((item, idx) => {
          const igvPct = Number(item.igv) || 0;
          const calc   = calcItemVelsat(Number(item.importe) || 0, igvPct);
          return {
            item:               idx + 1,
            productoId:         null,
            codigo:             null,
            descripcion:        item.concepto,
            cantidad:           1,
            unidadMedida:       "ZZ",
            precioUnitario:     calc.precioUnitario,
            tipoAfectacionIGV:  calc.tipoAfectacionIGV,
            porcentajeIGV:      calc.porcentajeIGV,
            baseIgv:            calc.baseIgv,
            montoIGV:           calc.montoIGV,
            codigoTipoDescuento:"01",
            descuentoUnitario:  0,
            descuentoTotal:     0,
            valorVenta:         calc.valorVenta,
            precioVenta:        calc.precioVenta,
            totalVentaItem:     calc.totalVentaItem,
            icbper:             0,
            factorIcbper:       0,
          };
        });

        return {
          ublVersion:                   "2.1",
          tipoOperacion:                "0101",
          tipoComprobante:              tipoComp,
          tipoMoneda:                   grupo.moneda,
          fechaEmision:                 fechaISO,
          horaEmision:                  fechaISO,
          fechaVencimiento:             fechaEmision,
          tipoPago:                     "Contado",
          serie,
          correlativo:                  String(correlativo).padStart(8, "0"),
          company: {
            ...empresa,
            establecimientoAnexo:
              sucursalActual.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000",
          },
          cliente: {
            clienteId:          null,
            tipoDocumento:      tipoDocCliente,
            numeroDocumento:    grupo.numdoc,
            razonSocial:        grupo.razonSocial,
            ubigeo:             null,
            direccionLineal:    null,
            departamento:       null,
            provincia:          null,
            distrito:           null,
            correo:             grupo.correo   || null,
            enviadoPorCorreo:   false,
            whatsApp:           grupo.whatsapp || null,
            enviadoPorWhatsApp: false,
          },
          details,
          pagos: [
            {
              medioPago:          "Efectivo",
              monto:              importeTotal,
              fechaPago:          fechaISO,
              numeroOperacion:    "",
              entidadFinanciera:  "",
              observaciones:      `Velsat ${grupo.periodoTipo}`,
            },
          ],
          cuotas:                           [],
          guias:                            [],
          totalOperacionesGravadas:         gravadas,
          totalOperacionesExoneradas:       exoneradas,
          totalOperacionesInafectas:        0,
          totalOperacionesGratuitas:        0,
          totalIgvGratuitas:                0,
          totalIGV:                         igvTotal,
          totalIcbper:                      0,
          totalImpuestos:                   igvTotal,
          totalDescuentos:                  0,
          totalOtrosCargos:                 0,
          subTotal:    parseFloat((gravadas + exoneradas + igvTotal).toFixed(2)),
          importeTotal,
          valorVenta:  parseFloat((gravadas + exoneradas).toFixed(2)),
          montoCredito:       0,
          descuentoGlobal:    0,
          codigoTipoDescGlobal: "03",
          usuarioCreacion:    user?.id ?? 0,
          enviadoEnResumen:   esBoleta ? false : null,
          legends:            [{ code: "1000", value: numeroAlertas(importeTotal, monedaLabel) }],
        };
      });

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarMasivo`,
        payloads,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      // Avanzar fechas al siguiente ciclo
      const siguientePeriodo = filas.map((fila) => {
        if (!idsFilasEmitidas.has(fila.id)) return fila;
        const dFin = parseIsoLocalDate(fila.fechafin);
        let fechaini: string;
        if (dFin) {
          dFin.setDate(dFin.getDate() + 1);
          fechaini = toLocalIso(dFin);
        } else {
          fechaini = sumarPeriodo(fila.fechaini, fila.periodo);
        }
        const fechafin = finPeriodo(fechaini, fila.periodo);
        const concepto = generarConcepto(fila.periodo, fechaini, fechafin, fila.placa);
        return { ...fila, fechaini, fechafin, concepto };
      });
      persistirFilas(siguientePeriodo);

      const periodoEmitido =
        tabActiva === "todos" ? "todos los períodos" : PERIODO_CFG[tabActiva]?.label.toLowerCase();
      showToast(
        `${payloads.length} comprobante(s) generados (${periodoEmitido}) — revísalos en Comprobantes`,
        "success",
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.mensaje ??
        err?.response?.data?.message ??
        err?.message ??
        "Error al generar los comprobantes";
      showToast(msg, "error");
    } finally {
      setEmitiendo(false);
    }
  };

  // ── Return ──
  return {
    // datos
    filas,
    filasFiltradas,
    gruposFiltrados,
    grupos,
    periodosPresentes,
    stats,
    statsPorPeriodo,
    erroresPorFila,
    // estado UI
    tabActiva,        setTabActiva,
    fechaEmision,     setFechaEmision,
    periodosExpandidos,
    loadingRazonSocialIds,
    emitiendo,
    modalPlantillaOpen, setModalPlantillaOpen,
    // acceso
    esUsuarioVelsat,
    sucursal,
    empresa,
    // acciones
    cargarExcel,
    descargarPlantilla,
    actualizarFila,
    agregarFila,
    emitir,
    limpiarCarga,
    togglePeriodo,
  };
}
