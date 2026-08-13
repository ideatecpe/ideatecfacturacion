// gestionOrdenes/useEliminarCompraProveedor.ts

import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useEliminarCompraProveedor() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [loadingEliminarCompra, setLoadingEliminarCompra] = useState(false);

  const eliminarCompraProveedor = async (compraProveedorId: number): Promise<boolean> => {
    setLoadingEliminarCompra(true);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/compra/${compraProveedorId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Orden de compra eliminada correctamente.", "success");
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          showToast("No se encontró la orden de compra.", "error");
        } else if (status === 409) {
          showToast(error.response?.data?.mensaje ?? "No se pudo eliminar la orden de compra.", "error");
        } else {
          showToast("No se pudo eliminar la orden de compra. Intenta nuevamente.", "error");
        }
      } else {
        showToast("No se pudo eliminar la orden de compra. Intenta nuevamente.", "error");
      }
      return false;
    } finally {
      setLoadingEliminarCompra(false);
    }
  };

  return { eliminarCompraProveedor, loadingEliminarCompra };
}
