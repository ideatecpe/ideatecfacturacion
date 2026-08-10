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
} from "@/lib/offline/offlineDb";
import {
  generarXml,
  enviarASunatApi,
  crearNotaVenta,
  descontarStockApi,
} from "@/app/factufly/operaciones/boleta/gestionBoletas/emitirBoletaApi";

interface OfflineSalesContextValue {
  isOnline: boolean;
  ventasPendientes: VentaPendiente[];
  cantidadPendientes: number;
  cantidadError: number;
  syncing: boolean;
  sesionExpirada: boolean;
  enqueueVenta: (
    payload: Record<string, unknown>,
    stockItems: { sucursalProductoId: number; cantidad: number }[],
    resumenTicket: VentaPendiente["resumenTicket"],
    tipo?: TipoVentaPendiente,
  ) => Promise<string>;
  sincronizarAhora: () => void;
  reintentarVenta: (id: string) => void;
}

const OfflineSalesContext = createContext<OfflineSalesContextValue | null>(
  null,
);

export function OfflineSalesProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const isOnline = useOnlineStatus();
  const { showToast } = useToast();

  const [ventasPendientes, setVentasPendientes] = useState<VentaPendiente[]>(
    [],
  );
  const [syncing, setSyncing] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const syncingRef = useRef(false);
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Carga inicial de la cola (sobrevive a recargas / cierres del navegador)
  useEffect(() => {
    listVentasPendientes().then(setVentasPendientes).catch(() => {});
  }, []);

  useEffect(() => {
    if (accessToken) setSesionExpirada(false);
  }, [accessToken]);

  const procesarCola = useCallback(async () => {
    if (syncingRef.current) return;
    if (!navigator.onLine) return;
    const token = accessTokenRef.current;
    if (!token) return;

    const pendientes = await listVentasPendientes();
    const porSincronizar = pendientes.filter((v) => v.estado === "pendiente");
    if (!porSincronizar.length) return;

    syncingRef.current = true;
    setSyncing(true);

    for (const venta of porSincronizar) {
      await updateVentaPendiente(venta.id, { estado: "sincronizando" });
      setVentasPendientes((prev) =>
        prev.map((v) =>
          v.id === venta.id ? { ...v, estado: "sincronizando" } : v,
        ),
      );

      try {
        let comprobanteId: number;
        let mensajeSunat: string;

        if (venta.tipo === "notaventa") {
          const res = await crearNotaVenta(venta.payload, token);
          comprobanteId = (res.comprobanteId ?? res.ComprobanteId) as number;
          mensajeSunat = "Nota de venta sincronizada correctamente.";
        } else {
          const res = await generarXml(venta.payload, token);
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

        if (venta.stockItems.length) {
          try {
            await descontarStockApi(comprobanteId, venta.stockItems, token);
          } catch {
            // El stock se puede reconciliar manualmente; no bloquea la sincronización.
          }
        }

        await deleteVentaPendiente(venta.id);
        setVentasPendientes((prev) => prev.filter((v) => v.id !== venta.id));
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

        if (!err?.response) {
          // Se cayó la conexión de nuevo a mitad de la sincronización.
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
  }, [showToast]);

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
      stockItems: { sucursalProductoId: number; cantidad: number }[],
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
        procesarCola();
      });
    },
    [procesarCola],
  );

  const cantidadPendientes = ventasPendientes.filter(
    (v) => v.estado === "pendiente" || v.estado === "sincronizando",
  ).length;
  const cantidadError = ventasPendientes.filter(
    (v) => v.estado === "error",
  ).length;

  return (
    <OfflineSalesContext.Provider
      value={{
        isOnline,
        ventasPendientes,
        cantidadPendientes,
        cantidadError,
        syncing,
        sesionExpirada,
        enqueueVenta,
        sincronizarAhora: procesarCola,
        reintentarVenta,
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
