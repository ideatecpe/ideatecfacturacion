"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  PackagePlus,
  Loader2,
  Sparkles,
  Barcode,
  Tag,
  DollarSign,
  Boxes,
  Check,
} from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { ProductoSucursal, NuevoProducto, Categoria } from "@/app/factufly/productos/gestioProductos/Producto";
import { generarCodigoProducto } from "@/app/factufly/productos/gestioProductos/generarCodigoProducto";

interface ModalCrearProductoRapidoProps {
  isOpen: boolean;
  onClose: () => void;
  codigoBarrasInicial?: string;
  nombreInicial?: string;
  categorias: Categoria[];
  totalProductos: number;
  sucursalId: number;
  onProductoCreado: (producto: ProductoSucursal) => void;
}

function incrementarCodigo(codigo: string): string {
  const m = codigo.match(/^(.*?)(\d+)$/);
  if (!m) return `${codigo}-1`;
  const [, base, num] = m;
  const siguiente = String(Number(num) + 1).padStart(num.length, "0");
  return base + siguiente;
}

export default function ModalCrearProductoRapido({
  isOpen,
  onClose,
  codigoBarrasInicial = "",
  nombreInicial = "",
  categorias,
  totalProductos,
  sucursalId,
  onProductoCreado,
}: ModalCrearProductoRapidoProps) {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [nomProducto, setNomProducto] = useState<string>("");
  const [codigoBarras, setCodigoBarras] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<string>("");
  const [precioCompra, setPrecioCompra] = useState<string>("");
  const [stock, setStock] = useState<string>("10");
  const [unidadMedida, setUnidadMedida] = useState<string>("NIU");
  const [guardando, setGuardando] = useState<boolean>(false);

  const nombreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Si el texto inicial parece ser código de barras (números o formato barcode)
      const esCodigo = /^\d{4,}$/.test(codigoBarrasInicial.trim());
      setCodigoBarras(codigoBarrasInicial.trim());
      setNomProducto(esCodigo ? "" : nombreInicial || (!/^\d{4,}$/.test(codigoBarrasInicial) ? codigoBarrasInicial : ""));
      setPrecioVenta("");
      setPrecioCompra("");
      setStock("10");
      setUnidadMedida("NIU");
      setGuardando(false);

      if (categorias.length > 0) {
        setCategoriaId(categorias[0].categoriaId);
      } else {
        setCategoriaId(0);
      }

      setTimeout(() => {
        nombreInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, codigoBarrasInicial, nombreInicial, categorias]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nombreLimpio = nomProducto.trim();
    if (!nombreLimpio) {
      showToast("Ingresa el nombre del producto", "info");
      nombreInputRef.current?.focus();
      return;
    }

    const numPrecioVenta = parseFloat(precioVenta);
    if (isNaN(numPrecioVenta) || numPrecioVenta < 0) {
      showToast("Ingresa un precio de venta válido", "info");
      return;
    }

    const numStock = parseFloat(stock);
    if (isNaN(numStock) || numStock <= 0) {
      showToast("Ingresa una cantidad de stock inicial mayor a 0", "info");
      return;
    }

    const numPrecioCompra = precioCompra ? parseFloat(precioCompra) : null;
    if (precioCompra && (isNaN(numPrecioCompra!) || numPrecioCompra! < 0)) {
      showToast("El precio de compra debe ser un número válido", "info");
      return;
    }

    setGuardando(true);

    const baseCodigo = generarCodigoProducto(nombreLimpio, totalProductos) || "PROD-001";
    let codigoActual = baseCodigo;
    const MAX_REINTENTOS = 25;

    try {
      for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
        const payload: NuevoProducto = {
          codigo: codigoActual,
          tipoProducto: "BIEN",
          nomProducto: nombreLimpio,
          unidadMedida,
          tipoAfectacionIGV: "10",
          incluirIGV: true,
          categoriaId: categoriaId || (categorias[0]?.categoriaId ?? 0),
          sucursalId,
          precioUnitario: numPrecioVenta,
          stock: numStock,
          costoUnitario: numPrecioCompra,
          codigoBarras: codigoBarras.trim() || null,
          alertaStockBajoActiva: true,
          alertaVencimientoActiva: false,
          usuarioId: user?.id ? parseInt(user.id) : null,
        };

        try {
          const res = await axios.post<ProductoSucursal>(
            `${process.env.NEXT_PUBLIC_API_URL}/api/productos`,
            payload,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );

          const productoFinal: ProductoSucursal = {
            ...res.data,
            categoria:
              categorias.find((c) => c.categoriaId === (categoriaId || (categorias[0]?.categoriaId ?? 0))) ??
              res.data?.categoria ??
              null,
            sucursalProducto: {
              ...(res.data?.sucursalProducto || {}),
              sucursalProductoId: res.data?.sucursalProducto?.sucursalProductoId ?? res.data?.productoId,
              nomSucursal: res.data?.sucursalProducto?.nomSucursal ?? null,
              precioUnitario: numPrecioVenta,
              stock: numStock,
              ultimoPrecioCompra: numPrecioCompra,
            },
          };

          showToast(
            `✓ Producto "${productoFinal.nomProducto}" creado y agregado a la venta`,
            "success",
          );
          onProductoCreado(productoFinal);
          onClose();
          return;
        } catch (err) {
          if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const mensaje = String(err.response?.data?.mensaje ?? "");

            const esConflictoBarcode = status === 409 && /c[oó]digo\s*de\s*barras/i.test(mensaje);
            if (esConflictoBarcode) {
              showToast(err.response?.data?.mensaje || "El código de barras ya pertenece a otro producto", "error");
              return;
            }

            const esConflictoCodigo = status === 409 && /c[oó]digo/i.test(mensaje);
            if (esConflictoCodigo && intento < MAX_REINTENTOS - 1) {
              codigoActual = incrementarCodigo(codigoActual);
              continue;
            }

            showToast(err.response?.data?.mensaje || "Error al crear el producto", "error");
            return;
          }
          throw err;
        }
      }
    } catch (err) {
      showToast("Error de conexión al registrar producto", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Producto Rápido"
      className="max-w-lg"
      elevated
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner de ayuda */}
        <div className="flex items-center gap-2.5 p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-brand-blue">
          <PackagePlus className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Registro exprés para venta inmediata</p>
            <p className="text-blue-600/90 text-[11px]">
              Ingresa los datos esenciales. Podrás editar fotos y detalles más tarde en el catálogo.
            </p>
          </div>
        </div>

        {/* Campo: Nombre del Producto */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-gray-700">
            Nombre del Producto <span className="text-rose-500">*</span>
          </label>
          <input
            ref={nombreInputRef}
            type="text"
            required
            value={nomProducto}
            onChange={(e) => setNomProducto(e.target.value)}
            placeholder="Ej: Chocolate Sublime Blanco 30g"
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
          />
        </div>

        {/* Fila: Código de Barras y Categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Código de Barras
            </label>
            <div className="relative">
              <Barcode className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Ej: 7702006298940"
                className="w-full h-10 pl-9 pr-3 bg-white border border-gray-200 rounded-xl text-xs font-mono font-medium text-gray-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Categoría
            </label>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
                className="w-full h-10 pl-8 pr-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all cursor-pointer"
              >
                {categorias.map((c) => (
                  <option key={c.categoriaId} value={c.categoriaId}>
                    {c.categoriaNombre}
                  </option>
                ))}
                {categorias.length === 0 && (
                  <option value={0}>General / Sin categoría</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Fila: Precios y Unidad */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Precio Venta (S/) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="text-xs font-bold text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                S/
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                placeholder="0.00"
                className="w-full h-10 pl-8 pr-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-brand-blue outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Precio Compra (S/)
            </label>
            <div className="relative">
              <span className="text-xs font-bold text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                S/
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                placeholder="0.00"
                className="w-full h-10 pl-8 pr-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Unidad
            </label>
            <select
              value={unidadMedida}
              onChange={(e) => setUnidadMedida(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all cursor-pointer"
            >
              <option value="NIU">Unidad (NIU)</option>
              <option value="KGM">Kilogramo (KGM)</option>
              <option value="LTR">Litro (LTR)</option>
              <option value="BX">Caja (BX)</option>
            </select>
          </div>
        </div>

        {/* Fila: Stock Inicial */}
        <div className="space-y-1.5 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-gray-500" /> Stock Inicial <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-gray-400">
              Unidades físicas disponibles ahora
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              min="0.001"
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              placeholder="Ej: 10"
              className="w-28 h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 outline-none focus:border-brand-blue text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {[1, 5, 10, 20, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setStock(String(num))}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all ${
                    stock === String(num)
                      ? "bg-brand-blue text-white border-brand-blue shadow-2xs"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

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
                Registrando...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Registrar y Vender
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
