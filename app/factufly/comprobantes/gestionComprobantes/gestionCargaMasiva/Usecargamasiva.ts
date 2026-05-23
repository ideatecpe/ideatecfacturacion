import { useState, useCallback } from "react";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import axios from "axios";
import { CargaMasivaState, ComprobanteAgrupado, ResultadoCargaMasiva } from "./Cargamasivatypes";
import { parsearExcel, validarFechaEmision, agruparComprobantes, calcularTotales } from "./Cargamasivautils";

// ── Helper cálculo item ────────────────────────────────────────────────────────
function calcItem(item: { precioUnitario: number; cantidad: number; igvPct: number }) {
  const totalVentaItem = parseFloat((item.precioUnitario * item.cantidad).toFixed(2));
  const montoIGV = parseFloat((totalVentaItem - totalVentaItem / (1 + item.igvPct / 100)).toFixed(2));
  const baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
  return { baseIgv, montoIGV, totalVentaItem, valorVenta: baseIgv };
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useCargaMasiva(accessToken: string, empresa: any, user: any) {
  const [state, setState] = useState<CargaMasivaState>({
    fechaEmision: new Date().toISOString().split("T")[0],
    comprobantes: [],
    erroresGlobales: [],
    cargando: false,
    guardando: false,
    progreso: 0,
    resultado: null,
  });

  // ── Actualizar fecha de emisión ─────────────────────────────────────────────
  const setFechaEmision = useCallback((fecha: string) => {
    setState((prev) => ({ ...prev, fechaEmision: fecha }));
  }, []);

  // ── Descargar plantilla (generada con ExcelJS) ──────────────────────────────
  const descargarPlantilla = useCallback(async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "FactuFly";
    wb.created = new Date();

    const ws = wb.addWorksheet("Comprobantes", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    ws.columns = [
      { key: "A", width: 16 },
      { key: "B", width: 42 },
      { key: "C", width: 11 },
      { key: "D", width: 22 },
      { key: "E", width: 10 },
      { key: "F", width: 18 },
      { key: "G", width: 10 },
      { key: "H", width: 30 },
      { key: "I", width: 18 },
    ];

    const AZUL   = "2563EB";
    const OSCURO = "1E3A5F";
    const BLANCO = "FFFFFF";
    const PALE   = "EFF6FF";
    const AMBER  = "FEF3C7";

    // ── Fila 1: Título ──────────────────────────────────────────────────────
    ws.mergeCells("A1:I1");
    ws.getRow(1).height = 34;
    const t = ws.getCell("A1");
    t.value = "CARGA MASIVA DE COMPROBANTES — FACTUFLY";
    t.font = { name: "Calibri", bold: true, size: 14, color: { argb: `FF${BLANCO}` } };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${OSCURO}` } };
    t.alignment = { horizontal: "center", vertical: "middle" };

    // ── Fila 2: Instrucción + Fecha en I2 ──────────────────────────────────
    ws.getRow(2).height = 26;
    ws.mergeCells("A2:G2");
    const instr = ws.getCell("A2");
    instr.value =
      "Una fila por ítem. Para múltiples ítems del mismo comprobante, deje RUC/DNI vacío en las filas siguientes. La Razón Social se autocompleta con el RUC/DNI.";
    instr.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF92400E" } };
    instr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AMBER}` } };
    instr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const labelF = ws.getCell("H2");
    labelF.value = "Fecha Emisión:";
    labelF.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
    labelF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE}` } };
    labelF.alignment = { horizontal: "right", vertical: "middle" };

    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, "0");
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const yyyy = hoy.getFullYear();

    const dateC = ws.getCell("I2");
    dateC.value = `${dd}/${mm}/${yyyy}`;
    dateC.font = { name: "Calibri", size: 11, bold: true, color: { argb: `FF${AZUL}` } };
    dateC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE}` } };
    dateC.alignment = { horizontal: "center", vertical: "middle" };
    dateC.border = {
      top:    { style: "medium", color: { argb: `FF${AZUL}` } },
      bottom: { style: "medium", color: { argb: `FF${AZUL}` } },
      left:   { style: "medium", color: { argb: `FF${AZUL}` } },
      right:  { style: "medium", color: { argb: `FF${AZUL}` } },
    };

    // ── Fila 3: Encabezados de columnas ────────────────────────────────────
    ws.getRow(3).height = 30;
    const hdrs = [
      "RUC / DNI", "Detalle / Descripción", "Cantidad",
      "Precio Unit. (c/IGV)", "IGV %", "Unidad de Medida",
      "Moneda", "Correo Electrónico", "WhatsApp",
    ];
    hdrs.forEach((h, i) => {
      const c = ws.getCell(3, i + 1);
      c.value = h;
      c.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${BLANCO}` } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AZUL}` } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = {
        top:    { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        left:   { style: "thin", color: { argb: "FFFFFFFF" } },
        right:  { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });

    // ── Filas 4-8: Datos de ejemplo ────────────────────────────────────────
    const ejemplos = [
      ["20100454523", "Servicio de consultoría empresarial", 2,   590.00, 18, "ZZ",  "PEN", "empresa@cliente.com", ""],
      ["",            "Licencia de software mensual",        1,   236.00, 18, "ZZ",  "PEN", "",                    ""],
      ["12345678",    "Venta de notebook HP 15\" i5",        1,  3540.00, 18, "NIU", "PEN", "jose@gmail.com, pepito@gmail.com",       "987654321"],
      ["20601234567", "Exportación de servicios TI",         5,   100.00, 18, "ZZ",  "USD", "corp@export.com",      ""],
      ["87654321",    "Alquiler de equipos de cómputo",      3,   177.00, 18, "ZZ",  "PEN", "",                    "961234567"],
    ];

    ejemplos.forEach((row, ri) => {
      const isPrimary = !!row[0];
      const bg = isPrimary
        ? (ri % 2 === 0 ? "FFF0F9FF" : "FFEFF6FF")
        : (ri % 2 === 0 ? "FFFAFAFA" : "FFF8FAFC");
      ws.getRow(ri + 4).height = 22;
      row.forEach((v, ci) => {
        const c = ws.getCell(ri + 4, ci + 1);
        c.value = v === "" ? null : v;
        c.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        c.border = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right:  { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (ci === 2) {
          c.alignment = { horizontal: "center", vertical: "middle" };
        } else if (ci === 3) {
          c.numFmt = "#,##0.00";
          c.alignment = { horizontal: "right", vertical: "middle" };
        } else if (ci === 4) {
          c.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          c.alignment = { vertical: "middle" };
        }
      });
    });

    // Congelar encabezados
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 3, topLeftCell: "A4" }];

    // ── Hoja de instrucciones ───────────────────────────────────────────────
    const wsI = wb.addWorksheet("Instrucciones");
    wsI.columns = [{ width: 90 }];

    const lines: [string, boolean, string][] = [
      ["INSTRUCCIONES — CARGA MASIVA DE COMPROBANTES", true,  `FF${OSCURO}`],
      ["", false, "FF1E293B"],
      ["COLUMNAS:", true, `FF${AZUL}`],
      ["A - RUC / DNI: 8 dígitos = DNI (genera Boleta) | 11 dígitos = RUC (genera Factura).", false, "FF1E293B"],
      ["B - Detalle / Descripción: Producto o servicio facturado.", false, "FF1E293B"],
      ["C - Cantidad: Número mayor a 0.", false, "FF1E293B"],
      ["D - Precio Unitario con IGV incluido: precio de venta al público.", false, "FF1E293B"],
      ["E - IGV %: Solo se aceptan los valores 18 o 10.5", false, "FF1E293B"],
      ["F - Unidad de Medida: ZZ (servicio), NIU (unidad), KGM (kilo), GAL (galón), etc.", false, "FF1E293B"],
      ["G - Moneda: PEN (soles) o USD (dólares).", false, "FF1E293B"],
      ["H - Correo Electrónico (opcional): varios correos separados por coma.", false, "FF1E293B"],
      ["I - WhatsApp (opcional): 9 dígitos empezando con 9. Ej: 987654321", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["FECHA DE EMISIÓN:", true, `FF${AZUL}`],
      ["• Escriba la fecha en la celda I2 en formato DD/MM/YYYY. Ej: 20/05/2026", false, "FF1E293B"],
      ["• No puede ser futura ni mayor a 2 días antes de hoy.", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["RAZÓN SOCIAL:", true, `FF${AZUL}`],
      ["• No necesita ingresar la Razón Social. El sistema la obtiene automáticamente por RUC/DNI.", false, "FF1E293B"],
      ["• Si el DNI no se encuentra en la API, el comprobante se guardará con advertencia.", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["MÚLTIPLES ÍTEMS EN UN MISMO COMPROBANTE:", true, `FF${AZUL}`],
      ["• Para añadir más ítems al mismo comprobante, deje la columna A (RUC/DNI) en BLANCO.", false, "FF1E293B"],
      ["• Correo, WhatsApp y Moneda solo se leen en la primera fila del comprobante.", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["IMPORTANTE:", true, "FFDC2626"],
      ["• Los comprobantes se guardan como PENDIENTE. Envíelos a SUNAT desde el módulo de comprobantes.", false, "FF1E293B"],
      ["• No modifique la estructura del archivo (columnas, filas de encabezado, celda I2).", false, "FF1E293B"],
      ["• Solo se aceptan archivos .xlsx", false, "FF1E293B"],
    ];

    lines.forEach(([text, bold, color], i) => {
      const r = wsI.getRow(i + 1);
      r.height = i === 0 ? 34 : 20;
      const c = wsI.getCell(i + 1, 1);
      c.value = text;
      c.font = { name: "Calibri", size: i === 0 ? 13 : 11, bold, color: { argb: color } };
      c.alignment = { wrapText: true, vertical: "top" };
      if (i === 0) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${OSCURO}` } };
        c.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      }
    });

    // ── Descarga ────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Plantilla Carga Masiva Comprobantes.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Consultar API por RUC o DNI ─────────────────────────────────────────────
  const consultarDocumento = useCallback(async (
    comp: ComprobanteAgrupado
  ): Promise<Partial<ComprobanteAgrupado>> => {
    try {
      if (comp.tipoDoc === "01") {
        // DNI → advertencia si no encuentra, pero puede guardar
        const result = await consultaDni(comp.rucDni);
        if (!result) {
          return {
            apiEncontrado: true, // puede guardar
            tieneAdvertencia: true,
            apiError: `DNI ${comp.rucDni} no encontrado en la API. Verifique el número y nombre antes de guardar.`,
            consultandoApi: false,
          };
        }
        return {
          apiEncontrado: true,
          tieneAdvertencia: false,
          apiError: null,
          consultandoApi: false,
          razonSocial: result.nombreCompleto || comp.razonSocial,
          ubigeo: "",
          direccionLineal: "",
          departamento: "",
          provincia: "",
          distrito: "",
        };
      } else {
        // RUC → error bloqueante si no encuentra
        const result = await consultaRuc(comp.rucDni);
        if (!result) {
          return {
            apiEncontrado: false, // bloquea guardado
            tieneAdvertencia: false,
            apiError: `RUC ${comp.rucDni} no encontrado. Corrija el Excel o emita este comprobante desde el módulo de emisión.`,
            consultandoApi: false,
          };
        }
        return {
          apiEncontrado: true,
          tieneAdvertencia: false,
          apiError: null,
          consultandoApi: false,
          razonSocial: result.razonSocial || comp.razonSocial,
          ubigeo: result.ubigeo || "",
          direccionLineal: result.direccionLineal || "",
          departamento: result.departamento || "",
          provincia: result.provincia || "",
          distrito: result.distrito || "",
        };
      }
    } catch {
      return {
        apiEncontrado: false,
        tieneAdvertencia: false,
        apiError: `Error al consultar ${comp.tipoDoc === "01" ? "DNI" : "RUC"} ${comp.rucDni}. Intente nuevamente.`,
        consultandoApi: false,
      };
    }
  }, []);

  // ── Cargar archivo Excel ────────────────────────────────────────────────────
  const cargarExcel = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      cargando: true,
      erroresGlobales: [],
      comprobantes: [],
      resultado: null,
    }));

    try {
      const { filas, fechaEmision, erroresGlobales } = await parsearExcel(file);

      // Errores de parseo → mostrar y detener
      if (erroresGlobales.length > 0) {
        setState((prev) => ({
          ...prev,
          cargando: false,
          erroresGlobales,
          comprobantes: [],
          fechaEmision: fechaEmision || prev.fechaEmision,
        }));
        return;
      }

      const errFecha = validarFechaEmision(fechaEmision);
      if (errFecha) {
        setState((prev) => ({
          ...prev,
          cargando: false,
          erroresGlobales: [errFecha],
          comprobantes: [],
        }));
        return;
      }

      // Agrupar y marcar como consultando
      const agrupados = agruparComprobantes(filas);
      setState((prev) => ({
        ...prev,
        fechaEmision,
        comprobantes: agrupados.map((c) => ({ ...c, consultandoApi: true })),
        erroresGlobales: [],
      }));

      // Consultar API en lotes de 3
      const LOTE = 3;
      const resultado = [...agrupados];

      for (let i = 0; i < resultado.length; i += LOTE) {
        const lote = resultado.slice(i, i + LOTE);
        const respuestas = await Promise.all(lote.map((c) => consultarDocumento(c)));
        respuestas.forEach((resp, j) => {
          Object.assign(resultado[i + j], resp);
        });
        setState((prev) => ({
          ...prev,
          comprobantes: resultado.map((c) => ({ ...c })),
        }));
      }

      setState((prev) => ({ ...prev, cargando: false, comprobantes: resultado }));
    } catch {
      setState((prev) => ({
        ...prev,
        cargando: false,
        erroresGlobales: ["Error al leer el archivo Excel. Verifique el formato."],
      }));
    }
  }, [consultarDocumento]);

  // ── Construir payload para la API ───────────────────────────────────────────
  const construirPayload = useCallback((
    comp: ComprobanteAgrupado,
    fechaEmision: string,
    sucursalActual: any,
    correlativo: number,
  ) => {
    const { gravadas, igv, importeTotal } = calcularTotales(comp);
    const moneda = comp.moneda === "USD" ? "DÓLARES" : "SOLES";

    const serie = comp.tipoComprobante === "03"
      ? sucursalActual?.serieBoleta
      : sucursalActual?.serieFactura;

    const details = comp.items.map((item, idx) => {
      const calc = calcItem(item);
      return {
        item: idx + 1,
        productoId: null,
        codigo: null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidadMedida: item.unidadMedida,
        precioUnitario: parseFloat((item.precioUnitario / (1 + item.igvPct / 100)).toFixed(6)),
        tipoAfectacionIGV: "10",
        porcentajeIGV: item.igvPct,
        baseIgv: calc.baseIgv,
        montoIGV: calc.montoIGV,
        codigoTipoDescuento: "01",
        descuentoUnitario: 0,
        descuentoTotal: 0,
        valorVenta: calc.valorVenta,
        precioVenta: item.precioUnitario,
        totalVentaItem: calc.totalVentaItem,
        icbper: 0,
        factorIcbper: 0,
      };
    });

    return {
      ublVersion: "2.1",
      tipoOperacion: "0101",
      tipoComprobante: comp.tipoComprobante,
      tipoMoneda: comp.moneda,
      fechaEmision: `${fechaEmision}T00:00:00`,
      horaEmision: `${fechaEmision}T00:00:00`,
      fechaVencimiento: fechaEmision,
      tipoPago: "Contado",
      serie,
      correlativo: String(correlativo).padStart(8, "0"),
      company: {
        ...empresa,
        establecimientoAnexo:
          sucursalActual?.codEstablecimiento ?? empresa?.establecimientoAnexo ?? "0000",
      },
      cliente: {
        clienteId: null,
        tipoDocumento: comp.tipoDoc === "06" ? "6" : comp.tipoDoc,
        numeroDocumento: comp.rucDni,
        razonSocial: comp.razonSocial,
        ubigeo: comp.ubigeo || null,
        direccionLineal: comp.direccionLineal || null,
        departamento: comp.departamento || null,
        provincia: comp.provincia || null,
        distrito: comp.distrito || null,
        correo: comp.correo || null,
        enviadoPorCorreo: false,
        whatsApp: comp.whatsapp || null,
        enviadoPorWhatsApp: false,
      },
      details,
      pagos: [{
        medioPago: "Efectivo",
        monto: importeTotal,
        fechaPago: `${fechaEmision}T00:00:00`,
        numeroOperacion: "",
        entidadFinanciera: "",
        observaciones: "",
      }],
      cuotas: [],
      guias: [],
      totalOperacionesGravadas: gravadas,
      totalOperacionesExoneradas: 0,
      totalOperacionesInafectas: 0,
      totalIGV: igv,
      totalIcbper: 0,
      totalImpuestos: igv,
      totalDescuentos: 0,
      subTotal: parseFloat((gravadas + igv).toFixed(2)),
      importeTotal,
      valorVenta: gravadas,
      montoCredito: 0,
      descuentoGlobal: 0,
      codigoTipoDescGlobal: "03",
      usuarioCreacion: user?.id ?? 0,
      enviadoEnResumen: comp.tipoComprobante === "03" ? false : null,
      legends: [{ code: "1000", value: numeroAlertas(importeTotal, moneda) }],
    };
  }, [empresa, user]);

  // ── Guardar carga masiva ────────────────────────────────────────────────────
  const guardarCargaMasiva = useCallback(async (sucursalActual: any) => {
    // Incluir comprobantes válidos Y los que tienen advertencia (DNI no encontrado)
    const validos = state.comprobantes.filter(
      (c) => (c.apiEncontrado === true) && c.errores.length === 0
    );

    if (validos.length === 0) return;

    setState((prev) => ({ ...prev, guardando: true, progreso: 0 }));

    try {
      // Obtener correlativo actualizado de la sucursal antes de enviar
      const resSucursal = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalActual.sucursalId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sucursalData = resSucursal.data;

      let correlativoBoleta = sucursalData.correlativoBoleta;
      let correlativoFactura = sucursalData.correlativoFactura;

      const payloads = validos.map((comp) => {
        const correlativo = comp.tipoComprobante === "03"
          ? correlativoBoleta++
          : correlativoFactura++;
        return construirPayload(
          comp,
          state.fechaEmision,
          { ...sucursalActual, ...sucursalData },
          correlativo
        );
      });

      setState((prev) => ({ ...prev, progreso: 10 }));

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarMasivo`,
        payloads,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      setState((prev) => ({
        ...prev,
        guardando: false,
        progreso: 100,
        resultado: res.data as ResultadoCargaMasiva,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        guardando: false,
        erroresGlobales: [
          err?.response?.data?.mensaje ?? "Error al guardar la carga masiva",
        ],
      }));
    }
  }, [state.comprobantes, state.fechaEmision, construirPayload, accessToken]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState({
      fechaEmision: new Date().toISOString().split("T")[0],
      comprobantes: [],
      erroresGlobales: [],
      cargando: false,
      guardando: false,
      progreso: 0,
      resultado: null,
    });
  }, []);

  // ── Derivados ───────────────────────────────────────────────────────────────
  // Hay errores bloqueantes si algún RUC no se encontró (apiEncontrado=false y no advertencia)
  const hayErrores = state.comprobantes.some(
    (c) => c.apiEncontrado === false && !c.tieneAdvertencia
  );
  const todosConsultados =
    state.comprobantes.length > 0 &&
    state.comprobantes.every((c) => !c.consultandoApi);
  const puedeGuardar =
    todosConsultados &&
    !hayErrores &&
    state.comprobantes.length > 0 &&
    !state.guardando;

  return {
    state,
    setFechaEmision,
    descargarPlantilla,
    cargarExcel,
    guardarCargaMasiva,
    reset,
    hayErrores,
    todosConsultados,
    puedeGuardar,
    calcularTotales,
  };
}