"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useToast } from "@/app/components/ui/Toast";
import {
  VentaPendiente,
  TipoVentaPendiente,
  listVentasPendientes,
  enqueueVentaPendiente,
  updateVentaPendiente,
  deleteVentaPendiente,
  cacheCliente,
  getClienteCache,
} from "@/lib/offline/offlineDb";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";
import { consultaCe } from "@/app/components/apiConsultasJsonPe/consultaCe";
import {
  generarXml,
  enviarASunatApi,
  crearNotaVenta,
  esErrorTransitorio,
} from "@/app/factufly/operaciones/boleta/gestionBoletas/emitirBoletaApi";

interface OfflineSalesContextValue {
  isOnline: boolean;
  ventasPendientes: VentaPendiente[];
  cantidadPendientes: number;
  cantidadError: number;
  syncing: boolean;
  sesionExpirada: boolean;
  /**
   * Sube cada vez que la cola termina de subir al menos una venta. Las cajas lo
   * observan para recargar el stock del servidor: hasta ese momento el catálogo
   * en pantalla es de ANTES de que el backend descontara esas ventas.
   */
  ventasSincronizadas: number;
  enqueueVenta: (
    payload: Record<string, unknown>,
    stockItems: { sucursalProductoId: number; cantidad: number; item?: number }[],
    resumenTicket: VentaPendiente["resumenTicket"],
    tipo?: TipoVentaPendiente,
  ) => Promise<string>;
  sincronizarAhora: () => void;
  reintentarVenta: (id: string) => void;
  eliminarVenta: (id: string) => Promise<void>;
}

const OfflineSalesContext = createContext<OfflineSalesContextValue | null>(
  null,
);

export function OfflineSalesProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const isOnline = useOnlineStatus();
  const { showToast } = useToast();

  const [ventasPendientes, setVentasPendientes] = useState<VentaPendiente[]>(
    [],
  );
  const [syncing, setSyncing] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [ventasSincronizadas, setVentasSincronizadas] = useState(0);

  const syncingRef = useRef(false);
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // La cola en IndexedDB es del navegador, no del usuario logueado: si en la
  // misma PC entra otro cajero con ventas ajenas todavía sin subir, no se
  // deben sincronizar con SU token (le imputaría la venta a su turno).
  const usuarioIdRef = useRef<number | null>(null);
  useEffect(() => {
    usuarioIdRef.current = user?.id ? Number(user.id) : null;
  }, [user?.id]);

  // Carga inicial de la cola (sobrevive a recargas / cierres del navegador)
  useEffect(() => {
    listVentasPendientes()
      .then(async (list) => {
        // Desatascar ventas que quedaron en "sincronizando" si el usuario recargó la página a mitad del proceso
        const arregladas = await Promise.all(
          list.map(async (v) => {
            if (v.estado === "sincronizando") {
              await updateVentaPendiente(v.id, { estado: "pendiente" });
              return { ...v, estado: "pendiente" as const };
            }
            return v;
          }),
        );
        setVentasPendientes(arregladas);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (accessToken) setSesionExpirada(false);
  }, [accessToken]);

  const procesarCola = useCallback(async (forzarTodo = false) => {
    if (syncingRef.current) return;
    if (!navigator.onLine) return;
    const token = accessTokenRef.current;
    if (!token) return;
    const usuarioActual = usuarioIdRef.current;
    if (!usuarioActual) return;

    const pendientes = await listVentasPendientes();
    const porSincronizar = pendientes.filter((v) => {
      if (!(forzarTodo ? true : v.estado === "pendiente" || v.estado === "sincronizando")) {
        return false;
      }
      // Ventas encoladas antes de este cambio no traen usuarioId: se sincronizan
      // igual (comportamiento previo) en vez de quedar varadas para siempre.
      return v.usuarioId == null || v.usuarioId === usuarioActual;
    });
    if (!porSincronizar.length) return;

    syncingRef.current = true;
    setSyncing(true);
    let huboExito = false;

    for (const venta of porSincronizar) {
      await updateVentaPendiente(venta.id, { estado: "sincronizando" });
      setVentasPendientes((prev) =>
        prev.map((v) =>
          v.id === venta.id ? { ...v, estado: "sincronizando" } : v,
        ),
      );

      // Si la venta se guardó sin conexión y sólo con número de documento (DNI, RUC o CE)
      // pero sin razón social (o vacía), al reconectar a internet consultamos los nombres a la API.
      const payload = { ...venta.payload } as any;
      // El backend descuenta el stock ATÓMICAMENTE al crear la venta. Fusionamos
      // los stockItems guardados en la cola (cubre ventas viejas y nuevas) para
      // que al sincronizar el descuento ocurra dentro de la misma transacción.
      payload.stockItems = venta.stockItems ?? [];
      if (payload?.cliente && payload.cliente.numeroDocumento) {
        const cli = payload.cliente;
        const numDoc = String(cli.numeroDocumento).trim();
        const len = numDoc.length;
        const razonActual = (cli.razonSocial || "").trim();

        const esDocGenerico =
          !numDoc ||
          numDoc === "0" ||
          numDoc === "00000000" ||
          numDoc === "99999999" ||
          numDoc === "99999999999" ||
          numDoc === "00000000000" ||
          numDoc === "11111111";

        const esNombrePlaceholder =
          !razonActual ||
          /^(cliente|clientes varios|cliente con dni|cliente con ruc|sin nombre|consumidor final)$/i.test(razonActual);

        if (!esDocGenerico && esNombrePlaceholder) {
          const tipoDoc = cli.tipoDocumento || (len === 11 ? "06" : len === 9 ? "04" : "01");
          const tipoDocKey = tipoDoc === "6" ? "06" : tipoDoc === "1" ? "01" : tipoDoc === "4" ? "04" : tipoDoc;
          try {
            // 1. Primero intentar leer de caché local IndexedDB
            const desdeCache = await getClienteCache(tipoDocKey, numDoc).catch(() => null);
            if (
              desdeCache?.cliente?.razonSocial &&
              !/^(cliente|clientes varios|cliente con dni|cliente con ruc)$/i.test(desdeCache.cliente.razonSocial.trim())
            ) {
              cli.razonSocial = desdeCache.cliente.razonSocial;
              if (desdeCache.cliente.direccionLineal) cli.direccionLineal = desdeCache.cliente.direccionLineal;
              if (desdeCache.cliente.ubigeo) cli.ubigeo = desdeCache.cliente.ubigeo;
              if (desdeCache.cliente.departamento) cli.departamento = desdeCache.cliente.departamento;
              if (desdeCache.cliente.provincia) cli.provincia = desdeCache.cliente.provincia;
              if (desdeCache.cliente.distrito) cli.distrito = desdeCache.cliente.distrito;
              if (venta.resumenTicket) venta.resumenTicket.clienteNombre = desdeCache.cliente.razonSocial;
            } else {
              // 2. Si no está en caché, consultar a la API de consulta en línea
              if (len === 8 || tipoDocKey === "01") {
                const resDni = await consultaDni(numDoc);
                if (resDni?.nombreCompleto) {
                  cli.razonSocial = resDni.nombreCompleto;
                  if (venta.resumenTicket) venta.resumenTicket.clienteNombre = resDni.nombreCompleto;
                  cacheCliente("01", numDoc, { razonSocial: resDni.nombreCompleto, tipoDocumento: "01", numeroDocumento: numDoc }).catch(() => {});
                }
              } else if (len === 11 || tipoDocKey === "06") {
                const resRuc = await consultaRuc(numDoc);
                if (resRuc?.razonSocial) {
                  cli.razonSocial = resRuc.razonSocial;
                  cli.direccionLineal = resRuc.direccionLineal || cli.direccionLineal;
                  cli.ubigeo = resRuc.ubigeo || cli.ubigeo;
                  cli.departamento = resRuc.departamento || cli.departamento;
                  cli.provincia = resRuc.provincia || cli.provincia;
                  cli.distrito = resRuc.distrito || cli.distrito;
                  if (venta.resumenTicket) venta.resumenTicket.clienteNombre = resRuc.razonSocial;
                  cacheCliente("06", numDoc, { ...resRuc, tipoDocumento: "06", numeroDocumento: numDoc }).catch(() => {});
                }
              } else if (len === 9 || tipoDocKey === "04") {
                const resCe = await consultaCe(numDoc);
                if (resCe?.nombreCompleto) {
                  cli.razonSocial = resCe.nombreCompleto;
                  if (venta.resumenTicket) venta.resumenTicket.clienteNombre = resCe.nombreCompleto;
                  cacheCliente("04", numDoc, { razonSocial: resCe.nombreCompleto, tipoDocumento: "04", numeroDocumento: numDoc }).catch(() => {});
                }
              }
            }
          } catch {
            // Silencioso
          }
        }
      }

      try {
        let comprobanteId: number;
        let mensajeSunat: string;

        if (venta.tipo === "notaventa") {
          const res = await crearNotaVenta(payload, token);
          comprobanteId = (res.comprobanteId ?? res.ComprobanteId) as number;
          mensajeSunat = "Nota de venta sincronizada correctamente.";
        } else {
          const res = await generarXml(payload, token);
          comprobanteId = res.comprobanteId;
          try {
            const resSunat = await enviarASunatApi(comprobanteId, token);
            mensajeSunat = resSunat.exitoso
              ? (resSunat.mensaje ?? "Venta sincronizada y aceptada por SUNAT.")
              : "Venta sincronizada. Quedó pendiente/observada por SUNAT — revisa Comprobantes.";
          } catch {
            mensajeSunat =
              "Venta sincronizada en el sistema. No se pudo confirmar el envío a SUNAT — revisa Comprobantes.";
          }
        }

        // El stock ya se descontó atómicamente al crear la venta (payload.stockItems);
        // no hay un paso de descuento separado.

        await deleteVentaPendiente(venta.id);
        setVentasPendientes((prev) => prev.filter((v) => v.id !== venta.id));
        huboExito = true;
        showToast(mensajeSunat, "success");
      } catch (err: any) {
        if (err?.response?.status === 401) {
          setSesionExpirada(true);
          await updateVentaPendiente(venta.id, { estado: "pendiente" });
          setVentasPendientes((prev) =>
            prev.map((v) =>
              v.id === venta.id ? { ...v, estado: "pendiente" } : v,
            ),
          );
          break;
        }

        if (esErrorTransitorio(err)) {
          // Se cayó la conexión, o el backend falló por su cuenta (ej. su base
          // de datos), a mitad de la sincronización: se reintenta más tarde.
          await updateVentaPendiente(venta.id, { estado: "pendiente" });
          setVentasPendientes((prev) =>
            prev.map((v) =>
              v.id === venta.id ? { ...v, estado: "pendiente" } : v,
            ),
          );
          break;
        }

        const mensaje =
          err?.response?.data?.mensaje ??
          err?.response?.data?.message ??
          "Error al sincronizar la venta";
        await updateVentaPendiente(venta.id, {
          estado: "error",
          ultimoError: mensaje,
          intentos: (venta.intentos ?? 0) + 1,
        });
        setVentasPendientes((prev) =>
          prev.map((v) =>
            v.id === venta.id
              ? { ...v, estado: "error", ultimoError: mensaje }
              : v,
          ),
        );
      }
    }

    syncingRef.current = false;
    setSyncing(false);
    // El backend ya descontó el stock de estas ventas: se avisa a las cajas
    // abiertas para que recarguen el catálogo real (equivale a pulsar
    // "Actualizar stock desde el servidor", pero solo).
    if (huboExito) setVentasSincronizadas((n) => n + 1);
  }, [showToast]);

  const sincronizarAhora = useCallback(() => {
    procesarCola(true);
  }, [procesarCola]);

  // Dispara la sincronización: al montar, al volver la conexión, y cada 45s
  // como red de seguridad mientras haya pendientes (por si el evento "online"
  // del navegador no llega a disparar, ej. wifi con portal cautivo).
  useEffect(() => {
    if (isOnline) procesarCola();
  }, [isOnline, procesarCola]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      procesarCola();
    }, 45000);
    return () => clearInterval(interval);
  }, [isOnline, procesarCola]);

  const enqueueVenta = useCallback(
    async (
      payload: Record<string, unknown>,
      stockItems: { sucursalProductoId: number; cantidad: number; item?: number }[],
      resumenTicket: VentaPendiente["resumenTicket"],
      tipo: TipoVentaPendiente = "comprobante",
    ) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `venta-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const registro = await enqueueVentaPendiente({
        id,
        tipo,
        createdAt: new Date().toISOString(),
        usuarioId: usuarioIdRef.current ?? 0,
        payload,
        stockItems,
        resumenTicket,
      });
      setVentasPendientes((prev) => [...prev, registro]);
      return id;
    },
    [],
  );

  const reintentarVenta = useCallback(
    (id: string) => {
      updateVentaPendiente(id, { estado: "pendiente" }).then(() => {
        setVentasPendientes((prev) =>
          prev.map((v) => (v.id === id ? { ...v, estado: "pendiente" } : v)),
        );
        procesarCola(true);
      });
    },
    [procesarCola],
  );

  const eliminarVenta = useCallback(
    async (id: string) => {
      await deleteVentaPendiente(id);
      setVentasPendientes((prev) => prev.filter((v) => v.id !== id));
      showToast("Venta pendiente eliminada", "info");
    },
    [showToast],
  );

  // La cola completa vive en IndexedDB para poder sincronizar ventas ajenas
  // en cuanto su dueño vuelva a loguearse (ver procesarCola), pero lo que se
  // le muestra al cajero (badge, lista, aviso al cuadrar) es solo lo suyo:
  // lo de otro usuario no le compete y no debe alarmarlo.
  const usuarioActual = user?.id ? Number(user.id) : null;
  const propias = ventasPendientes.filter(
    (v) => v.usuarioId == null || v.usuarioId === usuarioActual,
  );

  const cantidadPendientes = propias.filter(
    (v) => v.estado === "pendiente" || v.estado === "sincronizando",
  ).length;
  const cantidadError = propias.filter(
    (v) => v.estado === "error",
  ).length;

  return (
    <OfflineSalesContext.Provider
      value={{
        isOnline,
        ventasPendientes: propias,
        cantidadPendientes,
        cantidadError,
        syncing,
        sesionExpirada,
        ventasSincronizadas,
        enqueueVenta,
        sincronizarAhora,
        reintentarVenta,
        eliminarVenta,
      }}
    >
      {children}
    </OfflineSalesContext.Provider>
  );
}

export function useOfflineSales(): OfflineSalesContextValue {
  const ctx = useContext(OfflineSalesContext);
  if (!ctx)
    throw new Error(
      "useOfflineSales debe usarse dentro de <OfflineSalesProvider>",
    );
  return ctx;
}
