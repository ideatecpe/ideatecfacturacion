import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cacheConfig, getConfigCache } from "@/lib/offline/offlineDb";

export interface Configuracion {
  isImprime: boolean;
  tamañoImpresion: string; // "58" | "80" | "A4"
  igv: string;             // "18" | "10.5"
  isConsumo: boolean;
  guiaRemision: boolean;
  isCredito: boolean;
  itemsDefecto: boolean;
  isBoletaOrFactura: string; // "b" | "f"
  isEnvioResumen: boolean;
  isVale: boolean;
  deudasCobrar: boolean;
  trabajadores: boolean;
  cargaComprobantes: boolean;
  afectacionIgv: boolean;
  descUnitario: boolean;
  isStock: boolean;
  umbralStockBajo?: number | null;
  diasAlertaVencimiento?: number | null;
  useNotaVenta: boolean;
  isCajaAutopago: boolean;
  usaSire: boolean;
  comisionPagoTarjeta?: string | null;
  /** Exige aperturar caja para poder vender y habilita el módulo Caja. */
  administraCaja: boolean;
}

// Cache a nivel de módulo: evita que un remount (p.ej. cambiar Boleta <-> Factura)
// arranque con config=null y muestre valores por defecto (IGV 18%) mientras carga.
const configCache = new Map<string, Configuracion>();

// Notifica a todas las instancias de useConfiguracion ya montadas (p.ej. los modales
// de productos abiertos en la misma sesión) que vuelvan a pedir la config al backend.
// Sin esto, guardar en la página de Configuración no se reflejaba hasta recargar la
// app, porque cada instancia del hook solo hacía fetch una vez al montarse.
const configEmitter = new EventTarget();

export function notificarConfiguracionActualizada() {
  configEmitter.dispatchEvent(new Event("actualizada"));
}

export function useConfiguracion() {
  const { user, accessToken } = useAuth();
  const cached = user?.ruc ? configCache.get(user.ruc) ?? null : null;
  const [config, setConfig] = useState<Configuracion | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!user?.ruc || !accessToken) return;
    const ruc = user.ruc;

    function cargar() {
      let usedNetwork = false;

      if (!configCache.has(ruc)) {
        setLoading(true);
        // Mientras se confirma por red, muestra lo último bueno guardado en el
        // dispositivo (sobrevive a un reload sin conexión, a diferencia del
        // Map en memoria de arriba).
        getConfigCache(ruc)
          .then((entry) => {
            if (entry && !usedNetwork) {
              configCache.set(ruc, entry.config);
              setConfig(entry.config);
            }
          })
          .catch(() => {});
      }

      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Configuracion/${ruc}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            usedNetwork = true;
            configCache.set(ruc, data);
            setConfig(data);
            cacheConfig(ruc, data).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    cargar();
    configEmitter.addEventListener("actualizada", cargar);
    return () => configEmitter.removeEventListener("actualizada", cargar);
  }, [user?.ruc, accessToken]);

  return { config, loading };
}
