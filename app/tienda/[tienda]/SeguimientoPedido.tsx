"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  Bike,
  Clock,
  Loader2,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import {
  ErrorTienda,
  EstadoPedido,
  PedidoSeguimiento,
  TiendaPublica,
  crearConexionPedidos,
  reproducirAlertaPedido,
  tiendaApi,
} from "@/lib/pedidosOnline";
import { formatoSoles } from "./formato";

interface Props {
  token: string;
  tienda: TiendaPublica;
  onSeguirComprando: () => void;
  onPedidoTerminado: () => void;
}

// Los cambios llegan al instante por SignalR; la consulta periódica solo cubre
// el caso de que la conexión en tiempo real no esté disponible.
const CONSULTA_RESPALDO_MS = 15000;
// Flujo simple: el pedido queda listo en cuanto la caja emite la venta.
const ESTADOS_FINALES: EstadoPedido[] = ["LISTO", "ENTREGADO", "CANCELADO"];

export default function SeguimientoPedido({ token, tienda, onSeguirComprando, onPedidoTerminado }: Props) {
  const [pedido, setPedido] = useState<PedidoSeguimiento | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const estadoAnteriorRef = useRef<EstadoPedido | null>(null);

  const finalizado = !!pedido && ESTADOS_FINALES.includes(pedido.estado);

  const consultar = useCallback(async () => {
    try {
      const datos = await tiendaApi.seguimiento(token, tienda.entorno);
      // Suena y vibra en el celular del cliente cuando su pedido pasa a "listo".
      if (estadoAnteriorRef.current && estadoAnteriorRef.current !== "LISTO" && datos.estado === "LISTO") {
        reproducirAlertaPedido();
      }
      estadoAnteriorRef.current = datos.estado;
      setPedido(datos);
    } catch (e) {
      if (e instanceof ErrorTienda && e.status === 404) setNoEncontrado(true);
      /* otros errores (sin señal): se reintenta en la próxima consulta */
    }
  }, [token, tienda.entorno]);

  useEffect(() => {
    const primera = setTimeout(() => void consultar(), 0);
    return () => clearTimeout(primera);
  }, [consultar]);

  // Tiempo real + consulta de respaldo, mientras el pedido siga en curso.
  useEffect(() => {
    if (finalizado) return;

    const intervalo = setInterval(consultar, CONSULTA_RESPALDO_MS);
    const conexion = crearConexionPedidos();
    const seguir = () => conexion.invoke("SeguirPedido", token);

    conexion.on("EstadoPedido", () => void consultar());
    conexion.onreconnected(() => {
      void seguir().catch(() => {});
      void consultar();
    });
    conexion
      .start()
      .then(seguir)
      .catch(() => {
        /* sin tiempo real: queda la consulta periódica */
      });

    return () => {
      clearInterval(intervalo);
      void conexion.stop();
    };
  }, [token, finalizado, consultar]);

  if (noEncontrado) {
    return (
      <Contenedor tienda={tienda}>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-3">
          <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm text-slate-600">No encontramos tu pedido anterior.</p>
          <BotonPrincipal onClick={onPedidoTerminado}>Hacer un pedido</BotonPrincipal>
        </div>
      </Contenedor>
    );
  }

  if (!pedido) {
    return (
      <Contenedor tienda={tienda}>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[var(--t-pri,#0B1F49)]" />
        </div>
      </Contenedor>
    );
  }

  const cancelado = pedido.estado === "CANCELADO";
  const indiceActual = pedido.estado === "LISTO" || pedido.estado === "ENTREGADO" ? 1 : 0;

  const pasos = [
    {
      estado: "PENDIENTE" as const,
      icono: Clock,
      titulo: "Pedido enviado",
      detalle:
        pedido.medioPago === "Yape"
          ? "La tienda está verificando tu pago con Yape."
          : "La tienda está preparando tu pedido.",
    },
    {
      estado: "LISTO" as const,
      icono: BellRing,
      titulo: "¡Tu pedido está listo!",
      detalle:
        pedido.tipoEntrega === "MESA"
          ? `En un momento te lo llevamos${pedido.mesa ? ` a la mesa ${pedido.mesa}` : " a tu mesa"}. ¡Gracias por tu compra!`
          : pedido.tipoEntrega === "DELIVERY"
            ? "Tu pedido va en camino a tu dirección. ¡Gracias por tu compra!"
            : "Acércate a caja y di tu número de pedido. ¡Gracias por tu compra!",
    },
  ];

  return (
    <Contenedor tienda={tienda}>
      <div className="rounded-2xl bg-white border border-slate-200 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tu número de pedido</p>
        <p className="mt-1 text-6xl font-black text-[var(--t-pri,#0B1F49)] tabular-nums leading-none">{pedido.numero}</p>
        {pedido.tipoEntrega === "MESA" && pedido.mesa ? (
          <p className="mt-2 text-sm text-slate-600">
            Tu pedido a la <span className="font-bold text-slate-900">mesa {pedido.mesa}</span>, a nombre de{" "}
            <span className="font-semibold text-slate-800">{pedido.clienteNombre}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">A nombre de {pedido.clienteNombre}</p>
        )}
        {!finalizado && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Esta pantalla se actualiza sola
          </p>
        )}
      </div>

      {cancelado ? (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 flex gap-3">
          <XCircle className="w-6 h-6 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold text-rose-800">Tu pedido fue cancelado</p>
            <p className="mt-0.5 text-sm text-rose-700">
              {pedido.motivoCancelacion || "Acércate a caja si tienes alguna duda."}
            </p>
          </div>
        </div>
      ) : (
        <ol className="rounded-2xl bg-white border border-slate-200 p-5">
          {pasos.map((paso, i) => {
            const hecho = i < indiceActual;
            const actual = i === indiceActual;
            const Icono = paso.icono;
            return (
              <li key={paso.estado} className="relative flex gap-3 pb-5 last:pb-0">
                {i < pasos.length - 1 && (
                  <span
                    className={`absolute left-4.5 top-9 bottom-0 w-0.5 -translate-x-1/2 ${hecho ? "bg-emerald-500" : "bg-slate-200"}`}
                  />
                )}
                <span
                  className={`relative z-10 h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${
                    hecho
                      ? "bg-emerald-500 text-white"
                      : actual
                        ? "bg-[var(--t-pri,#0B1F49)] text-white ring-4 ring-[var(--t-pri,#0B1F49)]/15"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icono className="w-4.5 h-4.5" />
                </span>
                <div className="pt-1.5">
                  <p className={`text-sm font-semibold ${actual ? "text-slate-900" : hecho ? "text-slate-700" : "text-slate-400"}`}>
                    {paso.titulo}
                  </p>
                  {actual && <p className="mt-0.5 text-sm text-slate-600">{paso.detalle}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          {pedido.tipoEntrega === "MESA" ? (
            <UtensilsCrossed className="w-4 h-4" />
          ) : pedido.tipoEntrega === "DELIVERY" ? (
            <Bike className="w-4 h-4" />
          ) : (
            <Store className="w-4 h-4" />
          )}
          {pedido.tipoEntrega === "MESA"
            ? pedido.mesa
              ? `Mesa ${pedido.mesa}`
              : "Llevar a mi mesa"
            : pedido.tipoEntrega === "DELIVERY"
              ? `Delivery${pedido.direccionEntrega ? ` · ${pedido.direccionEntrega}` : ""}`
              : "Recojo en caja"}
          <span className="text-slate-300">·</span>
          {pedido.medioPago}
          <span className="text-slate-300">·</span>
          {pedido.tipoComprobante === "FACTURA"
            ? "Factura"
            : pedido.tipoComprobante === "BOLETA"
              ? "Boleta"
              : "Comprobante en caja"}
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {pedido.detalles.map((d, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5">
              <span className="text-slate-700">
                <span className="font-semibold tabular-nums">{Number(d.cantidad)}×</span> {d.descripcion}
              </span>
              <span className="tabular-nums text-slate-600">{formatoSoles(d.subtotal)}</span>
            </li>
          ))}
          {pedido.tipoEntrega === "DELIVERY" && (
            <li className="flex justify-between gap-3 py-1.5">
              <span className="text-slate-700">Envío</span>
              <span className="tabular-nums text-slate-600">
                {(pedido.costoEnvio ?? 0) > 0 ? formatoSoles(pedido.costoEnvio ?? 0) : "Gratis"}
              </span>
            </li>
          )}
        </ul>
        <div className="flex justify-between border-t border-slate-100 pt-2.5">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-base font-bold tabular-nums">{formatoSoles(pedido.total)}</span>
        </div>
      </div>

      {finalizado ? (
        <BotonPrincipal onClick={onPedidoTerminado}>Hacer un nuevo pedido</BotonPrincipal>
      ) : (
        <button
          type="button"
          onClick={onSeguirComprando}
          className="w-full h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
        >
          Volver a la tienda
        </button>
      )}
    </Contenedor>
  );
}

function Contenedor({ tienda, children }: { tienda: TiendaPublica; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[var(--t-pri,#0B1F49)] text-[var(--t-sobre-pri,#FFFFFF)]">
        <div className="mx-auto max-w-md px-4 py-4 flex items-center gap-2.5">
          <Store className="w-5 h-5" />
          <h1 className="font-bold truncate">{tienda.nombreTienda}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-5 space-y-4">{children}</main>
    </div>
  );
}

function BotonPrincipal({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-12 rounded-xl bg-[var(--t-pri,#0B1F49)] text-[var(--t-sobre-pri,#FFFFFF)] text-base font-bold active:scale-[0.99] transition-transform"
    >
      {children}
    </button>
  );
}
