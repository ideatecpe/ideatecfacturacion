import { useState, useEffect, useRef, useCallback } from "react";

interface NotificationDoc {
  id: number;
  tipo: "comprobante" | "guia";
  numeroCompleto: string;
  tipoComprobante: string;
  destinatario: string;
  importeTotal?: string;
  tipoMoneda?: string;
  estadoSunat: string;
  fechaActualizacion?: string;
  mensajeRespuestaSunat?: string;
  codigoRespuestaSunat?: string;
}

interface CertInfo {
  expiryDate: string;
  daysLeft: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

interface DashboardData {
  pendingDocs: NotificationDoc[];
  lastAccepted: NotificationDoc | null;
  lastRejected: NotificationDoc | null;
  recentDocs: NotificationDoc[];
  totalPending: number;
  certInfo: CertInfo | null;
  generatedAt: string;
}

export interface YapeAlert {
  monto: string;
  remitente: string;
  codigoSeguridad?: string;
  fechaHora?: string;
}

interface UseNotificationsParams {
  sucursalId?: number | null;
  empresaRuc?: string | null;
}

export function useNotifications({
  sucursalId,
  empresaRuc,
}: UseNotificationsParams) {
  const [data, setData] = useState<DashboardData>({
    pendingDocs: [],
    lastAccepted: null,
    lastRejected: null,
    recentDocs: [],
    totalPending: 0,
    certInfo: null,
    generatedAt: "",
  });

  const [connected, setConnected] = useState(false);
  const [yapeAlert, setYapeAlert] = useState<YapeAlert | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const dismissYape = useCallback(() => setYapeAlert(null), []);

  useEffect(() => {
    if (!sucursalId && !empresaRuc) return; // espera a que lleguen los valores

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      ws = new WebSocket(
        process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080",
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(
          JSON.stringify({
            sucursalId: sucursalId ?? null,
            empresaRuc: empresaRuc ?? null,
          }),
        );
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "yape") {
          setYapeAlert(msg.data as YapeAlert);
          return;
        }
        if (msg.type === "dashboard") {
          const { evento, ...newData } = msg.data;
          if (evento === "pending") {
            // Solo actualiza pendientes
            setData((prev) => ({
              ...prev,
              pendingDocs: newData.pendingDocs,
              totalPending: newData.totalPending,
              recentDocs: newData.recentDocs ?? prev.recentDocs,
            }));
          } else if (evento === "status") {
            setData((prev) => ({
              ...prev,
              pendingDocs: newData.pendingDocs,
              totalPending: newData.totalPending,
              lastAccepted: newData.lastAccepted,
              lastRejected: newData.lastRejected,
              recentDocs: newData.recentDocs ?? prev.recentDocs,
            }));
          } else {
            // Reemplaza todo
            setData(newData);
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    }

    // ← Pequeño delay para asegurar que la sesión ya está lista
    const initTimeout = setTimeout(connect, 500);

    return () => {
      clearTimeout(initTimeout);
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [sucursalId, empresaRuc]);

  return { ...data, connected, yapeAlert, dismissYape };
}
