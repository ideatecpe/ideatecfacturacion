// gestionProveedorCompra/useRegistrarCompraProveedor.ts

import { useState } from "react";
import axios from "axios";
import { CompraProveedor, NuevaCompraProveedor } from "./Proveedor";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useRegistrarCompraProveedor() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [loadingRegistrarCompra, setLoadingRegistrarCompra] = useState(false);

  const registrarCompraProveedor = async (
    dto: NuevaCompraProveedor,
  ): Promise<CompraProveedor | null> => {
    setLoadingRegistrarCompra(true);
    try {
      const res = await axios.post<CompraProveedor>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/compra`,
        dto,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Compra registrada y stock actualizado.", "success");
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400) {
          showToast(error.response?.data?.mensaje ?? "Datos inválidos.", "error");
        } else if (status === 409) {
          showToast(error.response?.data?.mensaje ?? "No se pudo registrar la compra.", "info");
        } else {
          showToast("No se pudo registrar la compra. Intenta nuevamente.", "error");
        }
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
      return null;
    } finally {
      setLoadingRegistrarCompra(false);
    }
  };

  return { registrarCompraProveedor, loadingRegistrarCompra };
}
