import * as XLSX from "xlsx";
import type { FilaCarga, GrupoTotales, FilaErrores } from "./types";
import { STORAGE_FILAS_KEY } from "./constants";

// ─── Alias de columnas Excel ──────────────────────────────────────────────────

export const normalizar = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const alias: Record<keyof Omit<FilaCarga, "id" | "tipoOverride">, string[]> = {
  numdoc:      ["numdoc", "documento", "dni", "ruc", "numerodocumento"],
  razonSocial: ["razonsocial", "cliente", "nombre", "nombrecliente"],
  periodo:     ["periodo", "meses", "dias", "periodonumeromeses"],
  concepto:    ["concepto", "descripcion", "detalle"],
  importe:     ["importe", "precio", "monto", "total"],
  igv:         ["igv", "igvpct", "porcentajeigv", "porcigv"],
  moneda:      ["moneda", "currency", "tipomoneda"],
  correo:      ["correo", "email", "correoelectronico", "mail"],
  whatsapp:    ["whatsapp", "celular", "telefono", "wsp", "ws"],
  fechaini:    ["fechaini", "fechainicio", "desde", "inicio"],
  fechafin:    ["fechafin", "fechafinal", "hasta", "fin"],
  placa:       ["placa", "unidad", "vehiculo"],
};

// ─── Tipo de comprobante ──────────────────────────────────────────────────────

/**
 * Retorna "B" (Boleta) o "F" (Factura).
 * El override manual tiene prioridad; si no, RUC de 11 dígitos → Factura, cualquier otro → Boleta.
 */
export const getTipoDoc = (fila: FilaCarga): "B" | "F" => {
  if (fila.tipoOverride) return fila.tipoOverride;
  return fila.numdoc.trim().length === 11 ? "F" : "B";
};

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

export const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  return text;
};

export const parseIsoLocalDate = (value: string): Date | null => {
  const iso = toIsoDate(value);
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toLocalIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const formatFechaEs = (iso: string): string => {
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
};

// ─── Helpers de período ───────────────────────────────────────────────────────

export const mesesPorPeriodo = (periodo: string): number => {
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  if (limpio === "1/2" || limpio === "0.5") return 0.5;
  if (limpio.endsWith("d")) return 0;
  const valor = Number(limpio);
  if (valor >= 28 && valor <= 31) return 1;
  if (valor >= 89 && valor <= 92) return 3;
  if (valor >= 179 && valor <= 184) return 6;
  if (valor >= 364) return 12;
  // Cualquier entero de 1 a 12 se interpreta como esa cantidad de meses
  if (Number.isInteger(valor) && valor >= 1 && valor <= 12) return valor;
  return 1;
};

export const sumarPeriodo = (fecha: string, periodo: string): string => {
  const date = parseIsoLocalDate(fecha);
  if (!date) return "";
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  if (limpio.endsWith("d")) {
    date.setDate(date.getDate() + Number(limpio.replace("d", "")));
    return toLocalIso(date);
  }
  const valor = Number(limpio);
  const meses = mesesPorPeriodo(periodo);

  if (meses === 0.5) {
    // Quincenal → siempre 15 días
    date.setDate(date.getDate() + 15);
  } else if (periodoTexto(periodo) === "dias") {
    // Período en días sueltos (ej: "17", "45") → suma esos días exactos
    date.setDate(date.getDate() + valor);
  } else if (meses === 1) {
    // Mensual → siempre al 1 del mes SIGUIENTE, sin importar el día de inicio.
    // setDate(1) primero evita overflow (ej: Jan 31 → Mar 3 si se suma el mes directo).
    // finPeriodo restará 1 día → último día del mes de inicio:
    //   Jan 06 → Feb 01 → fin = Jan 31
    //   Feb 01 → Mar 01 → fin = Feb 28/29
    //   May 01 → Jun 01 → fin = May 31
    //   Jun 15 → Jul 01 → fin = Jun 30
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
  } else {
    // Bimestral (2), trimestral (3), semestral (6), anual (12) → aritmética de calendario
    date.setMonth(date.getMonth() + meses);
  }
  return toLocalIso(date);
};

export const finPeriodo = (fechaInicio: string, periodo: string): string => {
  const siguiente = sumarPeriodo(fechaInicio, periodo);
  const fin = parseIsoLocalDate(siguiente);
  if (!fin) return "";
  fin.setDate(fin.getDate() - 1);
  return toLocalIso(fin);
};

export const periodoTexto = (periodo: string): string => {
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  const valor = Number(limpio);
  if (limpio.endsWith("d")) return "dias";
  if (valor > 12 && !(valor >= 28 && valor <= 31) && !(valor >= 89 && valor <= 92) && !(valor >= 179 && valor <= 184) && valor < 364) return "dias";
  const meses = mesesPorPeriodo(periodo);
  if (meses === 0.5) return "quincenal";
  if (meses === 2)   return "bimestral";
  if (meses === 3)   return "trimestral";
  if (meses === 4)   return "cuatrimestral";
  if (meses === 5)   return "quinquemestral";
  if (meses === 6)   return "semestral";
  if (meses === 7)   return "7meses";
  if (meses === 8)   return "8meses";
  if (meses === 9)   return "9meses";
  if (meses === 10)  return "10meses";
  if (meses === 11)  return "11meses";
  if (meses === 12)  return "anual";
  return "mensual";
};

export const periodoLabel = (periodo: string): string => {
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  if (limpio.endsWith("d")) {
    const n = Number(limpio.replace("d", ""));
    return `${n} día${n !== 1 ? "s" : ""}`;
  }
  const meses = mesesPorPeriodo(periodo);
  if (meses === 0.5) return "quincenal";
  if (meses === 2)   return "bimestral";
  if (meses === 3)   return "trimestral";
  if (meses === 4)   return "cuatrimestral";
  if (meses === 5)   return "quinquemestral";
  if (meses === 6)   return "semestral";
  if (meses === 7)   return "septemestral";
  if (meses === 8)   return "octamestral";
  if (meses === 9)   return "novenestral";
  if (meses === 10)  return "decamestral";
  if (meses === 11)  return "undecamestral";
  if (meses === 12)  return "anual";
  if (meses > 1)     return `${meses} meses`;
  return "mensual";
};

export const generarConcepto = (
  periodo: string,
  fechaini: string,
  fechafin: string,
  placa: string,
): string => {
  const tipo = `Servicio de monitoreo ${periodoLabel(periodo)}`;
  const fi   = fechaini ? formatFechaEs(fechaini) : "";
  const ff   = fechafin ? formatFechaEs(fechafin) : "";
  const pl   = placa ? `, placa ${placa}` : "";
  if (fi && ff) return `${tipo}, del ${fi} al ${ff}${pl}`;
  return `${tipo}${pl}`;
};

// ─── Cálculo IGV ──────────────────────────────────────────────────────────────
// importe = precio CON IGV incluido (o precio exonerado si igvPct=0), cantidad siempre 1

export function calcItemVelsat(importe: number, igvPct: number) {
  if (igvPct === 0) {
    return {
      tipoAfectacionIGV: "20", // EXONERADA
      porcentajeIGV:     0,
      baseIgv:           0,
      montoIGV:          0,
      totalVentaItem:    parseFloat(importe.toFixed(2)),
      valorVenta:        parseFloat(importe.toFixed(2)),
      precioUnitario:    parseFloat(importe.toFixed(6)),
      precioVenta:       parseFloat(importe.toFixed(2)),
    };
  }
  const totalVentaItem = parseFloat(importe.toFixed(2));
  const montoIGV       = parseFloat((totalVentaItem - totalVentaItem / (1 + igvPct / 100)).toFixed(2));
  const baseIgv        = parseFloat((totalVentaItem - montoIGV).toFixed(2));
  return {
    tipoAfectacionIGV: "10", // GRAVADA
    porcentajeIGV:     igvPct,
    baseIgv,
    montoIGV,
    totalVentaItem,
    valorVenta:      baseIgv,
    precioUnitario:  parseFloat((importe / (1 + igvPct / 100)).toFixed(6)),
    precioVenta:     parseFloat(importe.toFixed(2)),
  };
}

export function calcTotalesGrupo(items: FilaCarga[]): GrupoTotales {
  let gravadas = 0, exoneradas = 0, igvTotal = 0;
  for (const item of items) {
    const igvPct = Number(item.igv) || 0;
    const calc   = calcItemVelsat(Number(item.importe) || 0, igvPct);
    if (igvPct === 0) {
      exoneradas += calc.totalVentaItem;
    } else {
      gravadas  += calc.baseIgv;
      igvTotal  += calc.montoIGV;
    }
  }
  return {
    gravadas:     parseFloat(gravadas.toFixed(2)),
    exoneradas:   parseFloat(exoneradas.toFixed(2)),
    igvTotal:     parseFloat(igvTotal.toFixed(2)),
    importeTotal: parseFloat((gravadas + exoneradas + igvTotal).toFixed(2)),
  };
}

// ─── Validaciones por fila ────────────────────────────────────────────────────

/**
 * Devuelve un objeto con los campos que tienen error y su mensaje.
 * Un objeto vacío significa que la fila es válida.
 */
export function validarFila(fila: FilaCarga): FilaErrores {
  const e: FilaErrores = {};

  // numdoc: 8 dígitos (DNI) u 11 dígitos (RUC), solo numérico
  const numdoc = fila.numdoc.trim().replace(/\D/g, "");
  if (!numdoc) {
    e.numdoc = "Requerido";
  } else if (numdoc.length !== 8 && numdoc.length !== 11) {
    e.numdoc = "Debe tener 8 (DNI) u 11 (RUC) dígitos";
  }

  // razonSocial: no vacío
  if (!fila.razonSocial.trim()) {
    e.razonSocial = "Requerido";
  }

  // importe: número mayor a cero
  const imp = Number(fila.importe);
  if (isNaN(imp) || imp <= 0) {
    e.importe = "Debe ser > 0";
  }

  // igv: número >= 0 (0 = exonerado, 18 = gravado, etc.)
  const igv = Number(fila.igv);
  if (isNaN(igv) || igv < 0) {
    e.igv = "Debe ser ≥ 0";
  }

  // placa: no vacío
  if (!fila.placa.trim()) {
    e.placa = "Requerida";
  }

  // fechaini: fecha válida
  if (!fila.fechaini || !parseIsoLocalDate(fila.fechaini)) {
    e.fechaini = "Fecha inválida";
  }

  // fechafin: fecha válida y >= fechaini
  if (!fila.fechafin || !parseIsoLocalDate(fila.fechafin)) {
    e.fechafin = "Fecha inválida";
  } else if (fila.fechaini && fila.fechafin < fila.fechaini) {
    e.fechafin = "Debe ser ≥ fecha inicio";
  }

  return e;
}

// ─── localStorage ─────────────────────────────────────────────────────────────

export const leerFilasGuardadas = (): FilaCarga[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_FILAS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((f: any) => ({
      ...f,
      igv:          f.igv          ?? 0,
      moneda:       f.moneda       ?? "PEN",
      correo:       f.correo       ?? "",
      whatsapp:     f.whatsapp     ?? "",
      tipoOverride: f.tipoOverride ?? undefined,
      concepto:
        f.concepto && f.concepto.includes(" del ")
          ? f.concepto
          : generarConcepto(f.periodo, f.fechaini, f.fechafin, f.placa),
    }));
  } catch {
    return [];
  }
};
