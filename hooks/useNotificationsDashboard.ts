import { useState, useCallback } from "react";

export interface NotifDoc {
  id: number;
  tipo: "comprobante" | "guia";
  numeroCompleto: string;
  tipoComprobante: string;
  destinatario: string;
  importeTotal?: string;
  tipoMoneda?: string;
  estadoSunat: string;
  fechaActualizacion?: string;
  codigoRespuestaSunat?: string;
  mensajeRespuestaSunat?: string;
}

export interface CertInfo {
  expiryDate: string;
  daysLeft: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

interface State {
  pendingDocs: NotifDoc[];
  allAccepted: NotifDoc[];
  allRejected: NotifDoc[];
  recentDocs: NotifDoc[];
  certInfo: CertInfo | null;
  totalPending: number;
  generatedAt: string;
}

const EMPTY: State = {
  pendingDocs: [],
  allAccepted: [],
  allRejected: [],
  recentDocs: [],
  certInfo: null,
  totalPending: 0,
  generatedAt: "",
};

interface Params {
  sucursalId?: number | null;
  empresaRuc?: string | null;
}

/**
 * Hook para cargar notificaciones del dashboard vía REST (carga única).
 * Independiente del WebSocket — no interfiere con useNotifications.
 */
export function useNotificationsDashboard({ sucursalId, empresaRuc }: Params) {
  const [data, setData] = useState<State>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sucursalId && !empresaRuc) return;

    const params = new URLSearchParams();
    if (sucursalId) params.set("sucursalId", String(sucursalId));
    if (empresaRuc) params.set("empresaRuc", empresaRuc);

    // Convierte ws:// → http://, wss:// → https://
    const baseUrl = (process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080")
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://")
      .replace(/\/notify\/?$/, "");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${baseUrl}/dashboard-notifications?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error desconocido");

      setData({
        pendingDocs: json.pendingDocs ?? [],
        allAccepted: json.allAccepted ?? [],
        allRejected: json.allRejected ?? [],
        recentDocs: json.recentDocs ?? [],
        certInfo: json.certInfo ?? null,
        totalPending: json.totalPending ?? 0,
        generatedAt: json.generatedAt ?? "",
      });
    } catch (err: any) {
      setError(err.message ?? "Error al cargar notificaciones");
    } finally {
      setLoading(false);
    }
  }, [sucursalId, empresaRuc]);

  return { ...data, loading, error, refetch };
}
