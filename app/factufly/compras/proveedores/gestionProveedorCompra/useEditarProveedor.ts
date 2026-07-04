// gestionProveedorCompra/useEditarProveedor.ts

import { useState } from "react";
import axios from "axios";
import { EditProveedor } from "./Proveedor";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useEditarProveedor() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [loadingEditar, setLoadingEditar] = useState(false);

  const editarProveedor = async (dto: EditProveedor): Promise<boolean> => {
    setLoadingEditar(true);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/${dto.proveedorId}`,
        dto,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Proveedor actualizado correctamente.", "success");
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        showToast("No se encontró el proveedor.", "error");
      } else {
        showToast("No se pudo actualizar el proveedor. Intenta nuevamente.", "error");
      }
      return false;
    } finally {
      setLoadingEditar(false);
    }
  };

  return { editarProveedor, loadingEditar };
}
