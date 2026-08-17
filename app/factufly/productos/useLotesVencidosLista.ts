import { useState, useCallback } from "react";
import axios from "axios";
import { LoteVencido } from "./Inventario";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

interface RetirarVencidosResultado {
  mensaje: string;
  totalLotesRetirados: number;
  totalProductosAfectados: number;
  totalCantidadRetirada: number;
  totalCostoRetirado: number;
}

export function useLotesVencidosLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [lotesVencidos, setLotesVencidos] = useState<LoteVencido[]>([]);
  const [loadingLotesVencidos, setLoadingLotesVencidos] = useState(false);
  const [retirandoId, setRetirandoId] = useState<number | null>(null);

  const fetchLotesVencidosSucursal = useCallback(
    async (sucursalId: number) => {
      if (!sucursalId) return;
      setLoadingLotesVencidos(true);
      try {
        const res = await axios.get<LoteVencido[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/vencidos/sucursal/${sucursalId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
            params: { _: Date.now() },
          },
        );
        setLotesVencidos(res.data ?? []);
      } catch {
        showToast("Error al cargar los productos vencidos", "error");
      } finally {
        setLoadingLotesVencidos(false);
      }
    },
    [accessToken],
  );

  // Retira (da de baja) todos los lotes vencidos de un producto puntual (sucursalProductoId).
  const retirarVencidosProducto = useCallback(
    async (sucursalProductoId: number): Promise<boolean> => {
      setRetirandoId(sucursalProductoId);
      try {
        const res = await axios.post<RetirarVencidosResultado>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/retirar-vencidos`,
          null,
          {
            params: { sucursalProductoId },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        showToast(res.data?.mensaje ?? "Producto vencido retirado correctamente.", "success");
        return true;
      } catch {
        showToast("No se pudo retirar el producto vencido. Intenta nuevamente.", "error");
        return false;
      } finally {
        setRetirandoId(null);
      }
    },
    [accessToken],
  );

  return {
    lotesVencidos,
    loadingLotesVencidos,
    fetchLotesVencidosSucursal,
    retirarVencidosProducto,
    retirandoId,
  };
}
