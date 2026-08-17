import { useState, useCallback } from "react";
import axios from "axios";
import { StockValorizado } from "./Inventario";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useStockValorizadoLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [stockValorizado, setStockValorizado] = useState<StockValorizado[]>([]);
  const [loadingStockValorizado, setLoadingStockValorizado] = useState(false);

  const fetchStockValorizadoSucursal = useCallback(
    async (sucursalId: number) => {
      if (!sucursalId) return;
      setLoadingStockValorizado(true);
      try {
        const res = await axios.get<StockValorizado[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/stock-valorizado/sucursal/${sucursalId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
            params: { _: Date.now() },
          },
        );
        setStockValorizado(res.data ?? []);
      } catch {
        showToast("Error al cargar el stock valorizado", "error");
      } finally {
        setLoadingStockValorizado(false);
      }
    },
    [accessToken],
  );

  return { stockValorizado, loadingStockValorizado, fetchStockValorizadoSucursal };
}
