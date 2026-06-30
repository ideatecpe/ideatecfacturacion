// gestionProveedorCompra/useProveedoresLista.ts

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Proveedor } from "./Proveedor";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useProveedoresLista() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);

  const fetchProveedores = useCallback(async () => {
    if (!user?.ruc || !accessToken) return;
    setLoadingProveedores(true);
    try {
      const res = await axios.get<Proveedor[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/ruc/${user.ruc}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setProveedores(res.data);
    } catch (err) {
      showToast("Error al cargar los proveedores", "error");
    } finally {
      setLoadingProveedores(false);
    }
  }, [accessToken, user?.ruc]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  return { proveedores, loadingProveedores, setProveedores, fetchProveedores };
}
