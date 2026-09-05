import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireComprobanteCompraEliminarDto, SireEliminarComprobanteResponse } from "./types";

export const useSireEliminarComprobanteRce = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const eliminarComprobanteRce = useCallback(
    async (
      ruc: string,
      perTributario: string,
      enPreliminar: boolean,
      comprobante: SireComprobanteCompraEliminarDto,
    ): Promise<SireEliminarComprobanteResponse | null> => {
      setLoading(true);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sire/rce/propuesta/${perTributario}/comprobantes`,
        );
        url.searchParams.append("ruc", ruc);
        url.searchParams.append("enPreliminar", String(enPreliminar));

        const response = await fetch(url.toString(), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([comprobante]),
        });

        if (!response.ok) {
          showToast("Error al eliminar el comprobante en SUNAT", "error");
          return null;
        }

        const data: SireEliminarComprobanteResponse = await response.json();
        if (data.success) {
          showToast("Comprobante eliminado correctamente", "success");
        } else {
          showToast(data.mensaje ?? "SUNAT rechazó la eliminación", "error");
        }
        return data;
      } catch {
        showToast("Error de conexión al eliminar el comprobante", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { loading, eliminarComprobanteRce };
};
