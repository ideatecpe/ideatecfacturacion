// Tipos y constantes del módulo "Gastos e ingresos" (todo en soles).

/** "G" gasto, "I" ingreso (dinero que entra fuera de las ventas habituales). */
export type TipoMovimiento = "G" | "I";

export interface CategoriaGasto {
  categoriaId: number;
  tipo: TipoMovimiento;
  nombre: string;
  color: string;
  icono: string | null;
  /** Opciones para elegir con un clic al registrar (Luz, Agua, Internet…). */
  conceptos: string[];
  orden: number;
  activa: boolean;
  gastadoMes: number;
  cantidadMes: number;
  presupuesto: number | null;
}

export interface InicioGastos {
  moduloActivo: boolean;
  anio: number;
  mes: number;
  categorias: CategoriaGasto[];
  totalMes: number;
  totalPresupuesto: number;
  totalMesAnterior: number;
  totalIngresosMes: number;
  totalIngresosMesAnterior: number;
  /** Ingresos programados con comprobante que esperan emitirse (o fallaron). */
  porEmitir: number;
  /** Turno de caja abierto del usuario: si hay, se ofrece "Salió del efectivo de la caja". */
  cajaTurnoAbiertoId: number | null;
  esAdmin: boolean;
  esSuperAdmin: boolean;
}

export interface Gasto {
  gastoId: number;
  tipo: TipoMovimiento;
  fecha: string; // yyyy-MM-dd
  descripcion: string;
  monto: number;
  medioPago: string;
  tipoComprobante: string;
  serie: string | null;
  numero: string | null;
  /** Comprobante emitido que respalda un ingreso facturado. */
  comprobanteId: number | null;
  /** Regla programada que lo registró automáticamente. */
  gastoProgramadoId: number | null;
  igv: number | null;
  proveedorId: number | null;
  proveedorDocumento: string | null;
  proveedorNombre: string | null;
  categoriaId: number;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  categoriaIcono: string | null;
  sucursalId: number | null;
  sucursalNombre: string | null;
  pagadoConCaja: boolean;
  adjuntoUrl: string | null;
  adjuntoImageId: string | null;
  observacion: string | null;
  usuarioId: number;
  nombreUsuario: string | null;
  fechaRegistro: string;
  anulado: boolean;
  fechaAnulacion: string | null;
  motivoAnulacion: string | null;
}

export interface ResumenGasto {
  clave: string;
  categoriaId: number | null;
  nombre: string;
  color: string | null;
  total: number;
  cantidad: number;
}

export interface ListaGastos {
  items: Gasto[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  sumaTotal: number;
  porCategoria: ResumenGasto[];
  porMedioPago: ResumenGasto[];
}

export interface FiltrosGastos {
  tipo: TipoMovimiento;
  desde: string;
  hasta: string;
  categoriaId: number | null;
  sucursalId: number | null;
  medioPago: string;
  q: string;
  incluirAnulados: boolean;
  page: number;
  pageSize: number;
}

export interface GuardarGasto {
  tipo: TipoMovimiento;
  categoriaId: number;
  fecha: string;
  descripcion: string;
  monto: number;
  medioPago: string;
  tipoComprobante: string;
  serie: string | null;
  numero: string | null;
  comprobanteId?: number | null;
  /** Ingreso emitido desde "Por emitir": esa fecha queda emitida con este ingreso. */
  porEmitirId?: number | null;
  igv: number | null;
  proveedorId: number | null;
  proveedorDocumento: string | null;
  proveedorNombre: string | null;
  sucursalId: number | null;
  adjuntoUrl: string | null;
  adjuntoImageId: string | null;
  observacion: string | null;
  pagadoConCaja: boolean;
}

// ── Programados: gastos e ingresos que se registran solos ──

export type Frecuencia = "MENSUAL" | "FIN_MES" | "QUINCENAL" | "SEMANAL";

export const FRECUENCIAS: { id: Frecuencia; nombre: string }[] = [
  { id: "MENSUAL", nombre: "Cada mes" },
  { id: "FIN_MES", nombre: "Fin de mes" },
  { id: "QUINCENAL", nombre: "Quincenal" },
  { id: "SEMANAL", nombre: "Cada semana" },
];

/** 1 = lunes … 7 = domingo (igual que el backend). */
export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Programado {
  programadoId: number;
  tipo: TipoMovimiento;
  categoriaId: number;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  categoriaIcono: string | null;
  descripcion: string;
  monto: number;
  medioPago: string;
  sucursalId: number | null;
  sucursalNombre: string | null;
  /** Solo ingresos: "03" boleta, "01" factura, "NV" nota de venta; null = sin comprobante. */
  tipoComprobante: ComprobanteProgramado | null;
  /** Catálogo 06: "1" DNI, "6" RUC, "0" sin documento. */
  clienteTipoDoc: string | null;
  clienteNumDoc: string | null;
  clienteRazonSocial: string | null;
  clienteDireccion: string | null;
  emisionAutomatica: boolean;
  frecuencia: Frecuencia;
  dia: number | null;
  /** "Cada mes, el día 15", "Cada lunes"… */
  regla: string;
  fechaInicio: string;
  fechaFin: string | null;
  /** Próxima vez que se registra; null si ya terminó. */
  proximaFecha: string | null;
  activo: boolean;
  observacion: string | null;
  cantidadGenerados: number;
  ultimaFecha: string | null;
  nombreUsuario: string | null;
}

export type ComprobanteProgramado = "03" | "01" | "NV";

export interface GuardarProgramado {
  tipo: TipoMovimiento;
  categoriaId: number;
  descripcion: string;
  monto: number;
  medioPago: string;
  sucursalId: number | null;
  tipoComprobante: ComprobanteProgramado | null;
  clienteNumDoc: string | null;
  clienteRazonSocial: string | null;
  clienteDireccion: string | null;
  emisionAutomatica: boolean;
  frecuencia: Frecuencia;
  dia: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  observacion: string | null;
}

/** Fecha de un ingreso programado con comprobante que espera emitirse. */
export interface PorEmitir {
  porEmitirId: number;
  programadoId: number;
  fecha: string;
  /** PENDIENTE, EMITIENDO o ERROR. */
  estado: "PENDIENTE" | "EMITIENDO" | "ERROR";
  mensaje: string | null;
  comprobanteId: number | null;
  categoriaId: number;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  categoriaIcono: string | null;
  sucursalId: number | null;
  descripcion: string;
  monto: number;
  medioPago: string;
  observacion: string | null;
  tipoComprobante: ComprobanteProgramado | null;
  clienteTipoDoc: string | null;
  clienteNumDoc: string | null;
  clienteRazonSocial: string | null;
  clienteDireccion: string | null;
  emisionAutomatica: boolean;
}

/** Monto desde el que SUNAT exige el DNI del cliente en una boleta. */
export const MONTO_BOLETA_CON_DNI = 700;

export interface ResultadoProgramado {
  programadoId: number;
  proximaFecha: string | null;
  /** Movimientos registrados al guardar (porque ya tocaban). */
  registrados: number;
}

const aFecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
};
const ultimoDia = (a: number, m: number) => new Date(a, m + 1, 0).getDate();

/** Misma regla que el backend: primera fecha ≥ desde en que toca (null si pasa de fechaFin). */
export function siguienteFecha(frecuencia: Frecuencia, dia: number | null, desde: string, fechaFin: string | null): string | null {
  const d0 = aFecha(desde);
  let f: Date;
  if (frecuencia === "FIN_MES") {
    f = new Date(d0.getFullYear(), d0.getMonth(), ultimoDia(d0.getFullYear(), d0.getMonth()));
  } else if (frecuencia === "QUINCENAL") {
    const quince = new Date(d0.getFullYear(), d0.getMonth(), 15);
    const fin = new Date(d0.getFullYear(), d0.getMonth(), ultimoDia(d0.getFullYear(), d0.getMonth()));
    f = d0 <= quince ? quince : d0 <= fin ? fin : new Date(d0.getFullYear(), d0.getMonth() + 1, 15);
  } else if (frecuencia === "SEMANAL") {
    const objetivo = Math.min(7, Math.max(1, dia ?? 1));
    const actual = ((d0.getDay() + 6) % 7) + 1;
    f = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + ((objetivo - actual + 7) % 7));
  } else {
    const dd = Math.min(31, Math.max(1, dia ?? 1));
    f = new Date(d0.getFullYear(), d0.getMonth(), Math.min(dd, ultimoDia(d0.getFullYear(), d0.getMonth())));
    if (f < d0) {
      const sig = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
      f = new Date(sig.getFullYear(), sig.getMonth(), Math.min(dd, ultimoDia(sig.getFullYear(), sig.getMonth())));
    }
  }
  const iso = fechaLocal(f);
  return fechaFin && iso > fechaFin ? null : iso;
}

/**
 * Fechas en que se registrará la regla, desde `desde`: las primeras `max` y el total si tiene fin
 * (null cuando no termina). Para mostrarle al usuario exactamente qué días tocan.
 */
export function fechasRegla(
  frecuencia: Frecuencia, dia: number | null, desde: string, fechaFin: string | null, max = 5,
): { fechas: string[]; total: number | null } {
  const fechas: string[] = [];
  let total = 0;
  let d = desde;
  // Con fin: cuenta todas (máx. ~2 años semanales); sin fin: basta con las primeras.
  const tope = fechaFin ? 120 : max;
  while (total < tope) {
    const f = siguienteFecha(frecuencia, dia, d, fechaFin);
    if (!f) break;
    if (fechas.length < max) fechas.push(f);
    total++;
    const sig = aFecha(f);
    sig.setDate(sig.getDate() + 1);
    d = fechaLocal(sig);
  }
  return { fechas, total: fechaFin ? total : null };
}

/** "lun 16 nov" */
export const formatFechaDia = (iso: string) => {
  const f = aFecha(iso);
  const dia = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][f.getDay()];
  const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"][f.getMonth()];
  return `${dia} ${f.getDate()} ${mes}`;
};

export const MEDIOS_PAGO = ["Efectivo", "Yape", "Plin", "Transferencia", "Tarjeta", "Otro"] as const;

export const TIPOS_COMPROBANTE: { codigo: string; nombre: string; corto: string }[] = [
  { codigo: "00", nombre: "Sin comprobante", corto: "Sin comprobante" },
  { codigo: "01", nombre: "Factura", corto: "Factura" },
  { codigo: "03", nombre: "Boleta", corto: "Boleta" },
  { codigo: "02", nombre: "Recibo por honorarios", corto: "RxH" },
  { codigo: "12", nombre: "Ticket", corto: "Ticket" },
];

export const nombreComprobante = (codigo: string) =>
  codigo === "NV" ? "Nota de venta" : TIPOS_COMPROBANTE.find((t) => t.codigo === codigo)?.corto ?? "Sin comprobante";

/**
 * Cifras de un mes. Otros ingresos = todo lo registrado como ingreso (con o sin comprobante).
 * Ventas = facturas + boletas + notas de venta − notas de crédito + notas de débito − ingresos con comprobante.
 */
export interface ResumenPeriodo {
  ventasComprobantes: number;
  notasVenta: number;
  notasCredito: number;
  notasDebito: number;
  ventas: number;
  cantidadComprobantes: number;
  otrosIngresos: number;
  cantidadOtrosIngresos: number;
  /** Parte de otrosIngresos con comprobante (se descuenta de ventas para no contarla dos veces). */
  ingresosFacturados: number;
  cantidadIngresosFacturados: number;
  totalIngresos: number;
  gastos: number;
  cantidadGastos: number;
  resultado: number;
}

export interface ResumenMes {
  anio: number;
  mes: number;
  actual: ResumenPeriodo;
  anterior: ResumenPeriodo;
  gastosPorCategoria: ResumenGasto[];
  ingresosPorCategoria: ResumenGasto[];
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const formatSoles = (n: number) =>
  `S/ ${(n ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Fecha local yyyy-MM-dd (no UTC: a las 8 pm en Perú toISOString ya da el día siguiente). */
export const fechaLocal = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatFechaCorta = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

/** Nivel de avance de un presupuesto: verde < 80 %, ámbar 80–100 %, rojo si se pasó. */
export const nivelPresupuesto = (gastado: number, presupuesto: number | null) => {
  if (!presupuesto || presupuesto <= 0) return { porcentaje: 0, nivel: "sin" as const };
  const porcentaje = (gastado / presupuesto) * 100;
  const nivel = porcentaje > 100 ? ("pasado" as const) : porcentaje >= 80 ? ("alerta" as const) : ("ok" as const);
  return { porcentaje, nivel };
};
