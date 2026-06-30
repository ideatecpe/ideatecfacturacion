// gestionProveedorCompra/useEliminarProveedor.ts

import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useEliminarProveedor() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [loadingEliminar, setLoadingEliminar] = useState(false);

  const eliminarProveedor = async (proveedorId: number): Promise<boolean> => {
    setLoadingEliminar(true);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/${proveedorId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Proveedor eliminado correctamente.", "success");
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        showToast("No se encontró el proveedor.", "error");
      } else {
        showToast("No se pudo eliminar el proveedor. Intenta nuevamente.", "error");
      }
      return false;
    } finally {
      setLoadingEliminar(false);
    }
  };

  return { eliminarProveedor, loadingEliminar };
}
