// gestionOrdenes/useOrdenesLista.ts

import { useState, useCallback } from "react";
import axios, { AxiosResponse } from "axios";
import { CompraProveedor } from "../../proveedores/gestionProveedorCompra/Proveedor";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Sucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/Boleta";

interface FetchOrdenesParams {
  /** 0 = sin filtro de proveedor */
  proveedorId?: number;
  /** 0 = sin filtro de sucursal (trae todas las de la empresa, si es superadmin) */
  sucursalId?: number;
  /** Lista de sucursales de la empresa, usada para mezclar resultados cuando no hay filtro de sucursal puntual */
  sucursalesEmpresa?: Sucursal[];
}

function dedupePorId(compras: CompraProveedor[]): CompraProveedor[] {
  const map = new Map<number, CompraProveedor>();
  compras.forEach((c) => map.set(c.compraProveedorId, c));
  return Array.from(map.values());
}

export function useOrdenesLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [ordenes, setOrdenes] = useState<CompraProveedor[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);

  const fetchOrdenes = useCallback(
    async ({ proveedorId = 0, sucursalId = 0, sucursalesEmpresa = [] }: FetchOrdenesParams) => {
      setLoadingOrdenes(true);
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const base = process.env.NEXT_PUBLIC_API_URL;

        let data: CompraProveedor[] = [];

        if (proveedorId > 0) {
          // Filtro por proveedor: ya cubre todas las sucursales donde compró ese proveedor
          const res = await axios.get<CompraProveedor[]>(
            `${base}/api/Proveedor/compra/proveedor/${proveedorId}`,
            { headers },
          );
          data = res.data ?? [];
        } else if (sucursalId > 0) {
          // Filtro por una sucursal puntual
          const res = await axios.get<CompraProveedor[]>(
            `${base}/api/Proveedor/compra/sucursal/${sucursalId}`,
            { headers },
          );
          data = res.data ?? [];
        } else if (sucursalesEmpresa.length > 0) {
          // Sin filtros: trae todas las sucursales de la empresa y mezcla
          const resultados = await Promise.allSettled(
            sucursalesEmpresa.map((s) =>
              axios.get<CompraProveedor[]>(
                `${base}/api/Proveedor/compra/sucursal/${s.sucursalId}`,
                { headers },
              ),
            ),
          );
          data = resultados
            .filter((r): r is PromiseFulfilledResult<AxiosResponse<CompraProveedor[]>> => r.status === "fulfilled")
            .flatMap((r) => r.value.data ?? []);
        }

        data = dedupePorId(data).sort(
          (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
        );

        setOrdenes(data);
      } catch {
        showToast("Error al cargar las órdenes de compra", "error");
      } finally {
        setLoadingOrdenes(false);
      }
    },
    [accessToken],
  );

  return { ordenes, setOrdenes, loadingOrdenes, fetchOrdenes };
}
