import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { SireRegistro } from "./types";

export const useSireHistorial = () => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [historial, setHistorial] = useState<SireRegistro[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorial = useCallback(
    async (ruc: string): Promise<SireRegistro[]> => {
      setLoading(true);
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/sire/historial`);
        url.searchParams.append("ruc", ruc);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          let mensaje = `Error ${response.status} al consultar el historial SIRE`;
          try {
            const body = await response.json();
            if (body?.mensaje) mensaje = body.mensaje;
          } catch {
            // el cuerpo no es JSON; se conserva el mensaje genérico con el status
          }
          throw new Error(mensaje);
        }

        const data: SireRegistro[] = await response.json();
        setHistorial(data);
        return data;
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error al cargar el historial SIRE";
        console.error("[SIRE] Error consultando historial:", err);
        showToast(mensaje, "error");
        setHistorial([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return { historial, loading, fetchHistorial };
};
