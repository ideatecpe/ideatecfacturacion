"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Flame,
  ImageIcon,
  ImageOff,
  Loader2,
  MapPin,
  Minus,
  PackageSearch,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  X,
} from "lucide-react";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";
import { PedidoCreado, ProductoPublico, TiendaPublica, tiendaApi } from "@/lib/pedidosOnline";
import BarraCategorias, { IconoDeSeccion } from "./BarraCategorias";
import CheckoutPedido, { LineaCarrito } from "./CheckoutPedido";
import SeguimientoPedido from "./SeguimientoPedido";
import { formatoSoles, guardarLocal, leerLocal, normalizar } from "./formato";

type Carrito = Record<number, number>;

const claveCarrito = (sucursalId: number) => `tienda_carrito_${sucursalId}`;
const clavePedido = (sucursalId: number) => `tienda_pedido_${sucursalId}`;
const claveUltimoPedido = (sucursalId: number) => `tienda_ultimo_pedido_${sucursalId}`;
const claveCatalogo = (clave: string, entorno: string | null) =>
  `tienda_catalogo_${entorno === "beta" ? "beta" : "prod"}_${clave.toLowerCase()}`;
// Una copia más vieja que esto no se muestra: los precios o productos pueden haber cambiado mucho.
const VIGENCIA_COPIA_MS = 7 * 24 * 60 * 60 * 1000;

interface CatalogoGuardado {
  tienda: TiendaPublica;
  productos: ProductoPublico[];
  guardadoEn: number;
}

const SECCION_COMBOS = "Combos";
const SECCION_OTROS = "Otros";
// Atajos que van antes de las categorías para encontrar rápido lo de siempre.
const SECCION_PEDIR_DE_NUEVO = "Pedir de nuevo";
const SECCION_MAS_VENDIDOS = "Lo más vendido";
const MAX_MAS_VENDIDOS = 12;
// Con menos, la sección se ve vacía y no ayuda a elegir.
const MIN_MAS_VENDIDOS = 3;

const ICONOS_SECCION: Record<string, IconoDeSeccion> = {
  [SECCION_PEDIR_DE_NUEVO]: { Icono: RotateCcw, clase: "text-emerald-500" },
  [SECCION_MAS_VENDIDOS]: { Icono: Flame, clase: "text-orange-500" },
  [SECCION_COMBOS]: { Icono: Sparkles, clase: "text-amber-500" },
};

const idSeccion = (nombre: string) => `seccion-${normalizar(nombre).replace(/[^a-z0-9]+/g, "-")}`;

function toLogoUrl(base64?: string | null): string {
  if (!base64) return "";
  if (base64.startsWith("data:")) return base64;
  return `data:image/png;base64,${base64}`;
}

interface Props {
  clave: string;
  entorno: string | null;
  mesaInicial: string | null;
}

export default function TiendaCliente({ clave, entorno, mesaInicial }: Props) {
  const [tienda, setTienda] = useState<TiendaPublica | null>(null);
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [seccionActiva, setSeccionActiva] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<Carrito>({});
  const [carritoRestaurado, setCarritoRestaurado] = useState(false);
  // Lo que pidió la última vez en este celular (productoId → cantidad).
  const [ultimoPedido, setUltimoPedido] = useState<Carrito>({});
  const [mostrarCheckout, setMostrarCheckout] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // En celular, al bajar, el buscador queda como una sola franja plana arriba
  // (como las apps de tiendas) para dejarle el máximo espacio a los productos.
  const [buscadorFijo, setBuscadorFijo] = useState(false);
  const [marcaBuscador, setMarcaBuscador] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!marcaBuscador) return;
    const revisar = () => setBuscadorFijo(marcaBuscador.getBoundingClientRect().top < 0);
    const inicial = requestAnimationFrame(revisar);
    window.addEventListener("scroll", revisar, { passive: true });
    window.addEventListener("resize", revisar);
    return () => {
      cancelAnimationFrame(inicial);
      window.removeEventListener("scroll", revisar);
      window.removeEventListener("resize", revisar);
    };
  }, [marcaBuscador]);

  const [tokenPedido, setTokenPedido] = useState<string | null>(null);
  const [verSeguimiento, setVerSeguimiento] = useState(false);

  const sucursalId = tienda?.sucursalId ?? null;

  // ── Carga inicial ──
  // Se pinta al instante lo guardado de la última visita (tienda y catálogo) y en
  // segundo plano se trae lo actual, que siempre pisa a la copia. El stock de la
  // copia dura lo que tarda esa respuesta, y el pedido igual se valida contra el
  // stock real al enviarse.
  useEffect(() => {
    let cancelado = false;

    const restaurarCliente = (sucursal: number) => {
      setCarrito(leerLocal<Carrito>(claveCarrito(sucursal), {}));
      setUltimoPedido(leerLocal<Carrito>(claveUltimoPedido(sucursal), {}));
      const token = leerLocal<string | null>(clavePedido(sucursal), null);
      setTokenPedido(token);
      setVerSeguimiento(!!token);
      setCarritoRestaurado(true);
    };

    (async () => {
      await Promise.resolve();
      if (cancelado) return;

      const guardado = leerLocal<CatalogoGuardado | null>(claveCatalogo(clave, entorno), null);
      const copia = guardado && Date.now() - guardado.guardadoEn < VIGENCIA_COPIA_MS ? guardado : null;
      if (copia) {
        restaurarCliente(copia.tienda.sucursalId);
        setTienda(copia.tienda);
        setProductos(copia.productos);
        document.title = copia.tienda.nombreTienda;
        setCargando(false);
      }

      try {
        // Con la sucursal ya conocida, tienda y catálogo se piden a la vez.
        const [datosTienda, catalogoAdelantado] = await Promise.all([
          tiendaApi.obtenerTienda(clave, entorno),
          copia
            ? tiendaApi.obtenerProductos(copia.tienda.sucursalId, copia.tienda.entorno).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelado) return;

        const mismaSucursal = copia?.tienda.sucursalId === datosTienda.sucursalId;
        if (!mismaSucursal) restaurarCliente(datosTienda.sucursalId);
        setTienda(datosTienda);
        document.title = datosTienda.nombreTienda;

        // Fuera de horario no se pide el catálogo: nadie va a comprar y es una
        // consulta completa contra la BD remota que no hace falta pagar.
        if (datosTienda.abierta) {
          const catalogo =
            mismaSucursal && catalogoAdelantado
              ? catalogoAdelantado
              : await tiendaApi.obtenerProductos(datosTienda.sucursalId, datosTienda.entorno);
          if (!cancelado) setProductos(catalogo);
        }
      } catch (e) {
        // Sin conexión: si había copia se sigue mostrando esa en vez de un error.
        if (!cancelado && !copia) setError(e instanceof Error ? e.message : "No se pudo cargar la tienda.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [clave, entorno]);

  // Copia para la próxima visita: se actualiza con cada respuesta del servidor.
  useEffect(() => {
    if (!tienda) return;
    guardarLocal(claveCatalogo(clave, entorno), {
      tienda,
      productos,
      guardadoEn: Date.now(),
    } satisfies CatalogoGuardado);
  }, [tienda, productos, clave, entorno]);

  useEffect(() => {
    if (!sucursalId || !carritoRestaurado) return;
    guardarLocal(claveCarrito(sucursalId), Object.keys(carrito).length ? carrito : null);
  }, [carrito, carritoRestaurado, sucursalId]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  const recargarProductos = useCallback(async () => {
    if (!tienda) return;
    try {
      setProductos(await tiendaApi.obtenerProductos(tienda.sucursalId, tienda.entorno));
    } catch {
      /* se mantiene el catálogo anterior */
    }
  }, [tienda]);

  // El stock cambia con cada venta de la caja: se refresca cada minuto y al volver
  // a la pestaña, para que lo agotado deje de ofrecerse sin recargar la página.
  useEffect(() => {
    if (!tienda?.abierta) return;
    const refrescar = () => {
      if (document.visibilityState === "visible") void recargarProductos();
    };
    const intervalo = setInterval(refrescar, 60000);
    document.addEventListener("visibilitychange", refrescar);
    window.addEventListener("focus", refrescar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", refrescar);
      window.removeEventListener("focus", refrescar);
    };
  }, [tienda?.abierta, recargarProductos]);

  const recargarTodo = useCallback(async () => {
    setCargando(true);
    try {
      const datosTienda = await tiendaApi.obtenerTienda(clave, entorno);
      setTienda(datosTienda);
      if (datosTienda.abierta) {
        const catalogo = await tiendaApi.obtenerProductos(datosTienda.sucursalId, datosTienda.entorno);
        setProductos(catalogo);
      }
    } catch {
      /* mantener estado anterior */
    } finally {
      setCargando(false);
    }
  }, [clave, entorno]);

  // ── Derivados ──────────────────────────────────────────────────────────
  const porId = useMemo(() => new Map(productos.map((p) => [p.productoId, p])), [productos]);

  const filtrados = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return productos;
    return productos.filter((p) => {
      const texto = normalizar(`${p.nombre} ${p.categoria ?? ""} ${p.incluye.join(" ")}`);
      return palabras.every((w) => texto.includes(w));
    });
  }, [productos, busqueda]);

  // Combos primero y luego una sección por categoría, en el orden del catálogo.
  const secciones = useMemo(() => {
    const mapa = new Map<string, ProductoPublico[]>();
    for (const p of filtrados) {
      const nombre = p.esCombo ? SECCION_COMBOS : (p.categoria ?? SECCION_OTROS);
      const lista = mapa.get(nombre);
      if (lista) lista.push(p);
      else mapa.set(nombre, [p]);
    }
    return Array.from(mapa, ([nombre, items]) => ({ nombre, items })).sort((a, b) =>
      a.nombre === SECCION_COMBOS ? -1 : b.nombre === SECCION_COMBOS ? 1 : 0,
    );
  }, [filtrados]);

  // Secciones destacadas antes de los combos y las categorías. Solo sin búsqueda:
  // quien busca ya sabe lo que quiere y le estorbarían.
  const destacadas = useMemo(() => {
    if (normalizar(busqueda).trim()) return [];
    const lista: { nombre: string; items: ProductoPublico[] }[] = [];

    const repetir = Object.keys(ultimoPedido)
      .map((id) => porId.get(Number(id)))
      .filter((p): p is ProductoPublico => !!p && p.disponible);
    if (repetir.length > 0) lista.push({ nombre: SECCION_PEDIR_DE_NUEVO, items: repetir });

    const vendidos = productos
      .filter((p) => p.disponible && p.rankingVentas != null)
      .sort((a, b) => (a.rankingVentas ?? 0) - (b.rankingVentas ?? 0))
      .slice(0, MAX_MAS_VENDIDOS);
    if (vendidos.length >= MIN_MAS_VENDIDOS) lista.push({ nombre: SECCION_MAS_VENDIDOS, items: vendidos });

    return lista;
  }, [busqueda, ultimoPedido, porId, productos]);

  const resumenSecciones = useMemo(
    () => [...destacadas, ...secciones].map((s) => ({ nombre: s.nombre, cantidad: s.items.length })),
    [destacadas, secciones],
  );

  // Logo de empresa: prioridad al logo PDF del DTO, fallback a localStorage
  const logoEmpresaUrl = useMemo(() => {
    if (tienda?.logoBase64) return toLogoUrl(tienda.logoBase64);
    if (typeof window !== "undefined" && tienda?.ruc) {
      const cached =
        localStorage.getItem(`logo_pdf_cache_${tienda.ruc}`) ||
        localStorage.getItem(`logo_cache_${tienda.ruc}`);
      if (cached) return toLogoUrl(cached);
    }
    return null;
  }, [tienda?.logoBase64, tienda?.ruc]);

  const cantidadCombos = useMemo(() => productos.filter((p) => p.esCombo).length, [productos]);

  const irASeccion = (nombre: string) => {
    setSeccionActiva(nombre);
    const seccion = document.getElementById(idSeccion(nombre));
    if (!seccion) return;
    // Las categorías fuera de pantalla todavía no tienen su alto real (se dibujan al
    // llegar a ellas), así que el destino se mueve mientras se renderizan: se salta
    // y se corrige hasta que la posición queda quieta.
    let intentos = 0;
    const ajustar = () => {
      seccion.scrollIntoView({ behavior: "instant", block: "start" });
      const posicion = seccion.getBoundingClientRect().top;
      if (++intentos >= 10) return;
      setTimeout(() => {
        if (Math.abs(seccion.getBoundingClientRect().top - posicion) > 2) ajustar();
      }, 80);
    };
    ajustar();
  };

  const lineas: LineaCarrito[] = useMemo(
    () =>
      Object.entries(carrito)
        .map(([id, cantidad]) => ({ producto: porId.get(Number(id)), cantidad }))
        .filter((l): l is LineaCarrito => !!l.producto && l.producto.disponible && l.cantidad > 0),
    [carrito, porId],
  );

  const totalUnidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + Math.round(l.producto.precio * l.cantidad * 100) / 100, 0);

  const cambiarCantidad = useCallback((producto: ProductoPublico, delta: number) => {
    setCarrito((prev) => {
      const actual = prev[producto.productoId] ?? 0;
      const maximo = producto.stockDisponible ?? 999;
      let nueva = actual + delta;
      if (nueva > maximo) {
        setAviso(`Solo quedan ${maximo} de "${producto.nombre}"`);
        nueva = maximo;
      }
      const siguiente = { ...prev };
      if (nueva <= 0) delete siguiente[producto.productoId];
      else siguiente[producto.productoId] = nueva;
      return siguiente;
    });
  }, []);

  /** Completa el carrito con lo del pedido anterior (respeta el stock de cada producto). */
  const repetirPedido = (items: ProductoPublico[]) => {
    for (const p of items) {
      const faltan = (ultimoPedido[p.productoId] ?? 0) - (carrito[p.productoId] ?? 0);
      if (faltan > 0) cambiarCantidad(p, faltan);
    }
    setAviso("Agregamos lo que pediste la última vez");
  };

  const alCrearPedido = (creado: PedidoCreado) => {
    if (!sucursalId) return;
    const pedido: Carrito = Object.fromEntries(lineas.map((l) => [l.producto.productoId, l.cantidad]));
    guardarLocal(claveUltimoPedido(sucursalId), pedido);
    setUltimoPedido(pedido);
    setCarrito({});
    guardarLocal(clavePedido(sucursalId), creado.token);
    setTokenPedido(creado.token);
    setMostrarCheckout(false);
    setVerSeguimiento(true);
    window.scrollTo({ top: 0 });
  };

  const alTerminarPedido = () => {
    if (sucursalId) guardarLocal(clavePedido(sucursalId), null);
    setTokenPedido(null);
    setVerSeguimiento(false);
    void recargarProductos();
  };

  // ── Pantallas de estado ────────────────────────────────────────────────
  if (cargando) {
    return (
      <PantallaCentrada>
        <Loader2 className="w-8 h-8 animate-spin text-[#0b1b36]" />
        <p className="text-sm font-medium text-slate-500">Cargando tienda…</p>
      </PantallaCentrada>
    );
  }

  if (error || !tienda) {
    return (
      <PantallaCentrada>
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Store className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">Tienda no disponible</h1>
        <p className="text-sm text-slate-500 max-w-xs text-center">
          {error ?? "Esta tienda no está recibiendo pedidos en este momento."}
        </p>
      </PantallaCentrada>
    );
  }

  if (tokenPedido && verSeguimiento) {
    return (
      <SeguimientoPedido
        token={tokenPedido}
        tienda={tienda}
        onSeguirComprando={() => setVerSeguimiento(false)}
        onPedidoTerminado={alTerminarPedido}
      />
    );
  }

  // Fuera de horario: aviso de cerrado en vez del catálogo. Si el cliente ya tiene
  // un pedido en curso (de cuando la tienda sí estaba abierta) igual puede seguirlo.
  if (!tienda.abierta) {
    return (
      <PantallaCerrada
        tienda={tienda}
        logoEmpresaUrl={logoEmpresaUrl}
        tienePedidoEnCurso={!!tokenPedido}
        onVerPedido={() => setVerSeguimiento(true)}
        onReintentar={recargarTodo}
      />
    );
  }

  const nombreEmpresa = tienda.nombreTienda.trim();
  const direccionCompleta = tienda.direccion?.toUpperCase() || "";

  // ── Catálogo ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-32">
      {/* ══════════════ TOP NAVBAR ══════════════ */}
      <nav className="border-b border-white/10 bg-[#0B1F49] sm:sticky sm:top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoEmpresaUrl ? (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden border border-white/20">
                <img src={logoEmpresaUrl} alt={nombreEmpresa} className="w-full h-full object-contain rounded-md" />
              </div>
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-[#1a3363] text-white flex items-center justify-center font-black text-base border border-white/15">
                {nombreEmpresa.charAt(0) || "T"}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white uppercase leading-tight truncate">
                {nombreEmpresa}
              </h1>
              {direccionCompleta && (
                <p className="text-[10px] font-medium tracking-wide text-blue-200/70 truncate">
                  {direccionCompleta} · MINI MARKET
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Si el cliente ve el catálogo es porque la tienda está abierta: el aviso sobraba. */}
            <button
              type="button"
              onClick={() => totalUnidades > 0 ? setMostrarCheckout(true) : undefined}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#132c5e] hover:bg-[#1a3a78] border border-white/15 text-white text-xs font-semibold transition-all active:scale-95"
            >
              <span>Mi pedido</span>
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center tabular-nums">
                {totalUnidades}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO BANNER ══════════════ */}
      <header className="relative bg-[#0B1F49] text-white pt-6 pb-12 px-4 overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-20 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Columna Izquierda */}
          <div className="lg:col-span-7 space-y-3.5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-[1.15]">
              Haz tu pedido <br className="hidden sm:inline" />
              <span className="text-amber-400">desde donde estés</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300/90 max-w-lg leading-relaxed">
              {tienda.mensaje && !tienda.mensaje.toLowerCase().includes("tienda de prueba") && !tienda.mensaje.toLowerCase().includes("pide desde tu celular")
                ? tienda.mensaje
                : "Recógelo listo en caja o pídelo directo a tu mesa si estás en el local. Rápido, fácil y sin colas."}
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => irASeccion(SECCION_COMBOS)}
                className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 active:scale-95 transition-all"
              >
                Ver combos
              </button>
              <button
                type="button"
                onClick={() => {
                  const cat = secciones.find((s) => s.nombre !== SECCION_COMBOS)?.nombre;
                  if (cat) irASeccion(cat);
                }}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-xs transition-all active:scale-95"
              >
                Explorar categorías
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10 max-w-xs">
              <div>
                <p className="text-lg sm:text-xl font-black text-white">{productos.length}+</p>
                <p className="text-[10px] text-slate-400">productos en tienda</p>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-black text-white">S/ 0</p>
                <p className="text-[10px] text-slate-400">costo de servicio</p>
              </div>
            </div>

            {tokenPedido && (
              <button
                type="button"
                onClick={() => setVerSeguimiento(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
              >
                <Receipt className="w-4 h-4 text-amber-400" />
                Tienes un pedido en curso. Ver seguimiento
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Columna Derecha – Fotografía principal del servicio */}
          <div className="lg:col-span-5 hidden lg:block relative">
            <div className="relative rounded-3xl overflow-hidden border border-white/15 shadow-2xl h-[280px] sm:h-[300px] w-full group bg-slate-900/60">
              <img
                src="/tienda/online1.jpeg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/tienda/online1.png";
                }}
                alt="Haz tu pedido desde donde estés"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />

              {/* Gradiente sutil para profundidad y contraste */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

              {/* Tarjeta flotante inferior que indica combos disponibles */}
              <div className="absolute bottom-3.5 inset-x-3.5 z-10 flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/15 shadow-xl">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white leading-tight">
                    {cantidadCombos > 0 ? `¡${cantidadCombos} combos disponibles!` : "Pagas al recoger en caja"}
                  </p>
                  <p className="text-[10px] text-blue-200/70 truncate">
                    Ahorra en paquetes armados de la semana
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => irASeccion(SECCION_COMBOS)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shrink-0 transition-colors shadow-sm active:scale-95"
                >
                  Ver combos
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════ BARRA DE BÚSQUEDA PERENNE (STICKY) ══════════════ */}
      <div ref={setMarcaBuscador} aria-hidden className="h-0" />
      <div
        id="catalogo-completo"
        className={`sticky top-0 sm:top-[52px] z-30 -mt-6 mx-auto max-w-6xl px-4 transition-all ${
          buscadorFijo ? "max-sm:px-0" : ""
        }`}
      >
        <div
          className={`relative bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 shadow-xl border border-slate-200/80 space-y-2 ${
            buscadorFijo
              ? "max-sm:flex max-sm:flex-row-reverse max-sm:items-center max-sm:gap-2 max-sm:space-y-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:px-3 max-sm:py-2 max-sm:shadow-md"
              : ""
          }`}
        >
          <div className={`relative ${buscadorFijo ? "max-sm:flex-1" : ""}`}>
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder='¿Qué se te antoja hoy? Prueba con "aceite"'
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#0b1b36] focus:ring-2 focus:ring-[#0b1b36]/10 transition-all"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {secciones.length > 0 && (
            <BarraCategorias
              secciones={resumenSecciones}
              activa={seccionActiva}
              iconos={ICONOS_SECCION}
              compacto={buscadorFijo}
              onElegir={irASeccion}
            />
          )}
        </div>
      </div>



      {/* ══════════════ CATÁLOGO ══════════════ */}
      <main className="mx-auto max-w-6xl px-4 pt-5 space-y-7">
        {destacadas.map((d) => {
          const esRepetir = d.nombre === SECCION_PEDIR_DE_NUEVO;
          const { Icono, clase } = ICONOS_SECCION[d.nombre];
          return (
            <section key={d.nombre} id={idSeccion(d.nombre)} data-seccion={d.nombre} className="scroll-mt-20 sm:scroll-mt-40">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icono className={`w-4 h-4 ${clase}`} />
                    <h2 className="text-base sm:text-lg font-black text-slate-900">{d.nombre}</h2>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {esRepetir ? "Lo que pediste la última vez" : "Lo que más piden nuestros clientes"}
                  </p>
                </div>
                {esRepetir && (
                  <button
                    type="button"
                    onClick={() => repetirPedido(d.items)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#0b1b36] hover:bg-[#122852] px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3 h-3" /> Agregar todo
                  </button>
                )}
              </div>

              {/* Celular: una fila que se desliza con el dedo. Escritorio: cuadrícula. */}
              <div className="-mx-4 px-4 pb-1 flex gap-2.5 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
                {d.items.map((p) => (
                  <div key={p.productoId} className="grid w-36 sm:w-44 lg:w-auto shrink-0 snap-start">
                    <TarjetaProducto producto={p} cantidad={carrito[p.productoId] ?? 0} onCambiar={cambiarCantidad} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {secciones.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-2 text-center">
            <PackageSearch className="w-8 h-8 text-slate-300" />
            <p className="text-xs font-medium text-slate-500">
              {productos.length === 0 ? "Esta tienda aún no tiene productos." : "No encontramos productos con esa búsqueda."}
            </p>
          </div>
        ) : (
          secciones.map((s) => (
            // content-visibility: con ~1000 productos, el navegador solo dibuja las
            // categorías que están en pantalla; el resto, al llegar a ellas.
            <section
              key={s.nombre}
              id={idSeccion(s.nombre)}
              data-seccion={s.nombre}
              className="scroll-mt-20 sm:scroll-mt-40 [content-visibility:auto] [contain-intrinsic-size:auto_900px]"
            >
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    {s.nombre === SECCION_COMBOS && <Sparkles className="w-4 h-4 text-amber-500" />}
                    <h2 className="text-base sm:text-lg font-black text-slate-900">{s.nombre}</h2>
                    <span className="text-[11px] font-normal text-slate-400">{s.items.length} productos</span>
                  </div>
                  {s.nombre === SECCION_COMBOS && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Paquetes armados para ahorrar</p>
                  )}
                </div>
                {s.nombre !== SECCION_COMBOS && (
                  <button type="button" onClick={() => irASeccion(s.nombre)} className="text-[11px] font-semibold text-[#0b1b36] hover:underline">
                    Ver todo
                  </button>
                )}
              </div>

              {s.nombre === SECCION_COMBOS ? (
                <div className="grid grid-cols-1 gap-3">
                  {s.items.map((p) => (
                    <TarjetaCombo key={p.productoId} producto={p} cantidad={carrito[p.productoId] ?? 0} onCambiar={cambiarCantidad} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {s.items.map((p) => (
                    <TarjetaProducto key={p.productoId} producto={p} cantidad={carrito[p.productoId] ?? 0} onCambiar={cambiarCantidad} />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>

      {/* Aviso flotante */}
      {aviso && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 max-w-[calc(100%-2rem)] rounded-lg bg-slate-900 text-white text-xs font-medium px-3.5 py-2 shadow-lg">
          {aviso}
        </div>
      )}

      {/* Barra flotante inferior */}
      {totalUnidades > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent">
          <button
            type="button"
            onClick={() => setMostrarCheckout(true)}
            className="mx-auto max-w-5xl w-full flex items-center gap-2.5 rounded-xl bg-[#0b1b36] text-white px-3.5 py-3 shadow-xl shadow-[#0b1b36]/25 active:scale-[0.99] transition-transform text-sm"
          >
            <span className="relative">
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-[9px] font-bold text-slate-900 flex items-center justify-center tabular-nums">
                {totalUnidades}
              </span>
            </span>
            <span className="flex-1 text-left font-semibold text-sm">Ver mi pedido</span>
            <span className="font-bold tabular-nums text-sm">{formatoSoles(total)}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Checkout */}
      {mostrarCheckout && (
        <CheckoutPedido
          tienda={tienda}
          mesaInicial={mesaInicial}
          lineas={lineas}
          total={total}
          onCambiarCantidad={cambiarCantidad}
          onCerrar={() => setMostrarCheckout(false)}
          onCreado={alCrearPedido}
          onCatalogoDesactualizado={recargarProductos}
        />
      )}
    </div>
  );
}

// ══════════════ COMPONENTES AUXILIARES ══════════════

function PantallaCentrada({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 px-6">{children}</div>
  );
}

function formatoHora12(hora?: string | null): string {
  if (!hora) return "";
  const partes = hora.split(":");
  const h = parseInt(partes[0], 10);
  const m = partes[1] ?? "00";
  if (isNaN(h)) return hora;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

const DIAS_CONFIG = [
  { num: 1, letra: "L", nombre: "Lunes" },
  { num: 2, letra: "M", nombre: "Martes" },
  { num: 3, letra: "X", nombre: "Miércoles" },
  { num: 4, letra: "J", nombre: "Jueves" },
  { num: 5, letra: "V", nombre: "Viernes" },
  { num: 6, letra: "S", nombre: "Sábado" },
  { num: 0, letra: "D", nombre: "Domingo" },
];

function PantallaCerrada({
  tienda,
  logoEmpresaUrl,
  tienePedidoEnCurso,
  onVerPedido,
  onReintentar,
}: {
  tienda: TiendaPublica;
  logoEmpresaUrl: string | null;
  tienePedidoEnCurso: boolean;
  onVerPedido: () => void;
  onReintentar?: () => Promise<void>;
}) {
  const [actualizando, setActualizando] = useState(false);

  const horaAperturaTexto = formatoHora12(tienda.horaApertura || "08:00");
  const horaCierreTexto = formatoHora12(tienda.horaCierre || "20:00");

  const diasHabilitados = useMemo(() => {
    if (!tienda.diasAtencion) return new Set([0, 1, 2, 3, 4, 5, 6]);
    const nums = tienda.diasAtencion
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return new Set(nums.length > 0 ? nums : [0, 1, 2, 3, 4, 5, 6]);
  }, [tienda.diasAtencion]);

  const sonTodosLosDias = diasHabilitados.size >= 7;

  const handleActualizar = async () => {
    if (actualizando || !onReintentar) return;
    setActualizando(true);
    try {
      await onReintentar();
    } finally {
      setTimeout(() => setActualizando(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1F49] via-[#071530] to-[#040b17] text-white flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950">
      {/* ── Top Bar de la Tienda ── */}
      <header className="border-b border-white/10 bg-[#0B1F49]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoEmpresaUrl ? (
              <div className="h-9 w-9 shrink-0 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-white/20 shadow-sm">
                <img src={logoEmpresaUrl} alt={tienda.nombreTienda} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-xl bg-[#1a3363] text-white flex items-center justify-center font-black text-sm border border-white/15">
                {tienda.nombreTienda.charAt(0) || "T"}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight uppercase leading-tight truncate text-white">
                {tienda.nombreTienda}
              </h1>
              {tienda.direccion && (
                <p className="text-[10px] text-blue-200/70 truncate">
                  {tienda.direccion.toUpperCase()}
                </p>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-medium shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Cerrado por ahora</span>
          </div>
        </div>
      </header>

      {/* ── Tarjeta Central Principal ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="relative w-full max-w-md mx-auto">
          {/* Luces de ambiente sutiles */}
          <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col gap-6">
            {/* Cabecera del aviso con Logo y Estado */}
            <div className="flex flex-col items-center text-center gap-3">
              {logoEmpresaUrl ? (
                <div className="h-20 w-20 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl border border-white/30">
                  <img src={logoEmpresaUrl} alt={tienda.nombreTienda} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-[#122e69] border border-cyan-400/30 text-amber-300 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Clock className="w-8 h-8" />
                </div>
              )}

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Fuera de horario de atención</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                  Por ahora estamos cerrados
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/90 max-w-md mx-auto leading-relaxed">
                  {tienda.mensajeCerrado && !tienda.mensajeCerrado.includes("temporalmente")
                    ? tienda.mensajeCerrado
                    : "En este momento no estamos recibiendo pedidos en línea. Consulta nuestros horarios y servicios a continuación para visitarnos o pedir al abrir."}
                </p>
              </div>
            </div>

            {/* Bloque Destacado: Horario de Atención */}
            <div className="rounded-2xl bg-[#07132a]/90 border border-white/10 p-4 sm:p-5 flex flex-col gap-3.5 shadow-inner">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Horario de atención
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {sonTodosLosDias ? "Todos los días" : "Días seleccionados"}
                </span>
              </div>

              {/* Rango de horas */}
              <div className="flex items-center justify-center gap-3 py-1">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Abre</p>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-tight">{horaAperturaTexto}</p>
                </div>
                <span className="text-amber-400/80 font-black text-lg px-1">—</span>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cierra</p>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-tight">{horaCierreTexto}</p>
                </div>
              </div>

              {/* Selector de días visual (L M X J V S D) */}
              <div className="flex flex-col items-center gap-2 pt-1 border-t border-white/10">
                <p className="text-[11px] text-slate-400 font-medium">
                  {sonTodosLosDias
                    ? `Atendemos todos los días de ${horaAperturaTexto} a ${horaCierreTexto}`
                    : "Días de atención en la semana:"}
                </p>
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  {DIAS_CONFIG.map((dia) => {
                    const activo = diasHabilitados.has(dia.num);
                    return (
                      <div
                        key={dia.num}
                        title={`${dia.nombre}: ${activo ? "Atiende" : "Cerrado"}`}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                          activo
                            ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                            : "bg-white/5 text-slate-500 border border-white/5"
                        }`}
                      >
                        {dia.letra}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Aviso de pedido previo si existe */}
            {tienePedidoEnCurso && (
              <button
                type="button"
                onClick={onVerPedido}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-400/40 text-white text-xs font-bold hover:bg-amber-500/25 transition-all shadow-lg shadow-amber-500/10"
              >
                <span className="flex items-center gap-2 text-amber-300">
                  <Receipt className="w-4 h-4" />
                  Tienes un pedido en curso · Ver seguimiento
                </span>
                <ChevronRight className="w-4 h-4 text-amber-300" />
              </button>
            )}

            {/* Botón de comprobación */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleActualizar}
                disabled={actualizando}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-400/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actualizando ? "animate-spin" : ""}`} />
                <span>{actualizando ? "Comprobando apertura…" : "Comprobar si ya abrió"}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-4 px-4 text-center text-xs text-slate-400">
        <p className="font-semibold text-slate-300">{tienda.nombreTienda}</p>
        {tienda.direccion && <p className="text-[11px] text-slate-500 mt-0.5">{tienda.direccion}</p>}
      </footer>
    </div>
  );
}

function ImagenProducto({ producto: p, className }: { producto: ProductoPublico; className: string }) {
  // Primero la variante liviana; si Cloudflare aún no la generó, la original.
  const [intento, setIntento] = useState<"thumbnail" | "original" | "fallo">("thumbnail");
  // Hasta que carga, la imagen va invisible: si no, el navegador pinta su texto
  // alternativo encima de la tarjeta mientras descarga.
  const [cargada, setCargada] = useState(false);
  const sinImagen = !p.urlImagen || intento === "fallo";

  return (
    <div className={`${className} relative flex items-center justify-center ${cargada ? "" : "bg-white"}`}>
      {sinImagen ? (
        <div className="flex flex-col items-center justify-center text-slate-300 gap-1 p-2 text-center">
          <ImageOff className="w-7 h-7" />
          <span className="text-[10px] text-slate-400 font-medium line-clamp-1">{p.nombre}</span>
        </div>
      ) : (
        <>
          {!cargada && <ImageIcon className="w-6 h-6 text-slate-300 animate-pulse" />}
          <img
            src={intento === "thumbnail" ? conVarianteImagen(p.urlImagen as string, "thumbnail") : (p.urlImagen as string)}
            alt={p.nombre}
            loading="lazy"
            decoding="async"
            onLoad={() => setCargada(true)}
            onError={() => {
              setCargada(false);
              setIntento((i) => (i === "thumbnail" ? "original" : "fallo"));
            }}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${cargada ? "opacity-100" : "opacity-0"}`}
          />
        </>
      )}
    </div>
  );
}

function TarjetaProducto({
  producto: p,
  cantidad,
  onCambiar,
}: {
  producto: ProductoPublico;
  cantidad: number;
  onCambiar: (p: ProductoPublico, delta: number) => void;
}) {
  const handleClickCard = () => {
    if (!p.disponible) return;
    onCambiar(p, 1);
  };

  return (
    <div
      onClick={handleClickCard}
      className={`bg-white rounded-2xl border overflow-hidden flex flex-col justify-between transition-all group select-none ${
        p.disponible ? "cursor-pointer active:scale-[0.98]" : "opacity-60 cursor-not-allowed"
      } ${
        cantidad > 0 ? "border-[#0b1b36] ring-1 ring-[#0b1b36]/20 shadow-sm" : "border-slate-200/90 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      {/* Área superior: Imagen con fondo blanco puro */}
      <div className="relative aspect-square w-full bg-white flex items-center justify-center p-2.5 overflow-hidden">
        <ImagenProducto producto={p} className="w-full h-full" />
        {p.porcentajeDescuento && p.disponible && (
          <span className="absolute top-2 left-2 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white z-10">
            <Tag className="w-2 h-2 inline mr-0.5" />-{p.porcentajeDescuento}%
          </span>
        )}
        {!p.disponible && (
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-slate-900/85 py-0.5 text-center text-[9px] font-semibold text-white z-10">
            Agotado
          </span>
        )}
      </div>

      {/* Footer inferior: Fondo suave donde sale el nombre, unidad y precio */}
      <div className="bg-slate-50 p-2 sm:p-2.5 border-t border-slate-100 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-snug line-clamp-2 min-h-7">{p.nombre}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
            {p.unidadMedida === "NIU" ? "Unidad" : (p.unidadMedida ?? "Unidad")}
          </p>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-1">
          <div className="min-w-0">
            {p.porcentajeDescuento && (
              <p className="text-[9px] text-slate-400 line-through tabular-nums leading-none">{formatoSoles(p.precioRegular)}</p>
            )}
            <p className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">{formatoSoles(p.precio)}</p>
          </div>

          {p.disponible && (
            cantidad === 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCambiar(p, 1);
                }}
                aria-label={`Agregar ${p.nombre}`}
                className="w-7 h-7 rounded-full bg-[#0b1b36] hover:bg-[#122852] text-white flex items-center justify-center active:scale-95 transition-all shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center rounded-full bg-[#0b1b36] text-white shrink-0"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCambiar(p, -1);
                  }}
                  aria-label="Quitar uno"
                  className="h-7 w-6 flex items-center justify-center hover:bg-white/10 rounded-l-full"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="min-w-4 text-center text-[11px] font-bold tabular-nums">{cantidad}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCambiar(p, 1);
                  }}
                  aria-label="Agregar uno"
                  className="h-7 w-6 flex items-center justify-center hover:bg-white/10 rounded-r-full"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaCombo({
  producto: p,
  cantidad,
  onCambiar,
}: {
  producto: ProductoPublico;
  cantidad: number;
  onCambiar: (p: ProductoPublico, delta: number) => void;
}) {
  const handleClickCard = () => {
    if (!p.disponible) return;
    onCambiar(p, 1);
  };

  return (
    <div
      onClick={handleClickCard}
      className={`bg-white rounded-xl border p-3 sm:p-3.5 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 transition-all select-none ${
        p.disponible ? "cursor-pointer active:scale-[0.99]" : "opacity-60 cursor-not-allowed"
      } ${
        cantidad > 0 ? "border-amber-400 ring-1 ring-amber-300/50 shadow-md" : "border-amber-200/90 hover:shadow-md"
      }`}
    >
      <div className="relative w-full sm:w-28 aspect-[16/9] sm:aspect-square shrink-0 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center p-1.5 overflow-hidden">
        <ImagenProducto producto={p} className="w-full h-full" />
      </div>

      <div className="flex-1 min-w-0 space-y-1 text-left w-full">
        <div className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-950 uppercase tracking-wide">
          <Sparkles className="w-2.5 h-2.5" /> Combo
        </div>
        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2">{p.nombre}</h3>
        {p.incluye.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-slate-500 font-medium">
            {p.incluye.map((item, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                <span className="truncate">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
        <div>
          {p.porcentajeDescuento && (
            <p className="text-[10px] text-slate-400 line-through tabular-nums">{formatoSoles(p.precioRegular)}</p>
          )}
          <p className="text-lg sm:text-xl font-black text-[#0b1b36] tabular-nums">{formatoSoles(p.precio)}</p>
        </div>

        {cantidad === 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCambiar(p, 1);
            }}
            className="px-4 py-1.5 rounded-full bg-[#0b1b36] hover:bg-[#122852] text-white text-xs font-semibold transition-all active:scale-95 shadow-sm"
          >
            Agregar
          </button>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center rounded-full bg-[#0b1b36] text-white"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCambiar(p, -1);
              }}
              aria-label="Quitar uno"
              className="h-7 w-7 flex items-center justify-center hover:bg-white/10 rounded-l-full"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="min-w-5 text-center text-xs font-bold tabular-nums">{cantidad}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCambiar(p, 1);
              }}
              aria-label="Agregar uno"
              className="h-7 w-7 flex items-center justify-center hover:bg-white/10 rounded-r-full"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
