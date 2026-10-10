// Despiece: un producto que se compra entero (pollo, res, cerdo…) y se vende por
// partes (carne, menudencia…). Lo que se bota es merma: no entra a stock y su costo
// lo absorben las partes que sí se venden.
//
// Este módulo tiene los tipos de la API y el cálculo que la pantalla muestra en vivo.
// Es el mismo que hace el backend al confirmar, para que lo que se ve sea lo que queda.

export interface LoteDespiece {
  cantidad: number;
  costoUnitario: number;
}

export interface ParteReceta {
  productoId: number;
  codigo: string | null;
  nomProducto: string | null;
  unidadMedida: string | null;
  /** Cuánto sale de la parte por cada 1 unidad del entero (0.6 = 60 % si ambos van por kilo). */
  rendimiento: number;
  disponible: boolean;
  sucursalProductoId: number | null;
  stock: number;
  precioUnitario: number;
  costoUnitario: number | null;
}

export interface RecetaDespiece {
  productoBaseId: number;
  codigo: string | null;
  nomProducto: string | null;
  unidadMedida: string | null;
  sucursalProductoId: number;
  stock: number;
  precioUnitario: number;
  costoUnitario: number | null;
  margenObjetivo: number | null;
  /** Al vender una parte sin stock, se despieza sola del entero con el rendimiento normal. */
  despieceAlVender: boolean;
  lotes: LoteDespiece[];
  partes: ParteReceta[];
}

export interface DespieceParte {
  productoId: number;
  nomProducto: string | null;
  unidadMedida: string | null;
  cantidad: number;
  cantidadEsperada: number | null;
  costoUnitario: number;
  costoTotal: number;
  precioAnterior: number | null;
  precioNuevo: number | null;
  cantidadVendida: number;
  stockActual: number | null;
}

export interface Despiece {
  despieceId: number;
  fecha: string;
  productoBaseId: number;
  nomProducto: string | null;
  unidadMedida: string | null;
  cantidad: number;
  costoTotal: number;
  costoUnitario: number;
  cantidadMerma: number | null;
  porcentajeMerma: number | null;
  usuario: string | null;
  estado: "VIGENTE" | "DESHECHO";
  /** Lo hizo el sistema al vender una parte sin stock. */
  automatico: boolean;
  fechaAnulacion: string | null;
  sePuedeDeshacer: boolean;
  motivoNoDeshacer: string | null;
  partes: DespieceParte[];
}

export interface GuardarParteReceta {
  productoId?: number | null;
  nombreNuevo?: string | null;
  unidadMedida?: string | null;
  precioVenta?: number | null;
  rendimiento: number;
}

// ─── Formato ─────────────────────────────────────────────────────────────────

export const soles = (n: number) => `S/ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

/** Hasta 3 decimales sin ceros sobrantes: 6, 6.5, 0.125. */
export const cantidadTexto = (n: number) => String(parseFloat((Number.isFinite(n) ? n : 0).toFixed(3)));

export const porcentajeTexto = (n: number) => `${parseFloat((Number.isFinite(n) ? n : 0).toFixed(1))} %`;

export const mismaUnidad = (a?: string | null, b?: string | null) =>
  (a ?? "NIU").toUpperCase() === (b ?? "NIU").toUpperCase();

/** Lee un número escrito por el usuario (acepta coma decimal). NaN si está vacío. */
export const leerNumero = (texto: string): number => {
  const limpio = texto.replace(",", ".").trim();
  if (limpio === "" || limpio === ".") return NaN;
  return Number(limpio);
};

/** Deja solo dígitos y un separador decimal, con hasta `decimales` decimales. */
export const filtrarDecimal = (texto: string, decimales = 3): string => {
  let t = texto.replace(",", ".").replace(/[^\d.]/g, "");
  const punto = t.indexOf(".");
  if (punto >= 0) t = t.slice(0, punto + 1) + t.slice(punto + 1).replace(/\./g, "").slice(0, decimales);
  return t.slice(0, 10);
};

/** Precio sugerido: se redondea hacia arriba a los 10 céntimos, como se cobra en el mercado. */
export const redondearPrecio = (n: number) => Math.ceil(Math.round(n * 1000) / 100) / 10;

// ─── Cálculo ─────────────────────────────────────────────────────────────────

/** Costo real de sacar `cantidad` del entero: sus lotes en orden PEPS. null si no alcanzan. */
export function costoPeps(lotes: LoteDespiece[], cantidad: number): number | null {
  let restante = cantidad;
  let costo = 0;
  for (const lote of lotes) {
    if (restante <= 0) break;
    const tomar = Math.min(lote.cantidad, restante);
    if (tomar <= 0) continue;
    costo += tomar * lote.costoUnitario;
    restante -= tomar;
  }
  return restante > 0.0005 ? null : costo;
}

export interface ParteCalculo {
  cantidad: number;
  /** Precio con el que quedará la parte (el nuevo si se actualiza, si no el actual). */
  precio: number;
}

export interface ParteResultado {
  costoTotal: number;
  costoUnitario: number;
  /** Ganancia por unidad vendida al precio indicado. */
  gananciaUnitaria: number;
}

/**
 * Reparte el costo del entero entre las partes según lo que vale cada una
 * (cantidad x precio): el kilo de carne carga más costo que el de menudencia porque
 * vale más. Así todas quedan con la misma ganancia. Si ninguna tiene precio, se
 * reparte por peso.
 */
export function repartirCosto(costoTotal: number, partes: ParteCalculo[]): ParteResultado[] {
  let valores = partes.map((p) => (p.cantidad > 0 ? p.cantidad * Math.max(0, p.precio) : 0));
  if (valores.reduce((s, v) => s + v, 0) <= 0) valores = partes.map((p) => Math.max(0, p.cantidad));
  const total = valores.reduce((s, v) => s + v, 0);

  return partes.map((p, i) => {
    const costo = total > 0 ? (costoTotal * valores[i]) / total : 0;
    const unitario = p.cantidad > 0 ? costo / p.cantidad : 0;
    return { costoTotal: costo, costoUnitario: unitario, gananciaUnitaria: p.precio - unitario };
  });
}

/**
 * Precios para ganar `margen` % sobre la venta, manteniendo la proporción entre los
 * precios actuales (si la carne hoy vale 2.5 veces la menudencia, lo sigue valiendo).
 * Partes sin precio usan el costo por peso.
 */
export function preciosSugeridos(costoTotal: number, partes: ParteCalculo[], margen: number): number[] {
  const m = Math.min(Math.max(margen, 0), 95) / 100;
  const ventaNecesaria = costoTotal / (1 - m);
  const conPrecio = partes.filter((p) => p.cantidad > 0 && p.precio > 0);
  const valorActual = conPrecio.reduce((s, p) => s + p.cantidad * p.precio, 0);
  const pesoTotal = partes.reduce((s, p) => s + Math.max(0, p.cantidad), 0);

  if (valorActual <= 0 || conPrecio.length < partes.filter((p) => p.cantidad > 0).length) {
    // Alguna parte no tiene precio: a esas se les propone el costo promedio por peso más la ganancia.
    const porPeso = pesoTotal > 0 ? ventaNecesaria / pesoTotal : 0;
    if (valorActual <= 0) return partes.map(() => redondearPrecio(porPeso));
    const factor = ventaNecesaria / (valorActual + partes.filter((p) => p.precio <= 0).reduce((s, p) => s + p.cantidad * porPeso, 0));
    return partes.map((p) => redondearPrecio((p.precio > 0 ? p.precio : porPeso) * factor));
  }

  const factor = ventaNecesaria / valorActual;
  return partes.map((p) => redondearPrecio(p.precio * factor));
}
