import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireAceptarPropuestaResponse } from "./types";

export const useSireAceptarPropuestaRce = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const aceptarPropuestaRce = useCallback(
    async (
      ruc: string,
      perTributario: string,
    ): Promise<SireAceptarPropuestaResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/rce/aceptar-propuesta/${perTributario}`,
        );
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          showToast("Error al aceptar la propuesta de compras (RCE)", "error");
          return null;
        }

        const data: SireAceptarPropuestaResponse = await response.json();
        if (data.success) {
          showToast(
            `Propuesta de compras aceptada. Ticket: ${data.numTicket ?? "—"}`,
            "success",
          );
        } else {
          showToast(data.mensaje ?? "SUNAT rechazó la propuesta", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al aceptar la propuesta RCE", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, aceptarPropuestaRce };
};
