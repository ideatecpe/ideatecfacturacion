import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireDescargarPropuestaResponse } from "./types";

export const useSireDescargarPropuesta = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const descargarPropuesta = useCallback(
    async (
      ruc: string,
      perTributario: string,
    ): Promise<SireDescargarPropuestaResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/propuesta/${perTributario}/comprobantes`,
        );
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          showToast("Error al descargar la propuesta SIRE", "error");
          return null;
        }

        const data: SireDescargarPropuestaResponse = await response.json();
        if (!data.success) {
          showToast(data.mensaje ?? "SUNAT no pudo generar la propuesta", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al descargar la propuesta", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, descargarPropuesta };
};
