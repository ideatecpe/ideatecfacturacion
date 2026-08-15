"use client";
import React from "react";
import dynamic from "next/dynamic";
const Barcode = dynamic(() => import("react-barcode"), { ssr: false });
import { Edit2, Trash2, Tag, Printer, MapPin, AlertTriangle, CalendarClock } from "lucide-react";

import { Card } from "@/app/components/ui/Card";
import { cn } from "@/app/utils/cn";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";
import { formatoBarcodeSeguro } from "../gestioProductos/barcodeFormato";
import { ProductoSucursal } from "../gestioProductos/Producto";
import { abreviaturaUnidad, formatearCantidadUnidad } from "../gestioProductos/unidadMedida";

// Umbral de alerta de vencimiento (días) por defecto, si la empresa no configuró el suyo.
const DIAS_ALERTA_VENCIMIENTO_DEFAULT = 30;

function formatearFechaLocal(fechaISO: string): string {
  try {
    const soloFecha = fechaISO.slice(0, 10);
    const [year, month, day] = soloFecha.split("-").map(Number);
    if (!year || !month || !day) return fechaISO;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  } catch {
    return fechaISO;
  }
}

function estaProximoAVencer(fechaISO: string, diasAlerta: number): boolean {
  try {
    const soloFecha = fechaISO.slice(0, 10);
    const [y, m, d] = soloFecha.split("-").map(Number);
    const fechaLote = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diffDias = (fechaLote.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
    return diffDias <= diasAlerta;
  } catch {
    return false;
  }
}

interface ProductoCardProps {
  prod: ProductoSucursal;
  isSuperAdmin: boolean;
  soloLectura: boolean;
  isStock?: boolean;
  modoSeleccionPromo: boolean;
  seleccionado: boolean;
  toggleSeleccionPromo: (productoId: number) => void;
  handleOpenEdit: (prod: ProductoSucursal) => void;
  handleOpenDelete: (prod: ProductoSucursal) => void;
  abrirModalImprimir: (lista: ProductoSucursal[]) => void;
  productoBase?: ProductoSucursal;
  getEstadoStock: (p: ProductoSucursal) => "agotado" | "bajo" | "normal";
  imgError: boolean;
  onImgError: () => void;
  /** true cuando el filtro "Vence antes de" está aplicado — fuerza mostrar el badge aunque falten más de 30 días. */
  filtroVencimientoActivo?: boolean;
  /** Días de anticipación configurados por la empresa (Configuración). Si no viene, usa el default. */
  diasAlertaVencimiento?: number | null;
}

export default function ProductoCard({
  prod,
  isSuperAdmin,
  soloLectura,
  isStock,
  modoSeleccionPromo,
  seleccionado,
  toggleSeleccionPromo,
  handleOpenEdit,
  handleOpenDelete,
  abrirModalImprimir,
  productoBase,
  getEstadoStock,
  imgError,
  onImgError,
  filtroVencimientoActivo,
  diasAlertaVencimiento,
}: ProductoCardProps) {
  // Intenta primero la variante liviana "thumbnail"; si no existe todavía en
  // Cloudflare (404), cae a la imagen original antes de rendirse a "sin imagen".
  const [intento, setIntento] = React.useState<"thumbnail" | "original">("thumbnail");

  React.useEffect(() => {
    setIntento("thumbnail");
  }, [prod.urlImagenProducto]);

  return (
    <Card
      className={`group hover:border-brand-blue transition-all ${modoSeleccionPromo && prod.tipoProducto === "BIEN" ? "cursor-pointer" : ""}`}
      onClick={modoSeleccionPromo && prod.tipoProducto === "BIEN" ? () => toggleSeleccionPromo(prod.productoId) : undefined}
    >
      {/* ── Imagen ── */}
      {prod.urlImagenProducto && !imgError ? (
        <div className="-mx-2 -mt-2 mb-1.5 h-24 bg-white overflow-hidden rounded-t-xl">
          <img
            src={
              intento === "thumbnail"
                ? conVarianteImagen(prod.urlImagenProducto, "thumbnail")
                : prod.urlImagenProducto
            }
            alt={prod.nomProducto}
            loading="lazy"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            onError={() => {
              if (intento === "thumbnail") setIntento("original");
              else onImgError();
            }}
          />
        </div>
      ) : (
        <div className="-mx-2 -mt-2 mb-1.5 h-24 bg-gray-100 rounded-t-xl flex items-center justify-center">
          <span className="text-gray-300 font-bold text-xs tracking-wide select-none">Sin imagen</span>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {prod.codigo}
          </p>
          <h4 className="text-[13px] font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-1">
            {prod.nomProducto}
          </h4>
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-[9px] font-medium text-gray-400 bg-gray-100 w-fit px-1.5 py-0.5 rounded uppercase">
              {prod.categoria?.categoriaNombre}
            </p>
            {isSuperAdmin && (
              <p className="text-[9px] text-gray-400 bg-blue-50 w-fit px-1.5 py-0.5 rounded">
                {prod.sucursalProducto.nomSucursal}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-0.5 shrink-0">
          {modoSeleccionPromo ? (
            prod.tipoProducto === "BIEN" && (
              <input
                type="checkbox"
                checked={seleccionado}
                onChange={() => toggleSeleccionPromo(prod.productoId)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 accent-rose-600"
              />
            )
          ) : (
            !soloLectura && (
              <>
                <button
                  onClick={() => handleOpenEdit(prod)}
                  title="Editar producto"
                  aria-label={`Editar ${prod.nomProducto}`}
                  className="p-1 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleOpenDelete(prod)}
                  title="Eliminar producto"
                  aria-label={`Eliminar ${prod.nomProducto}`}
                  className="p-1 text-gray-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )
          )}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between items-end">
        <div>
          {isStock && prod.tipoProducto === "BIEN" && (
            <>
              {prod.esPaquete && prod.factorConversion ? (
                (() => {
                  const stockBase = productoBase?.sucursalProducto.stock ?? null;
                  const factor = prod.factorConversion!;
                  const cajas = stockBase != null ? Math.floor(stockBase / factor) : null;
                  const sueltas = stockBase != null ? stockBase % factor : null;
                  const estado = getEstadoStock(prod);
                  const labelPrincipal = (() => {
                    if (cajas == null) return "STOCK: —";
                    if (cajas > 0) return `STOCK: ${cajas} caja${cajas > 1 ? "s" : ""}`;
                    if (sueltas! > 0) return `STOCK: 0 cajas`;
                    return "STOCK: 0";
                  })();
                  const labelDetalle = (() => {
                    if (cajas == null || !productoBase) return null;
                    const partes = [];
                    if (cajas > 0) partes.push(`${cajas} caj. (${factor} und. c/u)`);
                    if (sueltas! > 0) partes.push(`${sueltas} und. sueltas`);
                    return partes.length ? partes.join(" + ") : null;
                  })();
                  return (
                    <div className="mb-0.5">
                      <p
                        className={cn(
                          "text-[13px] font-bold leading-tight",
                          estado === "agotado"
                            ? "text-slate-400"
                            : estado === "bajo"
                              ? "text-amber-600"
                              : "text-gray-900",
                        )}
                      >
                        {labelPrincipal}
                      </p>
                      {labelDetalle && (
                        <p className="text-[9px] font-normal text-gray-400 leading-tight">
                          {labelDetalle}
                        </p>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p
                  className={cn(
                    "text-[13px] font-bold",
                    getEstadoStock(prod) === "agotado"
                      ? "text-slate-400"
                      : getEstadoStock(prod) === "bajo"
                        ? "text-amber-600"
                        : "text-gray-900",
                  )}
                >
                  STOCK: {formatearCantidadUnidad(prod.sucursalProducto.stock ?? 0, prod.unidadMedida)}{" "}
                  {abreviaturaUnidad(prod.unidadMedida)}
                </p>
              )}
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-400 uppercase font-bold leading-tight">
            {prod.tipoAfectacionIGV === "10"
              ? prod.incluirIGV
                ? "Gravado (Inc. IGV)"
                : "Gravado (Sin. IGV)"
              : prod.tipoAfectacionIGV === "20"
                ? "Exonerado"
                : "Inafecto"}
          </p>
          {isStock && prod.sucursalProducto.enPromocion && prod.sucursalProducto.porcentajeDescuento ? (
            <>
              <div className="flex items-center justify-end gap-1">
                <Tag className="w-3 h-3 text-orange-500" />
                <span className="text-[9px] font-bold text-orange-500 uppercase">
                  -{prod.sucursalProducto.porcentajeDescuento}%
                </span>
              </div>
              <p className="text-[10px] text-gray-400 line-through leading-tight">
                S/ {prod.sucursalProducto.precioUnitario.toFixed(2)}
              </p>
              <p className="text-[13px] font-black text-orange-500 leading-tight">
                S/{" "}
                {(
                  prod.sucursalProducto.precioUnitario *
                  (1 - prod.sucursalProducto.porcentajeDescuento / 100)
                ).toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-[13px] font-black text-brand-blue leading-tight">
              S/ {prod.sucursalProducto.precioUnitario.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* ── Ubicación en tienda (solo informativo) ── */}
      {isStock && prod.sucursalProducto.ubicacionTienda && (
        <div className="mt-1 flex flex-col gap-0.5">
          <span className="flex items-center gap-1 text-[9px] font-medium text-gray-400">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {prod.sucursalProducto.ubicacionTienda}
          </span>
        </div>
      )}

      {/* ── Vencimiento: advertencia (<N días) vs. dato informativo (solo por el filtro "Vence antes de") ── */}
      {isStock && prod.sucursalProducto.proximoVencimiento && (() => {
        const fecha = prod.sucursalProducto.proximoVencimiento;
        // Este producto puede tener la alerta de vencimiento desactivada; en ese caso
        // solo se muestra el dato neutral cuando el usuario lo pidió con el filtro.
        const alertaActiva = prod.sucursalProducto.alertaVencimientoActiva !== false;
        const esUrgente =
          alertaActiva &&
          estaProximoAVencer(fecha, diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFAULT);

        if (!esUrgente && !filtroVencimientoActivo) return null;

        const fechaFormateada = formatearFechaLocal(fecha);

        // Menos de 30 días: advertencia real, sin importar el filtro.
        if (esUrgente) {
          return (
            <div className="mt-1 flex items-center gap-1 w-fit text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              Hay stock por vencer: {fechaFormateada}
            </div>
          );
        }

        // Solo aparece por el filtro (falta más de 30 días): dato neutral, no es una alerta.
        return (
          <div className="mt-1 flex items-center gap-1 w-fit text-[9px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
            <CalendarClock className="w-2.5 h-2.5 shrink-0" />
            Vencimiento más próximo: {fechaFormateada}
          </div>
        );
      })()}

      {/* ── Código de barras — pie de tarjeta ── */}
      {prod.codigoBarras && (
        <div className="mt-1.5 -mx-2 -mb-2 border-t border-dashed border-gray-200 bg-gray-50 rounded-b-xl flex flex-col items-center py-1 px-2 relative">
          <Barcode
            value={prod.codigoBarras}
            format={formatoBarcodeSeguro(prod.codigoBarras)}
            width={1.2}
            height={26}
            fontSize={8}
            margin={0}
            displayValue={true}
            background="transparent"
            lineColor="#334155"
          />
          <button
            onClick={() => abrirModalImprimir([prod])}
            title="Imprimir etiqueta"
            aria-label={`Imprimir etiqueta de ${prod.nomProducto}`}
            className="absolute right-1 top-1 p-1 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Printer className="w-3 h-3" />
          </button>
        </div>
      )}
    </Card>
  );
}
