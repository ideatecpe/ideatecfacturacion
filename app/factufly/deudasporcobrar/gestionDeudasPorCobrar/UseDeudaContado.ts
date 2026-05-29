import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { DeudaContado } from "./DeudaContado";

interface Params {
  empresaRuc: string;
  establecimientoAnexo?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  clienteNumDoc?: string | null;
  serie?: string | null;
  correlativo?: number | null;
  estadoPago?: 'PENDIENTE' | 'PAGADO' | 'TODOS' | null;
}

interface UseDeudaContadoReturn {
  deudas: DeudaContado[];
  loading: boolean;
  error: string | null;
  fetchDeudas: (params: Params) => Promise<DeudaContado[]>;
  reset: () => void;
}

export const useDeudaContado = (): UseDeudaContadoReturn => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [deudas, setDeudas] = useState<DeudaContado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeudas = useCallback(
    async ({
      empresaRuc,
      establecimientoAnexo,
      fechaInicio,
      fechaFin,
      clienteNumDoc,
      serie,
      correlativo,
      estadoPago,
    }: Params): Promise<DeudaContado[]> => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          `${process.env.NEXT_PUBLIC_API_URL}/api/DeudaContado`,
        );
        url.searchParams.append("empresaRuc", empresaRuc);
        if (establecimientoAnexo)
          url.searchParams.append("establecimientoAnexo", establecimientoAnexo);
        if (fechaInicio) url.searchParams.append("fechaInicio", fechaInicio);
        if (fechaFin) url.searchParams.append("fechaFin", fechaFin);
        if (clienteNumDoc)
          url.searchParams.append("clienteNumDoc", clienteNumDoc);
        if (serie) url.searchParams.append("serie", serie);
        if (correlativo != null) url.searchParams.append("correlativo", correlativo.toString());
        if (estadoPago) url.searchParams.append("estadoPago", estadoPago);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.status === 404) {
          setDeudas([]);
          return [];
        }

        if (!response.ok)
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        const data: DeudaContado[] = await response.json();
        setDeudas(data);
        return data;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al obtener deudas";
        setError(msg);
        setDeudas([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const reset = useCallback(() => {
    setDeudas([]);
    setError(null);
    setLoading(false);
  }, []);

  return { deudas, loading, error, fetchDeudas, reset };
};
