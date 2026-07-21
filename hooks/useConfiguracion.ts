import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

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
  numeroStockBajo?: string | null;
  useNotaVenta: boolean;
  isCajaAutopago: boolean;
  usaSire: boolean;
}

// Cache a nivel de módulo: evita que un remount (p.ej. cambiar Boleta <-> Factura)
// arranque con config=null y muestre valores por defecto (IGV 18%) mientras carga.
const configCache = new Map<string, Configuracion>();

export function useConfiguracion() {
  const { user, accessToken } = useAuth();
  const cached = user?.ruc ? configCache.get(user.ruc) ?? null : null;
  const [config, setConfig] = useState<Configuracion | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!user?.ruc || !accessToken) return;
    const ruc = user.ruc;
    if (!configCache.has(ruc)) setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Configuracion/${ruc}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          configCache.set(ruc, data);
          setConfig(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.ruc, accessToken]);

  return { config, loading };
}
