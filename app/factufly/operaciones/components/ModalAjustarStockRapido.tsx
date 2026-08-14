"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Package, Plus, Loader2, Sparkles, AlertCircle, ShoppingCart } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { ProductoSucursal, EditProducto } from "@/app/factufly/productos/gestioProductos/Producto";
import { abreviaturaUnidad } from "@/app/factufly/productos/gestioProductos/unidadMedida";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";

interface ModalAjustarStockRapidoProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoSucursal | null;
  onStockGuardado: (productoActualizado: ProductoSucursal, autoAgregar: boolean) => void;
}

export default function ModalAjustarStockRapido({
  isOpen,
  onClose,
  producto,
  onStockGuardado,
}: ModalAjustarStockRapidoProps) {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [stockInput, setStockInput] = useState<string>("1");
  const [autoAgregar, setAutoAgregar] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const stockInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && producto) {
      setStockInput("1");
      setAutoAgregar(true);
      setGuardando(false);
      setImgError(false);

      setTimeout(() => {
        stockInputRef.current?.focus();
        stockInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, producto]);

  if (!producto) return null;

  const unidad = abreviaturaUnidad(producto.unidadMedida);
  const ultimoCosto = producto.sucursalProducto.ultimoPrecioCompra;

  const handleGuardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!producto) return;

    const numStock = parseFloat(stockInput);
    if (isNaN(numStock) || numStock <= 0) {
      showToast("Ingresa una cantidad de stock válida mayor a 0", "info");
      stockInputRef.current?.focus();
      return;
    }

    setGuardando(true);
    try {
      const payload: EditProducto = {
        productoId: producto.productoId,
        codigo: producto.codigo,
        tipoProducto: producto.tipoProducto ?? "BIEN",
        nomProducto: producto.nomProducto,
        unidadMedida: producto.unidadMedida,
        tipoAfectacionIGV: producto.tipoAfectacionIGV,
        incluirIGV: producto.incluirIGV,
        categoriaId: producto.categoria?.categoriaId ?? 0,
        sucursalProductoId: producto.sucursalProducto.sucursalProductoId,
        precioUnitario: producto.sucursalProducto.precioUnitario ?? 0,
        urlImagenProducto: producto.urlImagenProducto ?? null,
        stock: numStock,
        costoUnitario: ultimoCosto ?? null,
        alertaVencimientoActiva: producto.sucursalProducto.alertaVencimientoActiva ?? true,
        alertaStockBajoActiva: producto.sucursalProducto.alertaStockBajoActiva ?? true,
        stockMinimoAlerta: producto.sucursalProducto.stockMinimoAlerta ?? null,
        codigoBarras: producto.codigoBarras || null,
        codigoSunat: producto.codigoSunat || undefined,
        esPaquete: producto.esPaquete ?? false,
        productoBaseId: producto.productoBaseId ?? null,
        factorConversion: producto.factorConversion ?? null,
        precioMayorista: producto.sucursalProducto.precioMayorista ?? null,
        cantidadMinimaMayorista: producto.sucursalProducto.cantidadMinimaMayorista ?? null,
        enPromocion: producto.sucursalProducto.enPromocion ?? false,
        porcentajeDescuento: producto.sucursalProducto.porcentajeDescuento ?? null,
        ubicacionTienda: producto.sucursalProducto.ubicacionTienda ?? null,
        usuarioId: user?.id ? parseInt(user.id) : null,
      };

      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${producto.productoId}`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const productoActualizado: ProductoSucursal = {
        ...producto,
        sucursalProducto: {
          ...producto.sucursalProducto,
          stock: numStock,
          ultimoPrecioCompra: ultimoCosto,
        },
      };

      showToast(
        `✓ Stock de "${producto.nomProducto}" actualizado a ${numStock} ${unidad}`,
        "success",
      );

      onStockGuardado(productoActualizado, autoAgregar);
      onClose();
    } catch (err) {
      const data = (err as { response?: { data?: { mensaje?: string; message?: string } } })?.response?.data;
      showToast(data?.mensaje ?? data?.message ?? "Error al actualizar stock del producto", "error");
    } finally {
      setGuardando(false);
    }
  };

  const aplicarIncremento = (cant: number) => {
    const actual = parseFloat(stockInput) || 0;
    setStockInput(String(actual + cant));
  };

  const setValorFijo = (val: number) => {
    setStockInput(String(val));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajuste Rápido de Stock"
      className="max-w-md"
      elevated
    >
      <form onSubmit={handleGuardar} className="space-y-4">
        {/* Banner informativo de producto sin stock */}
        <div className="flex items-center gap-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Producto sin stock disponible</p>
            <p className="text-amber-700 text-[11px]">
              Ingresa el stock físico real que tienes para venderlo de inmediato.
            </p>
          </div>
        </div>

        {/* Tarjeta con detalle del producto */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
          <div className="w-14 h-14 bg-white rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
            {producto.urlImagenProducto && !imgError ? (
              <img
                src={conVarianteImagen(producto.urlImagenProducto, "thumbnail")}
                alt={producto.nomProducto}
                className="w-full h-full object-contain p-1"
                onError={() => setImgError(true)}
              />
            ) : (
              <Package className="w-6 h-6 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900 truncate">
              {producto.nomProducto}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
              <span className="font-medium text-gray-700">
                {producto.codigo}
              </span>
              {producto.codigoBarras && (
                <span className="font-mono text-[10px] bg-gray-200/70 px-1 rounded">
                  🏷️ {producto.codigoBarras}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="font-bold text-brand-blue">
                Precio: S/ {(producto.sucursalProducto.precioUnitario ?? 0).toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200">
                Stock actual: 0 {unidad}
              </span>
            </div>
          </div>
        </div>

        {/* Input de Nuevo Stock */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700">
            Nuevo Stock disponible ({unidad}) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              ref={stockInputRef}
              type="text"
              inputMode="decimal"
              required
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value.replace(/[^0-9.]/g, ""))}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              placeholder="Ej: 10"
              className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-base font-bold text-gray-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none select-none">
              {unidad}
            </span>
          </div>

          {/* Botones de sugerencias rápidas */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-medium text-gray-400 mr-1">Fijar:</span>
            {[1, 2, 5, 10, 20, 50].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setValorFijo(num)}
                className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all ${
                  stockInput === String(num)
                    ? "bg-brand-blue text-white border-brand-blue shadow-2xs"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                }`}
              >
                {num} {unidad}
              </button>
            ))}
            <button
              type="button"
              onClick={() => aplicarIncremento(1)}
              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-0.5 ml-auto"
            >
              <Plus size={11} /> 1
            </button>
          </div>
        </div>

        {/* Checkbox Auto-agregar a venta */}
        <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none">
          <input
            type="checkbox"
            checked={autoAgregar}
            onChange={(e) => setAutoAgregar(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
          />
          <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <ShoppingCart size={13} className="text-brand-blue" />
            Agregar a la venta automáticamente al guardar
          </span>
        </label>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={guardando}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={guardando}
            className="bg-brand-blue hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            {guardando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Guardar y Vender
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
