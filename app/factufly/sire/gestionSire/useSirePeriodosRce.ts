import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SirePeriodosResponse } from "./types";

export const useSirePeriodosRce = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const consultarPeriodosRce = useCallback(
    async (ruc: string): Promise<SirePeriodosResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/sire/rce/periodos`);
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          if (response.status === 404) {
            showToast(
              "La empresa no tiene credenciales SIRE configuradas",
              "error",
            );
          } else {
            showToast("Error al consultar los periodos de compras (RCE)", "error");
          }
          return null;
        }

        const data: SirePeriodosResponse = await response.json();
        if (!data.success) {
          showToast(data.mensaje ?? "Error al consultar periodos", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al consultar periodos RCE", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, consultarPeriodosRce };
};
