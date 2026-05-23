import * as XLSX from "xlsx";
import { FilaExcel, ComprobanteAgrupado, ItemAgrupado } from "./Cargamasivatypes";

// ─── Validar correos separados por coma ───────────────────────────────────────
export function validarCorreos(correo: string | null): string | null {
  if (!correo || correo.trim() === "") return null;
  const lista = correo.split(",").map((c) => c.trim()).filter(Boolean);
  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidos = lista.filter((c) => !regexCorreo.test(c));
  if (invalidos.length > 0)
    return `Correo(s) inválido(s): ${invalidos.join(", ")}`;
  return null;
}

// ─── Validar teléfonos WhatsApp separados por coma ───────────────────────────
export function validarWhatsapp(whatsapp: string | null): string | null {
  if (!whatsapp || whatsapp.trim() === "") return null;
  const lista = whatsapp.split(",").map((w) => w.trim()).filter(Boolean);
  const invalidos = lista.filter((w) => !/^9\d{8}$/.test(w));
  if (invalidos.length > 0)
    return `Número(s) WhatsApp inválido(s): ${invalidos.join(", ")} (deben tener 9 dígitos y empezar con 9)`;
  return null;
}

// ─── Validar fecha de emisión (máx 2 días antes de hoy) ──────────────────────
export function validarFechaEmision(fecha: string): string | null {
  if (!fecha) return "La fecha de emisión es requerida";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  const diffMs = hoy.getTime() - f.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  if (diffDias > 2) return "La fecha de emisión no puede ser mayor a 2 días antes de hoy";
  if (diffDias < 0) return "La fecha de emisión no puede ser futura";
  return null;
}

// ─── Determinar tipo de documento ─────────────────────────────────────────────
export function determinarTipoDoc(rucDni: string): {
  tipoDoc: "01" | "06";
  tipoComprobante: "03" | "01";
  error: string | null;
} {
  const limpio = String(rucDni).trim();
  if (limpio.length === 8) return { tipoDoc: "01", tipoComprobante: "03", error: null };
  if (limpio.length === 11) return { tipoDoc: "06", tipoComprobante: "01", error: null };
  return {
    tipoDoc: "01",
    tipoComprobante: "03",
    error: `RUC/DNI "${limpio}" inválido: debe tener 8 dígitos (DNI) o 11 dígitos (RUC)`,
  };
}

// ─── Normalizar valor de celda a string ──────────────────────────────────────
// XLSX.js puede traer números, fechas, booleans — normalizamos todo
function celdaAString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return String(val);
  // Fecha serial de Excel (número > 10000 probablemente es fecha)
  if (typeof val === "number" && val > 10000) {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
    } catch { return String(val); }
  }
  return String(val).trim();
}

// ─── Parsear fecha desde celda (string DD/MM/YYYY, número serial, o Date) ────
function parsearFechaCelda(val: any): string {
  if (!val) return "";
  // Número serial de Excel
  if (typeof val === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } catch { return ""; }
  }
  const s = String(val).trim();
  // DD/MM/YYYY
  const partes = s.split("/");
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
  }
  // YYYY-MM-DD ya formateado
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return s;
}

// ─── Leer y parsear el Excel ──────────────────────────────────────────────────
export async function parsearExcel(file: File): Promise<{
  filas: FilaExcel[];
  fechaEmision: string;
  erroresGlobales: string[];
}> {
  const erroresGlobales: string[] = [];
  const buffer = await file.arrayBuffer();

  // cellDates:true para que las fechas vengan como número serial (más predecible)
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

  // ── Leer fecha de I2 directamente desde la celda ──────────────────────────
  let fechaEmision = "";
  const celdaI2 = ws["I2"];
  if (celdaI2) {
    fechaEmision = parsearFechaCelda(celdaI2.v);
  }
  // Fallback: buscar en raw[1][8]
  if (!fechaEmision && raw[1]?.[8]) {
    fechaEmision = parsearFechaCelda(raw[1][8]);
  }

  if (!fechaEmision) {
    erroresGlobales.push("No se encontró la fecha de emisión en la celda I2 del Excel");
  }

  // ── Buscar fila de cabeceras dinámicamente ────────────────────────────────
  // Usa startsWith para no confundir celdas de instrucción que contengan "RUC/DNI" en su texto
  let filaInicioDatos = 3; // default fila 4
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i];
    if (!row) continue;
    const primeraCelda = String(row[0] ?? "").trim().toUpperCase();
    if (primeraCelda.startsWith("RUC") || primeraCelda.startsWith("DNI")) {
      filaInicioDatos = i + 1;
      break;
    }
  }

  // ── Parsear filas de datos ────────────────────────────────────────────────
  const filas: FilaExcel[] = [];
  let ultimoRucDni = "";

  for (let i = filaInicioDatos; i < raw.length; i++) {
    const row = raw[i];
    // Saltar filas completamente vacías
    if (!row || row.every((c: any) => c === null || c === undefined || c === "")) continue;

    // RUC/DNI puede venir como número entero — convertir a string sin decimales
    const rucDniRaw = row[0];
    const rucDni = rucDniRaw !== null && rucDniRaw !== undefined
      ? String(Math.floor(Number(rucDniRaw)) === Number(rucDniRaw) && typeof rucDniRaw === "number"
          ? Math.floor(rucDniRaw)
          : rucDniRaw).trim()
      : "";

    const detalle = celdaAString(row[1]);
    const cantidad = Number(row[2]) || 0;
    const precioUnitario = Number(row[3]) || 0;
    const igv = Number(row[4]) || 18;
    const unidadMedida = celdaAString(row[5]) || "ZZ";
    const moneda = celdaAString(row[6]) || "PEN";
    const correoRaw = celdaAString(row[7]);
    const correo = correoRaw || null;
    // WhatsApp puede venir como número — convertir
    const whatsappRaw = row[8];
    const whatsapp = whatsappRaw !== null && whatsappRaw !== undefined && whatsappRaw !== ""
      ? String(typeof whatsappRaw === "number" ? Math.floor(whatsappRaw) : whatsappRaw).trim()
      : null;

    // Determinar si es fila de detalle (rucDni vacío y ya hay un grupo)
    const esFilaDetalle = !rucDni && !!ultimoRucDni;

    const erroresFila: string[] = [];

    if (!esFilaDetalle) {
      if (!rucDni) {
        erroresFila.push(`Fila ${i + 1}: La primera fila de un comprobante debe tener RUC/DNI`);
      } else {
        const { error } = determinarTipoDoc(rucDni);
        if (error) erroresFila.push(`Fila ${i + 1}: ${error}`);
        ultimoRucDni = rucDni;
      }

      const errCorreo = validarCorreos(correo);
      if (errCorreo) erroresFila.push(`Fila ${i + 1}: ${errCorreo}`);

      const errWsp = validarWhatsapp(whatsapp);
      if (errWsp) erroresFila.push(`Fila ${i + 1}: ${errWsp}`);
    }

    if (!detalle) erroresFila.push(`Fila ${i + 1}: Detalle vacío`);
    if (cantidad <= 0) erroresFila.push(`Fila ${i + 1}: Cantidad debe ser mayor a 0`);
    if (precioUnitario <= 0) erroresFila.push(`Fila ${i + 1}: Precio unitario debe ser mayor a 0`);
    if (igv !== 18 && igv !== 10.5) erroresFila.push(`Fila ${i + 1}: IGV debe ser 18 o 10.5`);

    erroresGlobales.push(...erroresFila);

    filas.push({
      rucDni,
      detalle,
      cantidad,
      precioUnitario,
      igv,
      unidadMedida,
      moneda,
      correo,
      whatsapp,
    });
  }

  return { filas, fechaEmision, erroresGlobales };
}

// ─── Agrupar filas en comprobantes ───────────────────────────────────────────
export function agruparComprobantes(filas: FilaExcel[]): ComprobanteAgrupado[] {
  const grupos: ComprobanteAgrupado[] = [];
  let grupoActual: ComprobanteAgrupado | null = null;

  for (const fila of filas) {
    const rucDniActual = String(fila.rucDni ?? "").trim();

    const item: ItemAgrupado = {
      descripcion: fila.detalle,
      cantidad: fila.cantidad,
      precioUnitario: fila.precioUnitario,
      igvPct: fila.igv,
      unidadMedida: fila.unidadMedida || "ZZ",
    };

    // Fila de detalle sin rucDni → agrega al grupo anterior
    if (!rucDniActual && grupoActual) {
      grupoActual.items.push(item);
      continue;
    }

    // Mismo rucDni que el grupo actual → agrega ítem
    if (grupoActual && grupoActual.rucDni === rucDniActual) {
      grupoActual.items.push(item);
      continue;
    }

    // Nuevo grupo
    const { tipoDoc, tipoComprobante } = determinarTipoDoc(rucDniActual);

    grupoActual = {
      id: crypto.randomUUID(),
      rucDni: rucDniActual,
      razonSocial: "",
      tipoDoc,
      tipoComprobante,
      moneda: fila.moneda || "PEN",
      correo: fila.correo || null,
      whatsapp: fila.whatsapp || null,
      items: [item],
      consultandoApi: false,
      apiEncontrado: null,
      apiError: null,
      tieneAdvertencia: false,
      ubigeo: "",
      direccionLineal: "",
      departamento: "",
      provincia: "",
      distrito: "",
      errores: [],
    };

    grupos.push(grupoActual);
  }

  return grupos;
}

// ─── Calcular totales de un comprobante ──────────────────────────────────────
export function calcularTotales(comp: ComprobanteAgrupado) {
  let gravadas = 0, igv = 0;

  for (const item of comp.items) {
    const totalItem = item.precioUnitario * item.cantidad;
    const montoIgv = parseFloat((totalItem - totalItem / (1 + item.igvPct / 100)).toFixed(2));
    const base = parseFloat((totalItem - montoIgv).toFixed(2));
    gravadas += base;
    igv += montoIgv;
  }

  gravadas = parseFloat(gravadas.toFixed(2));
  igv = parseFloat(igv.toFixed(2));
  const importeTotal = parseFloat((gravadas + igv).toFixed(2));

  return { gravadas, igv, importeTotal };
}