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
}

export function useConfiguracion() {
  const { user, accessToken } = useAuth();
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.ruc || !accessToken) return;
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Configuracion/${user.ruc}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setConfig(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.ruc, accessToken]);

  return { config, loading };
}
