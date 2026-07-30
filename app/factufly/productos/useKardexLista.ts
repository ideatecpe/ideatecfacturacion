import { useState, useCallback, useRef } from "react";
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
  const abortRef = useRef<AbortController | null>(null);

  const fetchKardex = useCallback(
    async ({ sucursalProductoId, desde, hasta }: FetchKardexParams) => {
      if (!sucursalProductoId) return;

      // Cancela la petición anterior para que una respuesta lenta con
      // un filtro de fecha viejo no sobreescriba el resultado del filtro actual.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoadingKardex(true);
      try {
        const res = await axios.get<KardexMovimiento[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/kardex/${sucursalProductoId}`,
          {
            params: { desde: desde || undefined, hasta: hasta || undefined },
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          },
        );
        setKardex(res.data ?? []);
      } catch (err) {
        if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
          return;
        }
        showToast("Error al cargar el kardex del producto", "error");
      } finally {
        if (abortRef.current === controller) {
          setLoadingKardex(false);
        }
      }
    },
    [accessToken],
  );

  return { kardex, loadingKardex, fetchKardex };
}
