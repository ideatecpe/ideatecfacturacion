// gestionProveedorCompra/useRegistrarProveedor.ts

import { useState } from "react";
import axios from "axios";
import { NuevoProveedor, Proveedor } from "./Proveedor";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useRegistrarProveedor() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [loadingRegistrar, setLoadingRegistrar] = useState(false);

  const registrarProveedor = async (
    dto: NuevoProveedor,
  ): Promise<Proveedor | null> => {
    setLoadingRegistrar(true);
    try {
      const res = await axios.post<Proveedor>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor`,
        dto,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Proveedor registrado exitosamente.", "success");
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 409) {
          showToast(error.response?.data?.mensaje ?? "Proveedor duplicado.", "info");
        } else if (status === 400) {
          showToast("Los datos ingresados no son válidos.", "error");
        } else {
          showToast("No se pudo registrar el proveedor. Intenta nuevamente.", "error");
        }
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
      return null;
    } finally {
      setLoadingRegistrar(false);
    }
  };

  return { registrarProveedor, loadingRegistrar };
}
