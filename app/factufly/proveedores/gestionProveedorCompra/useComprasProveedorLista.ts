// gestionProveedorCompra/useComprasProveedorLista.ts

import { useState, useCallback } from "react";
import axios from "axios";
import { CompraProveedor } from "./Proveedor";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useComprasProveedorLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [compras, setCompras] = useState<CompraProveedor[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);

  const fetchComprasByProveedor = useCallback(
    async (proveedorId: number) => {
      setLoadingCompras(true);
      try {
        const res = await axios.get<CompraProveedor[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/compra/proveedor/${proveedorId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setCompras(res.data);
      } catch {
        showToast("Error al cargar las compras del proveedor", "error");
      } finally {
        setLoadingCompras(false);
      }
    },
    [accessToken],
  );

  return { compras, loadingCompras, setCompras, fetchComprasByProveedor };
}
