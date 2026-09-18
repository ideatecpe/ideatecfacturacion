"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";
import {
  EstadoPedido,
  PedidoOnline,
  crearConexionPedidos,
  pedidosOnlineApi,
  alertarPedidoNuevo,
  solicitarCobroPedido,
} from "@/lib/pedidosOnline";

// Los pedidos llegan al instante por SignalR. La consulta periódica es el respaldo:
// frecuente si no hay tiempo real, y espaciada si lo hay (solo por si se perdió un aviso).
const CONSULTA_SIN_TIEMPO_REAL_MS = 10000;
const CONSULTA_CON_TIEMPO_REAL_MS = 60000;
const CONSULTA_TIENDA_INACTIVA_MS = 60000;
const REINTENTO_CONEXION_MS = 15000;
const REPETIR_ALERTA_MS = 6000;

const MOTIVO_YAPE_RECHAZADO = "No pudimos confirmar tu pago con Yape. Acércate a caja para ayudarte.";

/**
 * Flujo simple: el cajero solo cobra (o verifica el Yape y cobra) o cancela. Al
 * emitir la venta el pedido queda "Listo" y se cierra; no hay pasos intermedios.
 */
const porAtender = (p: PedidoOnline) =>
  !p.cobrado && (p.estado === "PENDIENTE" || p.estado === "ACEPTADO" || p.estado === "LISTO");

const ETIQUETA_ESTADO: Record<EstadoPedido, { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Nuevo", clase: "bg-rose-100 text-rose-700" },
  ACEPTADO: { texto: "Nuevo", clase: "bg-rose-100 text-rose-700" },
  LISTO: { texto: "Listo", clase: "bg-emerald-100 text-emerald-700" },
  ENTREGADO: { texto: "Entregado", clase: "bg-gray-100 text-gray-600" },
  CANCELADO: { texto: "Cancelado", clase: "bg-gray-100 text-gray-500" },
};

const soles = (n: number) => `S/ ${Number(n).toFixed(2)}`;

function horaCorta(fecha: string) {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function haceCuanto(fecha: string) {
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (!Number.isFinite(minutos) || minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

interface Props {
  sucursalId: number | null;
  accessToken: string | null;
}

/**
 * Botón "Pedidos" de la Caja Autopago: recibe los pedidos de la tienda online en
 * tiempo real, suena cuando llega uno nuevo y abre el panel para atenderlos.
 * "Cobrar en caja" carga el pedido en el carrito de la caja principal.
 */
export default function PedidosOnline({ sucursalId, accessToken }: Props) {
  const { showToast } = useToast();

  const [tiendaActiva, setTiendaActiva] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoOnline[]>([]);
  const [errorRed, setErrorRed] = useState(false);
  const [tiempoReal, setTiempoReal] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<"activos" | "hoy">("activos");
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [cancelando, setCancelando] = useState<{ id: number; motivo: string } | null>(null);
  const [capturaAbierta, setCapturaAbierta] = useState<PedidoOnline | null>(null);
  // Pendientes que el cajero ya vio (abrió el panel). Mientras haya alguno sin
  // ver, la alerta se repite: un solo "ding" se pierde fácil en un local ruidoso.
  const [vistos, setVistos] = useState<Set<number>>(() => new Set());

  const conocidosRef = useRef<Set<number> | null>(null);
  const abiertoRef = useRef(abierto);
  useEffect(() => {
    abiertoRef.current = abierto;
  }, [abierto]);

  const anunciar = useCallback(
    (nuevos: PedidoOnline[]) => {
      if (nuevos.length === 0) return;
      alertarPedidoNuevo();
      showToast(
        nuevos.length === 1
          ? `Nuevo pedido online #${nuevos[0].numero} de ${nuevos[0].clienteNombre}`
          : `${nuevos.length} pedidos online nuevos`,
        "info",
      );
    },
    [showToast],
  );

  const marcarVistosSiAbierto = (lista: PedidoOnline[]) => {
    if (!abiertoRef.current) return;
    const pendientes = lista.filter((p) => p.estado === "PENDIENTE").map((p) => p.pedidoOnlineId);
    if (pendientes.length) setVistos((prev) => new Set([...prev, ...pendientes]));
  };

  const cargar = useCallback(async () => {
    if (!sucursalId || !accessToken) return;
    try {
      const data = await pedidosOnlineApi.listar(sucursalId, accessToken);
      setTiendaActiva(data.tiendaActiva);
      setPedidos(data.pedidos);
      setErrorRed(false);

      const conocidos = conocidosRef.current;
      // En la primera carga no se anuncia con toast: la alerta repetida de
      // "sin ver" ya avisa si quedaron pendientes de antes.
      if (conocidos) {
        anunciar(data.pedidos.filter((p) => p.estado === "PENDIENTE" && !conocidos.has(p.pedidoOnlineId)));
      }
      conocidosRef.current = new Set(data.pedidos.map((p) => p.pedidoOnlineId));
      marcarVistosSiAbierto(data.pedidos);
    } catch {
      setErrorRed(true);
    }
  }, [sucursalId, accessToken, anunciar]);

  /** Aplica un pedido recibido por tiempo real (nuevo o actualizado). */
  const integrar = useCallback(
    (pedido: PedidoOnline, esNuevo: boolean) => {
      setPedidos((prev) => {
        const i = prev.findIndex((p) => p.pedidoOnlineId === pedido.pedidoOnlineId);
        if (i === -1) return [pedido, ...prev];
        const copia = [...prev];
        copia[i] = pedido;
        return copia;
      });
      if (esNuevo) setTiendaActiva(true);

      const conocidos = conocidosRef.current ?? new Set<number>();
      if (!conocidos.has(pedido.pedidoOnlineId)) {
        conocidos.add(pedido.pedidoOnlineId);
        conocidosRef.current = conocidos;
        if (pedido.estado === "PENDIENTE") anunciar([pedido]);
      }
      marcarVistosSiAbierto([pedido]);
    },
    [anunciar],
  );

  const cargarRef = useRef(cargar);
  const integrarRef = useRef(integrar);
  useEffect(() => {
    cargarRef.current = cargar;
    integrarRef.current = integrar;
  });

  // ── Tiempo real (SignalR) ──
  useEffect(() => {
    if (!sucursalId || !accessToken) return;

    let detenido = false;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    const conexion = crearConexionPedidos(accessToken);

    const unirse = async () => {
      await conexion.invoke("UnirseCaja", sucursalId);
      setTiempoReal(true);
      // Lo que llegó mientras no había conexión.
      void cargarRef.current();
    };

    const iniciar = async () => {
      try {
        await conexion.start();
        await unirse();
      } catch {
        setTiempoReal(false);
        if (!detenido) reintento = setTimeout(iniciar, REINTENTO_CONEXION_MS);
      }
    };

    conexion.on("PedidoNuevo", (p: PedidoOnline) => integrarRef.current(p, true));
    conexion.on("PedidoActualizado", (p: PedidoOnline) => integrarRef.current(p, false));
    conexion.onreconnecting(() => setTiempoReal(false));
    conexion.onreconnected(() => void unirse().catch(() => setTiempoReal(false)));
    conexion.onclose(() => {
      setTiempoReal(false);
      if (!detenido) reintento = setTimeout(iniciar, REINTENTO_CONEXION_MS);
    });

    void iniciar();

    return () => {
      detenido = true;
      clearTimeout(reintento);
      void conexion.stop();
    };
  }, [sucursalId, accessToken]);

  // ── Consulta de respaldo ──
  useEffect(() => {
    if (!sucursalId || !accessToken) return;
    void cargar();
    const ms = !tiendaActiva
      ? CONSULTA_TIENDA_INACTIVA_MS
      : tiempoReal
        ? CONSULTA_CON_TIEMPO_REAL_MS
        : CONSULTA_SIN_TIEMPO_REAL_MS;
    const id = setInterval(cargar, ms);
    const alEnfocar = () => void cargar();
    window.addEventListener("focus", alEnfocar);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", alEnfocar);
    };
  }, [sucursalId, accessToken, tiendaActiva, tiempoReal, cargar]);

  const activos = useMemo(() => pedidos.filter(porAtender), [pedidos]);
  const cerradosHoy = useMemo(() => pedidos.filter((p) => !porAtender(p)), [pedidos]);
  const sinVer = useMemo(
    () => pedidos.filter((p) => p.estado === "PENDIENTE" && !vistos.has(p.pedidoOnlineId)).length,
    [pedidos, vistos],
  );

  // Alerta sonora repetida y título de la pestaña parpadeando mientras haya pedidos sin ver.
  useEffect(() => {
    if (sinVer === 0) return;
    const sonido = setInterval(alertarPedidoNuevo, REPETIR_ALERTA_MS);
    const tituloOriginal = document.title;
    let alterna = false;
    const titulo = setInterval(() => {
      alterna = !alterna;
      document.title = alterna ? `(${sinVer}) Nuevo pedido` : tituloOriginal;
    }, 1200);
    return () => {
      clearInterval(sonido);
      clearInterval(titulo);
      document.title = tituloOriginal;
    };
  }, [sinVer]);

  const abrirPanel = () => {
    setAbierto(true);
    setVistos((prev) => new Set([...prev, ...pedidos.filter((p) => p.estado === "PENDIENTE").map((p) => p.pedidoOnlineId)]));
    void cargar();
  };

  const cambiarEstado = async (pedido: PedidoOnline, estado: EstadoPedido, motivo?: string) => {
    setProcesandoId(pedido.pedidoOnlineId);
    try {
      const actualizado = await pedidosOnlineApi.cambiarEstado(pedido.pedidoOnlineId, estado, accessToken, motivo);
      setPedidos((prev) => prev.map((p) => (p.pedidoOnlineId === actualizado.pedidoOnlineId ? actualizado : p)));
      if (estado === "CANCELADO") {
        setCancelando(null);
        setCapturaAbierta(null);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo actualizar el pedido", "error");
      void cargar();
    } finally {
      setProcesandoId(null);
    }
  };

  const cobrarEnCaja = (pedido: PedidoOnline) => {
    solicitarCobroPedido(pedido);
    setCapturaAbierta(null);
    setAbierto(false);
  };

  // Sin tienda activa ni pedidos pendientes, el botón no ocupa espacio en la caja.
  if (!tiendaActiva && activos.length === 0) return null;

  const lista = pestana === "activos" ? activos : cerradosHoy;

  return (
    <>
      <button
        type="button"
        onClick={abrirPanel}
        className={`relative h-9.5 flex items-center justify-center gap-1.5 px-3 rounded-md text-xs font-semibold border shadow-sm shrink-0 cursor-pointer active:scale-[0.98] transition-all ${
          sinVer > 0
            ? "bg-rose-600 border-rose-600 text-white animate-pulse"
            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-brand-blue"
        }`}
        title="Pedidos de la tienda online"
      >
        <ShoppingBag size={14} />
        <span className="hidden sm:inline">Pedidos</span>
        {activos.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-amber-400 text-[10px] font-bold text-gray-900 flex items-center justify-center tabular-nums shadow-sm">
            {activos.length}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-80 bg-black/30" onClick={() => setAbierto(false)} />
          <aside className="fixed inset-y-0 right-0 z-90 w-full sm:w-110 bg-gray-50 shadow-2xl flex flex-col">
            <div className="shrink-0 bg-white border-b border-gray-200 px-4 pt-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Pedidos online</h2>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${tiempoReal ? "bg-emerald-500" : "bg-amber-400"}`} />
                    {!tiendaActiva
                      ? "La tienda está desactivada"
                      : tiempoReal
                        ? "En vivo · los pedidos llegan al instante"
                        : "Reconectando · se actualiza cada pocos segundos"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 flex gap-4 text-xs font-semibold">
                {(
                  [
                    ["activos", `Por atender (${activos.length})`],
                    ["hoy", `Cerrados hoy (${cerradosHoy.length})`],
                  ] as const
                ).map(([clave, texto]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setPestana(clave)}
                    className={`pb-2.5 border-b-2 transition-colors ${
                      pestana === clave ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-400"
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>

            {errorRed && (
              <p className="shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] text-amber-800">
                <AlertTriangle size={13} /> Sin conexión con el servidor: la lista puede no estar al día.
              </p>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {lista.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                  <p className="text-sm text-gray-400">
                    {pestana === "activos" ? "No hay pedidos por atender" : "Aún no hay pedidos cerrados hoy"}
                  </p>
                </div>
              ) : (
                lista.map((pedido) => (
                  <TarjetaPedido
                    key={pedido.pedidoOnlineId}
                    pedido={pedido}
                    procesando={procesandoId === pedido.pedidoOnlineId}
                    cancelando={cancelando?.id === pedido.pedidoOnlineId ? cancelando.motivo : null}
                    onIniciarCancelacion={() => setCancelando({ id: pedido.pedidoOnlineId, motivo: "" })}
                    onMotivoCancelacion={(motivo) => setCancelando({ id: pedido.pedidoOnlineId, motivo })}
                    onConfirmarCancelacion={() => cambiarEstado(pedido, "CANCELADO", cancelando?.motivo)}
                    onDescartarCancelacion={() => setCancelando(null)}
                    onCobrar={() => cobrarEnCaja(pedido)}
                    onRevisarYape={() => setCapturaAbierta(pedido)}
                  />
                ))
              )}
            </div>
          </aside>
        </>
      )}

      {capturaAbierta?.urlCapturaPago && (
        <div
          className="fixed inset-0 z-100 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCapturaAbierta(null)}
        >
          <div
            className="w-full max-w-md max-h-full flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 flex items-start gap-3 px-5 py-4 border-b border-gray-100">
              <span className="h-9 w-9 shrink-0 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Smartphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 truncate">
                  Pedido #{capturaAbierta.numero} · {capturaAbierta.clienteNombre}
                </p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  Debe llegar {soles(capturaAbierta.total)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCapturaAbierta(null)}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Cerrar captura"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4 flex items-center justify-center">
              <img
                src={conVarianteImagen(capturaAbierta.urlCapturaPago, "public")}
                alt="Captura del pago con Yape"
                className="max-h-[58vh] max-w-full rounded-lg object-contain border border-gray-200 bg-white shadow-sm"
              />
            </div>

            <footer className="shrink-0 px-5 py-4 border-t border-gray-100 space-y-2.5">
              {!capturaAbierta.cobrado && capturaAbierta.estado !== "CANCELADO" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cambiarEstado(capturaAbierta, "CANCELADO", MOTIVO_YAPE_RECHAZADO)}
                    disabled={procesandoId === capturaAbierta.pedidoOnlineId}
                    className="h-11 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {procesandoId === capturaAbierta.pedidoOnlineId && <Loader2 size={14} className="animate-spin" />}
                    Rechazar pago
                  </button>
                  <button
                    type="button"
                    onClick={() => cobrarEnCaja(capturaAbierta)}
                    className="h-11 rounded-lg bg-[#008000] text-white text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-[#006400]"
                  >
                    <ShieldCheck size={16} /> Pago conforme · Emitir
                  </button>
                </div>
              )}
              <p className="text-[11px] text-gray-400 text-center">
                Verifica en tu app de Yape que el pago llegó con este monto antes de confirmar.
              </p>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function TarjetaPedido({
  pedido,
  procesando,
  cancelando,
  onIniciarCancelacion,
  onMotivoCancelacion,
  onConfirmarCancelacion,
  onDescartarCancelacion,
  onCobrar,
  onRevisarYape,
}: {
  pedido: PedidoOnline;
  procesando: boolean;
  cancelando: string | null;
  onIniciarCancelacion: () => void;
  onMotivoCancelacion: (motivo: string) => void;
  onConfirmarCancelacion: () => void;
  onDescartarCancelacion: () => void;
  onCobrar: () => void;
  onRevisarYape: () => void;
}) {
  const activo = porAtender(pedido);
  const etiqueta = activo
    ? ETIQUETA_ESTADO.PENDIENTE
    : pedido.cobrado
      ? ETIQUETA_ESTADO.LISTO
      : ETIQUETA_ESTADO[pedido.estado];
  const yapePorVerificar = activo && pedido.medioPago === "Yape" && !!pedido.urlCapturaPago;

  return (
    <article
      className={`rounded-lg bg-white border shadow-xs overflow-hidden ${
        activo ? "border-rose-300 ring-1 ring-rose-200" : "border-gray-200"
      }`}
    >
      <header className="flex items-start gap-3 px-3.5 pt-3">
        <span className="text-2xl font-black text-brand-blue tabular-nums leading-none">#{pedido.numero}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{pedido.clienteNombre}</p>
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            <Clock size={11} /> {horaCorta(pedido.fechaCreacion)} · {haceCuanto(pedido.fechaCreacion)}
            {pedido.clienteTelefono && <> · {pedido.clienteTelefono}</>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${etiqueta.clase}`}>{etiqueta.texto}</span>
      </header>

      <div className="px-3.5 pt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-brand-blue px-2 py-1">
          {pedido.tipoEntrega === "MESA" ? <UtensilsCrossed size={12} /> : <Store size={12} />}
          {pedido.tipoEntrega === "MESA" ? (pedido.mesa ? `Mesa ${pedido.mesa}` : "Llevar a mesa") : "Recoge en caja"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${
            pedido.medioPago === "Yape"
              ? "bg-violet-50 text-violet-700"
              : pedido.medioPago === "Tarjeta"
                ? "bg-sky-50 text-sky-700"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {pedido.medioPago === "Yape" ? (
            <Smartphone size={12} />
          ) : pedido.medioPago === "Tarjeta" ? (
            <CreditCard size={12} />
          ) : (
            <Banknote size={12} />
          )}
          {pedido.medioPago}
          {pedido.medioPago === "Efectivo" && pedido.pagaCon != null && (
            <span className="font-normal">
              · paga con {soles(pedido.pagaCon)} · vuelto {soles(Math.max(0, pedido.pagaCon - pedido.total))}
            </span>
          )}
          {pedido.medioPago === "Tarjeta" && pedido.tipoEntrega === "MESA" && <span className="font-normal">· llevar POS</span>}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 text-gray-600 px-2 py-1">
          {pedido.tipoComprobante === "FACTURA" ? <FileText size={12} /> : <Receipt size={12} />}
          {pedido.tipoComprobante === "FACTURA"
            ? "Factura"
            : pedido.tipoComprobante === "BOLETA"
              ? "Boleta"
              : "Sin comprobante · tú eliges"}
          {pedido.clienteDocumento && (
            <span className="font-normal tabular-nums">
              · {pedido.tipoComprobante === "FACTURA" ? "RUC" : "DNI"} {pedido.clienteDocumento}
            </span>
          )}
        </span>
        {pedido.cobrado && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-1">
            <CheckCircle2 size={12} /> Cobrado
          </span>
        )}
      </div>

      {pedido.clienteRazonSocial && (
        <p className="px-3.5 pt-1.5 text-[11px] text-gray-500 truncate">{pedido.clienteRazonSocial}</p>
      )}

      <ul className="mx-3.5 mt-2.5 divide-y divide-gray-100 border-y border-gray-100 text-xs">
        {pedido.detalles.map((d, i) => (
          <li key={i} className="flex justify-between gap-3 py-1.5">
            <span className="text-gray-700">
              <span className="font-bold tabular-nums">{Number(d.cantidad)}×</span> {d.descripcion}
            </span>
            <span className="tabular-nums text-gray-500">{soles(d.subtotal)}</span>
          </li>
        ))}
      </ul>

      <div className="px-3.5 py-2.5 flex items-end gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {pedido.observaciones && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">{pedido.observaciones}</p>
          )}
          {pedido.estado === "CANCELADO" && pedido.motivoCancelacion && (
            <p className="text-xs text-gray-500">Motivo: {pedido.motivoCancelacion}</p>
          )}
          {pedido.urlCapturaPago && (
            <button
              type="button"
              onClick={onRevisarYape}
              className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 p-1 pr-2.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
            >
              <img
                src={conVarianteImagen(pedido.urlCapturaPago, "thumbnail")}
                alt=""
                className="h-10 w-8 rounded object-cover bg-white"
              />
              {yapePorVerificar ? "Revisar pago Yape" : "Ver captura de Yape"}
            </button>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase text-gray-400 font-semibold">Total</p>
          <p className="text-lg font-bold tabular-nums text-gray-900">{soles(pedido.total)}</p>
        </div>
      </div>

      {cancelando !== null ? (
        <div className="border-t border-gray-100 bg-gray-50 px-3.5 py-2.5 space-y-2">
          <input
            autoFocus
            value={cancelando}
            onChange={(e) => onMotivoCancelacion(e.target.value.slice(0, 200))}
            placeholder="Motivo para el cliente (opcional)"
            className="w-full h-9 px-2.5 rounded-md border border-gray-200 bg-white text-xs outline-none focus:border-rose-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDescartarCancelacion}
              className="flex-1 h-9 rounded-md border border-gray-200 bg-white text-xs font-semibold text-gray-600"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={onConfirmarCancelacion}
              disabled={procesando}
              className="flex-1 h-9 rounded-md bg-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {procesando && <Loader2 size={13} className="animate-spin" />} Cancelar pedido
            </button>
          </div>
        </div>
      ) : (
        activo && (
          <div className="border-t border-gray-100 px-3.5 py-2.5 flex gap-2">
            {yapePorVerificar ? (
              <button
                type="button"
                onClick={onRevisarYape}
                className="flex-1 h-9 rounded-md bg-violet-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-violet-700"
              >
                <ShieldCheck size={14} /> Verificar Yape
              </button>
            ) : (
              <button
                type="button"
                onClick={onCobrar}
                className="flex-1 h-9 rounded-md bg-brand-blue text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0a2050]"
              >
                <Receipt size={14} /> Cobrar en caja
              </button>
            )}
            <button
              type="button"
              onClick={onIniciarCancelacion}
              className="h-9 px-4 rounded-md border border-gray-200 text-xs font-semibold text-gray-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
            >
              Cancelar
            </button>
          </div>
        )
      )}
    </article>
  );
}
