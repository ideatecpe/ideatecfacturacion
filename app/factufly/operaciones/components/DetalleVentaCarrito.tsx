"use client";

import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  ClipboardList,
  Car,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { ProductoSucursal } from "../../productos/gestioProductos/Producto";
import ImagenProductoCuadrada from "./ImagenProductoCuadrada";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";

export interface DetalleVentaItem {
  _id?: string;
  productoId?: number | null;
  codigo?: string | null;
  descripcion?: string;
  cantidad?: number;
  unidadMedida?: string;
  tipoAfectacionIGV?: string;
  porcentajeIGV?: number;
  descuentoUnitario?: number;
  precioVenta?: number;
  baseIgv?: number;
  totalVentaItem?: number;
  _esIcbper?: boolean;
  _tipoProducto?: string | null;
  _stockDisponible?: number | null;
  _precioVentaConIGV?: number;
  _urlImagen?: string | null;
}

interface ConfiguracionVenta {
  isConsumo?: boolean;
  itemsDefecto?: boolean;
  afectacionIgv?: boolean;
  descUnitario?: boolean;
  isStock?: boolean;
}

interface DetalleVentaCarritoProps<T extends DetalleVentaItem> {
  detalles: T[];
  setDetalles: React.Dispatch<React.SetStateAction<T[]>>;
  busquedaProducto: string[];
  setBusquedaProducto: React.Dispatch<React.SetStateAction<string[]>>;
  showDropdownProducto: boolean[];
  setShowDropdownProducto: React.Dispatch<React.SetStateAction<boolean[]>>;
  inputRefs: React.MutableRefObject<(HTMLInputElement | HTMLTextAreaElement | null)[]>;
  focusedItemIndex: number | null;
  setFocusedItemIndex: (i: number | null) => void;
  focusedItemIndexRef: React.MutableRefObject<number | null>;
  precioInputValues: Record<number, string>;
  setPrecioInputValues: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  productosSucursal: ProductoSucursal[];
  seleccionarProducto: (producto: ProductoSucursal, index: number) => void;
  actualizarCantidad: (i: number, cantidad: number) => void;
  actualizarTipoAfectacion: (i: number, tipo: string) => void;
  actualizarPrecioVenta: (i: number, precio: number) => void;
  actualizarPorcentajeIGV: (i: number, pct: number) => void;
  actualizarDescuento: (i: number, desc: number) => void;
  eliminarFila: (i: number) => void;
  agregarFila: () => void;
  getStockEfectivo: (p: ProductoSucursal) => number | null;
  fmtMonto: (n: number) => string;
  simbolo: string;
  IGV_DEFAULT: number;
  config: ConfiguracionVenta | null | undefined;
  loadingConfig: boolean;
  porConsumo: boolean;
  setPorConsumo: (v: boolean) => void;
  sinSucursal: boolean;
  setShowModalMonitoreo: (v: boolean) => void;
  setPendingScanProducto: (p: ProductoSucursal | null) => void;
  showToast: (msg: string, tipo: "success" | "info" | "error") => void;
  /** Opciones extra de afectación IGV (ej. factura agrega 11/21/31 "gratuito"). */
  tipoAfectacionExtra?: { value: string; label: string }[];
  /** Valores de tipoAfectacionIGV que habilitan el select de %IGV (default: ["10"]). */
  igvAfectacionValues?: string[];
  /** Determina si un ítem es "gratuito" (precio/descuento bloqueados, subtotal en 0). */
  esGratuito?: (d: T) => boolean;
  /** Aviso informativo mostrado debajo del listado (ej. nota de ítems gratuitos en factura). */
  avisoExtra?: React.ReactNode;
}

export default function DetalleVentaCarrito<T extends DetalleVentaItem>({
  detalles,
  setDetalles,
  busquedaProducto,
  setBusquedaProducto,
  showDropdownProducto,
  setShowDropdownProducto,
  inputRefs,
  focusedItemIndex,
  setFocusedItemIndex,
  focusedItemIndexRef,
  precioInputValues,
  setPrecioInputValues,
  productosSucursal,
  seleccionarProducto,
  actualizarCantidad,
  actualizarTipoAfectacion,
  actualizarPrecioVenta,
  actualizarPorcentajeIGV,
  actualizarDescuento,
  eliminarFila,
  agregarFila,
  getStockEfectivo,
  fmtMonto,
  simbolo,
  IGV_DEFAULT,
  config,
  loadingConfig,
  porConsumo,
  setPorConsumo,
  sinSucursal,
  setShowModalMonitoreo,
  setPendingScanProducto,
  showToast,
  tipoAfectacionExtra = [],
  igvAfectacionValues = ["10"],
  esGratuito = () => false,
  avisoExtra,
}: DetalleVentaCarritoProps<T>) {
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});
  const mostrarAvanzado = !!config?.afectacionIgv || !!config?.descUnitario;
  const originalItemAlFocoRef = useRef<Record<number, { productoId: number | null; descripcion: string }>>({});
  const ultimoInputTsRef = useRef(0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-brand-blue" />
          </div>
          <label className="text-xs font-semibold text-brand-blue">Detalle de Venta</label>
        </div>
        <div className="flex items-center gap-2">
          {loadingConfig && (
            <span className="text-[11px] text-gray-400 animate-pulse">
              Cargando configuración...
            </span>
          )}
          {config?.isConsumo && (
            <label
              className={`flex items-center gap-1.5 select-none ${sinSucursal || loadingConfig ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={porConsumo}
                onChange={(e) => {
                  if (sinSucursal || loadingConfig) return;
                  setPorConsumo(e.target.checked);
                }}
                disabled={sinSucursal || loadingConfig}
                className="w-3.5 h-3.5 accent-brand-blue"
              />
              <span className="text-xs text-gray-500">Por Consumo</span>
            </label>
          )}
          {!porConsumo && (
            <Button
              type="button"
              variant="ghost"
              className={`h-8 text-xs text-brand-blue ${sinSucursal || loadingConfig ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} `}
              disabled={sinSucursal || loadingConfig}
              onClick={agregarFila}
            >
              <Plus className="w-3 h-3 mr-1" /> Agregar ítem
            </Button>
          )}
          {!porConsumo && config?.itemsDefecto && (
            <button
              type="button"
              onClick={() => setShowModalMonitoreo(true)}
              disabled={sinSucursal || loadingConfig}
              className={`flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg ${sinSucursal || loadingConfig ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Car className="w-3.5 h-3.5" /> Ítems por defecto
            </button>
          )}
        </div>
      </div>

      {detalles.length === 0 ? (
        <div className="border border-gray-100 rounded-xl px-4 py-8 text-center text-xs text-gray-400">
          Sin ítems. Haz clic en "Agregar ítem" para comenzar.
        </div>
      ) : (
        <div className="space-y-2">
          {detalles.map((d, i) => {
            const esPorConsumo = d._id === "por-consumo";
            const gratuito = esGratuito(d);
            const bloqueado = !!d._esIcbper || esPorConsumo || loadingConfig;
            return (
              <div
                key={i}
                className={`border rounded-xl p-2 flex gap-2 ${
                  d._esIcbper
                    ? "border-amber-100 bg-amber-50/50"
                    : esPorConsumo
                      ? "border-gray-100 bg-gray-50/50"
                      : gratuito
                        ? "border-green-100 bg-green-50/30"
                        : "border-gray-100 bg-white hover:bg-gray-50/30"
                }`}
              >
                <ImagenProductoCuadrada
                  url={d._urlImagen}
                  alt={d.descripcion ?? "Producto"}
                  size="md"
                />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-400 pt-1.5 shrink-0">{i + 1}</span>

                    <div
                      className="flex-1 min-w-0"
                      style={{ position: "relative", overflow: "visible" }}
                    >
                      <textarea
                        data-escaner-producto="true"
                        ref={(el) => {
                          inputRefs.current[i] = el;
                        }}
                        value={busquedaProducto[i] ?? ""}
                        disabled={bloqueado}
                        onChange={(e) => {
                          const ahora = Date.now();
                          const gap = ahora - ultimoInputTsRef.current;
                          ultimoInputTsRef.current = ahora;

                          const valor = e.target.value;
                          const tieneSaltoDeLinea = valor.includes("\n");

                          if (tieneSaltoDeLinea) {
                            const ultimaLinea = valor.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
                            const candidato = ultimaLinea.length >= 6 ? ultimaLinea : "";
                            if (candidato) {
                              const coincidencia = productosSucursal.find(
                                (p: ProductoSucursal) => !!p.codigoBarras && p.codigoBarras === candidato,
                              );
                              if (coincidencia) {
                                if (config?.isStock && coincidencia.tipoProducto === "BIEN") {
                                  const se = getStockEfectivo(coincidencia);
                                  const uv = coincidencia.esPaquete && coincidencia.factorConversion
                                    ? Math.floor((se ?? 0) / coincidencia.factorConversion) : (se ?? 0);
                                  if (uv <= 0) {
                                    showToast(`${coincidencia.nomProducto} sin stock disponible`, "error");
                                    const orig = originalItemAlFocoRef.current[i];
                                    const nb = [...busquedaProducto]; nb[i] = orig?.descripcion ?? ""; setBusquedaProducto(nb);
                                    if (orig?.productoId != null) {
                                      setDetalles((prev) => { const n = [...prev]; if (n[i]) n[i] = { ...n[i], productoId: orig.productoId, descripcion: orig.descripcion } as T; return n; });
                                    }
                                    (e.target as HTMLTextAreaElement).blur();
                                    return;
                                  }
                                }
                                const productoIdOriginal = originalItemAlFocoRef.current[i]?.productoId ?? detalles[i]?.productoId ?? null;
                                if (productoIdOriginal === coincidencia.productoId) {
                                  actualizarCantidad(i, (detalles[i]?.cantidad ?? 1) + 1);
                                  const nb = [...busquedaProducto]; nb[i] = coincidencia.nomProducto; setBusquedaProducto(nb);
                                  const nd = [...showDropdownProducto]; nd[i] = false; setShowDropdownProducto(nd);
                                  showToast(`✓ ${coincidencia.nomProducto} ×${(detalles[i]?.cantidad ?? 1) + 1}`, "success");
                                  setTimeout(() => {
                                    setDetalles((prev) => { const n = [...prev]; if (n[i]) n[i] = { ...n[i], productoId: productoIdOriginal, descripcion: coincidencia.nomProducto } as T; return n; });
                                  }, 0);
                                } else if (productoIdOriginal || originalItemAlFocoRef.current[i]?.descripcion?.trim()) {
                                  const origDesc = originalItemAlFocoRef.current[i]?.descripcion ?? "";
                                  const nb = [...busquedaProducto]; nb[i] = origDesc; setBusquedaProducto(nb);
                                  setDetalles((prev) => { const n = [...prev]; if (n[i]) n[i] = { ...n[i], productoId: productoIdOriginal, descripcion: origDesc } as T; return n; });
                                  const idxExistente = detalles.findIndex((d2, idx) => idx !== i && !d2._esIcbper && d2.productoId === coincidencia.productoId);
                                  if (idxExistente !== -1) {
                                    actualizarCantidad(idxExistente, (detalles[idxExistente].cantidad ?? 1) + 1);
                                    showToast(`✓ ${coincidencia.nomProducto} ×${(detalles[idxExistente].cantidad ?? 1) + 1}`, "success");
                                  } else {
                                    setPendingScanProducto(coincidencia);
                                    agregarFila();
                                  }
                                } else {
                                  seleccionarProducto(coincidencia, i);
                                  showToast(`✓ ${coincidencia.nomProducto} agregado por código de barras`, "success");
                                }
                                (e.target as HTMLTextAreaElement).blur();
                                return;
                              }
                              showToast(`Código "${candidato}" no encontrado en el catálogo`, "error");
                              const orig = originalItemAlFocoRef.current[i];
                              if (orig?.productoId != null) {
                                const nb = [...busquedaProducto]; nb[i] = orig.descripcion; setBusquedaProducto(nb);
                                setDetalles((prev) => { const n = [...prev]; if (n[i]) n[i] = { ...n[i], productoId: orig.productoId, descripcion: orig.descripcion } as T; return n; });
                              } else if (orig?.descripcion?.trim()) {
                                const nb = [...busquedaProducto]; nb[i] = orig.descripcion; setBusquedaProducto(nb);
                                setDetalles((prev) => { const n = [...prev]; if (n[i]) n[i] = { ...n[i], descripcion: orig.descripcion, productoId: null } as T; return n; });
                              } else {
                                const nb = [...busquedaProducto]; nb[i] = ""; setBusquedaProducto(nb);
                              }
                              return;
                            }
                          }

                          const itemTeniaContenido = originalItemAlFocoRef.current[i]?.productoId != null ||
                            !!originalItemAlFocoRef.current[i]?.descripcion?.trim();
                          if (gap < 60 && itemTeniaContenido) return;

                          if (
                            detalles[i]?.productoId &&
                            valor.trim() === (detalles[i]?.descripcion ?? "").trim()
                          ) {
                            const nb = [...busquedaProducto];
                            nb[i] = detalles[i]?.descripcion ?? "";
                            setBusquedaProducto(nb);
                            return;
                          }
                          const nb = [...busquedaProducto];
                          nb[i] = valor;
                          setBusquedaProducto(nb);
                          const nd = [...showDropdownProducto];
                          nd[i] = true;
                          setShowDropdownProducto(nd);
                          const n = [...detalles];
                          n[i] = { ...n[i], descripcion: valor, productoId: null };
                          setDetalles(n as T[]);

                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onFocus={(e) => {
                          originalItemAlFocoRef.current[i] = {
                            productoId: detalles[i]?.productoId ?? null,
                            descripcion: detalles[i]?.descripcion ?? busquedaProducto[i] ?? "",
                          };
                          const nd = [...showDropdownProducto];
                          nd[i] = true;
                          setShowDropdownProducto(nd);
                          setFocusedItemIndex(i);
                          focusedItemIndexRef.current = i;

                          const target = e.target;
                          target.style.whiteSpace = "pre-wrap";
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                          target.style.whiteSpace = "";

                          setTimeout(() => {
                            if (target) {
                              target.style.height = "auto";
                              target.style.height = `${target.scrollHeight}px`;
                            }
                          }, 50);
                        }}
                        onBlur={(e) => {
                          delete originalItemAlFocoRef.current[i];
                          const target = e.target;
                          const blurredIndex = i;
                          target.style.height = "";
                          setTimeout(() => {
                            if (focusedItemIndexRef.current === blurredIndex) {
                              setFocusedItemIndex(null);
                              focusedItemIndexRef.current = null;
                            } else if (focusedItemIndexRef.current !== null) {
                              const el = inputRefs.current[focusedItemIndexRef.current] as HTMLTextAreaElement | null;
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }
                            const nd = [...showDropdownProducto];
                            nd[blurredIndex] = false;
                            setShowDropdownProducto(nd);
                          }, 200);
                          const txt = busquedaProducto[i] ?? "";
                          if (txt) {
                            setDetalles((prev) => {
                              // Si ya se seleccionó un producto (p.ej. por escaneo, cuyo
                              // .blur() dispara este handler antes de que el estado se
                              // actualice), no pisar esos datos con el texto en tránsito.
                              if (prev[i]?.productoId) return prev;
                              const n = [...prev];
                              n[i] = {
                                ...n[i],
                                descripcion: txt,
                                productoId: null,
                                codigo: null,
                              };
                              return n as T[];
                            });
                          }
                        }}
                        placeholder="Buscar o agregar producto..."
                        rows={1}
                        className={`w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-[border-color,box-shadow] duration-200 ${
                          focusedItemIndex === i
                            ? "overflow-y-hidden whitespace-pre-wrap"
                            : "h-7 overflow-hidden whitespace-nowrap text-ellipsis"
                        }`}
                      />
                      {showDropdownProducto[i] &&
                        !d._esIcbper &&
                        !esPorConsumo &&
                        (() => {
                          const rect = inputRefs.current[i]?.getBoundingClientRect();
                          const filtrados = productosSucursal.filter((p: ProductoSucursal) =>
                            !(busquedaProducto[i] ?? "")
                              ? true
                              : coincideBusqueda(busquedaProducto[i] ?? "", p.nomProducto, p.codigo) ||
                                (!!p.codigoBarras && p.codigoBarras === (busquedaProducto[i] ?? "")),
                          );
                          if (!filtrados.length) return null;
                          return (
                            <div
                              style={{
                                position: "fixed",
                                zIndex: 9999,
                                top: (rect?.bottom ?? 0) + window.scrollY + 4,
                                left: rect?.left ?? 0,
                                width: "300px",
                              }}
                              className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
                            >
                              {filtrados.map((p: ProductoSucursal) => {
                                const stockEfectivo = getStockEfectivo(p);
                                const unidadesVendibles =
                                  p.esPaquete && p.factorConversion
                                    ? Math.floor((stockEfectivo ?? 0) / p.factorConversion)
                                    : (stockEfectivo ?? 0);
                                const sinStock =
                                  !!config?.isStock && p.tipoProducto === "BIEN" && unidadesVendibles <= 0;
                                const stockMostrado = (() => {
                                  if (p.esPaquete && p.factorConversion && stockEfectivo != null) {
                                    const cajas = Math.floor(stockEfectivo / p.factorConversion);
                                    const sueltas = stockEfectivo % p.factorConversion;
                                    if (cajas > 0 && sueltas > 0) return `${cajas} caja${cajas > 1 ? "s" : ""} + ${sueltas} und.`;
                                    if (cajas > 0) return `${cajas} caja${cajas > 1 ? "s" : ""}`;
                                    return `${sueltas} und. (sin caja)`;
                                  }
                                  return `${stockEfectivo ?? 0} und.`;
                                })();
                                return (
                                  <button
                                    key={p.productoId}
                                    type="button"
                                    disabled={sinStock}
                                    onMouseDown={() => {
                                      if (sinStock) return;
                                      seleccionarProducto(p, i);
                                    }}
                                    className={
                                      "w-full text-left px-3 py-1.5 border-b border-gray-50 last:border-0 flex items-center gap-2" +
                                      (sinStock ? " opacity-50 cursor-not-allowed" : " hover:bg-gray-50")
                                    }
                                  >
                                    <ImagenProductoCuadrada url={p.urlImagenProducto} alt={p.nomProducto} size="sm" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-gray-800 flex items-center gap-1">
                                        {p.nomProducto}
                                        {!!config?.isStock &&
                                          !!p.sucursalProducto.enPromocion &&
                                          !!p.sucursalProducto.porcentajeDescuento && (
                                            <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1 rounded">
                                              -{p.sucursalProducto.porcentajeDescuento}%
                                            </span>
                                          )}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        {p.codigo} · S/{" "}
                                        {!!config?.isStock &&
                                        !!p.sucursalProducto.enPromocion &&
                                        !!p.sucursalProducto.porcentajeDescuento ? (
                                          <>
                                            <span className="line-through">
                                              {p.sucursalProducto.precioUnitario.toFixed(2)}
                                            </span>{" "}
                                            <span className="text-rose-500 font-semibold">
                                              {(
                                                p.sucursalProducto.precioUnitario *
                                                (1 - p.sucursalProducto.porcentajeDescuento / 100)
                                              ).toFixed(2)}
                                            </span>
                                          </>
                                        ) : (
                                          p.sucursalProducto.precioUnitario.toFixed(2)
                                        )}
                                        {!!config?.isStock && p.tipoProducto === "BIEN" && (
                                          <span className={unidadesVendibles <= 0 ? " text-red-500" : " text-green-600"}>
                                            {" "}
                                            · Stock: {stockMostrado}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                    </div>

                    <button
                      type="button"
                      onClick={() => eliminarFila(i)}
                      className="text-red-400 hover:text-red-600 shrink-0 pt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-end justify-between gap-2 flex-wrap">
                    <div className="flex items-end gap-2 flex-wrap">
                      {/* Tipo Bien/Servicio */}
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-gray-400 block">Tipo</label>
                        {esPorConsumo ? (
                          <span className="text-[10px] text-gray-400">ZZ</span>
                        ) : (
                          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 h-7 items-center">
                            <button
                              type="button"
                              onClick={() => {
                                const n = [...detalles];
                                n[i] = { ...n[i], unidadMedida: "NIU" };
                                setDetalles(n as T[]);
                              }}
                              disabled={!!d.productoId}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                (d.unidadMedida ?? "NIU") !== "ZZ" ? "bg-white text-brand-blue shadow-sm" : "text-gray-400"
                              } ${d.productoId ? "cursor-default" : "hover:text-gray-600"}`}
                            >
                              Bien
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const n = [...detalles];
                                n[i] = { ...n[i], unidadMedida: "ZZ" };
                                setDetalles(n as T[]);
                              }}
                              disabled={!!d.productoId}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                (d.unidadMedida ?? "NIU") === "ZZ" ? "bg-white text-brand-blue shadow-sm" : "text-gray-400"
                              } ${d.productoId ? "cursor-default" : "hover:text-gray-600"}`}
                            >
                              Serv.
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Cantidad */}
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-gray-400 block">Cant.</label>
                        {d._esIcbper || esPorConsumo ? (
                          <span className="text-xs text-gray-500">{d.cantidad}</span>
                        ) : (
                          <div className="flex items-center gap-1 h-7">
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(i, Math.max(1, (d.cantidad ?? 1) - 1))}
                              className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold transition-colors"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={
                                config?.isStock && d._tipoProducto === "BIEN" && d._stockDisponible != null
                                  ? d._stockDisponible
                                  : undefined
                              }
                              value={d.cantidad ?? 1}
                              onWheel={(e) => e.currentTarget.blur()}
                              onFocus={(e) => {
                                if (Number(e.currentTarget.value) === 0) e.currentTarget.select();
                              }}
                              onChange={(e) => actualizarCantidad(i, Number(e.target.value))}
                              className="w-10 py-1 pl-2 pr-3 border border-gray-200 bg-gray-50 rounded-lg text-xs text-center outline-none focus:border-brand-blue/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(i, (d.cantidad ?? 1) + 1)}
                              className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Precio unitario */}
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-gray-400 block">Precio U.</label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                            {simbolo}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              precioInputValues[i] !== undefined
                                ? precioInputValues[i]
                                : String(d._precioVentaConIGV ?? d.precioVenta ?? 0)
                            }
                            onFocus={(e) => {
                              setPrecioInputValues((prev) => ({ ...prev, [i]: e.target.value }));
                              e.target.select();
                            }}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.,]/g, "");
                              setPrecioInputValues((prev) => ({ ...prev, [i]: raw }));
                              const num = Number(raw.replace(",", "."));
                              if (!isNaN(num) && raw !== "" && !raw.replace(",", ".").endsWith(".")) {
                                actualizarPrecioVenta(i, num);
                              }
                            }}
                            onBlur={(e) => {
                              const num = Number(e.target.value.replace(",", "."));
                              if (!isNaN(num)) actualizarPrecioVenta(i, num);
                              setPrecioInputValues((prev) => {
                                const n = { ...prev };
                                delete n[i];
                                return n;
                              });
                            }}
                            disabled={!!d._esIcbper || gratuito}
                            className={`w-24 py-1 pl-6 pr-2 border rounded-lg text-xs text-right outline-none focus:border-brand-blue/50 font-mono ${
                              d._esIcbper || gratuito ? "bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50 border-gray-200"
                            }`}
                          />
                        </div>
                      </div>
                      {/* Detalles avanzados — inline, al costado del Precio U. */}
                      {mostrarAvanzado && (
                        <>
                          <div className="space-y-0.5">
                            <label className="text-[9px] text-gray-400 block">Avan.</label>
                            <button
                              type="button"
                              title={expandido[i] ? "Ocultar avanzado" : "Mostrar avanzado"}
                              onClick={() => setExpandido((prev) => ({ ...prev, [i]: !prev[i] }))}
                              className="h-7 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                            >
                              {expandido[i] ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {expandido[i] && (
                            <>
                              {config?.afectacionIgv === true && (
                                <div className="space-y-0.5">
                                  <label className="text-[9px] text-gray-400 block">Afect. IGV</label>
                                  <select
                                    value={d.tipoAfectacionIGV ?? "10"}
                                    disabled={!!d._esIcbper || esPorConsumo}
                                    onChange={(e) => actualizarTipoAfectacion(i, e.target.value)}
                                    className="w-20 h-7 py-1 px-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue/50"
                                  >
                                    <option value="10">Grav.</option>
                                    <option value="20">Exon.</option>
                                    <option value="30">Inaf.</option>
                                    {tipoAfectacionExtra.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div className="space-y-0.5">
                                <label className="text-[9px] text-gray-400 block">%IGV</label>
                                {igvAfectacionValues.includes(d.tipoAfectacionIGV ?? "10") ? (
                                  <span className="flex items-center justify-center w-16 h-7 text-gray-500 text-xs">
                                    {d.porcentajeIGV ?? IGV_DEFAULT}
                                  </span>
                                ) : (
                                  <span className="flex items-center justify-center w-16 h-7 text-gray-400 text-xs">N/A</span>
                                )}
                              </div>
                              {config?.descUnitario === true && (
                                <div className="space-y-0.5">
                                  <label className="text-[9px] text-gray-400 block">Desc.Unit</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={d.descuentoUnitario ?? 0}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onFocus={(e) => {
                                      if (Number(e.currentTarget.value) === 0) e.currentTarget.select();
                                    }}
                                    onChange={(e) => actualizarDescuento(i, Number(e.target.value))}
                                    disabled={!!d._esIcbper || esPorConsumo || gratuito}
                                    className={`w-20 h-7 py-1 pl-2 pr-3 border rounded-lg text-xs text-right outline-none focus:border-brand-blue/50 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                      d._esIcbper || esPorConsumo || gratuito ? "bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50 border-gray-200"
                                    }`}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {gratuito ? (
                        <p className="text-[10px] text-green-600 font-semibold">GRATUITO</p>
                      ) : (
                        <p className="text-[10px] text-gray-400">
                          Sub Total: {simbolo} {fmtMonto(d.baseIgv ?? 0)}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-gray-800">
                        {simbolo} {gratuito ? fmtMonto(0) : fmtMonto(d.totalVentaItem ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {avisoExtra}
    </div>
  );
}
