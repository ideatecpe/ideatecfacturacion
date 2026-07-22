"use client";

import React from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import {
  Proveedor,
  CompraProveedor,
} from "@/app/factufly/compras/proveedores/gestionProveedorCompra/Proveedor";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  compra: CompraProveedor | null;
  proveedores: Proveedor[];
  onGuardado: (compraEditada: CompraProveedor) => void;
}

export default function EditarCompraModal({
  isOpen,
  onClose,
  compra,
  proveedores,
  onGuardado,
}: Props) {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [proveedorId, setProveedorId] = React.useState(0);
  const [productoId, setProductoId] = React.useState(0);
  const [cantidad, setCantidad] = React.useState("");
  const [precioCompra, setPrecioCompra] = React.useState("");
  const [docReferencia, setDocReferencia] = React.useState("");
  const [fechaVencimiento, setFechaVencimiento] = React.useState("");
  const [productos, setProductos] = React.useState<ProductoSucursal[]>([]);
  const [loadingProductos, setLoadingProductos] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!isOpen || !compra) return;

    setProveedorId(compra.proveedorId);
    setProductoId(compra.productoId);
    setCantidad(String(compra.cantidad));
    setPrecioCompra(String(compra.precioCompra));
    setDocReferencia(compra.docReferencia ?? "");
    setFechaVencimiento(
      compra.fechaVencimiento
        ? new Date(compra.fechaVencimiento).toISOString().split("T")[0]
        : "",
    );
    setErrors({});

    if (compra.sucursalId) {
      setLoadingProductos(true);
      axios
        .get<ProductoSucursal[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${compra.sucursalId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        .then((r) => setProductos(r.data ?? []))
        .catch(() => showToast("Error al cargar productos", "error"))
        .finally(() => setLoadingProductos(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, compra?.compraProveedorId]);

  const validar = () => {
    const e: Record<string, boolean> = {};
    if (!proveedorId) e.proveedorId = true;
    if (!productoId) e.productoId = true;
    if (!cantidad || Number(cantidad) <= 0) e.cantidad = true;
    if (precioCompra === "" || Number(precioCompra) < 0) e.precioCompra = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compra || !validar()) return;

    setGuardando(true);
    try {
      const res = await axios.put<CompraProveedor>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Proveedor/compra/${compra.compraProveedorId}`,
        {
          proveedorId,
          productoId,
          cantidad: Number(cantidad),
          precioCompra: Number(precioCompra),
          docReferencia: docReferencia.trim() || null,
          fechaVencimiento: fechaVencimiento || null,
          idUsuario: user?.id ? Number(user.id) : undefined,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Compra actualizada correctamente", "success");
      onGuardado(res.data);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data
          ?.mensaje ?? "Error al editar la compra";
      showToast(msg, "error");
    } finally {
      setGuardando(false);
    }
  };

  const subtotal =
    cantidad && precioCompra
      ? (Number(cantidad) * Number(precioCompra)).toFixed(2)
      : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar orden de compra">
      <form className="space-y-3" onSubmit={handleSubmit}>
        {/* Proveedor */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
            Proveedor <span className="text-rose-500">*</span>
          </label>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(Number(e.target.value))}
            disabled={guardando}
            className={`w-full h-8 px-2.5 text-sm bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60 ${
              errors.proveedorId ? "border-rose-400" : "border-gray-200"
            }`}
          >
            <option value={0}>Seleccione un proveedor</option>
            {proveedores.map((p) => (
              <option key={p.proveedorId} value={p.proveedorId}>
                {p.razonSocial}
              </option>
            ))}
          </select>
          {errors.proveedorId && (
            <p className="text-xs text-rose-500">Seleccione un proveedor</p>
          )}
        </div>

        {/* Producto */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
            Producto <span className="text-rose-500">*</span>
          </label>
          <select
            value={productoId}
            onChange={(e) => setProductoId(Number(e.target.value))}
            disabled={guardando || loadingProductos}
            className={`w-full h-8 px-2.5 text-sm bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60 ${
              errors.productoId ? "border-rose-400" : "border-gray-200"
            }`}
          >
            <option value={0}>
              {loadingProductos ? "Cargando..." : "Seleccione un producto"}
            </option>
            {productos.map((p) => (
              <option key={p.productoId} value={p.productoId}>
                {p.nomProducto}
              </option>
            ))}
          </select>
          {errors.productoId && (
            <p className="text-xs text-rose-500">Seleccione un producto</p>
          )}
        </div>

        {/* Cantidad + Precio */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
              Cantidad <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              disabled={guardando}
              className={`w-full h-8 px-2.5 text-sm bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60 ${
                errors.cantidad ? "border-rose-400" : "border-gray-200"
              }`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
              Precio compra <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                S/
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                disabled={guardando}
                className={`w-full h-8 pl-7 pr-2.5 text-sm bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60 ${
                  errors.precioCompra ? "border-rose-400" : "border-gray-200"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Doc. Referencia + Fecha Vencimiento */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase">
              Doc. Referencia{" "}
              <span className="normal-case font-normal text-gray-400">(opc.)</span>
            </label>
            <input
              type="text"
              value={docReferencia}
              onChange={(e) => setDocReferencia(e.target.value)}
              disabled={guardando}
              placeholder="N° de factura/guía"
              className="w-full h-8 px-2.5 text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase">
              Vencimiento{" "}
              <span className="normal-case font-normal text-gray-400">(opc.)</span>
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              disabled={guardando}
              className="w-full h-8 px-2.5 text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60"
            />
          </div>
        </div>

        {subtotal && (
          <p className="text-right text-sm text-gray-500">
            Subtotal:{" "}
            <span className="font-bold text-emerald-700">S/ {subtotal}</span>
          </p>
        )}

        <div className="pt-1 flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
