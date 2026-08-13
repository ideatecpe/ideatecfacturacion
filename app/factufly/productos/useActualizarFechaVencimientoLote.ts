import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export type ActualizarFechaVencimientoResultado =
  | { status: "ok" }
  | {
      status: "requiere_confirmacion";
      mensaje: string;
      cantidadVendida: number;
      cantidadOriginal: number;
    }
  | { status: "error" };

export function useActualizarFechaVencimientoLote() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [actualizandoLoteId, setActualizandoLoteId] = useState<number | null>(null);

  // fechaVencimiento en null limpia el vencimiento del lote (queda sin fecha).
  // confirmar=true reintenta el cambio aceptando el aviso de venta parcial del lote.
  const actualizarFechaVencimiento = async (
    inventarioLoteId: number,
    fechaVencimiento: string | null,
    confirmar = false,
  ): Promise<ActualizarFechaVencimientoResultado> => {
    setActualizandoLoteId(inventarioLoteId);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Inventario/lote/${inventarioLoteId}/fecha-vencimiento`,
        { fechaVencimiento, confirmar },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Fecha de vencimiento actualizada correctamente.", "success");
      return { status: "ok" };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const data = error.response.data as {
          mensaje?: string;
          requiereConfirmacion?: boolean;
          cantidadVendida?: number;
          cantidadOriginal?: number;
        };
        if (data?.requiereConfirmacion) {
          return {
            status: "requiere_confirmacion",
            mensaje: data.mensaje ?? "Parte de este lote ya fue vendida.",
            cantidadVendida: data.cantidadVendida ?? 0,
            cantidadOriginal: data.cantidadOriginal ?? 0,
          };
        }
      }
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        showToast("El lote no existe o ya no está activo.", "error");
      } else {
        showToast("No se pudo actualizar la fecha de vencimiento. Intenta nuevamente.", "error");
      }
      return { status: "error" };
    } finally {
      setActualizandoLoteId(null);
    }
  };

  return { actualizarFechaVencimiento, actualizandoLoteId };
}
