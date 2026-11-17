// Ingreso que se factura: "Nuevo ingreso" con "Emitir comprobante" abre, dentro de
// Movimientos, el formulario clásico de Boleta / Factura / Nota de venta con el ítem ya
// cargado. Recién cuando el comprobante se guarda, el ingreso se registra vinculado a él.
// Si se vuelve sin emitir, no queda nada registrado.
import { sharedVentaStore } from "@/app/factufly/operaciones/sharedVentaStore";
import { MEDIOS_PAGO, type GuardarGasto } from "./tipos";

export type ComprobanteIngreso = "03" | "01" | "NV";

export interface IngresoPorEmitir {
  /** Comprobante con el que se abrió la emisión (el usuario puede cambiarlo ahí). */
  tipoComprobante: ComprobanteIngreso;
  /** Datos del ingreso; el comprobante se completa al emitir. */
  datos: GuardarGasto;
  categoriaNombre: string;
}

export interface EstadoEmision {
  ingreso: IngresoPorEmitir | null;
  /** El ingreso ya quedó registrado con su comprobante. */
  registrado: boolean;
}

const ESTADO_INICIAL: EstadoEmision = { ingreso: null, registrado: false };
let estado: EstadoEmision = ESTADO_INICIAL;
/** Lo que falta registrar: se vacía al registrar para no duplicar con un segundo clic. */
let enCurso: IngresoPorEmitir | null = null;
const oyentes = new Set<() => void>();

const publicar = (e: EstadoEmision) => {
  estado = e;
  oyentes.forEach((f) => f());
};

export const suscribirEmision = (f: () => void) => {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
};
export const leerEmision = () => estado;
export const leerEmisionServidor = () => ESTADO_INICIAL;

/**
 * Desde el modal: deja el ítem para Boleta/Factura (sharedVentaStore, el mismo que usan
 * para pasarse la venta entre pestañas) y abre la emisión.
 */
/** Cliente precargado en el formulario (códigos de la pantalla: "01" DNI, "06" RUC, "0" sin documento). */
export interface ClienteEmision {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  direccionLineal?: string | null;
}

export function iniciarEmisionIngreso(
  datos: GuardarGasto,
  tipoComprobante: ComprobanteIngreso,
  categoriaNombre: string,
  porcentajeIgv: number,
  cliente?: ClienteEmision | null,
) {
  const pct = Number.isFinite(porcentajeIgv) && porcentajeIgv > 0 ? porcentajeIgv : 18;
  const precioVenta = Math.round(datos.monto * 100) / 100;
  const clienteForm = cliente
    ? {
        clienteId: null,
        tipoDocumento: cliente.tipoDocumento,
        numeroDocumento: cliente.numeroDocumento,
        razonSocial: cliente.razonSocial,
        ubigeo: "",
        direccionLineal: cliente.direccionLineal ?? "",
        departamento: "",
        provincia: "",
        distrito: "",
      }
    : null;
  sharedVentaStore.save(clienteForm, [{
    productoId: null,
    codigo: null,
    descripcion: datos.descripcion,
    cantidad: 1,
    unidadMedida: "ZZ", // servicio
    tipoAfectacionIGV: "10",
    porcentajeIGV: pct,
    precioUnitario: parseFloat((precioVenta / (1 + pct / 100)).toFixed(6)),
    precioVenta,
    _incluirIGV: true,
  }], {});
  enCurso = { tipoComprobante, datos, categoriaNombre };
  publicar({ ingreso: enCurso, registrado: false });
}

/** Al volver a Movimientos (con o sin emitir). */
export function cerrarEmisionIngreso() {
  enCurso = null;
  sharedVentaStore.clear();
  publicar(ESTADO_INICIAL);
}

/**
 * Lo llaman Boleta, Factura y Nota de venta apenas el comprobante quedó guardado: registra el
 * ingreso vinculado a él. Devuelve el mensaje a mostrar, o null si no había ingreso pendiente
 * (una venta normal desde Nueva Venta).
 */
export async function registrarIngresoEmitido(opts: {
  comprobanteId: number;
  tipoComprobante: ComprobanteIngreso;
  serie?: string | null;
  correlativo?: string | number | null;
  cliente?: { numeroDocumento?: string | null; razonSocial?: string | null } | null;
  /** Total del comprobante: si se cambió el precio al emitir, el ingreso toma este monto. */
  importeTotal?: number | null;
  tipoMoneda?: string | null;
  /** Pagos del comprobante: el ingreso toma el medio con el que más se pagó. */
  pagos?: { medioPago?: string | null; monto?: number | null }[] | null;
  accessToken: string | null;
  ruc: string | undefined;
}): Promise<{ texto: string; tipo: "success" | "error" } | null> {
  const pendiente = enCurso;
  if (!pendiente || !opts.comprobanteId) return null;
  enCurso = null;

  const doc = (opts.cliente?.numeroDocumento ?? "").replace(/\D/g, "");
  // Solo en soles: el módulo no maneja dólares, así que un comprobante en USD conserva el monto original.
  const total = Number(opts.importeTotal);
  const monto = (opts.tipoMoneda ?? "PEN") === "PEN" && Number.isFinite(total) && total > 0
    ? Math.round(total * 100) / 100
    : pendiente.datos.monto;
  const principal = [...(opts.pagos ?? [])].sort((x, y) => (Number(y.monto) || 0) - (Number(x.monto) || 0))[0]?.medioPago ?? "";
  const medioPago = MEDIOS_PAGO.find((m) => principal.toLowerCase().startsWith(m.toLowerCase()))
    ?? (principal ? "Otro" : pendiente.datos.medioPago);
  const datos: GuardarGasto = {
    ...pendiente.datos,
    monto,
    medioPago,
    tipo: "I",
    comprobanteId: opts.comprobanteId,
    tipoComprobante: opts.tipoComprobante,
    serie: opts.serie ? String(opts.serie) : null,
    numero: opts.correlativo != null && opts.correlativo !== "" ? String(Number(opts.correlativo) || opts.correlativo) : null,
    proveedorDocumento: doc && !/^0+$/.test(doc) ? doc.slice(0, 15) : pendiente.datos.proveedorDocumento,
    proveedorNombre: opts.cliente?.razonSocial?.trim() || pendiente.datos.proveedorNombre,
    pagadoConCaja: false,
  };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/gastos?ruc=${encodeURIComponent(opts.ruc ?? "")}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { texto: `El comprobante se emitió, pero no se pudo anotar el ingreso: ${data?.mensaje ?? "regístralo a mano en Ingresos"}`, tipo: "error" };
    }
    publicar({ ...estado, registrado: true });
    return { texto: `Ingreso "${pendiente.categoriaNombre}" registrado con su comprobante`, tipo: "success" };
  } catch {
    return { texto: "El comprobante se emitió, pero no se pudo anotar el ingreso (sin conexión).", tipo: "error" };
  }
}
