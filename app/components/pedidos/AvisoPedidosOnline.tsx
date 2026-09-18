"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import {
  PedidoOnline,
  crearConexionPedidos,
  alertarPedidoNuevo,
  pedidosOnlineApi,
} from "@/lib/pedidosOnline";

/** Donde vive la Caja Autopago: ahí el panel de pedidos ya avisa por su cuenta. */
const RUTA_CAJA = "/factufly/operaciones/boleta-facturaelectronica";

// Un solo "ding" se pierde si el usuario está en otra pantalla: se repite hasta
// que atiende el aviso, igual que en la caja.
const REPETIR_ALERTA_MS = 8000;
const CONSULTA_RESPALDO_MS = 45000;
const REINTENTO_CONEXION_MS = 15000;

const esPendiente = (p: PedidoOnline) => !p.cobrado && p.estado === "PENDIENTE";

/**
 * Aviso de pedidos online en TODO el sistema: suena y muestra un recordatorio
 * aunque el usuario esté en Productos, Reportes o cualquier otro módulo, con un
 * botón para ir a cobrarlo. En la propia Caja Autopago no hace nada: ahí ya
 * avisa el panel de pedidos.
 */
export function AvisoPedidosOnline() {
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const router = useRouter();
  const pathname = usePathname();

  const [pendientes, setPendientes] = useState<PedidoOnline[]>([]);
  const [descartados, setDescartados] = useState<Set<number>>(() => new Set());
  const [tiempoReal, setTiempoReal] = useState(false);

  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;
  const enCaja = pathname.startsWith(RUTA_CAJA);
  const activo = !!accessToken && !!sucursalId && !!config?.isStock && !!config?.isCajaAutopago && !enCaja;

  const conocidosRef = useRef<Set<number> | null>(null);

  /**
   * @param lista pedidos recibidos. `completa` distingue la lista entera de la
   *   sucursal (reemplaza lo que había) de un aviso suelto de SignalR (se suma).
   */
  const integrar = useCallback((lista: PedidoOnline[], completa: boolean, sonarSiEsNuevo: boolean) => {
    const conocidos = conocidosRef.current ?? new Set<number>();
    const nuevos = lista.filter((p) => esPendiente(p) && !conocidos.has(p.pedidoOnlineId));
    lista.filter(esPendiente).forEach((p) => conocidos.add(p.pedidoOnlineId));
    conocidosRef.current = conocidos;

    setPendientes((prev) => {
      const porId = new Map((completa ? [] : prev).map((p) => [p.pedidoOnlineId, p]));
      for (const p of lista) {
        if (esPendiente(p)) porId.set(p.pedidoOnlineId, p);
        else porId.delete(p.pedidoOnlineId);
      }
      return [...porId.values()].sort((a, b) => b.pedidoOnlineId - a.pedidoOnlineId);
    });

    // La primera carga no suena: son pedidos de antes, no algo que acaba de llegar.
    if (sonarSiEsNuevo && nuevos.length > 0) alertarPedidoNuevo();
  }, []);

  const consultar = useCallback(async () => {
    if (!sucursalId || !accessToken) return;
    try {
      const datos = await pedidosOnlineApi.listar(sucursalId, accessToken);
      integrar(datos.pedidos, true, conocidosRef.current !== null);
    } catch {
      /* sin conexión: se reintenta en la siguiente consulta */
    }
  }, [sucursalId, accessToken, integrar]);

  // ── Tiempo real (SignalR) con consulta de respaldo ──
  useEffect(() => {
    if (!activo || !sucursalId) return;

    let detenido = false;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    const conexion = crearConexionPedidos(accessToken);

    const unirse = async () => {
      await conexion.invoke("UnirseCaja", sucursalId);
      setTiempoReal(true);
      void consultar();
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

    conexion.on("PedidoNuevo", (p: PedidoOnline) => integrar([p], false, true));
    conexion.on("PedidoActualizado", () => void consultar());
    conexion.onreconnecting(() => setTiempoReal(false));
    conexion.onreconnected(() => void unirse().catch(() => setTiempoReal(false)));
    conexion.onclose(() => {
      setTiempoReal(false);
      if (!detenido) reintento = setTimeout(iniciar, REINTENTO_CONEXION_MS);
    });

    // Lo que ya estaba esperando antes de abrir esta pantalla.
    const primera = setTimeout(() => void consultar(), 0);
    void iniciar();

    return () => {
      detenido = true;
      clearTimeout(primera);
      clearTimeout(reintento);
      void conexion.stop();
    };
  }, [activo, sucursalId, accessToken, consultar, integrar]);

  useEffect(() => {
    if (!activo || tiempoReal) return;
    const id = setInterval(consultar, CONSULTA_RESPALDO_MS);
    return () => clearInterval(id);
  }, [activo, tiempoReal, consultar]);

  const porAvisar = pendientes.filter((p) => !descartados.has(p.pedidoOnlineId));

  // Alerta repetida y título de la pestaña parpadeando mientras no se atienda.
  useEffect(() => {
    if (!activo || porAvisar.length === 0) return;
    const sonido = setInterval(alertarPedidoNuevo, REPETIR_ALERTA_MS);
    const tituloOriginal = document.title;
    let alterna = false;
    const titulo = setInterval(() => {
      alterna = !alterna;
      document.title = alterna ? `(${porAvisar.length}) Nuevo pedido` : tituloOriginal;
    }, 1200);
    return () => {
      clearInterval(sonido);
      clearInterval(titulo);
      document.title = tituloOriginal;
    };
  }, [activo, porAvisar.length]);

  if (!activo || porAvisar.length === 0) return null;

  const ultimo = porAvisar[0];
  const varios = porAvisar.length > 1;

  return (
    <div className="fixed bottom-4 right-4 z-100 w-72 rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3 p-3.5">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <ShoppingBag size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">
            {varios ? `${porAvisar.length} pedidos online nuevos` : `Nuevo pedido online #${ultimo.numero}`}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {varios ? "Están esperando en la caja" : `${ultimo.clienteNombre} · S/ ${Number(ultimo.total).toFixed(2)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDescartados(new Set(pendientes.map((p) => p.pedidoOnlineId)))}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Descartar aviso"
        >
          <X size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => router.push(RUTA_CAJA)}
        className="w-full h-10 bg-brand-blue text-white text-xs font-bold hover:bg-[#0a2050] transition-colors"
      >
        Ir a la caja
      </button>
    </div>
  );
}
