/**
 * Tienda online: tipos compartidos entre la tienda pública (/tienda) y la caja,
 * llamadas a la API, la conexión en tiempo real (SignalR) y el aviso "cobrar este
 * pedido" que el panel de pedidos envía a la Caja Autopago.
 */
import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

export type EstadoPedido = "PENDIENTE" | "ACEPTADO" | "LISTO" | "ENTREGADO" | "CANCELADO";
export type MedioPagoPedido = "Efectivo" | "Tarjeta" | "Yape";
export type TipoEntregaPedido = "RECOJO" | "MESA" | "DELIVERY";

/** Turno de un día. dia = domingo=0 … sábado=6; horas "HH:mm". Un día ausente = cerrado. */
export interface HorarioDia {
  dia: number;
  abre: string;
  cierra: string;
}
/** NINGUNO = el cliente no pidió comprobante: el cajero elige al cobrar (boleta o nota de venta). */
export type TipoComprobantePedido = "BOLETA" | "FACTURA" | "NINGUNO";

export interface PedidoOnlineDetalle {
  productoId: number;
  sucursalProductoId: number;
  descripcion: string;
  unidadMedida: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PedidoOnline {
  pedidoOnlineId: number;
  sucursalId: number;
  numero: number;
  clienteNombre: string;
  clienteTelefono: string | null;
  tipoComprobante: TipoComprobantePedido;
  clienteDocumento: string | null;
  clienteRazonSocial: string | null;
  tipoEntrega: TipoEntregaPedido;
  mesa: string | null;
  direccionEntrega: string | null;
  referenciaEntrega: string | null;
  /** "lat,lng" si el cliente compartió su ubicación. */
  ubicacionEntrega: string | null;
  /** Ya incluido en total. */
  costoEnvio: number;
  medioPago: MedioPagoPedido;
  pagaCon: number | null;
  urlCapturaPago: string | null;
  observaciones: string | null;
  total: number;
  estado: EstadoPedido;
  motivoCancelacion: string | null;
  cobrado: boolean;
  comprobanteId: number | null;
  nombreUsuarioAtiende: string | null;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  detalles: PedidoOnlineDetalle[];
}

export interface PedidosSucursal {
  tiendaActiva: boolean;
  pedidos: PedidoOnline[];
}

export interface TiendaOnlineConfig {
  slug: string | null;
  activa: boolean;
  mensaje: string | null;
  aceptaEfectivo: boolean;
  aceptaTarjeta: boolean;
  aceptaYape: boolean;
  yapeNumero: string | null;
  yapeTitular: string | null;
  permiteRecojo: boolean;
  permiteMesa: boolean;
  mostrarAgotados: boolean;

  usaHorario: boolean;
  /** "HH:mm" */
  horaApertura: string | null;
  horaCierre: string | null;
  /** DayOfWeek: domingo=0 … sábado=6. */
  diasAtencion: number[];

  /** Cierre de emergencia, independiente del horario: manda sobre él mientras esté activo. */
  cerradaTemporalmente: boolean;

  /** Horario de cada día; un día ausente = cerrado. */
  horario: HorarioDia[];

  /** Mesas numeradas, cada una con su QR (…?mesa=N). 0 = sin mesas numeradas. */
  cantidadMesas: number;

  permiteDelivery: boolean;
  costoDelivery: number;
  pedidoMinimoDelivery: number;
  /** Envío gratis cuando los productos suman al menos esto; null = nunca. */
  deliveryGratisDesde: number | null;
  zonaDelivery: string | null;
  tiempoDelivery: string | null;

  /** Colores "#RRGGBB"; null = el original. Con qrColor2 el QR va en degradado. */
  colorPrimario: string | null;
  colorSecundario: string | null;
  colorFondo: string | null;
  colorTarjeta: string | null;
  qrColor: string | null;
  qrColor2: string | null;
  qrFondo: string | null;
}

export interface TiendaPublica {
  sucursalId: number;
  slug: string | null;
  /** "beta" si la tienda vive en la base beta; se reenvía en todas las llamadas. */
  entorno: string | null;
  nombreTienda: string;
  nombreSucursal: string | null;
  direccion: string | null;
  telefono: string | null;
  mensaje: string | null;
  aceptaEfectivo: boolean;
  aceptaTarjeta: boolean;
  aceptaYape: boolean;
  yapeNumero: string | null;
  yapeTitular: string | null;
  permiteRecojo: boolean;
  permiteMesa: boolean;
  ruc?: string | null;
  logoBase64?: string | null;

  /** false = fuera de horario: mostrar el aviso de cerrado en vez del catálogo. */
  abierta: boolean;
  /** Solo viene cuando abierta es false, ya redactado con la próxima apertura. */
  mensajeCerrado: string | null;
  usaHorario: boolean;
  /** "HH:mm" */
  horaApertura: string | null;
  horaCierre: string | null;
  diasAtencion?: string | null;
  cerradaTemporalmente?: boolean;

  /** Horario de cada día (vacío si no usa horario). */
  horario?: HorarioDia[];
  cantidadMesas?: number;

  permiteDelivery?: boolean;
  costoDelivery?: number;
  pedidoMinimoDelivery?: number;
  deliveryGratisDesde?: number | null;
  zonaDelivery?: string | null;
  tiempoDelivery?: string | null;

  /** Colores de marca "#RRGGBB"; null = los originales. */
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  colorFondo?: string | null;
  colorTarjeta?: string | null;
}

export interface ProductoPublico {
  productoId: number;
  nombre: string;
  categoria: string | null;
  esCombo: boolean;
  incluye: string[];
  precio: number;
  precioRegular: number;
  porcentajeDescuento: number | null;
  urlImagen: string | null;
  unidadMedida: string | null;
  disponible: boolean;
  stockDisponible: number | null;
  /** Puesto en "Lo más vendido" (1 = el más vendido); null si no está entre los primeros. */
  rankingVentas?: number | null;
}

export interface NuevoPedidoOnline {
  clienteNombre: string;
  clienteTelefono?: string;
  tipoComprobante: TipoComprobantePedido;
  clienteDocumento?: string;
  clienteRazonSocial?: string;
  tipoEntrega: TipoEntregaPedido;
  mesa?: string;
  direccionEntrega?: string;
  referenciaEntrega?: string;
  ubicacionEntrega?: string;
  medioPago: MedioPagoPedido;
  pagaCon?: number | null;
  urlCapturaPago?: string | null;
  observaciones?: string;
  items: { productoId: number; cantidad: number }[];
}

export interface PedidoCreado {
  token: string;
  numero: number;
  total: number;
}

export interface PedidoSeguimiento {
  sucursalId: number;
  numero: number;
  clienteNombre: string;
  tipoComprobante: TipoComprobantePedido;
  estado: EstadoPedido;
  total: number;
  tipoEntrega: TipoEntregaPedido;
  mesa: string | null;
  direccionEntrega?: string | null;
  costoEnvio?: number;
  medioPago: MedioPagoPedido;
  motivoCancelacion: string | null;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  detalles: PedidoOnlineDetalle[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

/** Error con el mensaje que devuelve la API ({ mensaje }), listo para mostrar. */
export class ErrorTienda extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function pedirJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ErrorTienda("Sin conexión. Revisa tu internet e intenta de nuevo.", 0);
  }
  if (!res.ok) {
    let mensaje = "No se pudo completar la operación. Intenta de nuevo.";
    if (res.status === 429) mensaje = "Enviaste muchos pedidos seguidos. Espera un minuto e intenta de nuevo.";
    try {
      const data = await res.json();
      if (data?.mensaje) mensaje = data.mensaje;
    } catch {
      /* respuesta sin cuerpo */
    }
    throw new ErrorTienda(mensaje, res.status);
  }
  return res.json() as Promise<T>;
}

// ── Tienda pública (sin sesión) ───────────────────────────────────────────

/** El entorno viaja en la URL porque la tienda no tiene token del que leerlo. */
const conEntorno = (entorno: string | null | undefined) => (entorno === "beta" ? "?e=beta" : "");

export const tiendaApi = {
  /** `clave` es el nombre del enlace ("mi-bodega") o el id de la sucursal. */
  obtenerTienda: (clave: string, entorno?: string | null) =>
    pedirJson<TiendaPublica>(`${API}/api/tienda/${encodeURIComponent(clave)}${conEntorno(entorno)}`, { cache: "no-store" }),

  obtenerProductos: (sucursalId: number, entorno?: string | null) =>
    pedirJson<ProductoPublico[]>(`${API}/api/tienda/${sucursalId}/productos${conEntorno(entorno)}`, { cache: "no-store" }),

  crearPedido: (sucursalId: number, pedido: NuevoPedidoOnline, entorno?: string | null) =>
    pedirJson<PedidoCreado>(`${API}/api/tienda/${sucursalId}/pedidos${conEntorno(entorno)}`, {
      method: "POST",
      body: JSON.stringify(pedido),
    }),

  seguimiento: (token: string, entorno?: string | null) =>
    pedirJson<PedidoSeguimiento>(`${API}/api/tienda/pedido/${token}${conEntorno(entorno)}`, { cache: "no-store" }),
};

// ── Caja (con sesión) ─────────────────────────────────────────────────────

const conToken = (token: string | null): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

export const pedidosOnlineApi = {
  listar: (sucursalId: number, token: string | null) =>
    pedirJson<PedidosSucursal>(`${API}/api/pedidos-online/sucursal/${sucursalId}`, {
      headers: conToken(token),
      cache: "no-store",
    }),

  cambiarEstado: (pedidoOnlineId: number, estado: EstadoPedido, token: string | null, motivo?: string) =>
    pedirJson<PedidoOnline>(`${API}/api/pedidos-online/${pedidoOnlineId}/estado`, {
      method: "PATCH",
      headers: conToken(token),
      body: JSON.stringify({ estado, motivo }),
    }),

  marcarCobrado: (pedidoOnlineId: number, comprobanteId: number | null, token: string | null) =>
    pedirJson<PedidoOnline>(`${API}/api/pedidos-online/${pedidoOnlineId}/cobrado`, {
      method: "PATCH",
      headers: conToken(token),
      body: JSON.stringify({ comprobanteId }),
    }),

  obtenerConfig: (sucursalId: number, token: string | null) =>
    pedirJson<TiendaOnlineConfig>(`${API}/api/pedidos-online/config/${sucursalId}`, {
      headers: conToken(token),
      cache: "no-store",
    }),

  guardarConfig: (sucursalId: number, config: TiendaOnlineConfig, token: string | null) =>
    pedirJson<TiendaOnlineConfig>(`${API}/api/pedidos-online/config/${sucursalId}`, {
      method: "PUT",
      headers: conToken(token),
      body: JSON.stringify(config),
    }),
};

/** Enlace público de la tienda, para compartir o imprimir como QR. */
export function urlTiendaPublica(slug: string, entorno?: string | null): string {
  const origen = typeof window !== "undefined" ? window.location.origin : "https://factufly.pe";
  return `${origen}/tienda/${slug}${conEntorno(entorno)}`;
}

/** Enlace de una mesa: el pedido que se haga desde ahí llega a caja como "Mesa N". */
export function urlMesa(enlaceTienda: string, mesa: number): string {
  const url = new URL(enlaceTienda);
  url.searchParams.set("mesa", String(mesa));
  return url.toString();
}

/** Mismo criterio que el backend: el envío es gratis desde cierto monto de productos. */
export function costoEnvioPara(tienda: Pick<TiendaPublica, "costoDelivery" | "deliveryGratisDesde">, subtotal: number): number {
  const gratisDesde = tienda.deliveryGratisDesde;
  if (gratisDesde != null && gratisDesde > 0 && subtotal >= gratisDesde) return 0;
  return tienda.costoDelivery ?? 0;
}

// ── Tiempo real ───────────────────────────────────────────────────────────

/**
 * Conexión al hub de pedidos. Con `accessToken` (caja) puede unirse a los pedidos
 * de su sucursal; sin token (cliente de la tienda) solo puede seguir su pedido.
 * Reintenta sola unos segundos; si igual se cae, quien la usa vuelve a iniciarla
 * y mientras tanto sigue consultando la API de forma periódica.
 */
export function crearConexionPedidos(accessToken?: string | null): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${API}/hubs/pedidos`, accessToken ? { accessTokenFactory: () => accessToken } : {})
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
    .configureLogging(LogLevel.None)
    .build();
}

// ── "Cobrar este pedido" del panel hacia la Caja Autopago ─────────────────
// El carrito vive dentro de la vista de la caja; el panel de pedidos no puede
// tocarlo directamente, así que se lo pide con un evento (mismo enfoque que
// lib/eventosCaja.ts).

const pedidosEmitter = new EventTarget();
const EVENTO_COBRAR = "cobrar-pedido-online";

/** Caja que recibe los pedidos del panel; si está ocupada los reparte a las ventas rápidas. */
export const CAJA_PRINCIPAL = "principal";

interface SolicitudCobro {
  pedido: PedidoOnline;
  destino: string;
}

// Pedido enviado a una caja que aún no terminó de montarse (una venta rápida que
// se acaba de abrir): se le entrega en cuanto se suscribe.
const pendientesPorCaja = new Map<string, PedidoOnline>();

/** Pide cargar el pedido en una caja ("principal", "F1"…). */
export function solicitarCobroPedido(pedido: PedidoOnline, destino: string = CAJA_PRINCIPAL) {
  pendientesPorCaja.set(destino, pedido);
  pedidosEmitter.dispatchEvent(new CustomEvent<SolicitudCobro>(EVENTO_COBRAR, { detail: { pedido, destino } }));
}

/**
 * Cada caja escucha solo los pedidos dirigidos a ella. Devuelve la función para
 * desuscribirse, pensada para el cleanup de useEffect.
 */
export function suscribirCobroPedido(cajaId: string, callback: (pedido: PedidoOnline) => void) {
  const entregar = () => {
    const pedido = pendientesPorCaja.get(cajaId);
    if (!pedido) return;
    pendientesPorCaja.delete(cajaId);
    callback(pedido);
  };
  const handler = (e: Event) => {
    if ((e as CustomEvent<SolicitudCobro>).detail.destino === cajaId) entregar();
  };
  pedidosEmitter.addEventListener(EVENTO_COBRAR, handler);
  // Lo que llegó antes de que esta caja estuviera lista.
  const inicial = setTimeout(entregar, 0);
  return () => {
    clearTimeout(inicial);
    pedidosEmitter.removeEventListener(EVENTO_COBRAR, handler);
  };
}

// Qué caja tiene cargado cada pedido: con varias ventas a la vez, evita cargar
// (y cobrar) el mismo pedido en dos cajas.
const cajaPorPedido = new Map<number, string>();

export function marcarPedidoEnCaja(pedidoOnlineId: number, cajaId: string) {
  cajaPorPedido.set(pedidoOnlineId, cajaId);
}

export function liberarPedidoDeCaja(pedidoOnlineId: number) {
  cajaPorPedido.delete(pedidoOnlineId);
}

export function cajaDelPedido(pedidoOnlineId: number): string | undefined {
  return cajaPorPedido.get(pedidoOnlineId);
}

// ── Sonido de alerta ──────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

/**
 * Campanita de tres notas generada con Web Audio (sin archivos que descargar).
 * El contexto se reutiliza: el navegador solo deja reproducir audio después de
 * que el usuario interactuó con la página, y el cajero ya lo hizo al usar la caja.
 */
export function reproducirAlertaPedido() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    audioCtx ??= new AudioCtx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();

    const notas = [880, 1108.73, 1318.51]; // La5 · Do#6 · Mi6
    notas.forEach((frecuencia, i) => {
      const inicio = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frecuencia, inicio);
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.5);
    });

    if ("vibrate" in navigator) navigator.vibrate([120, 60, 120]);
  } catch {
    /* sin audio disponible: el aviso visual sigue funcionando */
  }
}

// ── Silenciar los avisos de pedidos (preferencia de cada navegador) ───────
// Solo afecta al personal (caja y aviso global). El sonido que recibe el cliente
// en la tienda cuando su pedido está listo no depende de esto.

const CLAVE_SILENCIO = "pedidos_online_silenciados";
const silencioEmitter = new EventTarget();

export function avisosPedidosSilenciados(): boolean {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === "1";
  } catch {
    return false;
  }
}

export function silenciarAvisosPedidos(silenciar: boolean) {
  try {
    if (silenciar) localStorage.setItem(CLAVE_SILENCIO, "1");
    else localStorage.removeItem(CLAVE_SILENCIO);
  } catch {
    /* sin almacenamiento: dura solo esta sesión */
  }
  silencioEmitter.dispatchEvent(new Event("cambio"));
}

/** Para useSyncExternalStore; también se entera si se cambia en otra pestaña. */
export function suscribirSilencioPedidos(callback: () => void) {
  const alCambiarEnOtraPestana = (e: StorageEvent) => {
    if (e.key === CLAVE_SILENCIO) callback();
  };
  silencioEmitter.addEventListener("cambio", callback);
  window.addEventListener("storage", alCambiarEnOtraPestana);
  return () => {
    silencioEmitter.removeEventListener("cambio", callback);
    window.removeEventListener("storage", alCambiarEnOtraPestana);
  };
}

/** Alerta de pedido nuevo para el personal: no suena si lo silenciaron. */
export function alertarPedidoNuevo() {
  if (avisosPedidosSilenciados()) return;
  reproducirAlertaPedido();
}
