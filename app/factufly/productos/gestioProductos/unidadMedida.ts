// Clasificación de unidades de medida para el registro, la lista y la venta.
//
// Unidades "contables": se cuentan de a 1 (una unidad suelta o una caja física)
// y SÍ pueden llevar código de barras. El resto se mide —peso, volumen,
// longitud— o es un servicio, y no admite código de barras (no le pones un
// EAN-13 a un kilo de arroz ni a un servicio de instalación).
const UNIDADES_CONTABLES = new Set(["NIU", "BX"]);

export const esUnidadContable = (unidad?: string | null): boolean =>
  !!unidad && UNIDADES_CONTABLES.has(unidad);

// Abreviatura corta para mostrar junto al stock o la cantidad vendida.
const ABREVIATURAS: Record<string, string> = {
  NIU: "und.",
  BX: "caja",
  KGM: "kg",
  GRM: "g",
  TNE: "t",
  LTR: "L",
  MLT: "mL",
  MTR: "m",
  MTK: "m²",
  MTQ: "m³",
  ZZ: "", // servicio: no se mide en cantidad
};

export const abreviaturaUnidad = (unidad?: string | null): string =>
  (unidad ? ABREVIATURAS[unidad] : undefined) ?? "und.";

// Formatea una cantidad según la unidad: número tal cual para unidades
// contables (unidad/caja) y hasta 3 decimales, sin ceros sobrantes, para
// unidades continuas (30.5 kg, 0.3 kg, etc.).
export const formatearCantidadUnidad = (
  cantidad: number,
  unidad?: string | null,
): string => {
  if (esUnidadContable(unidad)) return String(cantidad);
  return String(parseFloat(cantidad.toFixed(3)));
};
