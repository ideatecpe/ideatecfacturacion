"use client";

import React from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Loader2, PackageSearch } from "lucide-react";
import { Proveedor } from "@/app/factufly/proveedores/gestionProveedorCompra/Proveedor";
import { useComprasProveedorLista } from "@/app/factufly/proveedores/gestionProveedorCompra/useComprasProveedorLista";

interface Props {
  isOpen: boolean;
  proveedor: Proveedor | null;
  onClose: () => void;
}

export default function HistorialCompras({ isOpen, proveedor, onClose }: Props) {
  const { compras, loadingCompras, fetchComprasByProveedor } = useComprasProveedorLista();

  React.useEffect(() => {
    if (isOpen && proveedor) fetchComprasByProveedor(proveedor.proveedorId);
  }, [isOpen, proveedor]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Historial de compras — ${proveedor?.razonSocial ?? ""}`}
    >
      {loadingCompras ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : compras.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-gray-100 rounded-full p-4 mb-3">
            <PackageSearch className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-semibold text-sm">
            Este proveedor aún no tiene compras registradas
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {compras.map((c) => (
            <div
              key={c.compraProveedorId}
              className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800">{c.nomProducto}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {c.nomSucursal} ·{" "}
                  {new Date(c.fechaCreacion).toLocaleDateString("es-PE")}
                  {c.docReferencia && ` · Doc: ${c.docReferencia}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-gray-900">
                  {c.cantidad} {c.unidadMedida}
                </p>
                <p className="text-[11px] text-brand-blue font-semibold">
                  S/ {c.precioCompra.toFixed(2)} c/u
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
