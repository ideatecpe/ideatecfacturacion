import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useActualizarFechaVencimientoLote() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [actualizandoLoteId, setActualizandoLoteId] = useState<number | null>(null);

  // fechaVencimiento en null limpia el vencimiento del lote (queda sin fecha).
  const actualizarFechaVencimiento = async (
    inventarioLoteId: number,
    fechaVencimiento: string | null,
  ): Promise<boolean> => {
    setActualizandoLoteId(inventarioLoteId);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/lote/${inventarioLoteId}/fecha-vencimiento`,
        { fechaVencimiento },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Fecha de vencimiento actualizada correctamente.", "success");
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        showToast("El lote no existe o ya no está activo.", "error");
      } else {
        showToast("No se pudo actualizar la fecha de vencimiento. Intenta nuevamente.", "error");
      }
      return false;
    } finally {
      setActualizandoLoteId(null);
    }
  };

  return { actualizarFechaVencimiento, actualizandoLoteId };
}
