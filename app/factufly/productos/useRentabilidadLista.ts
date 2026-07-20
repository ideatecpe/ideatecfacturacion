import { useState, useCallback } from "react";
import axios from "axios";
import { RentabilidadProducto, RentabilidadDiaria } from "./Inventario";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

interface FetchRentabilidadParams {
  sucursalId: number;
  desde?: string;
  hasta?: string;
}

interface FetchRentabilidadDiariaParams {
  sucursalProductoId: number;
  desde?: string;
  hasta?: string;
}

export function useRentabilidadLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [rentabilidad, setRentabilidad] = useState<RentabilidadProducto[]>([]);
  const [loadingRentabilidad, setLoadingRentabilidad] = useState(false);
  const [rentabilidadDiaria, setRentabilidadDiaria] = useState<RentabilidadDiaria[]>([]);
  const [loadingRentabilidadDiaria, setLoadingRentabilidadDiaria] = useState(false);

  const fetchRentabilidad = useCallback(
    async ({ sucursalId, desde, hasta }: FetchRentabilidadParams) => {
      if (!sucursalId) return;
      setLoadingRentabilidad(true);
      try {
        const res = await axios.get<RentabilidadProducto[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/rentabilidad/sucursal/${sucursalId}`,
          {
            params: { desde: desde || undefined, hasta: hasta || undefined },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        setRentabilidad(res.data ?? []);
      } catch {
        showToast("Error al cargar el reporte de rentabilidad", "error");
      } finally {
        setLoadingRentabilidad(false);
      }
    },
    [accessToken],
  );

  const fetchRentabilidadDiaria = useCallback(
    async ({ sucursalProductoId, desde, hasta }: FetchRentabilidadDiariaParams) => {
      if (!sucursalProductoId) return;
      setLoadingRentabilidadDiaria(true);
      try {
        const res = await axios.get<RentabilidadDiaria[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/rentabilidad/producto/${sucursalProductoId}/detalle`,
          {
            params: { desde: desde || undefined, hasta: hasta || undefined },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        setRentabilidadDiaria(res.data ?? []);
      } catch {
        showToast("Error al cargar la evolución del producto", "error");
      } finally {
        setLoadingRentabilidadDiaria(false);
      }
    },
    [accessToken],
  );

  return {
    rentabilidad,
    loadingRentabilidad,
    fetchRentabilidad,
    rentabilidadDiaria,
    loadingRentabilidadDiaria,
    fetchRentabilidadDiaria,
  };
}
