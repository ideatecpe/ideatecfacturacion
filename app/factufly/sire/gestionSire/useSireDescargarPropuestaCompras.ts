import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireDescargarPropuestaComprasResponse } from "./types";

export const useSireDescargarPropuestaCompras = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const descargarPropuestaCompras = useCallback(
    async (
      ruc: string,
      perTributario: string,
    ): Promise<SireDescargarPropuestaComprasResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/rce/propuesta/${perTributario}/comprobantes`,
        );
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          showToast("Error al descargar la propuesta de compras (RCE)", "error");
          return null;
        }

        const data: SireDescargarPropuestaComprasResponse = await response.json();
        if (!data.success) {
          showToast(data.mensaje ?? "SUNAT no pudo generar la propuesta de compras", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al descargar la propuesta de compras", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, descargarPropuestaCompras };
};
