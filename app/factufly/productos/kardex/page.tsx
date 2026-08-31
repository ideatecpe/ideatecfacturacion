"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Calendar,
  PackageSearch,
  X,
  Lock,
  Search,
  ScanBarcode,
  Check,
  Tag,
  Boxes,
} from "lucide-react";

import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import { useKardexLista } from "../useKardexLista";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";
import { useEscanerGlobal } from "../../operaciones/useEscanerGlobal";

const TIPO_LABEL: Record<string, string> = {
  ENTRADA_COMPRA: "Entrada por compra",
  ENTRADA_SALDO_INICIAL: "Saldo inicial",
  ENTRADA_DEVOLUCION: "Entrada por devolución",
  SALIDA_VENTA: "Salida por venta",
  SALIDA_NOTA: "Salida por nota",
  SALIDA_VENCIMIENTO: "Salida por vencimiento",
  AJUSTE: "Ajuste",
};

const TIPO_STYLE: Record<string, { badge: string; cantidad: string; signo: string; fila: string }> = {
  ENTRADA_COMPRA: {
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    cantidad: "text-blue-700",
    signo: "+",
    fila: "border-l-2 border-l-blue-300",
  },
  ENTRADA_SALDO_INICIAL: {
    badge: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
    cantidad: "text-gray-700",
    signo: "+",
    fila: "border-l-2 border-l-gray-300",
  },
  ENTRADA_DEVOLUCION: {
    badge: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200",
    cantidad: "text-fuchsia-700",
    signo: "+",
    fila: "border-l-2 border-l-fuchsia-300",
  },
  SALIDA_VENTA: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    cantidad: "text-emerald-700",
    signo: "−",
    fila: "border-l-2 border-l-emerald-300",
  },
  SALIDA_NOTA: {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    cantidad: "text-amber-700",
    signo: "−",
    fila: "border-l-2 border-l-amber-300",
  },
  SALIDA_VENCIMIENTO: {
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    cantidad: "text-rose-700",
    signo: "−",
    fila: "border-l-2 border-l-rose-300",
  },
  AJUSTE: {
    badge: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
    cantidad: "text-purple-700",
    signo: "±",
    fila: "border-l-2 border-l-purple-300",
  },
};

const TIPO_STYLE_DEFAULT = {
  badge: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  cantidad: "text-gray-700",
  signo: "",
  fila: "border-l-2 border-l-gray-200",
};

function MovimientoBadge({ tipo }: { tipo: string }) {
  const style = TIPO_STYLE[tipo] ?? TIPO_STYLE_DEFAULT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${style.badge}`}
    >
      {TIPO_LABEL[tipo] ?? tipo}
    </span>
  );
}

export default function KardexPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("Todos");

  const sucursalId = isSuperAdmin
    ? sucursales.find((s) => s.nombre === filtroSucursal)?.sucursalId ?? 0
    : parseInt(user?.sucursalID ?? "0");

  const { productosSucursal } = useProductosSucursal(sucursalId || null, !!sucursalId);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoSucursal | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Un paquete/sixpack no tiene lotes propios (comparte el stock/kardex de su producto
  // base), así que para ver "su" kardex hay que consultar el sucursalProductoId del BASE
  // y filtrar por el productoId del paquete — igual que Rentabilidad separa sus filas.
  const productoBase = productoSeleccionado?.esPaquete
    ? productosSucursal.find((p) => p.productoId === productoSeleccionado.productoBaseId)
    : null;
  const sucursalProductoIdConsulta =
    productoBase?.sucursalProducto.sucursalProductoId ??
    productoSeleccionado?.sucursalProducto.sucursalProductoId ??
    0;
  const productoIdFiltro = productoSeleccionado?.esPaquete ? productoSeleccionado.productoId : undefined;
  const sucursalProductoId = productoSeleccionado?.sucursalProducto.sucursalProductoId ?? 0;
  const { kardex, loadingKardex, fetchKardex } = useKardexLista();

  // Auto-focus al entrar a la pantalla
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Escáner global (lector de códigos de barras físico):
  // Si el usuario escanea un código de barras en cualquier parte de la pantalla,
  // busca y selecciona el producto directamente cargando su Kardex de inmediato.
  useEscanerGlobal((codigo) => {
    const qClean = codigo.trim().replace(/\s+/g, "").toLowerCase();
    const prod =
      productosSucursal.find((p) => {
        const barcodeClean = (p.codigoBarras ?? "").replace(/\s+/g, "").toLowerCase();
        const codeClean = (p.codigo ?? "").replace(/\s+/g, "").toLowerCase();
        return barcodeClean === qClean || codeClean === qClean;
      }) ||
      productosSucursal.find((p) =>
        coincideBusqueda(codigo, p.nomProducto, p.codigo, p.codigoBarras),
      );

    if (prod) {
      seleccionarProducto(prod);
    } else {
      setBusqueda(codigo);
      setMostrarDropdown(true);
      searchInputRef.current?.focus();
    }
  });

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrado de productos por nombre, código interno o código de barras
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return productosSucursal.slice(0, 30);

    const qClean = q.replace(/\s+/g, "").toLowerCase();

    return productosSucursal
      .filter((p) => {
        const barcodeClean = (p.codigoBarras ?? "").replace(/\s+/g, "").toLowerCase();
        const codeClean = (p.codigo ?? "").replace(/\s+/g, "").toLowerCase();

        if (barcodeClean && (barcodeClean === qClean || barcodeClean.includes(qClean))) return true;
        if (codeClean && (codeClean === qClean || codeClean.includes(qClean))) return true;

        return coincideBusqueda(q, p.nomProducto, p.codigo, p.codigoBarras);
      })
      .slice(0, 30);
  }, [productosSucursal, busqueda]);

  const seleccionarProducto = (prod: ProductoSucursal) => {
    setProductoSeleccionado(prod);
    setBusqueda(prod.nomProducto);
    setMostrarDropdown(false);
    setSelectedIndex(-1);
  };

  const limpiarSeleccion = () => {
    setProductoSeleccionado(null);
    setBusqueda("");
    setMostrarDropdown(true);
    setSelectedIndex(-1);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mostrarDropdown) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setMostrarDropdown(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < productosFiltrados.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : productosFiltrados.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (productosFiltrados.length > 0) {
        const target =
          selectedIndex >= 0 && selectedIndex < productosFiltrados.length
            ? productosFiltrados[selectedIndex]
            : productosFiltrados[0];
        seleccionarProducto(target);
      }
    } else if (e.key === "Escape") {
      setMostrarDropdown(false);
    }
  };

  // Cálculo de fechas: 
  // - vacías = todo el historial
  // - solo desde = ese día exacto
  // - solo hasta = ese día exacto
  // - ambas = rango completo
  const desdeCalculado = useMemo(() => {
    if (fechaDesde && !fechaHasta) return fechaDesde;
    if (!fechaDesde && fechaHasta) return fechaHasta;
    if (fechaDesde && fechaHasta) return fechaDesde;
    return undefined;
  }, [fechaDesde, fechaHasta]);

  const hastaCalculado = useMemo(() => {
    if (fechaDesde && !fechaHasta) return fechaDesde;
    if (!fechaDesde && fechaHasta) return fechaHasta;
    if (fechaDesde && fechaHasta) return fechaHasta;
    return undefined;
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    if (!sucursalProductoIdConsulta) return;
    fetchKardex({
      sucursalProductoId: sucursalProductoIdConsulta,
      productoId: productoIdFiltro,
      desde: desdeCalculado,
      hasta: hastaCalculado,
    });
  }, [sucursalProductoIdConsulta, productoIdFiltro, desdeCalculado, hastaCalculado, fetchKardex]);

  const handleFechaDesdeChange = (val: string) => {
    setFechaDesde(val);
    if (fechaHasta && val > fechaHasta) {
      setFechaHasta("");
    }
  };

  const handleFechaHastaChange = (val: string) => {
    setFechaHasta(val);
    if (fechaDesde && val < fechaDesde) {
      setFechaDesde("");
    }
  };

  const filtrosActivos =
    filtroSucursal !== "Todos" || !!productoSeleccionado || !!busqueda || !!fechaDesde || !!fechaHasta;

  const limpiarFiltros = () => {
    setFiltroSucursal("Todos");
    limpiarSeleccion();
    setFechaDesde("");
    setFechaHasta("");
  };

  const totalSaldo = useMemo(() => {
    if (kardex.length === 0) return { cantidad: 0, valor: 0 };
    const ultimo = kardex[kardex.length - 1];
    return { cantidad: ultimo.saldoCantidadPost, valor: ultimo.saldoValorPost };
  }, [kardex]);

  if (!loadingConfig && !config?.isStock) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-gray-100 rounded-full p-4 mb-3">
          <Lock className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 font-semibold text-sm">Este reporte no está disponible</p>
        <p className="text-gray-400 text-xs mt-1">
          Tu empresa no tiene activada la gestión de stock/inventario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {isSuperAdmin && (
            <DropdownFiltro
              label="Sucursal"
              value={filtroSucursal}
              options={["Todos", ...sucursales.map((s) => s.nombre)]}
              onChange={(v) => {
                setFiltroSucursal(v);
                limpiarSeleccion();
              }}
            />
          )}

          {/* ── Buscador de producto con nombre o código de barras ── */}
          <div className="relative flex-1 min-w-70 sm:min-w-85 max-w-lg">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setMostrarDropdown(true);
                  if (productoSeleccionado && e.target.value !== productoSeleccionado.nomProducto) {
                    setProductoSeleccionado(null);
                  }
                }}
                onFocus={() => setMostrarDropdown(true)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar por nombre, código o código de barras..."
                className="w-full h-9 text-xs pl-8 pr-16 rounded-lg border border-gray-200 bg-white outline-none focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue/30 shadow-sm text-gray-800 placeholder:text-gray-400 font-medium"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {busqueda && (
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <ScanBarcode className="w-4 h-4 text-gray-400 shrink-0 pointer-events-none" />
              </div>
            </div>

            {/* Dropdown de opciones */}
            {mostrarDropdown && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto"
              >
                {productosFiltrados.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-gray-400">
                    <PackageSearch className="w-6 h-6 mx-auto mb-1.5 text-gray-300" />
                    No se encontró ningún producto que coincida con &quot;{busqueda}&quot;
                  </div>
                ) : (
                  <div className="py-1">
                    {productosFiltrados.map((prod, idx) => {
                      const isSelected =
                        productoSeleccionado?.sucursalProducto.sucursalProductoId ===
                        prod.sucursalProducto.sucursalProductoId;
                      const isHighlighted = idx === selectedIndex;

                      return (
                        <button
                          key={prod.sucursalProducto.sucursalProductoId}
                          type="button"
                          onMouseDown={() => seleccionarProducto(prod)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 border-b border-gray-50 last:border-0 ${
                            isSelected
                              ? "bg-blue-50/80 text-brand-blue"
                              : isHighlighted
                                ? "bg-gray-50 text-gray-900"
                                : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-gray-800 truncate">{prod.nomProducto}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-brand-blue shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                              {prod.codigo && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Tag className="w-2.5 h-2.5" /> {prod.codigo}
                                </span>
                              )}
                              {prod.codigoBarras && (
                                <span className="inline-flex items-center gap-0.5 font-mono bg-gray-100 text-gray-600 px-1 py-0.2 rounded border border-gray-200">
                                  🏷️ {prod.codigoBarras}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end">
                            <span className="text-[11px] font-bold text-gray-700">
                              Stock: {prod.sucursalProducto.stock ?? 0}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              S/ {prod.sucursalProducto.precioUnitario?.toFixed(2) ?? "0.00"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Filtro de fechas ── */}
          <div className="flex items-center h-9 gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => handleFechaDesdeChange(e.target.value)}
              className="text-xs outline-none w-26.25 h-full text-gray-700"
            />
            <span className="text-gray-300">–</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => handleFechaHastaChange(e.target.value)}
              className="text-xs outline-none w-26.25 h-full text-gray-700"
            />
          </div>

          {filtrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 font-semibold transition-colors px-2 py-2"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* ── Resumen de stock y valorización ── */}
        {sucursalProductoId > 0 && kardex.length > 0 && (
          <div className="flex items-center gap-2.5 sm:ml-auto">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 flex flex-col shadow-sm">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stock actual</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{totalSaldo.cantidad} unid.</span>
            </div>
            <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-3 py-1.5 flex flex-col shadow-sm">
              <span className="text-[10px] font-semibold text-brand-blue/70 uppercase tracking-wide">Valor actual</span>
              <span className="text-sm font-bold text-brand-blue tabular-nums">S/ {totalSaldo.valor.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm"
        style={{ maxHeight: "calc(100vh - 260px)", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
      >
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
            <tr>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Fecha</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Movimiento</th>
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Producto</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Cantidad</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Unit.</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Costo Total</th>
            </tr>
          </thead>
          <tbody>
            {loadingKardex &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  <td className="px-3 py-3" colSpan={6}>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </td>
                </tr>
              ))}

            {!loadingKardex && sucursalProductoId === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Selecciona o busca un producto</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Escribe el nombre, código o escanea el código de barras para ver su kardex
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingKardex && sucursalProductoId > 0 && kardex.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 rounded-full p-4 mb-3">
                      <PackageSearch className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold text-sm">Sin movimientos registrados</p>
                    <p className="text-gray-400 text-xs mt-1">Este producto no tiene movimientos en el periodo seleccionado</p>
                  </div>
                </td>
              </tr>
            )}

            {!loadingKardex &&
              sucursalProductoId > 0 &&
              kardex.map((m, idx) => {
                const style = TIPO_STYLE[m.tipoMovimiento] ?? TIPO_STYLE_DEFAULT;
                return (
                  <tr
                    key={m.kardexMovimientoId}
                    className={`border-b transition-colors hover:bg-blue-50/40 ${style.fila} ${
                      idx % 2 === 1 ? "bg-gray-50/50 border-gray-100" : "bg-white border-gray-100"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {new Date(m.fechaMovimiento).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-3 py-2.5">
                      <MovimientoBadge tipo={m.tipoMovimiento} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        {m.nomProducto ?? productoSeleccionado?.nomProducto ?? "—"}
                        {m.esPaquete && (
                          <span className="text-[9px] font-bold text-brand-blue bg-brand-blue/10 rounded-full px-1.5 py-0.5 uppercase tracking-wide">
                            Paquete
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${style.cantidad}`}>
                      {style.signo}
                      {m.cantidadVenta}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {m.esPaquete ? (
                        m.costoVenta != null && m.cantidadVenta > 0 ? (
                          `S/ ${(m.costoVenta / m.cantidadVenta).toFixed(2)}`
                        ) : (
                          "—"
                        )
                      ) : m.costoUnitarioPromedio != null ? (
                        <>
                          S/ {m.costoUnitarioPromedio.toFixed(2)}
                          {m.lotesConsumidos > 1 && (
                            <span className="text-gray-400"> (promedio)</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {(m.costoVenta ?? m.costoTotal) != null
                        ? `S/ ${(m.costoVenta ?? m.costoTotal!).toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
