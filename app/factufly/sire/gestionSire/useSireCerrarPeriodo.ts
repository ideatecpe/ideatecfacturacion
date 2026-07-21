import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireRegistrarPreliminarResponse } from "./types";

export const useSireCerrarPeriodo = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const cerrarPeriodo = useCallback(
    async (
      ruc: string,
      perTributario: string,
    ): Promise<SireRegistrarPreliminarResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/cerrar/${perTributario}`,
        );
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          showToast("Error al cerrar el periodo SIRE", "error");
          return null;
        }

        const data: SireRegistrarPreliminarResponse = await response.json();
        if (data.success) {
          showToast(`Periodo ${perTributario} cerrado correctamente`, "success");
        } else {
          showToast(data.mensaje ?? "SUNAT rechazó el cierre", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al cerrar el periodo", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, cerrarPeriodo };
};
