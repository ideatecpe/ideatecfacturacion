import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireEditarTipoCambioDto, SireEditarTipoCambioResponse } from "./types";

export const useSireEditarTipoCambio = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const editarTipoCambio = useCallback(
    async (
      ruc: string,
      perTributario: string,
      datos: SireEditarTipoCambioDto,
    ): Promise<SireEditarTipoCambioResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/propuesta/${perTributario}/tipo-cambio`,
        );
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(datos),
        });

        if (!response.ok) {
          showToast("Error al actualizar el tipo de cambio en SUNAT", "error");
          return null;
        }

        const data: SireEditarTipoCambioResponse = await response.json();
        if (data.success) {
          showToast("Tipo de cambio actualizado correctamente", "success");
        } else {
          showToast(data.mensaje ?? "SUNAT rechazó la actualización", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al actualizar el tipo de cambio", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, editarTipoCambio };
};
