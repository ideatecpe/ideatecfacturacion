"use client";

import React, { useState, useEffect, useMemo, useRef, memo } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import {
  Package,
  Search,
  Timer,
  RefreshCw,
  Zap,
  Tag,
  AlertTriangle,
  HardDrive,
  CloudDownload,
  Trash2,
  CheckCircle2,
  X,
  Gauge,
  Sparkles,
  Database,
  ArrowDownUp,
  ImageOff,
  ImageIcon,
} from "lucide-react";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";
import { abreviaturaUnidad, formatearCantidadUnidad } from "@/app/factufly/productos/gestioProductos/unidadMedida";
import { cacheProductos, getProductosCache } from "@/lib/offline/offlineDb";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";

const GRID_IMG_SIZES =
  "(min-width: 1536px) 12.5vw, (min-width: 1280px) 14.3vw, (min-width: 1024px) 16.7vw, (min-width: 768px) 20vw, (min-width: 640px) 25vw, 33.3vw";

// ── Tarjeta de Producto con Lazy Loading real por IntersectionObserver ──
const ProductoCardPrueba = memo(function ProductoCardPrueba({
  p,
  index,
  onImageMount,
}: {
  p: ProductoSucursal;
  index: number;
  onImageMount?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Las primeras 8 tarjetas inician con imagen activa, el resto espera al scroll
  const [isInView, setIsInView] = useState(index < 8);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (isInView) return;
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          onImageMount?.();
          observer.disconnect();
        }
      },
      { rootMargin: "100px" } // Comienza a cargar 100px antes de entrar a la pantalla
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isInView, onImageMount]);

  const stock = p.sucursalProducto?.stock ?? 0;
  const precio = p.sucursalProducto?.precioUnitario ?? 0;
  const tienePromo = !!p.sucursalProducto?.enPromocion && !!p.sucursalProducto?.porcentajeDescuento;
  const precioEfectivo = tienePromo
    ? precio * (1 - (p.sucursalProducto.porcentajeDescuento ?? 0) / 100)
    : precio;
  const tieneImagen = !!p.urlImagenProducto && !imgError;

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-xl border border-gray-200/90 hover:border-brand-blue/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group text-left"
    >
      {/* ── Contenedor de Imagen Cuadrada con Lazy Mount ── */}
      <div className="aspect-square w-full bg-gray-50 flex items-center justify-center overflow-hidden relative p-2 border-b border-gray-100">
        {tieneImagen && isInView ? (
          <img
            src={conVarianteImagen(p.urlImagenProducto as string, "thumbnail")}
            alt={p.nomProducto}
            decoding="async"
            fetchPriority={index < 8 ? "high" : "auto"}
            sizes={GRID_IMG_SIZES}
            className={`w-full h-full object-contain group-hover:scale-105 transition-all duration-300 ${
              imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : tieneImagen ? (
          /* Placeholder mientras NO está en el viewport (0 peticiones de red) */
          <div className="w-full h-full bg-gray-100/60 rounded flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-gray-300/70 animate-pulse" />
          </div>
        ) : (
          <ImageOff className="w-5 h-5 text-gray-300" />
        )}

        {/* Badge de Stock */}
        <span
          className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-2xs tabular-nums text-white z-10 ${
            stock <= 0
              ? "bg-rose-600"
              : stock <= 5
                ? "bg-red-500"
                : stock <= 10
                  ? "bg-[#ca5310]"
                  : "bg-[#007200]"
          }`}
        >
          {formatearCantidadUnidad(stock, p.unidadMedida)} {abreviaturaUnidad(p.unidadMedida)}
        </span>

        {tienePromo && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white z-10">
            <Tag className="w-2.5 h-2.5" /> -{p.sucursalProducto.porcentajeDescuento}%
          </span>
        )}
      </div>

      {/* ── Datos del Producto ── */}
      <div className="p-2.5 flex flex-col justify-between flex-1">
        <div>
          <span className="text-[10px] font-mono text-gray-400 font-medium truncate block mb-0.5">
            {p.codigo || `#${p.productoId}`}
          </span>
          <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-brand-blue transition-colors">
            {p.nomProducto}
          </p>
          {p.categoria?.categoriaNombre && (
            <span className="text-[9px] text-gray-400 block mt-1 truncate">
              {p.categoria.categoriaNombre}
            </span>
          )}
        </div>

        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-baseline justify-between">
          {tienePromo ? (
            <div>
              <span className="text-[9px] text-gray-400 line-through mr-1 tabular-nums">
                S/ {precio.toFixed(2)}
              </span>
              <span className="text-xs font-black text-orange-600 tabular-nums">
                S/ {precioEfectivo.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-black text-brand-blue tabular-nums">
              S/ {precio.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function PruebasRendimientoPage() {
  const { accessToken } = useAuth();

  const [sucursalId, setSucursalId] = useState("11");
  const [productos, setProductos] = useState<ProductoSucursal[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(false);
  const [syncSegundoPlano, setSyncSegundoPlano] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tiempoPantallaMs, setTiempoPantallaMs] = useState<number | null>(null);
  const [tiempoApiMs, setTiempoApiMs] = useState<number | null>(null);
  const [origenDatos, setOrigenDatos] = useState<"indexeddb" | "api" | null>(null);
  const [fechaCache, setFechaCache] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const reqSeqRef = useRef(0);

  const cargarProductosEstrategiaLocal = async (idToFetch = sucursalId) => {
    const numId = Number(idToFetch) || 11;
    const seq = ++reqSeqRef.current;
    setError(null);

    const startTotal = performance.now();

    // ─────────────────────────────────────────────────────────────
    // ⚡ PASO 1: Leer instantáneamente de IndexedDB (Disco local)
    // ─────────────────────────────────────────────────────────────
    let tuvoCache = false;
    try {
      const cacheEntry = await getProductosCache(numId);
      if (cacheEntry && cacheEntry.productos.length > 0 && seq === reqSeqRef.current) {
        tuvoCache = true;
        const endLocal = performance.now();
        const localMs = Math.round(endLocal - startTotal);

        setProductos(cacheEntry.productos);
        setTiempoPantallaMs(localMs);
        setOrigenDatos("indexeddb");
        setFechaCache(cacheEntry.updatedAt);
        setLoadingInicial(false);
      }
    } catch (err) {
      console.warn("No se pudo leer de IndexedDB:", err);
    }

    // Si no había caché, mostramos skeleton de carga inicial
    if (!tuvoCache) {
      setLoadingInicial(true);
    }

    // ─────────────────────────────────────────────────────────────
    // 🌐 PASO 2: Petición en segundo plano al servidor (Background Sync)
    // ─────────────────────────────────────────────────────────────
    setSyncSegundoPlano(true);
    const startApi = performance.now();

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5004";
      const url = `${baseUrl}/api/productos/${numId}`;

      const res = await axios.get<ProductoSucursal[]>(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      const endApi = performance.now();
      const elapsedApi = Math.round(endApi - startApi);
      setTiempoApiMs(elapsedApi);

      if (seq === reqSeqRef.current) {
        const datosServidor = res.data ?? [];
        setProductos(datosServidor);
        setOrigenDatos("api");

        if (!tuvoCache) {
          setTiempoPantallaMs(elapsedApi);
        }

        await cacheProductos(numId, datosServidor).catch(() => {});
        setFechaCache(new Date().toISOString());
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error al conectar con la API";
      setError(errMsg);
    } finally {
      if (seq === reqSeqRef.current) {
        setLoadingInicial(false);
        setSyncSegundoPlano(false);
      }
    }
  };

  useEffect(() => {
    cargarProductosEstrategiaLocal();
  }, [accessToken]);

  const limpiarCacheLocal = async () => {
    const numId = Number(sucursalId) || 11;
    try {
      await cacheProductos(numId, []);
      setProductos([]);
      setOrigenDatos(null);
      setTiempoPantallaMs(null);
      setTiempoApiMs(null);
      setFechaCache(null);
      alert("Caché local borrado. Ahora puedes probar una carga fría.");
    } catch (e) {
      console.error(e);
    }
  };

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return productos;
    return productos.filter((p) =>
      coincideBusqueda(q, p.nomProducto, p.codigo, p.codigoBarras)
    );
  }, [productos, busqueda]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-10">
      {/* ── Banner de Benchmark / Prueba ── */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-blue to-indigo-950 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap size={11} className="fill-emerald-300" /> Offline-First + Imágenes On-Demand (Scroll)
              </span>

              {syncSegundoPlano ? (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <CloudDownload size={11} /> Sincronizando API en segundo plano...
                </span>
              ) : origenDatos === "indexeddb" ? (
                <span className="bg-blue-500/20 text-blue-200 border border-blue-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <HardDrive size={11} /> Mostrando desde Caché Local
                </span>
              ) : origenDatos === "api" ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={11} /> Actualizado con Servidor
                </span>
              ) : null}
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Gauge className="w-5 h-5 text-emerald-400" />
              Prueba: IndexedDB + Carga Progresiva de Imágenes
            </h1>
            <p className="text-xs text-blue-100/80 mt-0.5 max-w-xl">
              Los datos abren en ~10ms. Las fotos <strong>NO se descargan</strong> hasta que cada tarjeta aparece en tu pantalla al hacer scroll.
            </p>
          </div>

          {/* Métricas de Velocidad */}
          <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/15 flex-wrap sm:flex-nowrap">
            {/* Tiempo que tardó la pantalla en estar lista */}
            <div className="px-3 border-r border-white/20 text-center">
              <p className="text-[9px] uppercase font-bold text-blue-200 tracking-wider">Pantalla Lista En</p>
              <p className="text-lg font-black text-emerald-400 tabular-nums">
                {tiempoPantallaMs !== null ? `${tiempoPantallaMs} ms` : "—"}
              </p>
            </div>

            {/* Tiempo de la petición API en segundo plano */}
            <div className="px-3 border-r border-white/20 text-center">
              <p className="text-[9px] uppercase font-bold text-blue-200 tracking-wider">API Red (3G)</p>
              <p className="text-lg font-black text-amber-300 tabular-nums">
                {tiempoApiMs !== null ? `${tiempoApiMs} ms` : syncSegundoPlano ? "cargando..." : "—"}
              </p>
            </div>

            {/* Total de productos */}
            <div className="px-3 border-r border-white/20 text-center">
              <p className="text-[9px] uppercase font-bold text-blue-200 tracking-wider">Productos</p>
              <p className="text-lg font-black text-white tabular-nums">
                {productos.length}
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-1 px-1">
              <button
                type="button"
                onClick={() => cargarProductosEstrategiaLocal()}
                disabled={loadingInicial}
                className="p-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg transition-all shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-50"
                title="Recargar prueba"
              >
                <RefreshCw size={15} className={syncSegundoPlano ? "animate-spin" : ""} />
              </button>

              <button
                type="button"
                onClick={limpiarCacheLocal}
                className="p-2 bg-rose-500/80 hover:bg-rose-600 active:scale-95 text-white rounded-lg transition-all shadow-sm flex items-center justify-center cursor-pointer"
                title="Borrar caché de IndexedDB para probar carga fría"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {fechaCache && (
          <div className="relative z-10 mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200/70">
            <span>
              📦 Última copia guardada en disco local: <strong>{new Date(fechaCache).toLocaleTimeString("es-PE")}</strong>
            </span>
            <span>
              {origenDatos === "indexeddb" ? "⚡ Abierto sin esperar a internet" : "✅ Sincronizado"}
            </span>
          </div>
        )}
      </div>

      {/* ── Barra de controles y filtros ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
        {/* Buscador en vivo */}
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar entre los ${productos.length} productos...`}
            className="w-full h-9 pl-9 pr-8 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Parámetros de la prueba */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 h-9 rounded-lg text-xs text-gray-600">
            <span className="font-semibold text-gray-500">ID Sucursal:</span>
            <input
              type="text"
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="w-10 bg-white border border-gray-300 rounded px-1 text-center font-bold text-gray-800 outline-none"
            />
            <button
              type="button"
              onClick={() => cargarProductosEstrategiaLocal(sucursalId)}
              className="text-[11px] font-bold text-brand-blue hover:underline cursor-pointer"
            >
              Cargar
            </button>
          </div>

          {/* Toggle Grid / Tabla */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "grid" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "table" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Tabla
            </button>
          </div>
        </div>
      </div>

      {/* ── Mensaje de error si falla la API ── */}
      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
            <span>La sincronización de red falló: <strong>{error}</strong>. {productos.length > 0 ? "Sigues viendo los productos guardados en tu equipo." : ""}</span>
          </div>
        </div>
      )}

      {/* ── Estado de Carga Inicial ── */}
      {loadingInicial ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-44 bg-white border border-gray-100 rounded-xl p-3 animate-pulse flex flex-col justify-between">
              <div className="aspect-square bg-gray-100 rounded-lg w-full mb-2" />
              <div className="space-y-1.5">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">No se encontraron productos</p>
          <p className="text-xs text-gray-400 mt-1">Presiona recargar o cambia el ID de sucursal.</p>
        </div>
      ) : viewMode === "grid" ? (
        /* ── Vista Grid CON Imágenes On-Demand al hacer scroll ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
          {productosFiltrados.map((p, idx) => (
            <ProductoCardPrueba
              key={p.productoId}
              p={p}
              index={idx}
            />
          ))}
        </div>
      ) : (
        /* ── Vista Tabla Compacta ── */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider z-10">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Stock</th>
                  <th className="py-2.5 px-3 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {productosFiltrados.map((p) => {
                  const stock = p.sucursalProducto?.stock ?? 0;
                  const precio = p.sucursalProducto?.precioUnitario ?? 0;
                  return (
                    <tr key={p.productoId} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 font-mono text-gray-500">{p.codigo || "—"}</td>
                      <td className="py-2 px-3 font-semibold text-gray-900">{p.nomProducto}</td>
                      <td className="py-2 px-3 text-gray-500">{p.categoria?.categoriaNombre || "—"}</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">
                        <span className={stock <= 0 ? "text-rose-600" : stock <= 5 ? "text-amber-600" : "text-emerald-700"}>
                          {formatearCantidadUnidad(stock, p.unidadMedida)} {abreviaturaUnidad(p.unidadMedida)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-brand-blue tabular-nums">
                        S/ {precio.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
