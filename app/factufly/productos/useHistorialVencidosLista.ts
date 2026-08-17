import { useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export interface HistorialVencido {
  kardexMovimientoId: number;
  sucursalProductoId: number;
  nomProducto: string | null;
  codigo: string | null;
  cantidad: number;
  costoUnitarioPromedio: number;
  costoTotal: number;
  fechaMovimiento: string;
}

export function useHistorialVencidosLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [historial, setHistorial] = useState<HistorialVencido[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const fetchHistorialVencidos = useCallback(
    async (sucursalId: number, desde?: string, hasta?: string) => {
      if (!sucursalId) return;
      setLoadingHistorial(true);
      try {
        const res = await axios.get<HistorialVencido[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/vencidos/historial/sucursal/${sucursalId}`,
          {
            params: { desde: desde || undefined, hasta: hasta || undefined, _: Date.now() },
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );
        setHistorial(res.data ?? []);
      } catch {
        showToast("Error al cargar el historial de vencidos retirados", "error");
      } finally {
        setLoadingHistorial(false);
      }
    },
    [accessToken],
  );

  return { historial, loadingHistorial, fetchHistorialVencidos };
}
