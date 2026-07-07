import { useState, useCallback } from "react";
import axios from "axios";
import { KardexMovimiento } from "./Inventario";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

interface FetchKardexParams {
  sucursalProductoId: number;
  desde?: string;
  hasta?: string;
}

export function useKardexLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [kardex, setKardex] = useState<KardexMovimiento[]>([]);
  const [loadingKardex, setLoadingKardex] = useState(false);

  const fetchKardex = useCallback(
    async ({ sucursalProductoId, desde, hasta }: FetchKardexParams) => {
      if (!sucursalProductoId) return;
      setLoadingKardex(true);
      try {
        const res = await axios.get<KardexMovimiento[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/kardex/${sucursalProductoId}`,
          {
            params: { desde: desde || undefined, hasta: hasta || undefined },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        setKardex(res.data ?? []);
      } catch {
        showToast("Error al cargar el kardex del producto", "error");
      } finally {
        setLoadingKardex(false);
      }
    },
    [accessToken],
  );

  return { kardex, loadingKardex, fetchKardex };
}
