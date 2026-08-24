import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireComprobanteNuevoDto, SireImportarComprobantesResponse } from "./types";

export const useSireImportarComprobante = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const importarComprobante = useCallback(
    async (
      ruc: string,
      perTributario: string,
      enPreliminar: boolean,
      comprobante: SireComprobanteNuevoDto,
    ): Promise<SireImportarComprobantesResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/propuesta/${perTributario}/comprobantes`,
        );
        url.searchParams.append("ruc", ruc);
        url.searchParams.append("enPreliminar", String(enPreliminar));

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([comprobante]),
        });

        if (!response.ok) {
          showToast("Error al enviar el comprobante a SUNAT", "error");
          return null;
        }

        const data: SireImportarComprobantesResponse = await response.json();
        if (data.success) {
          showToast("Comprobante agregado correctamente", "success");
        } else {
          showToast(data.mensaje ?? "SUNAT rechazó el envío del comprobante", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al enviar el comprobante", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, importarComprobante };
};
