"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  ArrowRight,
  Store,
  Search,
  Trash2,
  Plus,
  Minus,
  PackageSearch,
  UserRound,
  Loader2,
  AlertTriangle,
  Receipt,
  FileText,
  ImageOff,
  ImageIcon,
  CheckCircle2,
  Printer,
  Download,
  Send,
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
  MoreHorizontal,
  CalendarClock,
  Columns3,
  HandCoins,
  Tag,
  X,
  ScanBarcode,
  Check,
  CameraOff,
  ShoppingBag,
  WifiOff,
  PackagePlus,
  RefreshCw,
  Zap,
  Minimize2,
  Maximize2,
  AlertCircle,
  GripHorizontal,
} from "lucide-react";

import { scanImageData } from "@undecaf/zbar-wasm";

import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
import { useCategoriasLista } from "@/app/factufly/productos/gestioProductos/useCategoriasLista";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import { abreviaturaUnidad, formatearCantidadUnidad } from "@/app/factufly/productos/gestioProductos/unidadMedida";
import ImagenProductoCuadrada from "@/app/factufly/operaciones/components/ImagenProductoCuadrada";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { Modal } from "@/app/components/ui/Modal";
import { useClienteBoleta } from "@/app/factufly/operaciones/boleta/gestionBoletas/useClienteBoleta";
import { useEmpresaEmisor } from "@/app/factufly/operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { avisarStockBajoWhatsapp } from "@/app/factufly/productos/gestioProductos/stockAlerta";
import { useToast } from "@/app/components/ui/Toast";
import { coincideBusqueda, normalizarTexto } from "@/app/utils/normalizarTexto";
import {
  generarXml,
  enviarASunatApi,
  crearNotaVenta,
  esErrorTransitorio,
} from "@/app/factufly/operaciones/boleta/gestionBoletas/emitirBoletaApi";
import { useOfflineSales } from "@/app/components/offline/OfflineSalesProvider";
import { construirHtmlTicket, imprimirTicketProvisional } from "@/app/factufly/operaciones/components/TicketProvisional";
import { detectarAgente, imprimirHtmlConAgente } from "@/lib/impresion/agente";
import { cacheProductos } from "@/lib/offline/offlineDb";
import ModalAjustarStockRapido from "@/app/factufly/operaciones/components/ModalAjustarStockRapido";
import ModalCrearProductoRapido from "@/app/factufly/operaciones/components/ModalCrearProductoRapido";
import VentasRapidas from "@/app/factufly/operaciones/components/VentasRapidas";
import { iniciarEmisionSegundoPlano, terminarEmisionSegundoPlano } from "@/lib/eventosCaja";

interface MedioPagoOpcion {
  nombre: string;
  imagen: string;
  icon: typeof Banknote;
  activo: string;
}

const MEDIOS_PAGO: MedioPagoOpcion[] = [
  {
    nombre: "Efectivo",
    imagen: "/mediosPago/billetes.jpg",
    icon: Banknote,
    activo: "border-emerald-500 ring-2 ring-emerald-500/30",
  },
  {
    nombre: "Tarjeta",
    imagen: "/mediosPago/tarjeta.jpg",
    icon: CreditCard,
    activo: "border-brand-blue ring-2 ring-brand-blue/30",
  },
  {
    nombre: "Yape",
    imagen: "/mediosPago/yape.jpg?v=2",
    icon: Smartphone,
    activo: "border-violet-500 ring-2 ring-violet-500/30",
  },
  {
    nombre: "Plin",
    imagen: "/mediosPago/plin.jpg?v=2",
    icon: Smartphone,
    activo: "border-sky-500 ring-2 ring-sky-500/30",
  },
  {
    nombre: "Transferencia",
    imagen: "/mediosPago/transferencia.jpg",
    icon: Landmark,
    activo: "border-emerald-500 ring-2 ring-emerald-500/30",
  },
  {
    nombre: "Otro",
    imagen: "/mediosPago/otro.svg",
    icon: MoreHorizontal,
    activo: "border-gray-500 ring-2 ring-gray-400/30",
  },
];

const MONTOS_RAPIDOS = [5, 10, 20, 50, 100, 200];
function obtenerMontosRapidos(total: number): number[] {
  if (total <= 0) return [5, 10, 20, 50, 100, 200];
  const billetes = [5, 10, 20, 30, 40, 50, 100, 200];
  const opciones: number[] = [];

  const enteroSup = Math.ceil(total);
  if (enteroSup > total && enteroSup !== total) {
    opciones.push(enteroSup);
  }

  for (const b of billetes) {
    if (b > total && !opciones.includes(b)) {
      opciones.push(b);
    }
  }

  if (opciones.length < 3) {
    const prox50 = Math.ceil((total + 1) / 50) * 50;
    if (prox50 > total && !opciones.includes(prox50)) opciones.push(prox50);
    const prox100 = Math.ceil((total + 1) / 100) * 100;
    if (prox100 > total && !opciones.includes(prox100)) opciones.push(prox100);
  }

  return opciones.slice(0, 5);
}
const TAMANO_MAP: Record<"80" | "58" | "A4", string> = { "80": "Ticket80mm", "58": "Ticket58mm", A4: "A4" };

export interface ItemCarrito {
  key: string;
  productoId: number;
  sucursalProductoId: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  cantidadStr?: string;
  precio: number; // precio de venta (con IGV incluido)
  precioStr?: string;
  tipoAfectacionIGV: string;
  urlImagen: string | null;
  unidadMedida: string;
  tipoProducto: string | null;
  tieneVencido: boolean;
}

export const SIN_RESERVAS: ItemCarrito[] = [];

export const VENTAS_RAPIDAS_CONFIG = [
  { key: "F1", label: "Venta rápida 1", color: "bg-brand-blue", hoverColor: "hover:bg-[#0a2050]", shadowColor: "rgba(15,46,100,0.7)" },
  { key: "F2", label: "Venta rápida 2", color: "bg-brand-blue", hoverColor: "hover:bg-[#0a2050]", shadowColor: "rgba(15,46,100,0.7)" },
  { key: "F3", label: "Venta rápida 3", color: "bg-brand-blue", hoverColor: "hover:bg-[#0a2050]", shadowColor: "rgba(15,46,100,0.7)" },
  { key: "F4", label: "Venta rápida 4", color: "bg-brand-blue", hoverColor: "hover:bg-[#0a2050]", shadowColor: "rgba(15,46,100,0.7)" },
] as const;

/** Info de una venta rápida que la caja principal necesita para sus botones/barras. */
export interface VentaRapidaInfo {
  configIndex: number;
  items: number;
  total: number;
  minimizada: boolean;
  montada: boolean;
  onAbrir: () => void;
}


const precioConDescuento = (p: ProductoSucursal) => {
  const base = p.sucursalProducto.precioUnitario ?? 0;
  const { enPromocion, porcentajeDescuento } = p.sucursalProducto;
  if (enPromocion && porcentajeDescuento) {
    return base * (1 - porcentajeDescuento / 100);
  }
  return base;
};


function calcularDisponible(
  p: ProductoSucursal,
  cartItems: ItemCarrito[],
  allProducts: ProductoSucursal[],
  isStock: boolean,
  productsMap?: Map<number, ProductoSucursal>,
): number | null {
  if (!isStock || p.tipoProducto !== "BIEN") return null;
  const baseId = p.esPaquete && p.productoBaseId ? p.productoBaseId : p.productoId;
  const baseProd = p.esPaquete && p.productoBaseId
    ? (productsMap ? productsMap.get(p.productoBaseId) : allProducts.find((x) => x.productoId === p.productoBaseId))
    : p;
  const stockBase = baseProd?.sucursalProducto?.stock ?? 0;
  if (cartItems.length === 0) {
    if (p.esPaquete && p.factorConversion && p.factorConversion > 0) {
      return Math.floor(stockBase / p.factorConversion);
    }
    return stockBase;
  }
  const comprometido = cartItems.reduce((total, it) => {
    if (it.tipoProducto !== "BIEN") return total;
    const itProd = productsMap ? productsMap.get(it.productoId) : allProducts.find((x) => x.productoId === it.productoId);
    if (!itProd) return total;
    const itBaseId = itProd.esPaquete && itProd.productoBaseId ? itProd.productoBaseId : itProd.productoId;
    if (itBaseId !== baseId) return total;
    return total + (itProd.esPaquete && itProd.factorConversion ? it.cantidad * itProd.factorConversion : it.cantidad);
  }, 0);
  const disponibleBase = Math.max(0, stockBase - comprometido);
  if (p.esPaquete && p.factorConversion && p.factorConversion > 0) {
    return Math.floor(disponibleBase / p.factorConversion);
  }
  return disponibleBase;
}

// Retroalimentación háptica (vibración) y acústica ('bip') al escanear con la cámara del celular
function emitirBeepEscaneo() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([60, 30, 60]);
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch {
    /* ignore */
  }
}

function emitirBeepError() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(150);
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {
    /* ignore */
  }
}

// Coincidencia inteligente de código de barras o código interno:
// 1. Exacto (case-insensitive, trimmed)
// 2. Numérico puro ignorando TODOS los ceros a la izquierda (ej. '007500435247634' vs '07500435247634' vs '7500435247634')
// 3. Substring numérico o por palabras (igual que en lista de productos)
function coincideCodigoOBarras(p: ProductoSucursal, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return false;

  const cb = p.codigoBarras?.trim().toLowerCase() ?? "";
  const cod = p.codigo?.trim().toLowerCase() ?? "";

  // 1. Coincidencia exacta directa
  if (cb === query || cod === query) return true;

  // 2. Coincidencia numérica pura ignorando ceros a la izquierda ('00...' vs '0...' vs '...')
  const qDigits = query.replace(/\D/g, "");
  const qSinCeros = qDigits.replace(/^0+/, "");

  const cbDigits = cb.replace(/\D/g, "");
  const cbSinCeros = cbDigits.replace(/^0+/, "");

  const codDigits = cod.replace(/\D/g, "");
  const codSinCeros = codDigits.replace(/^0+/, "");

  // Si ambos números sin ceros iniciales coinciden (mínimo 3 dígitos)
  if (qSinCeros.length >= 3) {
    if (cbSinCeros && cbSinCeros === qSinCeros) return true;
    if (codSinCeros && codSinCeros === qSinCeros) return true;
  }

  // Si con ceros coinciden (ej. '001' vs '001')
  if (qDigits.length >= 3) {
    if (cbDigits && cbDigits === qDigits) return true;
    if (codDigits && codDigits === qDigits) return true;
  }

  // 3. Si el código de barras o código contiene el término escaneado como substring
  if (qSinCeros.length >= 4) {
    if (cbSinCeros && (cbSinCeros.includes(qSinCeros) || qSinCeros.includes(cbSinCeros))) return true;
    if (codSinCeros && (codSinCeros.includes(qSinCeros) || qSinCeros.includes(codSinCeros))) return true;
  }

  // 4. Normalizado sin acentos ni espacios
  if (
    normalizarTexto(cb) === normalizarTexto(query) ||
    normalizarTexto(cod) === normalizarTexto(query)
  ) {
    return true;
  }

  // 5. Coincidencia flexible de búsqueda (como en la lista de productos)
  if (coincideBusqueda(query, p.codigoBarras, p.codigo, p.nomProducto)) {
    return true;
  }

  return false;
}


function coincideCodigoExacto(p: ProductoSucursal, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return false;

  const cb = p.codigoBarras?.trim().toLowerCase() ?? "";
  const cod = p.codigo?.trim().toLowerCase() ?? "";

  // 1. Coincidencia exacta directa (solo si el código no está vacío)
  if ((cb && cb === query) || (cod && cod === query)) return true;

  // 2. Coincidencia numérica pura sin ceros iniciales
  const qDigits = query.replace(/\D/g, "");
  const qSinCeros = qDigits.replace(/^0+/, "");
  const cbDigits = cb.replace(/\D/g, "");
  const cbSinCeros = cbDigits.replace(/^0+/, "");
  const codDigits = cod.replace(/\D/g, "");
  const codSinCeros = codDigits.replace(/^0+/, "");

  if (qSinCeros && qSinCeros.length >= 3) {
    if (cbSinCeros && cbSinCeros === qSinCeros) return true;
    if (codSinCeros && codSinCeros === qSinCeros) return true;
  }
  if (qDigits && qDigits.length >= 3) {
    if (cbDigits && cbDigits === qDigits) return true;
    if (codDigits && codDigits === qDigits) return true;
  }

  // 3. Normalizado sin acentos
  if (
    (cb && normalizarTexto(cb) === normalizarTexto(query)) ||
    (cod && normalizarTexto(cod) === normalizarTexto(query))
  ) {
    return true;
  }

  return false;
}


const GRID_IMG_SIZES =
  "(min-width: 1536px) 12.5vw, (min-width: 1280px) 14.3vw, (min-width: 1024px) 16.7vw, (min-width: 768px) 20vw, (min-width: 640px) 25vw, 33.3vw";

const ProductoGridCard = memo(function ProductoGridCard({
  p,
  cantidadEnCarrito = 0,
  stockDisp = null,
  onClick,
  index = 99,
}: {
  p: ProductoSucursal;
  cantidadEnCarrito?: number;
  stockDisp?: number | null;
  onClick: () => void;
  /** Posición en el grid: las primeras 8 se cargan de inmediato. */
  index?: number;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  // Las primeras 8 tarjetas (primera fila visible) arrancan como visibles;
  // el resto empieza oculto hasta que IntersectionObserver lo detecte.
  const [isInView, setIsInView] = useState(index < 8);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // IntersectionObserver por tarjeta: la <img> NO se monta en el DOM hasta que
  // la tarjeta entre al viewport. Así el navegador no descarga ninguna imagen
  // que no sea visible — las tarjetas (nombre + precio) aparecen al instante y
  // las fotos van cargando una por una al hacer scroll (como Falabella).
  useEffect(() => {
    if (isInView) return; // ya visible, no necesita observer
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isInView]);

  const tieneImagen = !!p.urlImagenProducto && !imgError;
  const enOferta = !!p.sucursalProducto.enPromocion && !!p.sucursalProducto.porcentajeDescuento;
  const seleccionado = cantidadEnCarrito > 0;
  const hoy = new Date().toISOString().split("T")[0];
  const vencido = !!p.sucursalProducto.proximoVencimiento && p.sucursalProducto.proximoVencimiento < hoy;

  // Solo montar el <img> cuando la tarjeta está en el viewport
  const mostrarImg = tieneImagen && isInView;

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      className={`group relative flex flex-col rounded-md border transition-all text-left overflow-hidden ${
        seleccionado
          ? "border-gray-100 bg-[#008000]/5"
          : "border-gray-100 bg-white hover:border-brand-blue hover:shadow-md active:scale-[0.97]"
      }`}
    >
      <div className="aspect-square w-full bg-white flex items-center justify-center overflow-hidden relative p-2">
        {mostrarImg ? (
          <img
            src={conVarianteImagen(p.urlImagenProducto as string, "thumbnail")}
            alt={p.nomProducto}
            decoding="async"
            fetchPriority={index < 8 ? "high" : "auto"}
            sizes={GRID_IMG_SIZES}
            className={`w-full h-full object-contain group-hover:scale-105 transition-all duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : tieneImagen ? (
          /* Placeholder liviano mientras la tarjeta no está en el viewport (0 peticiones de red) */
          <div className="w-full h-full bg-white rounded flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-gray-300/70 animate-pulse" />
          </div>
        ) : (
          <ImageOff className="w-5 h-5 text-gray-300" />
        )}

        {/* Badge de Stock en forma de etiqueta/cinta en la parte superior derecha */}
        {stockDisp !== null && stockDisp !== undefined && (
          <span
            className={`absolute top-0 right-2 flex items-center justify-center gap-0.5 px-1.5 pt-0.5 pb-0.5 rounded-b-md text-[9px] font-bold text-white z-10 shadow-xs tabular-nums ${
              stockDisp <= 0
                ? "bg-rose-600"
                : stockDisp <= 5
                  ? "bg-red-500"
                  : stockDisp <= 10
                    ? "bg-[#ca5310]"
                    : "bg-[#007200]"
            }`}
            title={`Stock disponible: ${p.esPaquete ? `${stockDisp} und.` : `${formatearCantidadUnidad(stockDisp, p.unidadMedida)} ${abreviaturaUnidad(p.unidadMedida)}`}`}
          >
            {p.esPaquete ? `${stockDisp} und.` : `${formatearCantidadUnidad(stockDisp, p.unidadMedida)} ${abreviaturaUnidad(p.unidadMedida)}`}
          </span>
        )}

        {enOferta && (
          <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white z-10">
            <Tag className="w-2.5 h-2.5" /> -{p.sucursalProducto.porcentajeDescuento}%
          </span>
        )}
        {vencido && (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white z-10">
            <AlertTriangle className="w-2.5 h-2.5" /> Vencido
          </span>
        )}
      </div>
      <div className={`p-1 flex-1 w-full ${seleccionado ? "bg-[#008000]/10" : "bg-gray-50"}`}>
        <p className={`text-[11px] font-semibold line-clamp-1 leading-tight ${seleccionado ? "text-[#008000] font-bold" : "text-gray-800"}`}>
          {p.nomProducto}
        </p>
        {enOferta ? (
          <>
            <p className="text-[9px] text-gray-400 line-through leading-tight tabular-nums">
              S/ {(p.sucursalProducto.precioUnitario ?? 0).toFixed(2)}
            </p>
            <p className="text-xs font-bold text-orange-500 leading-tight tabular-nums">
              S/ {precioConDescuento(p).toFixed(2)}
            </p>
          </>
        ) : (
          <p className="text-xs font-bold text-brand-blue mt-0.5 tabular-nums">
            S/ {(p.sucursalProducto.precioUnitario ?? 0).toFixed(2)}
          </p>
        )}
      </div>
    </button>
  );
});

// Recursos que las dos cajas simultáneas COMPARTEN: catálogo/stock, sucursal
// (serie y correlativo), empresa emisora y categorías. Se cargan una sola vez en
// <CajaAutopago /> y se pasan a cada vista. Si cada caja tuviera su propia copia,
// la venta rápida y la principal mostrarían stock distinto del mismo producto y
// podrían vender dos veces la última unidad.
export interface RecursosCaja {
  productos: ReturnType<typeof useProductosSucursal>;
  recursoSucursal: ReturnType<typeof useSucursal>;
  recursoEmpresa: ReturnType<typeof useEmpresaEmisor>;
  recursoCategorias: ReturnType<typeof useCategoriasLista>;
  ultimaRevalidacionRef: { current: number };
}

export interface CajaAutopagoVistaProps {
  recursos: RecursosCaja;
  /** Solo la caja enfocada escucha el teclado global y usa la cámara. */
  activo: boolean;
  /** true cuando esta vista es la ventana emergente de venta rápida. */
  esRapida?: boolean;
  /** Carrito de TODAS las otras cajas: sus unidades ya están comprometidas. */
  reservasOtraCaja: ItemCarrito[];
  /** Publica el carrito propio para que las otras cajas lo descuenten. */
  onCarritoCambio: (items: ItemCarrito[]) => void;
  /** Info de las ventas rápidas (solo en la caja principal). */
  ventasRapidas?: VentaRapidaInfo[];
  /** Avisa al contenedor que el cajero cerró esta venta con "Nueva venta". */
  onVentaTerminada?: () => void;
}

export function CajaAutopagoVista({
  recursos,
  activo,
  esRapida = false,
  reservasOtraCaja,
  onCarritoCambio,
  ventasRapidas,
  onVentaTerminada,
}: CajaAutopagoVistaProps) {
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const { showToast } = useToast();

  const sucursalId = user?.sucursalID ? parseInt(user.sucursalID) : null;
  const {
    productosSucursal,
    loadingSucursal,
    setProductosSucursal,
    fetchProductosSucursal,
    descontarStockLocal,
    productosDesactualizados,
    fechaCache,
  } = recursos.productos;
  const ultimaRevalidacionRef = recursos.ultimaRevalidacionRef;

  // Mapa de productos por ID para lookups O(1) de paquetes/stock
  const productosPorId = useMemo(() => {
    return new Map(productosSucursal.map((p) => [p.productoId, p]));
  }, [productosSucursal]);
  const { empresa } = recursos.recursoEmpresa;
  const { sucursal, fetchSucursal } = recursos.recursoSucursal;
  const { cliente, loadingCliente, errorCliente, buscarCliente } = useClienteBoleta();
  const { categorias } = recursos.recursoCategorias;
  const { enqueueVenta, isOnline } = useOfflineSales();
  const [offlineEncolada, setOfflineEncolada] = useState(false);
  const [ultimoTicketOffline, setUltimoTicketOffline] = useState<
    Parameters<typeof imprimirTicketProvisional>[0] | null
  >(null);

 

  const [items, setItems] = useState<ItemCarrito[]>([]);
  const itemsRef = useRef<ItemCarrito[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);


  const reservasRef = useRef<ItemCarrito[]>(reservasOtraCaja);
  useEffect(() => { reservasRef.current = reservasOtraCaja; });

  const itemsMasReservas = useMemo(
    () => (reservasOtraCaja.length ? [...items, ...reservasOtraCaja] : items),
    [items, reservasOtraCaja],
  );
  // Versión para callbacks/efectos, que leen el carrito por ref y no por render.
  const carritoConReservas = useCallback(
    () => (reservasRef.current.length ? [...itemsRef.current, ...reservasRef.current] : itemsRef.current),
    [],
  );
  const [ultimoItemAgregadoKey, setUltimoItemAgregadoKey] = useState<string | null>(null);
  const cartContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileCartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ultimoItemAgregadoKey) {
      cartContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      mobileCartContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      const timer = setTimeout(() => {
        setUltimoItemAgregadoKey(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ultimoItemAgregadoKey]);

  const [busqueda, setBusqueda] = useState("");
  const [confirmarLimpiarTodo, setConfirmarLimpiarTodo] = useState(false);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [mostrarCarritoMobile, setMostrarCarritoMobile] = useState(false);
  const [documento, setDocumento] = useState("");
  const [nombreManualCliente, setNombreManualCliente] = useState("");
  const [direccionManualCliente, setDireccionManualCliente] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState<"Boleta" | "Nota de Venta" | "Factura">("Boleta");
  const [productoSinStock, setProductoSinStock] = useState<ProductoSucursal | null>(null);
  const [modalCrearRapidoAbierto, setModalCrearRapidoAbierto] = useState(false);
  const [codigoBarrasNuevoProducto, setCodigoBarrasNuevoProducto] = useState("");
  const [nombreNuevoProducto, setNombreNuevoProducto] = useState("");
  const [historialVentasVersion, setHistorialVentasVersion] = useState(0);
  const [refrescandoStock, setRefrescandoStock] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const montoInputRef = useRef<HTMLInputElement>(null);
  const tipoSinDocInitRef = useRef(false);
  const abrirPagoRef = useRef<() => void>(() => {});
  const modalAbiertoAtRef = useRef<number>(0);

  // Estados de pago y emisión
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [emitido, setEmitido] = useState(false);
  const emitidoRef = useRef(emitido);
  useEffect(() => {
    emitidoRef.current = emitido;
  }, [emitido]);
  const [totalEmitido, setTotalEmitido] = useState(0);
  const [comprobanteIdEmitido, setComprobanteIdEmitido] = useState<number | null>(null);
  const [serieCorrelativoEmitido, setSerieCorrelativoEmitido] = useState<string | null>(null);
  const [medioPagoEmitido, setMedioPagoEmitido] = useState("Efectivo");
  const [vueltoEmitido, setVueltoEmitido] = useState(0);
  const [imprimiendo, setImprimiendo] = useState(false);
  // Cuál de los tres botones se pulsó, para que el spinner salga solo en ese
  // y no en los tres a la vez.
  const [tamanoImprimiendo, setTamanoImprimiendo] = useState<"80" | "58" | "A4" | null>(null);
  // Comprobantes ya descargados de la API, por id y tamaño. La BD es remota y
  // cada descarga cuesta cientos de ms: sin esto, reimprimir o cambiar de
  // tamaño vuelve a pagar la espera completa.
  const comprobantesDescargados = useRef(new Map<string, Blob>());
  const [telWhatsapp, setTelWhatsapp] = useState("");
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);
  const [mostrarFechaManual, setMostrarFechaManual] = useState(false);
  const [fechaEmisionManual, setFechaEmisionManual] = useState("");
  const [pagoDividido, setPagoDividido] = useState(false);
  const [pagosDivididos, setPagosDivididos] = useState<
    { id: string; medioPago: string; monto: string }[]
  >([]);
  const [esCredito, setEsCredito] = useState(false);
  const [adelantoCredito, setAdelantoCredito] = useState("");
  const [numeroCuotasCredito, setNumeroCuotasCredito] = useState(1);
  const [cuotasCredito, setCuotasCredito] = useState<
    { numeroCuota: string; monto: string; fechaVencimiento: string }[]
  >([]);

  // Focus en el buscador cuando se muestra la pantalla de éxito (para escanear el sgte producto directo)
  useEffect(() => {
    if (emitido && activo) {
      const isMobile =
        typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
      if (!isMobile) {
        inputRef.current?.focus({ preventScroll: true });
      }
    }
  }, [emitido, activo]);

  const resetearEstadoVenta = useCallback(() => {
    setDocumento("");
    setNombreManualCliente("");
    setDireccionManualCliente("");
    setTipoComprobante(config?.useNotaVenta && config?.isBoletaOrFactura === "n" ? "Nota de Venta" : "Boleta");
    setMedioPago("Efectivo");
    setMontoRecibido("");
    setNotaPago("");
    setMostrarFechaManual(false);
    setFechaEmisionManual("");
    setPagoDividido(false);
    setPagosDivididos([]);
    setEsCredito(false);
    setAdelantoCredito("");
    setNumeroCuotasCredito(1);
    setCuotasCredito([]);
    setTelWhatsapp("");
    setComprobanteIdEmitido(null);
    setSerieCorrelativoEmitido(null);
    setOfflineEncolada(false);
    setUltimoTicketOffline(null);
    setTamanoImprimiendo(null);
    // Los comprobantes de la venta anterior ya no se van a reimprimir.
    comprobantesDescargados.current.clear();
    setMostrarPago(false);
    setMostrarCarritoMobile(false);
    setConfirmarLimpiarTodo(false);
    setBusqueda("");
    setEmitido(false);
    emitidoRef.current = false;
    fetchProductosSucursal();
  }, [config?.useNotaVenta, config?.isBoletaOrFactura, fetchProductosSucursal]);

  const nuevaVenta = useCallback(() => {
    setItems([]);
    resetearEstadoVenta();
    setTimeout(() => {
      const isMobile =
        typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
      if (!isMobile && activo) {
        inputRef.current?.focus({ preventScroll: true });
      }
    }, 50);
    onVentaTerminada?.();
  }, [resetearEstadoVenta, activo, onVentaTerminada]);

  const registrarVentaReciente = useCallback(
    (soldItems: { productoId: number }[]) => {
      if (!soldItems || soldItems.length === 0) return;
      try {
        const key = `factufly_recientes_venta_${sucursalId || "default"}`;
        const raw = localStorage.getItem(key);
        const data: Record<number, { timestamp: number; count: number }> = raw ? JSON.parse(raw) : {};
        const now = Date.now();
        for (const item of soldItems) {
          if (!item.productoId) continue;
          const prev = data[item.productoId] || { timestamp: 0, count: 0 };
          data[item.productoId] = {
            timestamp: now,
            count: (prev.count || 0) + 1,
          };
        }
        localStorage.setItem(key, JSON.stringify(data));
        setHistorialVentasVersion((v) => v + 1);
      } catch {
        // ignore
      }
    },
    [sucursalId],
  );

  // ── Cámara Escáner de Código de Barras (Móvil / Web) ───────────────
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ultimoEscaneadoCamara, setUltimoEscaneadoCamara] = useState<{
    nombre: string;
    precio: number;
    exito: boolean;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const timerBannerCamaraRef = useRef<NodeJS.Timeout | null>(null);

  // ── Agregar / quitar / cantidad ──────────────────────────────
  const agregarProducto = useCallback((p: ProductoSucursal) => {
    const hoy = new Date().toISOString().split("T")[0];
    const tieneVencido = !!p.sucursalProducto.proximoVencimiento && p.sucursalProducto.proximoVencimiento < hoy;
    if (tieneVencido) {
      showToast("⚠ Este producto tiene lotes vencidos sin retirar del inventario", "error");
    }

    const eraEmitido = emitidoRef.current;
    if (eraEmitido) {
      resetearEstadoVenta();
      onVentaTerminada?.();
    }

    setItems((prev) => {
      const baseItems = eraEmitido ? [] : prev;
      const disp = calcularDisponible(
        p,
        reservasRef.current.length ? [...baseItems, ...reservasRef.current] : baseItems,
        productosSucursal,
        config?.isStock ?? false,
        productosPorId,
      );
      if (disp !== null && disp <= 0) {
        setProductoSinStock(p);
        return baseItems;
      }

      const idx = baseItems.findIndex((i) => i.productoId === p.productoId);
      if (idx !== -1) {
        // Re-adding a product already in cart: check stock before incrementing
        if (disp !== null && disp < 1) {
          showToast(`Stock insuficiente: solo quedan ${parseFloat(disp.toFixed(3))} disponibles de "${p.nomProducto}"`, "info");
          return baseItems;
        }
        const itemActualizado = { ...baseItems[idx], cantidad: baseItems[idx].cantidad + 1 };
        setUltimoItemAgregadoKey(itemActualizado.key);
        // Ponemos el producto actualizado al inicio de la lista para que el cajero lo vea al instante
        const otros = baseItems.filter((_, i) => i !== idx);
        return [itemActualizado, ...otros];
      }

      // New product: cap initial quantity at available stock if less than 1
      const cantidadInicial = disp !== null && disp < 1 ? parseFloat(disp.toFixed(3)) : 1;
      const nuevoItem = {
        key: crypto.randomUUID(),
        productoId: p.productoId,
        sucursalProductoId: p.sucursalProducto.sucursalProductoId,
        codigo: p.codigo,
        descripcion: p.nomProducto,
        cantidad: cantidadInicial,
        precio: precioConDescuento(p),
        tipoAfectacionIGV: p.tipoAfectacionIGV,
        urlImagen: p.urlImagenProducto ?? null,
        unidadMedida: p.unidadMedida ?? "NIU",
        tipoProducto: p.tipoProducto,
        tieneVencido,
      };
      setUltimoItemAgregadoKey(nuevoItem.key);
      return [nuevoItem, ...baseItems];
    });

    setBusqueda("");
    const isMobile =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
    if (!isMobile && activo) {
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
    }
  }, [showToast, config?.isStock, productosSucursal, productosPorId, resetearEstadoVenta, onVentaTerminada, activo]);

  const handleStockGuardado = useCallback(
    (productoActualizado: ProductoSucursal, autoAgregar: boolean) => {
      setProductosSucursal((prev) => {
        const next = prev.map((p) =>
          p.productoId === productoActualizado.productoId ? productoActualizado : p,
        );
        if (sucursalId) cacheProductos(Number(sucursalId), next).catch(() => {});
        return next;
      });
      if (autoAgregar) {
        agregarProducto(productoActualizado);
      }
      fetchProductosSucursal().catch(() => {});
    },
    [agregarProducto, setProductosSucursal, sucursalId, fetchProductosSucursal],
  );

  const handleProductoCreado = useCallback(
    (nuevoProducto: ProductoSucursal) => {
      setProductosSucursal((prev) => {
        const next = [nuevoProducto, ...prev.filter((p) => p.productoId !== nuevoProducto.productoId)];
        if (sucursalId) cacheProductos(Number(sucursalId), next).catch(() => {});
        return next;
      });
      agregarProducto(nuevoProducto);
      fetchProductosSucursal().catch(() => {});
    },
    [agregarProducto, setProductosSucursal, sucursalId, fetchProductosSucursal],
  );

  const stopScanning = useCallback(async () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraError(null);
    setIsScanning(false);
  }, []);

  // Al perder el foco (se abrió la otra caja) esta vista suelta la cámara: el
  // navegador entrega un solo stream de video y el escáner de la caja activa
  // se quedaría sin imagen.
  useEffect(() => {
    if (!activo && isScanning) stopScanning();
  }, [activo, isScanning, stopScanning]);

  // Limpieza al desmontar el componente: apagar la cámara y detener el loop de escaneo
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const buscarEnServidor = useCallback(
    async (queryStr: string): Promise<ProductoSucursal[]> => {
      const q = queryStr.trim();
      if (!sucursalId || !accessToken || !q) return [];
      try {
        const res = await axios.get<ProductoSucursal[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/buscar/${sucursalId}?palabra=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (Array.isArray(res.data) && res.data.length > 0) {
          setProductosSucursal((prev) => {
            const map = new Map(prev.map((p) => [p.productoId, p]));
            res.data.forEach((p) => map.set(p.productoId, p));
            return Array.from(map.values());
          });
          return res.data;
        }
        return [];
      } catch (err) {
        // Un 404 es esperado: el producto no existe en el servidor. No es un
        // error real, así que no se registra (evita el overlay de Next.js y el
        // "Issue"); la ausencia de resultados ya se avisa con la alerta propia.
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status !== 404) {
          console.warn("Búsqueda remota de productos falló:", err);
        }
        return [];
      }
    },
    [sucursalId, accessToken, setProductosSucursal],
  );

  const processScannedBarcode = useCallback(
    async (decodedText: string) => {
      const code = decodedText.trim().toLowerCase();
      if (!code) return;

      const now = Date.now();
      // Cooldown de 2.5s para el MISMO código (evita duplicar unidades al sostener la cámara sobre el mismo producto en el celular).
      // Si cambia de producto (código diferente), escanea de inmediato.
      if (lastScannedCodeRef.current.code === code && now - lastScannedCodeRef.current.time < 2500) {
        return;
      }
      lastScannedCodeRef.current = { code, time: now };

      // Coincidencia estricta por código (exacto o ignorando ceros iniciales)
      let p = productosSucursal.find((prod) => coincideCodigoExacto(prod, code));

      if (!p) {
        const remotos = await buscarEnServidor(code);
        if (remotos.length > 0) {
          p = remotos.find((prod) => coincideCodigoExacto(prod, code));
        }
      }

      if (p) {
        if (config?.isStock && p.tipoProducto === "BIEN") {
          const disp = calcularDisponible(p, carritoConReservas(), productosSucursal, true);
          if (disp !== null && disp <= 0) {
            emitirBeepError();
            setProductoSinStock(p);
            return;
          }
        }
        agregarProducto(p);
        emitirBeepEscaneo();

        setUltimoEscaneadoCamara({
          nombre: p.nomProducto,
          precio: precioConDescuento(p),
          exito: true,
        });

        if (timerBannerCamaraRef.current) clearTimeout(timerBannerCamaraRef.current);
        timerBannerCamaraRef.current = setTimeout(() => {
          setUltimoEscaneadoCamara(null);
        }, 2500);
      } else {
        // En celular con cámara NO se abre el modal invasivo de registrar producto
        // para que los reflejos o lecturas ruidosas de la cámara no interrumpan al cajero.
        emitirBeepError();
        setUltimoEscaneadoCamara({
          nombre: `Código "${decodedText}" no encontrado`,
          precio: 0,
          exito: false,
        });

        if (timerBannerCamaraRef.current) clearTimeout(timerBannerCamaraRef.current);
        timerBannerCamaraRef.current = setTimeout(() => {
          setUltimoEscaneadoCamara(null);
        }, 2500);
      }
    },
    [productosSucursal, config?.isStock, showToast, agregarProducto, buscarEnServidor, carritoConReservas],
  );

  const startScanning = async () => {
    setCameraError(null);
    setIsScanning(true);

    setTimeout(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Tu navegador no soporta el uso de la cámara.");
          return;
        }

        const stream = await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 60, min: 30 },
              advanced: [{ focusMode: "continuous" }] as unknown as MediaTrackConstraintSet[],
            },
          })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        // 1. Camino primario NATIVO por GPU (Chrome / Android / Edge)
        if ("BarcodeDetector" in window) {
          try {
            const BarcodeDetectorClass = (
              window as unknown as {
                BarcodeDetector: new (options?: { formats: string[] }) => {
                  detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
                };
              }
            ).BarcodeDetector;

            const detector = new BarcodeDetectorClass({
              formats: ["ean_13", "code_128", "qr_code", "upc_a", "ean_8", "code_39", "upc_e", "itf", "codabar"],
            });

            const scanLoopNative = async () => {
              if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
              try {
                if (videoRef.current.readyState >= 2) {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    processScannedBarcode(barcodes[0].rawValue);
                  }
                }
              } catch {
                // Silencioso por fotograma
              }
              animFrameRef.current = requestAnimationFrame(scanLoopNative);
            };
            scanLoopNative();
            return;
          } catch (err) {
            console.warn("Fallback a ZBar-WASM por falla en cámara nativa", err);
          }
        }

        // 2. Camino C-WASM ultra-rápido con ZBar (iOS Safari / Firefox)
        const scanLoopZBar = async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !ctx) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const vWidth = videoRef.current.videoWidth || 640;
              const vHeight = videoRef.current.videoHeight || 480;
              if (canvas.width !== vWidth || canvas.height !== vHeight) {
                canvas.width = vWidth;
                canvas.height = vHeight;
              }
              ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);
              const imgData = ctx.getImageData(0, 0, vWidth, vHeight);
              const symbols = await scanImageData(imgData);
              if (symbols && symbols.length > 0) {
                const text = symbols[0].decode();
                if (text) {
                  processScannedBarcode(text);
                }
              }
            }
          } catch {
            // Silencioso por fotograma
          }
          animFrameRef.current = requestAnimationFrame(scanLoopZBar);
        };
        scanLoopZBar();
      } catch (err: unknown) {
        const errorName = (err as { name?: string })?.name;
        if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setCameraError("No se detectó ninguna cámara conectada en este equipo.");
        } else if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setCameraError("Permiso de cámara denegado en tu navegador.");
        } else {
          setCameraError("No se pudo acceder a la cámara de este dispositivo.");
        }
      }
    }, 50);
  };

  const igvPct = config?.igv ? parseFloat(config.igv) : 18;

  // Default del tipo de comprobante según "Tipo por defecto":
  // si el predeterminado es Nota de Venta y está habilitada, arranca en Nota de Venta.
  useEffect(() => {
    if (!config || tipoSinDocInitRef.current) return;
    tipoSinDocInitRef.current = true;
    if (config.useNotaVenta && config.isBoletaOrFactura === "n") {
      setTipoComprobante("Nota de Venta");
    }
  }, [config]);

  const documentoTrim = documento.trim();
  const sinDocumento = documentoTrim.length === 0;
  const esRuc = documentoTrim.length === 11;

  // Dígitos permitidos en el input de documento DENTRO del modal de cobro, donde
  // el comprobante ya está elegido:
  //   Boleta         → solo DNI (8)
  //   Nota de Venta  → DNI o RUC (hasta 11)
  //   Factura        → solo RUC (11)
  // Fuera del modal el documento es libre (8/9/11): es justamente lo que decide
  // el comprobante al abrir el cobro.
  const maxDocLen = tipoComprobante === "Boleta" ? 8 : 11;
  const docPlaceholder =
    tipoComprobante === "Factura"
      ? "RUC de la empresa (11 dígitos)"
      : tipoComprobante === "Nota de Venta"
        ? "DNI o RUC del cliente (opcional)"
        : "DNI del cliente (8 dígitos, opcional)";

  // Consulta el nombre / razón social en cuanto se escribe un documento válido
  // (8=DNI, 9=CE, 11=RUC), con debounce. Guarda el último documento consultado
  // para no repetir la llamada al abrir el modal de cobro: una sola consulta a la
  // API por documento. buscarCliente no está memoizado, se accede por ref.
  const buscarClienteRef = useRef(buscarCliente);
  useEffect(() => { buscarClienteRef.current = buscarCliente; });
  const ultimoDocConsultadoRef = useRef("");
  useEffect(() => {
    const len = documentoTrim.length;
    // Si el comprobante es Factura, SOLO se consulta a SUNAT al llegar a los 11 dígitos de RUC
    if (tipoComprobante === "Factura") {
      if (len !== 11) {
        ultimoDocConsultadoRef.current = "";
        return;
      }
    } else {
      if (![8, 9, 11].includes(len)) {
        ultimoDocConsultadoRef.current = "";
        return;
      }
    }

    if (ultimoDocConsultadoRef.current === documentoTrim) return;
    const timer = setTimeout(() => {
      ultimoDocConsultadoRef.current = documentoTrim;
      buscarClienteRef.current(len === 11 ? "06" : len === 9 ? "04" : "01", documentoTrim);
    }, 500);
    return () => clearTimeout(timer);
  }, [documentoTrim, tipoComprobante]);

  // Limpiar nombres y direcciones manuales inmediatamente cuando cambie el número de documento
  const docAsociadoClienteRef = useRef("");
  useEffect(() => {
    if (docAsociadoClienteRef.current !== documentoTrim) {
      docAsociadoClienteRef.current = documentoTrim;
      setNombreManualCliente("");
      setDireccionManualCliente("");
    }
  }, [documentoTrim]);

  // Sincronizar automáticamente datos consultados hacia los estados editables solo cuando coincida exactamente
  useEffect(() => {
    if (cliente?.numeroDocumento === documentoTrim && cliente?.razonSocial) {
      setNombreManualCliente(cliente.razonSocial);
      setDireccionManualCliente(cliente.direccionLineal || "");
    }
  }, [cliente, documentoTrim]);

  // Línea de estado del cliente bajo el input de documento (nombre confirmable
  // sin abrir el modal). Se compara numeroDocumento para nunca mostrar un nombre
  // que corresponde a un documento anterior (evita datos obsoletos al reescribir).
  const estadoClienteInline = (() => {
    if (!documentoTrim) return null;
    if (![8, 9, 11].includes(documentoTrim.length))
      return (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3 h-3 shrink-0" /> Faltan dígitos (DNI 8 · CE 9 · RUC 11)
        </span>
      );
    if (loadingCliente)
      return (
        <span className="flex items-center gap-1 text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Buscando cliente…
        </span>
      );
    if (errorCliente)
      return (
        <span className="flex items-center gap-1 text-rose-500">
          <AlertTriangle className="w-3 h-3 shrink-0" /> {errorCliente}
        </span>
      );
    if (cliente?.numeroDocumento === documentoTrim && cliente?.razonSocial)
      return (
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: "#008000" }}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {cliente.razonSocial}
        </span>
      );
    return null;
  })();

  // Estadísticas de ventas en memoria para evitar parsear localStorage en cada render
  const statsVentas = useMemo(() => {
    try {
      const key = `factufly_recientes_venta_${sucursalId || "default"}`;
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as Record<number, { timestamp: number; count: number }>) : {};
    } catch {
      return {};
    }
  }, [sucursalId, historialVentasVersion]);

  // ── Grid de productos (ordenados por más recientes / más vendidos por defecto) ──
  const productosGrid = useMemo(() => {
    const q = busqueda.trim();
    if (q) {
      return productosSucursal.filter((p) =>
        coincideBusqueda(q, p.nomProducto, p.codigo, p.codigoBarras),
      );
    }

    // Sin búsqueda: solo mostrar productos disponibles con stock mayor a 0 (o servicios)
    const baseProductos = (config?.isStock ?? true)
      ? productosSucursal.filter((p) => {
          if (p.tipoProducto !== "BIEN") return true;
          const disp = calcularDisponible(p, reservasOtraCaja, productosSucursal, true, productosPorId);
          return disp === null || disp > 0;
        })
      : productosSucursal;

    const copia = [...baseProductos];
    copia.sort((a, b) => {
      // 1. Por actividad de venta finalizada (timestamp más reciente primero)
      const statA = statsVentas[a.productoId];
      const statB = statsVentas[b.productoId];
      const timeA = statA?.timestamp ?? 0;
      const timeB = statB?.timestamp ?? 0;
      if (timeA !== timeB) return timeB - timeA;

      // 2. Por frecuencia de venta (más vendidos primero)
      const countA = statA?.count ?? 0;
      const countB = statB?.count ?? 0;
      if (countA !== countB) return countB - countA;

      // 3. Por defecto los creados más recientemente (id descendente)
      return b.productoId - a.productoId;
    });

    return copia;
  }, [busqueda, productosSucursal, statsVentas, config?.isStock, productosPorId, reservasOtraCaja]);

  const cambiarCantidad = (key: string, delta: number) => {
    if (delta > 0) {
      const item = items.find((i) => i.key === key);
      if (item) {
        const prod = productosSucursal.find((p) => p.productoId === item.productoId);
        if (prod) {
          const disp = calcularDisponible(prod, itemsMasReservas, productosSucursal, config?.isStock ?? false);
          if (disp !== null && disp <= 0) {
            showToast(`Stock insuficiente: no hay más unidades disponibles de "${item.descripcion}"`, "info");
            return;
          }
          // If incrementing by delta would exceed stock, cap delta at available
          if (disp !== null && delta > disp) {
            showToast(`Solo quedan ${parseFloat(disp.toFixed(3))} disponibles de "${item.descripcion}"`, "info");
            return;
          }
        }
      }
    }
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          const nuevaCant = parseFloat(Math.max(0, i.cantidad + delta).toFixed(3));
          return { ...i, cantidad: nuevaCant };
        })
        .filter((i) => i.cantidad > 0),
    );
  };

  const actualizarCantidadDirecta = (key: string, val: number, rawStr?: string) => {
    if (isNaN(val) || val < 0) return;
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (val > item.cantidad) {
      const prod = productosSucursal.find((p) => p.productoId === item.productoId);
      if (prod) {
        const disp = calcularDisponible(prod, itemsMasReservas, productosSucursal, config?.isStock ?? false);
        const incremento = val - item.cantidad;
        if (disp !== null && disp < incremento) {
          showToast(
            `Stock insuficiente para "${item.descripcion}". Máximo disponible: ${parseFloat((disp + item.cantidad).toFixed(3))}`,
            "info",
          );
          return;
        }
      }
    }
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, cantidad: val, cantidadStr: rawStr } : i)),
    );
  };

  const actualizarPrecioUnitarioDirecto = (key: string, precioNuevo: number, rawStr?: string) => {
    if (isNaN(precioNuevo) || precioNuevo < 0) return;
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, precio: precioNuevo, precioStr: rawStr } : i)),
    );
  };

  // Captura de lecturas de código de barras por escáner físico (USB / Bluetooth)
  const scannerBufferRef = useRef<{ text: string; lastTime: number }>({ text: "", lastTime: 0 });

  // Antiduplicado: una sola lectura de escáner dispara varias rutas casi a la vez
  // (efecto de auto-adición + Enter del input + listener global). Colapsamos las
  // que lleguen con el mismo código dentro de una ventana corta a una sola adición.
  // No afecta a los clics manuales del grid, que no pasan por aquí.
  const ultimaLecturaRef = useRef<{ q: string; time: number }>({ q: "", time: 0 });
  const esLecturaDuplicada = useCallback((q: string) => {
    const ahora = Date.now();
    const clave = q.trim().toLowerCase();
    if (
      clave &&
      ultimaLecturaRef.current.q === clave &&
      ahora - ultimaLecturaRef.current.time < 250
    ) {
      return true;
    }
    ultimaLecturaRef.current = { q: clave, time: ahora };
    return false;
  }, []);

  // ── Paginación y límite de renderizado inicial (20 productos más recientes/vendidos) ──
  // En 3G, menos tarjetas iniciales = menos imágenes compitiendo por ancho de banda.
  const GRID_PAGE_SIZE = 20;
  const [limiteVistaGrid, setLimiteVistaGrid] = useState(GRID_PAGE_SIZE);
  useEffect(() => { setLimiteVistaGrid(GRID_PAGE_SIZE); }, [busqueda]);

  const productosGridVisualizados = useMemo(() => {
    return productosGrid.slice(0, limiteVistaGrid);
  }, [productosGrid, limiteVistaGrid]);

  // Auto-cargar más productos al hacer scroll (IntersectionObserver):
  // reemplaza el botón manual "Cargar más" — invisible al usuario, carga bajo
  // demanda como Falabella/MercadoLibre. Solo incrementa cuando hay más productos.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLimiteVistaGrid((prev) => {
            const total = productosGrid.length;
            return prev >= total ? prev : prev + GRID_PAGE_SIZE;
          });
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [productosGrid.length]);

  // Búsqueda remota automática cuando no hay coincidencias locales
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) return;

    const tieneCoincidenciaLocal = productosSucursal.some((p) =>
      coincideBusqueda(q, p.nomProducto, p.codigo, p.codigoBarras),
    );

    if (!tieneCoincidenciaLocal) {
      const timer = setTimeout(() => {
        buscarEnServidor(q);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [busqueda, productosSucursal, buscarEnServidor]);

  // Enter en el buscador o escáner de código de barras físico:
  // Agrega directo el producto encontrado por código de barras o código exacto,
  // o abre el modal de cobro si no hay búsqueda pendiente.
  const onEnterBusqueda = useCallback(
    async (queryOverride?: string, esCodigoEscaneado = false) => {
      const q = (queryOverride !== undefined ? queryOverride : busqueda).trim().toLowerCase();
      if (!q) {
        if (itemsRef.current.length > 0) {
          abrirPagoRef.current?.();
        }
        return;
      }

      // Evitar lecturas duplicadas inmediatas (doble pitido del escáner en < 400ms)
      if (esLecturaDuplicada(q)) {
        setBusqueda("");
        return;
      }

      // 1. Buscar coincidencia por código de barras o código interno.
      // Un código escaneado (pistola o cámara) exige coincidencia ESTRICTA:
      // jamás se "adivina" por substring o por nombre de producto.
      let exacto = productosSucursal.find((p) =>
        esCodigoEscaneado ? coincideCodigoExacto(p, q) : coincideCodigoOBarras(p, q),
      );

      // 2. Si es búsqueda manual:
      // - Si el grid tiene exactamente 1 producto que coincide
      // - O si hay un producto cuyo nombre coincide exactamente
      if (!exacto && !esCodigoEscaneado) {
        if (productosGrid.length === 1) {
          exacto = productosGrid[0];
        } else if (productosGrid.length > 1) {
          const matchExactoNombre = productosGrid.find(
            (p) => p.nomProducto.trim().toLowerCase() === q,
          );
          if (matchExactoNombre) exacto = matchExactoNombre;
        }
      }

      // 3. Si en el grid hay algún producto cuyo código coincide
      if (!exacto && productosGrid.length > 0) {
        const matchGrid = productosGrid.find((p) =>
          esCodigoEscaneado ? coincideCodigoExacto(p, q) : coincideCodigoOBarras(p, q),
        );
        if (matchGrid) exacto = matchGrid;
      }

      // 4. Si no está en memoria local, consultar al servidor
      if (!exacto) {
        const remotos = await buscarEnServidor(q);
        if (remotos.length > 0) {
          const exactoRemoto = remotos.find((p) =>
            esCodigoEscaneado ? coincideCodigoExacto(p, q) : coincideCodigoOBarras(p, q),
          );
          if (exactoRemoto) {
            exacto = exactoRemoto;
          } else if (!esCodigoEscaneado && remotos.length === 1) {
            exacto = remotos[0];
          } else if (!esCodigoEscaneado) {
            const matchNombre = remotos.find(
              (p) => p.nomProducto.trim().toLowerCase() === q,
            );
            if (matchNombre) exacto = matchNombre;
          }
        }
      }

      if (exacto) {
        if (config?.isStock && exacto.tipoProducto === "BIEN" && (exacto.sucursalProducto.stock ?? 0) <= 0) {
          if (emitidoRef.current) {
            resetearEstadoVenta();
            setItems([]);
            onVentaTerminada?.();
          }
          setProductoSinStock(exacto);
          setBusqueda("");
          return;
        }
        agregarProducto(exacto);
        setBusqueda("");
        return;
      }

      // Si es búsqueda manual y hay múltiples productos en el grid, NO agregar arbitrariamente el primero.
      // Se mantiene el filtro visible para que el cajero seleccione el producto deseado.
      if (!esCodigoEscaneado && productosGrid.length > 1) {
        return;
      }

      // 5. Código escaneado o tecleado sin ninguna coincidencia: se abre modal para registrar
      if (emitidoRef.current) {
        resetearEstadoVenta();
        setItems([]);
        onVentaTerminada?.();
      }
      showToast(`No se encontró ningún producto con el código "${queryOverride ?? q}"`, "error");
      const raw = (queryOverride !== undefined ? queryOverride : busqueda).trim();
      setCodigoBarrasNuevoProducto(raw);
      setNombreNuevoProducto(/^\d{4,}$/.test(raw) ? "" : raw);
      setModalCrearRapidoAbierto(true);
      setBusqueda("");
    },
    [busqueda, productosGrid, productosSucursal, config?.isStock, showToast, agregarProducto, buscarEnServidor, esLecturaDuplicada, resetearEstadoVenta, onVentaTerminada],
  );

  // Foco inicial único al cargar la página (solo en computadoras/laptops).
  // También al recuperar el foco: al pasar de una caja a la otra, el cursor
  // tiene que saltar solo a su buscador para poder escanear sin tocar el mouse.
  // Con el modal de pago abierto no se toca el foco: ahí manda el monto
  // recibido, y robárselo al volver de la venta rápida obligaría a hacer clic
  // de nuevo justo en la mitad del cobro.
  useEffect(() => {
    if (!activo || mostrarPago) return;
    const isMobile = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [activo, mostrarPago]);

  // Captura global de lecturas de códigos de barras (escáner físico USB/Bluetooth)
  // e interacción con la tecla Enter para cobrar o iniciar nueva venta.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Con las dos cajas montadas, solo la que tiene el foco puede consumir la
      // lectura: si escucharan las dos, el mismo código entraría en ambos carritos.
      if (!activo) return;
      // No capturar si hay cualquier modal abierto
      if (mostrarPago || modalCrearRapidoAbierto || !!productoSinStock || confirmarLimpiarTodo) return;

      const target = e.target as HTMLElement | null;
      const active = document.activeElement;
      const isEditingOther =
        (!!target &&
          target !== inputRef.current &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)) ||
        (!!active &&
          active !== inputRef.current &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            (active as HTMLElement).isContentEditable));

      if (isEditingOther) return;

      const now = Date.now();
      const timeDiff = now - scannerBufferRef.current.lastTime;

      // Si las teclas se envían en menos de 65ms (típico de pistola de código de barras USB/Bluetooth)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff < 65) {
          scannerBufferRef.current.text += e.key;
        } else {
          scannerBufferRef.current.text = e.key;
        }
        scannerBufferRef.current.lastTime = now;
      }

      if (e.key === "Enter") {
        // Solo es un código escaneado si los caracteres llegaron en ráfaga rápida (<100ms) y es reciente
        const isScannerBurst = scannerBufferRef.current.text.length >= 3 && timeDiff < 100;
        const barcodeFromScanner = isScannerBurst ? scannerBufferRef.current.text.trim() : "";
        const isFocusOnSearch = document.activeElement === inputRef.current;
        const currentQuery = (inputRef.current?.value || busqueda).trim();

        scannerBufferRef.current = { text: "", lastTime: 0 };

        // 1. Si vino del lector de códigos de barras físico
        if (barcodeFromScanner) {
          e.preventDefault();
          onEnterBusqueda(barcodeFromScanner, true);
          return;
        }

        // 2. Si el foco está en el input de búsqueda y hay texto escrito por el usuario
        if (isFocusOnSearch && currentQuery) {
          e.preventDefault();
          onEnterBusqueda(currentQuery, false);
          return;
        }

        // 3. Si la venta ya fue emitida (pantalla de éxito visible) -> Iniciar Nueva Venta
        if (emitidoRef.current) {
          e.preventDefault();
          nuevaVenta();
          return;
        }

        // 4. Si hay productos en el carrito y no hay búsqueda pendiente -> Abrir modal de Cobro
        if (itemsRef.current.length > 0) {
          e.preventDefault();
          abrirPagoRef.current?.();
          return;
        }

        return;
      }

      if (!isEditingOther && document.activeElement !== inputRef.current && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const isMobileDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
        if (!isMobileDevice) {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activo, onEnterBusqueda, mostrarPago, modalCrearRapidoAbierto, productoSinStock, confirmarLimpiarTodo, busqueda, nuevaVenta]);

  // ── Totales (con desglose por afectación de IGV, para el payload real) ──
  const totales = useMemo(() => {
    let gravadas = 0,
      exoneradas = 0,
      inafectas = 0,
      igv = 0;
    items.forEach((i) => {
      const importe = i.precio * i.cantidad;
      if (i.tipoAfectacionIGV === "10") {
        const base = importe / (1 + igvPct / 100);
        gravadas += base;
        igv += importe - base;
      } else if (i.tipoAfectacionIGV === "20") {
        exoneradas += importe;
      } else {
        inafectas += importe;
      }
    });
    gravadas = parseFloat(gravadas.toFixed(2));
    exoneradas = parseFloat(exoneradas.toFixed(2));
    inafectas = parseFloat(inafectas.toFixed(2));
    igv = parseFloat(igv.toFixed(2));
    const valorVenta = parseFloat((gravadas + exoneradas + inafectas).toFixed(2));
    const total = parseFloat((valorVenta + igv).toFixed(2));
    const unidades = items.reduce((a, i) => a + i.cantidad, 0);
    return {
      gravadas,
      exoneradas,
      inafectas,
      igv,
      valorVenta,
      subtotal: valorVenta,
      total,
      unidades,
    };
  }, [items, igvPct]);

  // Publica el carrito propio para que la otra caja lo descuente de su stock.
  // Una vez emitida la venta el carrito deja de reservar: esas unidades ya se
  // descontaron del catálogo compartido (descontarStockLocal) y seguir
  // publicándolas las restaría dos veces en la otra caja, que vería menos
  // stock del que hay hasta que aquí se pulse "Nueva venta".
  useEffect(() => {
    onCarritoCambio(emitido ? SIN_RESERVAS : items);
  }, [items, emitido, onCarritoCambio]);

  // Emitir con otra fecha (fecha de emisión manual, en vez de la fecha/hora actual)
  // SUNAT permite emitir hasta 3 días atrás de la fecha actual.
  const fechaMinimaEmision = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  // Focus y auto-selección del monto al abrir el modal de pago en efectivo
  useEffect(() => {
    if (mostrarPago && medioPago === "Efectivo" && !pagoDividido) {
      const timer = setTimeout(() => {
        if (montoInputRef.current) {
          montoInputRef.current.focus();
          montoInputRef.current.select();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [mostrarPago, medioPago, pagoDividido]);

  const vuelto = Math.max(0, (parseFloat(montoRecibido) || 0) - totales.total);
  const faltante = Math.max(0, totales.total - (parseFloat(montoRecibido) || 0));

  const ingresadoDividido = parseFloat(
    pagosDivididos.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0).toFixed(2),
  );
  const faltanteDividido = Math.max(0, parseFloat((totales.total - ingresadoDividido).toFixed(2)));
  const sobranteDividido = Math.max(0, parseFloat((ingresadoDividido - totales.total).toFixed(2)));

  const togglePagoDividido = () => {
    if (pagoDividido) {
      setPagoDividido(false);
      setPagosDivididos([]);
      return;
    }
    setPagoDividido(true);
    setPagosDivididos([
      { id: crypto.randomUUID(), medioPago: "Efectivo", monto: "" },
      { id: crypto.randomUUID(), medioPago: "Yape", monto: "" },
    ]);
    setEsCredito(false);
  };

  const agregarPagoDividido = () => {
    setPagosDivididos((prev) => {
      const usados = new Set(prev.map((p) => p.medioPago));
      const siguiente = MEDIOS_PAGO.map((m) => m.nombre).find((n) => !usados.has(n)) ?? "Otro";
      return [...prev, { id: crypto.randomUUID(), medioPago: siguiente, monto: "" }];
    });
  };

  const quitarPagoDividido = (id: string) => {
    setPagosDivididos((prev) => prev.filter((p) => p.id !== id));
  };

  const actualizarPagoDividido = (id: string, campo: "medioPago" | "monto", valor: string) => {
    setPagosDivididos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  };

  const medioEnUsoEnOtraFila = (nombre: string, idActual: string) =>
    pagosDivididos.some((p) => p.id !== idActual && p.medioPago === nombre);

  const saldoPendienteCredito = Math.max(
    0,
    parseFloat((totales.total - (parseFloat(adelantoCredito) || 0)).toFixed(2)),
  );
  const sumaCuotasCredito = parseFloat(
    cuotasCredito.reduce((a, c) => a + (parseFloat(c.monto) || 0), 0).toFixed(2),
  );
  const cuotasCuadran = Math.abs(sumaCuotasCredito - saldoPendienteCredito) <= 0.01;

  const calcularFechasCuotas = (fechaBase: string, numCuotas: number): string[] => {
    const fechas: string[] = [];
    const [anio, mes, dia] = fechaBase.split("-").map(Number);
    for (let i = 0; i < numCuotas; i++) {
      let nuevoDia = dia,
        nuevoMes = mes + i,
        nuevoAnio = anio;
      while (nuevoMes > 12) {
        nuevoMes -= 12;
        nuevoAnio++;
      }
      const ultimoDia = new Date(nuevoAnio, nuevoMes, 0).getDate();
      if (nuevoDia > ultimoDia) nuevoDia = ultimoDia;
      const pad = (n: number) => String(n).padStart(2, "0");
      fechas.push(`${nuevoAnio}-${pad(nuevoMes)}-${pad(nuevoDia)}`);
    }
    return fechas;
  };

  // Recalcula las cuotas (fechas + monto equitativo) cuando cambia el número
  // de cuotas o el saldo pendiente; la edición manual de un monto individual
  // no dispara este efecto.
  useEffect(() => {
    if (!esCredito) return;
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fechaBase = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 2)}-15`.replace(
      /(\d{4})-13-/,
      (_, y) => `${Number(y) + 1}-01-`,
    );
    const fechas = calcularFechasCuotas(fechaBase, numeroCuotasCredito);
    const monto =
      saldoPendienteCredito === 0 ? "" : (saldoPendienteCredito / numeroCuotasCredito).toFixed(2);
    setCuotasCredito(
      Array.from({ length: numeroCuotasCredito }, (_, i) => ({
        numeroCuota: `Cuota${String(i + 1).padStart(3, "0")}`,
        monto,
        fechaVencimiento: fechas[i],
      })),
    );
  }, [numeroCuotasCredito, saldoPendienteCredito, esCredito]);

  const toggleCredito = () => {
    setEsCredito((v) => !v);
    if (!esCredito) {
      setPagoDividido(false);
      setPagosDivididos([]);
    }
  };

  // Ajusta la última cuota para que la suma cuadre exacto con el saldo pendiente.
  const cuadrarCuotasConSaldo = () => {
    setCuotasCredito((prev) => {
      if (prev.length === 0) return prev;
      const sumaSinUltima = prev.slice(0, -1).reduce((a, c) => a + (parseFloat(c.monto) || 0), 0);
      const ultima = parseFloat((saldoPendienteCredito - sumaSinUltima).toFixed(2));
      return prev.map((c, i) => (i === prev.length - 1 ? { ...c, monto: ultima.toFixed(2) } : c));
    });
  };

  const actualizarMontoCuota = (idx: number, valor: string) => {
    setCuotasCredito((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, monto: valor.replace(/[^0-9.]/g, "") } : c)),
    );
  };

  // Fecha de emisión efectiva: la manual (si está activa) o la actual.
  const obtenerFechaEmision = () => {
    const { fechaHora, fecha } = formatoFechaActual();
    if (mostrarFechaManual && fechaEmisionManual) {
      const hora = fechaHora.split("T")[1];
      return { fecha: fechaEmisionManual, fechaHora: `${fechaEmisionManual}T${hora}` };
    }
    return { fecha, fechaHora };
  };

  // Réplica de calcularDetalle() de boleta/factura/nota-venta, sin descuentos
  // (Caja Autopago no los maneja): precio ya trae el IGV incluido.
  // SUNAT valida "valorVenta = precioUnitario × cantidad", así que precioUnitario
  // debe ser el precio SIN IGV (precioBase), no el precio de venta con IGV —
  // de ahí el error 3271/4288 "El valor de venta por ítem difiere...".
  const calcularDetalleItem = (precio: number, cantidad: number, tipoAfectacion: string) => {
    const precioVenta = parseFloat(precio.toFixed(2));
    if (tipoAfectacion === "10") {
      const precioBase = parseFloat((precio / (1 + igvPct / 100)).toFixed(6));
      const totalVentaItem = parseFloat((precioVenta * cantidad).toFixed(2));
      const montoIGV = parseFloat((totalVentaItem - totalVentaItem / (1 + igvPct / 100)).toFixed(2));
      const baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
      return { precioUnitario: precioBase, precioVenta, baseIgv, montoIGV, totalVentaItem, valorVenta: baseIgv };
    }
    const precioBase = parseFloat(precio.toFixed(6));
    const baseIgv = parseFloat((precioVenta * cantidad).toFixed(2));
    return { precioUnitario: precioBase, precioVenta, baseIgv, montoIGV: 0, totalVentaItem: baseIgv, valorVenta: baseIgv };
  };

  // Cliente para el payload: "Clientes Varios" (sin documento) o el documento + datos
  // ya traídos por useClienteBoleta o ingresados manualmente por el usuario.
  const construirCliente = () => {
    if (sinDocumento) {
      return {
        clienteId: null,
        tipoDocumento: "0",
        numeroDocumento: "0",
        razonSocial: "Clientes Varios",
        ubigeo: "",
        direccionLineal: "",
        departamento: "",
        provincia: "",
        distrito: "",
      };
    }
    const len = documentoTrim.length;
    const tipoDocumento = len === 11 ? "06" : len === 9 ? "04" : "01";
    // Solo se asocian los datos del cliente si el número consultado coincide exactamente con el documento actual
    const coincide = cliente?.numeroDocumento === documentoTrim;
    const razonSocialFinal = (nombreManualCliente.trim() || (coincide ? (cliente?.razonSocial || "") : "")).trim();
    const direccionFinal = (direccionManualCliente.trim() || (coincide ? (cliente?.direccionLineal || "") : "")).trim();
    return {
      clienteId: coincide ? (cliente?.clienteId ?? null) : null,
      tipoDocumento,
      numeroDocumento: documentoTrim,
      razonSocial: razonSocialFinal || (len === 11 ? "CLIENTE CON RUC" : "CLIENTE"),
      ubigeo: coincide ? (cliente?.ubigeo || "") : "",
      direccionLineal: direccionFinal,
      departamento: coincide ? (cliente?.departamento || "") : "",
      provincia: coincide ? (cliente?.provincia || "") : "",
      distrito: coincide ? (cliente?.distrito || "") : "",
    };
  };

  // Arma el arreglo "pagos" del payload: la adelanto de un crédito, un único
  // medio de pago, o varios si "Pago dividido" está activo (se descartan
  // filas/adelantos sin monto).
  const construirPagos = (fechaHora: string) => {
    if (esCredito) {
      const adelanto = parseFloat(adelantoCredito) || 0;
      if (adelanto <= 0) return [];
      return [
        {
          medioPago,
          monto: adelanto,
          fechaPago: fechaHora,
          numeroOperacion: medioPago === "Efectivo" ? "" : notaPago,
          entidadFinanciera: "",
          observaciones: notaPago,
        },
      ];
    }
    if (pagoDividido) {
      return pagosDivididos
        .filter((p) => (parseFloat(p.monto) || 0) > 0)
        .map((p) => ({
          medioPago: p.medioPago,
          monto: parseFloat(p.monto) || 0,
          fechaPago: fechaHora,
          numeroOperacion: p.medioPago === "Efectivo" ? "" : notaPago,
          entidadFinanciera: "",
          observaciones: notaPago,
        }));
    }
    return [
      {
        medioPago,
        monto: totales.total,
        fechaPago: fechaHora,
        numeroOperacion: medioPago === "Efectivo" ? "" : notaPago,
        entidadFinanciera: "",
        observaciones: notaPago,
      },
    ];
  };

  // Arma el arreglo "cuotas" del payload (solo cuando "Al crédito" está activo).
  const construirCuotas = () =>
    esCredito
      ? cuotasCredito.map((c) => ({
          numeroCuota: c.numeroCuota,
          monto: parseFloat(c.monto) || 0,
          fechaVencimiento: c.fechaVencimiento,
        }))
      : [];

  // ── Comisión por pago con tarjeta (POS) — control interno, informativo ──
  // Se calcula solo sobre lo efectivamente pagado con "Tarjeta": el total (pago
  // simple), el adelanto (al crédito), o la porción correspondiente (pago dividido).
  // No afecta importeTotal ni ningún cálculo tributario del comprobante.
  const comisionPagoTarjetaPct = config?.comisionPagoTarjeta
    ? parseFloat(config.comisionPagoTarjeta)
    : 0;
  const montoPagadoConTarjeta = pagoDividido
    ? pagosDivididos
        .filter((p) => p.medioPago === "Tarjeta")
        .reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0)
    : esCredito
      ? (medioPago === "Tarjeta" ? (parseFloat(adelantoCredito) || 0) : 0)
      : (medioPago === "Tarjeta" ? totales.total : 0);
  const totalComisionPagoTarjeta =
    comisionPagoTarjetaPct > 0 && montoPagadoConTarjeta > 0
      ? parseFloat(((montoPagadoConTarjeta * comisionPagoTarjetaPct) / 100).toFixed(2))
      : 0;

  // Payload para POST /api/Comprobantes/GenerarXml (Boleta "03" / Factura "01").
  const prepararComprobante = (tipoComprobanteCod: "03" | "01") => {
    const { fechaHora, fecha } = obtenerFechaEmision();
    const clienteBase = construirCliente();
    const clienteFinal =
      clienteBase.tipoDocumento === "06"
        ? { ...clienteBase, tipoDocumento: "6" }
        : clienteBase;
    const detalles = items.map((it, idx) => {
      const calc = calcularDetalleItem(it.precio, it.cantidad, it.tipoAfectacionIGV);
      return {
        item: idx + 1,
        productoId: it.productoId,
        codigo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        unidadMedida: it.unidadMedida || "NIU",
        precioUnitario: calc.precioUnitario,
        tipoAfectacionIGV: it.tipoAfectacionIGV,
        porcentajeIGV: it.tipoAfectacionIGV === "10" ? igvPct : 0,
        montoIGV: calc.montoIGV,
        baseIgv: calc.baseIgv,
        codigoTipoDescuento: "00",
        descuentoUnitario: 0,
        descuentoTotal: 0,
        valorVenta: calc.valorVenta,
        precioVenta: calc.precioVenta,
        totalVentaItem: calc.totalVentaItem,
        icbper: 0,
        factorIcbper: 0,
      };
    });
    return {
      ublVersion: "2.1",
      tipoOperacion: "0101",
      tipoComprobante: tipoComprobanteCod,
      serie: tipoComprobanteCod === "01" ? (sucursal?.serieFactura ?? "") : (sucursal?.serieBoleta ?? ""),
      correlativo: String(
        (tipoComprobanteCod === "01" ? sucursal?.correlativoFactura : sucursal?.correlativoBoleta) ?? 1,
      ).padStart(8, "0"),
      fechaEmision: fechaHora,
      horaEmision: fechaHora,
      fechaVencimiento: esCredito
        ? (cuotasCredito[cuotasCredito.length - 1]?.fechaVencimiento ?? fecha)
        : fecha,
      tipoMoneda: "PEN",
      tipoPago: esCredito ? "Credito" : "Contado",
      cliente: clienteFinal,
      company: empresa
        ? { ...empresa, establecimientoAnexo: sucursal?.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000" }
        : null,
      codigoTipoDescGlobal: "02",
      descuentoGlobal: 0,
      totalOperacionesGravadas: totales.gravadas,
      totalOperacionesExoneradas: totales.exoneradas,
      totalOperacionesInafectas: totales.inafectas,
      totalOperacionesGratuitas: 0,
      totalIgvGratuitas: 0,
      totalIGV: totales.igv,
      totalImpuestos: totales.igv,
      totalDescuentos: 0,
      totalOtrosCargos: 0,
      totalIcbper: 0,
      valorVenta: totales.valorVenta,
      subTotal: totales.total,
      importeTotal: totales.total,
      montoCredito: esCredito ? saldoPendienteCredito : 0,
      totalComisionPagoTarjeta: totalComisionPagoTarjeta > 0 ? totalComisionPagoTarjeta : null,
      details: detalles,
      pagos: construirPagos(fechaHora),
      cuotas: construirCuotas(),
      legends: [{ code: "1000", value: numeroAlertas(totales.total, "SOLES") }],
      guias: [],
      detracciones: [],
      usuarioCreacion: user?.id ?? 0,
      enviadoEnResumen: false,
      // El backend descuenta este stock DENTRO de la transacción que crea el
      // comprobante: si no alcanza, la venta completa se rechaza (atómico).
      stockItems: config?.isStock ? calcularStockItems().items : [],
    };
  };

  // Payload para POST /api/NotaVenta — sin IGV discriminado (documento de control interno).
  const prepararNotaVenta = () => {
    const { fechaHora, fecha } = obtenerFechaEmision();
    const clienteBase = construirCliente();
    const clienteNV = sinDocumento
      ? { ...clienteBase, tipoDocumento: "1", numeroDocumento: "99999999" }
      : clienteBase;
    return {
      sucursalId: parseInt(user?.sucursalID ?? "0"),
      fechaEmision: fechaHora,
      fechaVencimiento: esCredito
        ? (cuotasCredito[cuotasCredito.length - 1]?.fechaVencimiento ?? fecha)
        : fecha,
      tipoMoneda: "PEN",
      tipoCambio: null,
      tipoPago: esCredito ? "Credito" : "Contado",
      observaciones: notaPago || null,
      usuarioCreacion: user?.id ?? 0,
      cliente: clienteNV,
      company: empresa
        ? { ...empresa, establecimientoAnexo: sucursal?.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000" }
        : null,
      descuentoGlobal: 0,
      totalDescuentos: 0,
      totalIGV: 0,
      valorVenta: totales.total,
      subTotal: totales.total,
      importeTotal: totales.total,
      montoCredito: esCredito ? saldoPendienteCredito : 0,
      totalComisionPagoTarjeta: totalComisionPagoTarjeta > 0 ? totalComisionPagoTarjeta : null,
      detalles: items.map((it, idx) => ({
        trabajadorId: null,
        item: idx + 1,
        productoId: it.productoId,
        codigo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        unidadMedida: it.unidadMedida || "NIU",
        precioUnitario: it.precio,
        descuentoUnitario: 0,
        descuentoTotal: 0,
        baseIgv: 0,
        montoIGV: 0,
        precioVenta: it.precio,
        totalVentaItem: parseFloat((it.precio * it.cantidad).toFixed(2)),
      })),
      pagos: construirPagos(fechaHora),
      cuotas: construirCuotas(),
      // El backend descuenta este stock DENTRO de la transacción que crea la
      // nota de venta: si no alcanza, la venta completa se rechaza (atómico).
      stockItems: config?.isStock ? calcularStockItems().items : [],
    };
  };

  // ── Descontar stock (solo si config.isStock) ───────────────────
  const calcularStockItems = () => {
    const acumulado = new Map<number, number>();
    // Un item por línea (no agregado por sucursalProductoId): el backend necesita poder
    // atar cada descuento de stock a su línea de comprobante exacta (vía `item`, el mismo
    // idx+1 con el que se numeran las líneas en `detalles`/`prepararNotaVenta`), para
    // distinguir p.ej. la venta de un paquete/sixpack de la de su producto base aunque
    // compartan el mismo sucursalProductoId.
    const stockItems = items
      .map((it, idx) => ({ it, item: idx + 1 }))
      .filter(({ it }) => it.tipoProducto === "BIEN" && it.sucursalProductoId)
      .map(({ it, item }) => {
        acumulado.set(it.sucursalProductoId!, (acumulado.get(it.sucursalProductoId!) ?? 0) + it.cantidad);
        return { sucursalProductoId: it.sucursalProductoId!, cantidad: it.cantidad, item };
      });
    return { acumulado, items: stockItems };
  };

  // El backend descuenta el stock ATÓMICAMENTE al crear la venta (ver StockItems
  // en el payload). Aquí ya no se llama a la API: solo reflejamos el cambio en
  // memoria para feedback inmediato (sin recargar) y disparamos la alerta de
  // stock bajo. Si no hubiera habido stock, la venta ni se habría creado.
  const actualizarStockLocalTrasVenta = () => {
    if (!config?.isStock) return;
    const { acumulado, items: payloadItems } = calcularStockItems();
    if (!payloadItems.length) return;

    descontarStockLocal(payloadItems);

    if (sucursal?.numeroStockBajo) {
      const umbral = config.umbralStockBajo ?? 10;
      const bajos = productosSucursal
        .filter((p) => {
          const vendida = acumulado.get(p.sucursalProducto.sucursalProductoId);
          if (vendida === undefined) return false;
          const stockActual = (p.sucursalProducto.stock ?? 0) - vendida;
          const stockAntes = p.sucursalProducto.stock ?? 0;
          return stockActual <= umbral && stockAntes > umbral;
        })
        .map((p) => {
          const vendida = acumulado.get(p.sucursalProducto.sucursalProductoId) ?? 0;
          return { nomProducto: p.nomProducto, stock: (p.sucursalProducto.stock ?? 0) - vendida };
        });
      if (bajos.length) avisarStockBajoWhatsapp(bajos, sucursal.numeroStockBajo);
    }
  };

  // ── Obtener el comprobante ya emitido (HTML ticket o PDF) ───────
  const obtenerBlobComprobante = async (
    comprobanteId: number,
    tamano: string,
  ): Promise<Blob | null> => {
    const clave = `${comprobanteId}:${tamano}`;
    const guardado = comprobantesDescargados.current.get(clave);
    if (guardado) return guardado;

    const esTicket = tamano === "Ticket58mm" || tamano === "Ticket80mm";
    try {
      if (esTicket) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/html?tamano=${tamano}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return null;
        const ticket = new Blob([await res.text()], { type: "text/html" });
        comprobantesDescargados.current.set(clave, ticket);
        return ticket;
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=${tamano}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return null;
      const pdf = new Blob([await res.blob()], { type: "application/pdf" });
      comprobantesDescargados.current.set(clave, pdf);
      return pdf;
    } catch {
      return null;
    }
  };

  const imprimirHtmlNavegador = (html: string) => {
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";

      let impreso = false;
      const ejecutar = () => {
        if (impreso) return;
        impreso = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn("Error al abrir diálogo de impresión:", err);
        }
        setTimeout(() => {
          try {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          } catch {}
          URL.revokeObjectURL(blobUrl);
        }, 30000);
      };

      iframe.onload = ejecutar;
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      // Fallback para navegadores que no disparen onload en blob de forma asíncrona
      setTimeout(() => {
        if (!impreso) ejecutar();
      }, 350);
    } catch (err) {
      console.warn("Error al abrir impresión:", err);
    }
  };

  const ejecutarImpresionComprobante = async (
    comprobanteId: number,
    serieCorrelativo: string | null,
  ) => {
    // Detectar tamaño configurado en Empresa (58mm u 80mm). Por defecto 80mm en caja si no se especificó.
    const raw = String(config?.tamañoImpresion || "").toLowerCase();
    const es58 = raw.includes("58");
    const anchoMm: 58 | 80 = es58 ? 58 : 80;
    const tamanoParam = es58 ? "Ticket58mm" : "Ticket80mm";
    const documento = serieCorrelativo ?? `Comprobante ${comprobanteId}`;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/html?tamano=${tamanoParam}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!res.ok) {
        console.warn("Fallo al obtener HTML del comprobante:", res.status);
        return;
      }

      const html = await res.text();
      if (!html || !html.trim()) return;

      // 1. Intentar impresión directa por agente local
      const porAgente = await imprimirHtmlConAgente(html, anchoMm, { documento }).catch(() => false);
      if (porAgente) return;

      // 2. Si no hay agente, imprimir directo con el navegador
      imprimirHtmlNavegador(html);
    } catch (err) {
      console.warn("Error en ejecución de impresión:", err);
    }
  };

  const imprimirBlob = (blob: Blob) => {
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";

    const cleanup = () => {
      try {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      } catch {
        // ignore
      }
      URL.revokeObjectURL(blobUrl);
    };

    let impreso = false;
    const ejecutar = () => {
      if (impreso) return;
      impreso = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("Error al abrir diálogo de impresión:", err);
      }
      setTimeout(cleanup, 30000);
    };

    iframe.onload = ejecutar;
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    setTimeout(() => {
      if (!impreso) ejecutar();
    }, 350);
  };

  // ── Impresión directa por el agente local ───────────────────────
  // El agente es un programa que el cliente instala en su PC y que imprime sin
  // el diálogo de Chrome, imposible de suprimir desde una página web. Si no
  // está instalado, todo cae al flujo de iframe + window.print() de siempre y
  // el cajero no nota ninguna diferencia.

  /** Nombre del cliente tal como debe salir impreso. */
  const nombreClienteTicket = () => {
    const coincide = cliente?.numeroDocumento === documentoTrim;
    const nombreValido = (nombreManualCliente.trim() || (coincide ? (cliente?.razonSocial || "") : "")).trim();
    return nombreValido || (sinDocumento ? "Clientes Varios" : documentoTrim ? `DNI: ${documentoTrim}` : "Cliente");
  };

  /**
   * Ancho del rollo térmico configurado, o null si el negocio imprime en A4.
   * En A4 no se usa el agente: el comprobante va en PDF a una láser, que sí
   * puede pasar por el diálogo normal del navegador.
   */
  const anchoTermico = (): "58" | "80" | null =>
    config?.tamañoImpresion === "80" ? "80" : config?.tamañoImpresion === "58" ? "58" : null;

  /**
   * Intenta imprimir por el agente el MISMO HTML que devuelve la API.
   *
   * Importante: no se reconstruye el ticket aquí. El HTML del backend ya trae
   * el logo, el QR de SUNAT y la redacción legal — un ticket armado en el front
   * saldría parecido pero sin QR, y una boleta sin QR no es válida.
   *
   * @returns true si el agente lo imprimió; false si hay que usar el navegador.
   */
  const imprimirHtmlSiHayAgente = async (
    blob: Blob,
    ancho: "58" | "80",
    documento: string,
  ) => {
    try {
      const html = await blob.text();
      if (!html.trim()) return false;
      return await imprimirHtmlConAgente(html, ancho === "80" ? 80 : 58, { documento });
    } catch {
      // La venta ya quedó registrada: un fallo imprimiendo nunca debe tumbarla.
      return false;
    }
  };

  // ── Impresión automática (según config.isImprime), justo al emitir ──
  // El serie-correlativo llega por parámetro y no del estado: `setSerieCorrelativoEmitido`
  // se acaba de llamar en `emitirVenta` y todavía no se reflejó en este render.
  const imprimirSiAplica = async (comprobanteId: number, serieCorrelativo: string | null) => {
    if (!config?.isImprime) return;
    setImprimiendo(true);
    try {
      const ancho = anchoTermico();
      const tamano = ancho ? TAMANO_MAP[ancho] : "A4";

      // Una sola descarga alimenta las dos rutas: el agente recibe este mismo
      // HTML y, si no está, el blob se imprime por el iframe de siempre.
      const blob = await obtenerBlobComprobante(comprobanteId, tamano);
      if (!blob) return;

      const documento = serieCorrelativo ?? `Comprobante ${comprobanteId}`;
      if (ancho && (await imprimirHtmlSiHayAgente(blob, ancho, documento))) return;

      imprimirBlob(blob);
    } finally {
      setImprimiendo(false);
    }
  };

  // ¿Hay agente en este equipo? Se averigua al abrir la caja, no al imprimir.
  //
  // En un equipo SIN agente el intento de conexión tarda ~2 s en fallar (el
  // firewall de Windows descarta el paquete en vez de rechazarlo), así que si
  // esto ocurriera al pulsar el botón, cada cliente sin agente esperaría eso en
  // cada venta. Adelantándolo al montaje, para cuando llega la primera venta la
  // respuesta ya está en memoria.
  useEffect(() => {
    detectarAgente().catch(() => {});
  }, []);

  // Apenas se emite, se baja el comprobante en segundo plano mientras el cajero
  // lee el vuelto. Así, cuando pulsa 58mm/80mm, ya está en memoria y la
  // impresión sale al instante en vez de esperar a la API.
  useEffect(() => {
    if (!emitido || !comprobanteIdEmitido) return;
    const ancho = anchoTermico();
    if (!ancho) return;
    // Se revalida el agente junto con el comprobante: si el cajero lo cerró a
    // media jornada, el fallback al navegador ya está decidido antes del clic.
    detectarAgente().catch(() => {});
    obtenerBlobComprobante(comprobanteIdEmitido, TAMANO_MAP[ancho]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitido, comprobanteIdEmitido]);

  // ── Reimpresión manual desde la pantalla de éxito ───────────────
  const imprimirManual = async (tamanoKey: "80" | "58" | "A4") => {
    if (!comprobanteIdEmitido || imprimiendo) return;
    setImprimiendo(true);
    setTamanoImprimiendo(tamanoKey);
    try {
      const blob = await obtenerBlobComprobante(comprobanteIdEmitido, TAMANO_MAP[tamanoKey]);
      if (!blob) {
        showToast("No se pudo generar el comprobante", "error");
        return;
      }

      // A4 nunca pasa por el agente: es un PDF para láser, no un ticket.
      const documento = serieCorrelativoEmitido ?? `Comprobante ${comprobanteIdEmitido}`;
      if (tamanoKey !== "A4" && (await imprimirHtmlSiHayAgente(blob, tamanoKey, documento))) return;

      imprimirBlob(blob);
    } finally {
      setImprimiendo(false);
      setTamanoImprimiendo(null);
    }
  };

  const descargarPDF = async () => {
    if (!comprobanteIdEmitido) return;
    const blob = await obtenerBlobComprobante(comprobanteIdEmitido, "A4");
    if (!blob) {
      showToast("No se pudo generar el PDF", "error");
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${empresa?.numeroDocumento ?? "comprobante"}-${tipoComprobante}-${serieCorrelativoEmitido ?? comprobanteIdEmitido}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const enviarComprobantePorWhatsapp = async () => {
    if (!comprobanteIdEmitido || !telWhatsapp.trim()) return;
    setEnviandoWhatsapp(true);
    try {
      const blob = await obtenerBlobComprobante(comprobanteIdEmitido, "A4");
      if (!blob) throw new Error();
      const nombreArchivo = `${empresa?.numeroDocumento ?? "comprobante"}-${tipoComprobante}-${serieCorrelativoEmitido ?? comprobanteIdEmitido}.pdf`;
      const pdfFile = new File([blob], nombreArchivo, { type: "application/pdf" });

      const whatsappApiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY!;
      const whatsappBase = "https://do.velsat.pe:8443/whatsapp";
      const uploadForm = new FormData();
      uploadForm.append("file", pdfFile);
      const resUpload = await fetch(`${whatsappBase}/api/upload`, {
        method: "POST",
        headers: { "x-api-key": whatsappApiKey },
        body: uploadForm,
      });
      if (!resUpload.ok) throw new Error();
      const fileUrl = (await resUpload.json()).datos.url;

      const numRaw = telWhatsapp.replace(/\D/g, "");
      const numeroFormateado = numRaw.startsWith("51") ? numRaw : `51${numRaw}`;
      const res = await fetch(`${whatsappBase}/api/send/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": whatsappApiKey },
        body: JSON.stringify({
          phone: numeroFormateado,
          type: "documento",
          file_url: fileUrl,
          filename: nombreArchivo,
          mime_type: "application/pdf",
          text: `Adjuntamos su ${tipoComprobante.toLowerCase()} electrónica.`,
        }),
      });
      if (!res.ok) throw new Error();
      showToast("Comprobante enviado por WhatsApp", "success");
    } catch {
      showToast("Error al enviar por WhatsApp", "error");
    } finally {
      setEnviandoWhatsapp(false);
    }
  };

  // ── Abrir el modal de cobro (valida el documento y precarga cliente) ──
  const abrirPago = () => {
    if (items.length === 0) return;
    const len = documentoTrim.length;
    if (len > 0 && ![8, 9, 11].includes(len)) {
      showToast("El documento debe tener 8 (DNI), 9 (CE) u 11 (RUC) dígitos, o déjalo vacío", "error");
      return;
    }
    if (tipoComprobante === "Boleta" && totales.total >= 700 && sinDocumento) {
      showToast("Aviso: SUNAT exige registrar DNI o CE del cliente para Boletas a partir de S/ 700.00", "info");
    }
    // El documento decide el comprobante con el que se abre el cobro, para que
    // el modal nunca arranque en un tipo incompatible con lo escrito. La Nota de
    // Venta admite DNI y RUC, así que si ya está elegida se respeta tal cual.
    if (len === 11 && tipoComprobante === "Boleta") {
      setTipoComprobante("Factura");
    } else if (len > 0 && len < 11 && tipoComprobante === "Factura") {
      setTipoComprobante(config?.useNotaVenta && config?.isBoletaOrFactura === "n" ? "Nota de Venta" : "Boleta");
    }
    // El cliente ya se consultó al escribir el documento (efecto con debounce),
    // así que aquí no se vuelve a llamar a la API. Si el debounce aún no disparó
    // (clic muy rápido), el efecto pendiente lo resuelve una sola vez.
    modalAbiertoAtRef.current = Date.now();
    setMedioPago("Efectivo");
    setMontoRecibido(totales.total.toFixed(2));
    setNotaPago("");
    setMostrarFechaManual(false);
    setFechaEmisionManual(formatoFechaActual().fecha);
    setPagoDividido(false);
    setPagosDivididos([]);
    setEsCredito(false);
    setAdelantoCredito("");
    setNumeroCuotasCredito(1);
    setMostrarPago(true);
  };

  useEffect(() => {
    abrirPagoRef.current = abrirPago;
  }, [abrirPago]);

  const elegirTipoComprobante = (t: "Boleta" | "Nota de Venta" | "Factura") => {
    setTipoComprobante(t);
    // Un RUC no es un DNI: al pasar a Boleta (único comprobante que no admite
    // RUC) el documento se LIMPIA, nunca se recorta. Recortar 11 → 8 dígitos
    // produce un DNI inventado pero con formato válido, que RENIEC resuelve al
    // nombre de OTRA persona y terminaría emitido en el comprobante.
    if (t === "Boleta" && documentoTrim.length > 8) {
      setDocumento("");
      showToast("Se quitó el RUC: la Boleta solo admite DNI (8 dígitos)", "info");
    }
  };

  // ── Venta sin conexión: se encola localmente ────────────────────
  const manejarVentaSinConexion = async (
    payload: Record<string, unknown>,
    tipo: "comprobante" | "notaventa",
    conImpresion = false,
    itemsSnapshot: ItemCarrito[] = itemsRef.current,
  ) => {
    const stockItems = (payload.stockItems ?? payload.StockItems ?? []) as { sucursalProductoId: number; cantidad: number }[];

    const totalVenta = Number(payload.total ?? payload.Total ?? totales.total) || 0;
    const resumenTicket = {
      clienteNombre: nombreClienteTicket(),
      items: itemsSnapshot.map((it) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioVenta: it.precio,
      })),
      total: totalVenta,
      moneda: "PEN",
      medioPago: esCredito ? "Crédito" : pagoDividido ? "Pago dividido" : medioPago,
    };

    const ventaId = await enqueueVenta(payload, stockItems, resumenTicket, tipo);

    if (stockItems.length) descontarStockLocal(stockItems);

    const datosTicket = {
      id: ventaId,
      fecha: new Date(),
      tamanoImpresion: config?.tamañoImpresion,
      ...resumenTicket,
    };
    setUltimoTicketOffline(datosTicket);
    // Impresión del ticket provisional si el cajero eligió "Confirmar e Imprimir"
    if (conImpresion) {
      const rawConfig = String(config?.tamañoImpresion || "").toLowerCase();
      const anchoMm: 58 | 80 = rawConfig.includes("58") ? 58 : 80;
      const porAgente = await imprimirHtmlConAgente(
        construirHtmlTicket(datosTicket),
        anchoMm,
        { documento: `Ticket provisional ${ventaId}` },
      ).catch(() => false);
      if (!porAgente) imprimirTicketProvisional(datosTicket);
    }

    registrarVentaReciente(itemsSnapshot);

    showToast(
      "Sin conexión: la venta se guardó localmente y se enviará al reconectar.",
      "success",
    );
  };

  const emitirVenta = async (conImpresion = false) => {
    if (!empresa) {
      showToast("No se pudo cargar la empresa emisora. Intenta de nuevo.", "error");
      return;
    }
    if (tipoComprobante !== "Nota de Venta" && !sucursal) {
      showToast("No se pudo cargar la sucursal (serie/correlativo). Intenta de nuevo.", "error");
      return;
    }
    if (tipoComprobante === "Boleta") {
      if (totales.total >= 700 && (!documentoTrim || ![8, 9].includes(documentoTrim.length))) {
        showToast(
          "Por normativa de SUNAT, las Boletas a partir de S/ 700.00 requieren identificar obligatoriamente al cliente con su DNI/CE.",
          "error",
        );
        return;
      }
      if (documentoTrim.length > 0 && ![8, 9].includes(documentoTrim.length)) {
        showToast("El DNI debe tener 8 dígitos (o CE de 9 dígitos), o bórralo para Clientes Varios", "error");
        return;
      }
    }
    if (tipoComprobante === "Nota de Venta" && documentoTrim.length > 0 && ![8, 9, 11].includes(documentoTrim.length)) {
      showToast("El documento debe tener 8 (DNI), 9 (CE) u 11 (RUC) dígitos, o déjalo vacío", "error");
      return;
    }
    if (tipoComprobante === "Factura") {
      if (documentoTrim.length !== 11) {
        showToast("Ingresa un RUC válido de 11 dígitos para la Factura", "error");
        return;
      }
      const clienteCheck = construirCliente();
      const onlineReal = isOnline && (typeof navigator !== "undefined" ? navigator.onLine : true);
      if (onlineReal && (!clienteCheck.razonSocial || clienteCheck.razonSocial === "CLIENTE CON RUC" || clienteCheck.razonSocial === "Clientes Varios")) {
        showToast("Ingresa la Razón Social de la empresa para emitir la Factura", "error");
        return;
      }
    }

    // Snapshot inmediato de los datos de la venta actual antes de limpiar la caja
    const itemsVendidos = [...items];
    const tipoComprobanteVenta = tipoComprobante;
    const vueltoFinal = esCredito ? 0 : pagoDividido ? sobranteDividido : vuelto;
    let serieCorrelativoTicket: string | null = null;
    if (sucursal) {
      const serie =
        tipoComprobante === "Factura"
          ? sucursal.serieFactura
          : tipoComprobante === "Nota de Venta"
            ? sucursal.serieNotaVenta
            : sucursal.serieBoleta;
      const correlativo =
        tipoComprobante === "Factura"
          ? sucursal.correlativoFactura
          : tipoComprobante === "Nota de Venta"
            ? sucursal.correlativoNotaVenta
            : sucursal.correlativoBoleta;
      serieCorrelativoTicket = serie && correlativo ? `${serie}-${String(correlativo).padStart(8, "0")}` : null;
    }

    const esNotaVenta = tipoComprobante === "Nota de Venta";
    const payload = esNotaVenta
      ? prepararNotaVenta()
      : prepararComprobante(tipoComprobante === "Factura" ? "01" : "03");

    const totalVenta = totales.total;

    // Descontar stock local y registrar venta de inmediato en la UI
    actualizarStockLocalTrasVenta();
    registrarVentaReciente(itemsVendidos);

    // CERRAR MODAL Y PREPARAR LA CAJA AL INSTANTE PARA EL SIGUIENTE CLIENTE
    nuevaVenta();

    const procesoId = Math.random().toString(36).substring(2, 9);
    iniciarEmisionSegundoPlano({ id: procesoId, tipo: tipoComprobanteVenta, total: totalVenta, conImpresion });

    // Proceso de emisión en segundo plano (sin bloquear la caja)
    void (async () => {
      try {
        let comprobanteId: number;
        try {
          if (esNotaVenta) {
            const res = await crearNotaVenta(payload, accessToken);
            comprobanteId = (res.comprobanteId ?? res.ComprobanteId) as number;
          } else {
            const res = await generarXml(payload, accessToken);
            comprobanteId = res.comprobanteId;
          }
        } catch (errGuardar: any) {
          if (esErrorTransitorio(errGuardar)) {
            await manejarVentaSinConexion(payload, esNotaVenta ? "notaventa" : "comprobante", conImpresion, itemsVendidos);
            return;
          }
          throw errGuardar;
        }

        if (!esNotaVenta) {
          try {
            const resSunat = await enviarASunatApi(comprobanteId, accessToken);
            if (!resSunat.exitoso) {
              showToast(resSunat.mensaje ?? `${tipoComprobanteVenta} quedó pendiente en SUNAT`, "error");
            }
          } catch {
            showToast("No se pudo conectar con SUNAT. Verifica el estado en Comprobantes.", "error");
          }
        }

        fetchSucursal();

        // Impresión en segundo plano si el cajero eligió "Confirmar e Imprimir"
        if (conImpresion) {
          await ejecutarImpresionComprobante(comprobanteId, serieCorrelativoTicket);
        }

        // Toast de confirmación
        const serieInfo = serieCorrelativoTicket ? ` · ${serieCorrelativoTicket}` : "";
        const vueltoInfo = vueltoFinal > 0 ? ` · Vuelto: S/ ${vueltoFinal.toFixed(2)}` : "";
        showToast(`${tipoComprobanteVenta} emitida${serieInfo}${vueltoInfo}`, "success");
      } catch (err) {
        const data = (err as { response?: { data?: { mensaje?: string; message?: string; detalle?: string } } })?.response?.data;
        const mensaje = data?.mensaje ?? data?.message ?? "Error al generar el comprobante";
        const detalle = data?.detalle;
        showToast(detalle ? `${mensaje}: ${detalle}` : mensaje, "error");

        if (/insuficiente|no encontrado|no existe|sin stock|stock/i.test(`${mensaje} ${detalle ?? ""}`)) {
          fetchProductosSucursal().catch(() => {});
        }
      } finally {
        terminarEmisionSegundoPlano(procesoId);
      }
    })();
  };

  // Validación de si se puede emitir el comprobante actual
  const boletaMayor700SinDoc =
    tipoComprobante === "Boleta" &&
    totales.total >= 700 &&
    (!documentoTrim || ![8, 9].includes(documentoTrim.length));
  const boletaDniIncompleto =
    tipoComprobante === "Boleta" &&
    documentoTrim.length > 0 &&
    ![8, 9].includes(documentoTrim.length);
  const notaVentaDocIncompleto =
    tipoComprobante === "Nota de Venta" &&
    documentoTrim.length > 0 &&
    ![8, 9, 11].includes(documentoTrim.length);
  const facturaSinRuc = tipoComprobante === "Factura" && documentoTrim.length !== 11;
  const onlineReal = isOnline && (typeof navigator !== "undefined" ? navigator.onLine : true);
  const facturaSinRazonSocial = tipoComprobante === "Factura" && onlineReal && (!nombreManualCliente.trim() && !cliente?.razonSocial);

  const puedeEmitir =
    !emitiendo &&
    !(pagoDividido && faltanteDividido > 0) &&
    !(esCredito && (!cuotasCuadran || cuotasCredito.some((c) => (parseFloat(c.monto) || 0) <= 0))) &&
    !boletaMayor700SinDoc &&
    !boletaDniIncompleto &&
    !notaVentaDocIncompleto &&
    !facturaSinRuc &&
    !facturaSinRazonSocial;

  // Confirmación con la tecla Enter en el modal de pago
  useEffect(() => {
    if (!mostrarPago || !activo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // Ignorar si el modal se acaba de abrir (evita doble disparo por el Enter de la vista principal)
        if (Date.now() - modalAbiertoAtRef.current < 400) {
          e.preventDefault();
          return;
        }
        if (puedeEmitir) {
          e.preventDefault();
          emitirVenta(false);
        } else if (boletaMayor700SinDoc) {
          e.preventDefault();
          showToast("SUNAT exige registrar el DNI del cliente para Boletas a partir de S/ 700.00", "error");
        } else if (boletaDniIncompleto) {
          e.preventDefault();
          showToast("Ingresa un DNI de 8 dígitos o bórralo para Clientes Varios", "error");
        } else if (notaVentaDocIncompleto) {
          e.preventDefault();
          showToast("El documento debe tener 8 (DNI), 9 (CE) u 11 (RUC) dígitos, o bórralo", "error");
        } else if (facturaSinRuc) {
          e.preventDefault();
          showToast("Ingresa un RUC válido de 11 dígitos para la Factura", "error");
        } else if (facturaSinRazonSocial) {
          e.preventDefault();
          showToast("Ingresa la Razón Social de la empresa para la Factura", "error");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activo,
    mostrarPago,
    puedeEmitir,
    boletaMayor700SinDoc,
    boletaDniIncompleto,
    notaVentaDocIncompleto,
    facturaSinRuc,
    facturaSinRazonSocial,
  ]);

  // ── Pantalla principal: grid de productos + carrito ───────────
  return (
    <>
      <div
        className={`relative w-full rounded-md border border-gray-200 bg-white shadow-sm flex flex-col lg:flex-row lg:overflow-hidden ${
          esRapida ? "min-h-full lg:h-full" : "lg:h-[calc(100vh-125px)]"
        }`}
      >
        {/* Barras de las ventas rápidas minimizadas: recuerdan que quedaron
            ventas a medias y las traen de vuelta con un clic. Van ancladas
            DENTRO de la caja (no a la ventana) porque el sidebar ocupa ancho
            real en el layout. En móvil sí es fija. Se apilan hacia arriba.
            Solo se muestran en la caja principal, nunca dentro de una ventana rápida. */}
        {!esRapida && ventasRapidas?.some(vr => vr.minimizada) && (
          <div className="fixed bottom-20 left-3 lg:absolute lg:bottom-3 lg:left-3 z-30 flex flex-col-reverse gap-2">
            {ventasRapidas.filter(vr => vr.minimizada).map((vr) => {
              const cfg = VENTAS_RAPIDAS_CONFIG[vr.configIndex];
              return (
                <button
                  key={vr.configIndex}
                  type="button"
                  onClick={vr.onAbrir}
                  className={`flex items-center gap-2.5 rounded-lg ${cfg.color} pl-3 pr-3.5 py-2 text-white shadow-[0_10px_30px_-8px_${cfg.shadowColor}] ring-1 ring-white/20 ${cfg.hoverColor} active:scale-[0.98] transition-all cursor-pointer`}
                  title={`Retomar ${cfg.label} (${cfg.key})`}
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] font-semibold text-white/75">{cfg.label} en espera</span>
                    <span className="text-xs font-bold tabular-nums">
                      {vr.items} producto{vr.items === 1 ? "" : "s"} · S/ {vr.total.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold opacity-70">{cfg.key}</span>
                  <Maximize2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                </button>
              );
            })}
          </div>
        )}
        {/* ── Columna izquierda: buscador + grid de productos ── */}
        <div className="flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100 lg:overflow-hidden">
          <div className="shrink-0 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  // El Enter lo procesa únicamente handleGlobalKeyDown (ver más
                  // abajo): usa scannerBufferRef, que se actualiza de forma
                  // síncrona por cada tecla y no depende del ciclo de render de
                  // React, así que es la fuente más confiable del código
                  // completo. Duplicar el manejo aquí (con el estado `busqueda`,
                  // que puede ir un paso atrás del buffer en escaneos rápidos)
                  // causaba que Enter se procesara dos veces con datos
                  // distintos, agregando a veces el producto equivocado.
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                placeholder="Escanea con la cámara, lector físico o busca por nombre / código"
                className="w-full h-9.5 pl-8 pr-7 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                if (refrescandoStock) return;
                setRefrescandoStock(true);
                ultimaRevalidacionRef.current = Date.now();
                try {
                  await fetchProductosSucursal();
                  showToast("Stock actualizado", "success");
                } catch {
                  showToast("No se pudo actualizar el stock", "error");
                } finally {
                  setRefrescandoStock(false);
                }
              }}
              className="h-9.5 w-9.5 flex items-center justify-center bg-white border border-gray-200 text-gray-500 rounded-md hover:bg-gray-50 hover:text-brand-blue active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer"
              title="Actualizar stock desde el servidor"
            >
              <RefreshCw size={14} className={refrescandoStock ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={() => {
                const raw = busqueda.trim();
                setCodigoBarrasNuevoProducto(raw);
                setNombreNuevoProducto(/^\d{4,}$/.test(raw) ? "" : raw);
                setModalCrearRapidoAbierto(true);
              }}
              className="h-9.5 flex items-center justify-center gap-1.5 px-3 bg-[#EEF3FB] text-brand-blue border border-[#D0E0F7] rounded-md text-xs font-bold hover:bg-[#D9E7FB] hover:border-[#BBD4F7] active:scale-[0.98] transition-all shadow-xs shrink-0 cursor-pointer"
              title="Registrar producto nuevo rápidamente"
            >
              <PackagePlus size={14} />
              <span className="hidden sm:inline">+ Producto</span>
            </button>

            {/* F1: botón principal "Venta rápida" siempre visible */}
            {!esRapida && ventasRapidas?.[0] && (
              <button
                type="button"
                onClick={ventasRapidas[0].onAbrir}
                className="relative h-9.5 flex items-center justify-center gap-1.5 px-3 bg-brand-blue text-white rounded-md text-xs font-semibold hover:bg-[#0a2050] active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer"
                title="Atender otra venta en paralelo sin perder este carrito (F1)"
              >
                <Zap size={14} />
                <span className="hidden sm:inline">Venta rápida</span>
                {ventasRapidas[0].items > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-amber-400 text-[10px] font-bold text-gray-900 flex items-center justify-center tabular-nums shadow-sm">
                    {ventasRapidas[0].items}
                  </span>
                )}
              </button>
            )}
            {/* F2/F3: solo aparecen si tienen productos en espera */}
            {!esRapida && ventasRapidas?.slice(1).map((vr) => {
              if (vr.items === 0) return null;
              const cfg = VENTAS_RAPIDAS_CONFIG[vr.configIndex];
              return (
                <button
                  key={vr.configIndex}
                  type="button"
                  onClick={vr.onAbrir}
                  className={`relative h-9.5 flex items-center justify-center gap-1 px-2.5 ${cfg.color} text-white rounded-md text-xs font-semibold ${cfg.hoverColor} active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer`}
                  title={`${cfg.label} (${cfg.key})`}
                >
                  <Zap size={13} />
                  <span className="tabular-nums">{cfg.key}</span>
                  <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-amber-400 text-[10px] font-bold text-gray-900 flex items-center justify-center tabular-nums shadow-sm">
                    {vr.items}
                  </span>
                </button>
              );
            })}

            {!isScanning ? (
              <button
                type="button"
                onClick={startScanning}
                className="h-9.5 flex items-center justify-center gap-1.5 px-3 bg-brand-blue text-white rounded-md text-xs font-semibold hover:bg-[#0a2050] active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <ScanBarcode size={14} />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanning}
                className="h-9.5 flex items-center justify-center gap-1.5 px-3 bg-rose-500 text-white rounded-md text-xs font-semibold hover:bg-rose-600 active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <X size={14} />
                <span>Cerrar</span>
              </button>
            )}
          </div>

          {/* El stock que se está viendo no vino del servidor: hay que decirlo.
              Sin este aviso, dos cajas podían mostrar números distintos sin que
              nadie supiera cuál era el real. */}
          {productosDesactualizados && (
            <div className="shrink-0 flex items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-medium text-amber-700">
              <WifiOff size={12} className="shrink-0" />
              <span>
                Stock guardado en este equipo
                {fechaCache ? ` · ${new Date(fechaCache).toLocaleString("es-PE")}` : ""}
                {" · puede no coincidir con otras cajas"}
              </span>
            </div>
          )}

          {/* Visor de cámara en vivo para ventas (cuadrado estilo imagetotext.info) */}
          {isScanning && (
            <div className="shrink-0 p-3 bg-gray-100/80 border-b border-gray-200 space-y-2.5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-gray-800">
                  Escanea tus productos
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  {items.length} producto{items.length === 1 ? "" : "s"} en el carrito
                </span>
              </div>
              <div className="relative w-full max-w-65 aspect-square mx-auto bg-black rounded-2xl overflow-hidden border border-white/15 shadow-xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {cameraError ? (
                  <div className="absolute inset-0 z-20 bg-gray-950/95 flex flex-col items-center justify-center text-center p-4">
                    <CameraOff className="w-9 h-9 text-gray-500 mb-2 animate-bounce" />
                    <p className="text-xs font-semibold text-gray-300">
                      {cameraError}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Puedes usar un lector físico de código de barras
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-3 border-2 border-white/20 rounded-xl flex items-center justify-center overflow-hidden z-10">
                      <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)] animate-pulse" />
                    </div>

                    {/* Banner de confirmación visual instantánea sobre la cámara */}
                    {ultimoEscaneadoCamara && (
                      <div
                        className={`absolute bottom-2 inset-x-2 z-20 rounded-xl p-2 text-center text-xs font-bold text-white shadow-lg transition-all animate-in slide-in-from-bottom-2 duration-200 ${
                          ultimoEscaneadoCamara.exito
                            ? "bg-emerald-600/95 border border-emerald-400/50"
                            : "bg-rose-600/95 border border-rose-400/50"
                        }`}
                      >
                        {ultimoEscaneadoCamara.exito ? (
                          <div className="flex items-center justify-center gap-1.5 truncate">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                            <span className="truncate">
                              {ultimoEscaneadoCamara.nombre} (S/ {ultimoEscaneadoCamara.precio.toFixed(2)})
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-[11px] truncate">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-white" />
                            <span className="truncate">{ultimoEscaneadoCamara.nombre}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 lg:overflow-y-auto p-3">
            {loadingSucursal ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 animate-pulse">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex flex-col rounded-md border border-gray-100 bg-white overflow-hidden">
                    <div className="aspect-square w-full bg-white" />
                    <div className="p-1 space-y-1.5 bg-gray-50">
                      <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : productosGrid.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="bg-gray-100 rounded-full p-5 mb-4">
                  <PackageSearch className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-500 font-semibold">Sin resultados</p>
                <p className="text-gray-400 text-sm mt-1">Prueba con otro nombre o código</p>
                {busqueda.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const raw = busqueda.trim();
                      setCodigoBarrasNuevoProducto(raw);
                      setNombreNuevoProducto(/^\d{4,}$/.test(raw) ? "" : raw);
                      setModalCrearRapidoAbierto(true);
                    }}
                    className="mt-3 px-4 py-2 bg-brand-blue hover:bg-[#0a2050] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <PackagePlus size={14} />
                    Registrar &quot;{busqueda}&quot; como nuevo producto
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5">
                  {productosGridVisualizados.map((p, idx) => {
                    const itemCarrito = items.find((i) => i.productoId === p.productoId);
                    const stockDisp = config?.isStock
                      ? calcularDisponible(p, itemsMasReservas, productosSucursal, true, productosPorId)
                      : null;
                    return (
                      <ProductoGridCard
                        key={p.productoId}
                        p={p}
                        cantidadEnCarrito={itemCarrito?.cantidad ?? 0}
                        stockDisp={stockDisp}
                        onClick={() => agregarProducto(p)}
                        index={idx}
                      />
                    );
                  })}
                </div>

                {/* Sentinel invisible: IntersectionObserver lo detecta y carga más productos automáticamente */}
                {productosGrid.length > limiteVistaGrid && (
                  <div ref={sentinelRef} className="h-1" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: marca + documento + carrito (docked en desktop) ── */}
        <div className="hidden lg:flex w-96 shrink-0 flex-col bg-gray-50/40 lg:overflow-hidden">
          <div
            className="shrink-0 px-5 py-4 text-white flex items-center gap-3 relative overflow-hidden bg-cover bg-center"
            style={{
              backgroundImage: "linear-gradient(rgba(15, 46, 100, 0.90), rgba(9, 26, 61, 0.20)), url('/banner.webp')",
            }}
          >
            <div className="w-9 h-9 rounded-md bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20 shadow-sm z-10">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 relative z-10">
              <p className="text-sm font-bold leading-tight drop-shadow-xs">Caja Autopago</p>
              <p className="text-[11px] text-blue-100 truncate font-medium">
                {user?.nombreEmpresa ?? ""}
                {user?.nombreSucursal ? ` · ${user.nombreSucursal}` : ""}
              </p>
            </div>
          </div>

          {/* Documento del cliente — siempre visible, opcional */}
          <div className="shrink-0 px-3 pt-3">
            <div className="relative">
              <UserRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={documento}
                onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="DNI o RUC del cliente (opcional)"
                className="w-full pl-8 pr-7 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
              />
              {documento && (
                <button
                  type="button"
                  onClick={() => setDocumento("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {documentoTrim ? (
              <div className="text-xs mt-1.5 px-1">{estadoClienteInline}</div>
            ) : (
              <p className="text-xs text-gray-400 mt-1 px-1">
                DNI/CE → Boleta{config?.useNotaVenta ? " o Nota de Venta" : ""} · RUC → Factura · Vacío → Clientes varios
              </p>
            )}
          </div>

          <div ref={cartContainerRef} className="flex-1 lg:overflow-y-auto px-3 py-3 space-y-2">
            {items.length > 0 && (
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Productos ({items.length})
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmarLimpiarTodo(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-700 hover:underline transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar todo
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="bg-gray-100 rounded-full p-4 mb-3">
                  <PackageSearch className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-semibold text-sm">Aún no hay productos</p>
                <p className="text-gray-400 text-xs mt-1">
                  Toca un producto o escanea su código para agregarlo
                </p>
              </div>
            ) : (
              items.map((i) => {
                const prodInfo = productosPorId.get(i.productoId);
                const stockDisp = config?.isStock && prodInfo && prodInfo.tipoProducto === "BIEN"
                  ? calcularDisponible(prodInfo, itemsMasReservas, productosSucursal, true, productosPorId)
                  : null;
                const esReciente = i.key === ultimoItemAgregadoKey;

                return (
                  <div
                    key={i.key}
                    className={`rounded-lg border p-2 transition-all shadow-2xs space-y-1.5 ${
                      esReciente
                        ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/50 shadow-md scale-[1.01]"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    {/* Fila superior: Imagen + Nombre + Precio Unitario Editable + Stock + Eliminar */}
                    <div className="flex items-center gap-2">
                      <ImagenProductoCuadrada url={i.urlImagen} alt={i.descripcion} size="sm" />

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight truncate flex items-center gap-1">
                          {i.descripcion}
                          {i.tieneVencido && (
                            <span title="Lote vencido sin retirar">
                              <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            </span>
                          )}
                        </p>

                        <div className="flex items-center justify-between gap-1 flex-wrap mt-0.5">
                          {/* Precio Unitario Editable */}
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <span className="font-medium">S/</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                i.precioStr !== undefined
                                  ? i.precioStr
                                  : i.precio === 0
                                    ? "0"
                                    : i.precio
                              }
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const raw = e.target.value.replace(",", ".");
                                if (raw === "" || raw === ".") {
                                  actualizarPrecioUnitarioDirecto(i.key, 0, raw);
                                } else if (/^\d*\.?\d*$/.test(raw)) {
                                  const parsed = parseFloat(raw);
                                  if (!isNaN(parsed)) {
                                    actualizarPrecioUnitarioDirecto(i.key, parsed, raw);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value.replace(",", ".");
                                const parsed = parseFloat(raw);
                                actualizarPrecioUnitarioDirecto(
                                  i.key,
                                  isNaN(parsed) ? 0 : parseFloat(parsed.toFixed(2)),
                                  undefined,
                                );
                              }}
                              className="w-14 h-4.5 px-1 text-center font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded focus:border-brand-blue focus:bg-white outline-none tabular-nums text-[11px]"
                              title="Haz clic para cambiar el precio unitario"
                            />
                            <span>
                              {i.unidadMedida
                                ? `/ ${i.unidadMedida === "KGM" ? "kg" : i.unidadMedida === "LTR" ? "lt" : i.unidadMedida === "NIU" ? "c/u" : i.unidadMedida}`
                                : "c/u"}
                            </span>
                          </div>

                          {/* Badge de Stock Disponible Restante */}
                          {stockDisp !== null && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold tabular-nums shrink-0 ${
                                stockDisp <= 0
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : stockDisp <= 5
                                    ? "bg-red-100 text-red-700 border border-red-200"
                                    : stockDisp <= 10
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                              title={`Stock restante disponible: ${prodInfo?.esPaquete ? `${stockDisp} und.` : `${formatearCantidadUnidad(stockDisp, i.unidadMedida)} ${abreviaturaUnidad(i.unidadMedida)}`}`}
                            >
                              Stock: {prodInfo?.esPaquete ? `${stockDisp} und.` : `${formatearCantidadUnidad(stockDisp, i.unidadMedida)} ${abreviaturaUnidad(i.unidadMedida)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Eliminar */}
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((it) => it.key !== i.key))}
                        className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Fila inferior: Control de Cantidad (Izquierda) + Total de Línea (Derecha en 1 sola línea) */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(i.key, -1)}
                          className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
                          title="Disminuir"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            i.cantidadStr !== undefined
                              ? i.cantidadStr
                              : i.cantidad === 0
                                ? ""
                                : i.cantidad
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            if (raw === "" || raw === ".") {
                              setItems((prev) =>
                                prev.map((it) =>
                                  it.key === i.key ? { ...it, cantidad: 0, cantidadStr: raw } : it,
                                ),
                              );
                            } else if (/^\d*\.?\d*$/.test(raw)) {
                              const parsed = parseFloat(raw);
                              const val = isNaN(parsed) ? 0 : parsed;
                              actualizarCantidadDirecta(i.key, val, raw);
                            }
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            const parsed = parseFloat(raw);
                            if (isNaN(parsed) || parsed <= 0) {
                              setItems((prev) => prev.filter((it) => it.key !== i.key));
                            } else {
                              setItems((prev) =>
                                prev.map((it) =>
                                  it.key === i.key
                                    ? { ...it, cantidad: parseFloat(parsed.toFixed(3)), cantidadStr: undefined }
                                    : it,
                                ),
                              );
                            }
                          }}
                          className="w-12 h-6 text-center text-xs font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded focus:border-brand-blue focus:bg-white outline-none tabular-nums px-0.5"
                          title="Ingresa la cantidad o peso (ej. 0.5, 0.4)"
                        />

                        <button
                          type="button"
                          onClick={() => cambiarCantidad(i.key, 1)}
                          className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
                          title="Aumentar"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-400 font-medium">Total:</span>
                        <span className="text-xs font-bold text-gray-900 tabular-nums">
                          S/ {(i.precio * i.cantidad).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer con totales y cobrar — fijo en la parte inferior en desktop */}
          <div className="shrink-0 sticky bottom-0 lg:static border-t border-gray-200 bg-white px-4 py-4 space-y-3 z-10">
            <button
              onClick={abrirPago}
              disabled={items.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-blue py-3.5 text-white text-base font-bold shadow-sm hover:bg-[#0a2050] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              Cobrar S/ {totales.total.toFixed(2)}
              <ArrowRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Barra Flotante de Carrito en Móvil (lg:hidden) ── */}
      {items.length > 0 && !mostrarPago && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
          <button
            type="button"
            onClick={() => setMostrarCarritoMobile(true)}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue shrink-0">
              <ShoppingBag className="w-5 h-5 text-brand-blue" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                {items.length}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 font-medium block uppercase tracking-wide">
                Ver carrito ({totales.unidades % 1 === 0 ? totales.unidades : parseFloat(totales.unidades.toFixed(3))} und.)
              </span>
              <span className="text-base font-bold text-gray-900 tabular-nums">
                S/ {totales.total.toFixed(2)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={abrirPago}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-white text-sm font-bold shadow-md hover:bg-[#0a2050] active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            Cobrar S/ {totales.total.toFixed(2)}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Drawer / Modal Deslizante del Carrito en Móvil (lg:hidden) ── */}
      {mostrarCarritoMobile && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setMostrarCarritoMobile(false)}
          />
          <div className="relative z-10 w-full bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Header del Drawer */}
            <div className="shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-blue" />
                <span className="text-sm font-bold text-gray-900">
                  Tu Carrito ({items.length} producto{items.length === 1 ? "" : "s"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmarLimpiarTodo(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMostrarCarritoMobile(false)}
                  className="w-8 h-8 rounded-full bg-gray-200/70 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Documento Cliente opcional en el drawer */}
            <div className="shrink-0 px-4 pt-3">
              <div className="relative">
                <UserRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  placeholder="DNI o RUC del cliente (opcional)"
                  className="w-full pl-8 pr-7 py-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all text-xs"
                />
                {documento && (
                  <button
                    type="button"
                    onClick={() => setDocumento("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {documentoTrim && <div className="text-xs mt-1.5 px-1">{estadoClienteInline}</div>}
            </div>

            {/* Lista de productos en el Drawer */}
            <div ref={mobileCartContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {items.map((i) => {
                const prodInfo = productosPorId.get(i.productoId);
                const stockDisp = config?.isStock && prodInfo && prodInfo.tipoProducto === "BIEN"
                  ? calcularDisponible(prodInfo, itemsMasReservas, productosSucursal, true, productosPorId)
                  : null;
                const esReciente = i.key === ultimoItemAgregadoKey;

                return (
                  <div
                    key={i.key}
                    className={`rounded-lg border p-2.5 shadow-2xs space-y-1.5 transition-all ${
                      esReciente
                        ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/50 shadow-md scale-[1.01]"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ImagenProductoCuadrada url={i.urlImagen} alt={i.descripcion} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight truncate flex items-center gap-1">
                          {i.descripcion}
                          {i.tieneVencido && (
                            <span title="Lote vencido sin retirar">
                              <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            </span>
                          )}
                        </p>
                        <div className="flex items-center justify-between gap-1 flex-wrap mt-0.5">
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <span className="font-medium">S/</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={i.precioStr !== undefined ? i.precioStr : i.precio === 0 ? "0" : i.precio}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const raw = e.target.value.replace(",", ".");
                                if (raw === "" || raw === ".") {
                                  actualizarPrecioUnitarioDirecto(i.key, 0, raw);
                                } else if (/^\d*\.?\d*$/.test(raw)) {
                                  const parsed = parseFloat(raw);
                                  if (!isNaN(parsed)) actualizarPrecioUnitarioDirecto(i.key, parsed, raw);
                                }
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value.replace(",", ".");
                                const parsed = parseFloat(raw);
                                actualizarPrecioUnitarioDirecto(i.key, isNaN(parsed) ? 0 : parseFloat(parsed.toFixed(2)), undefined);
                              }}
                              className="w-14 h-5 px-1 text-center font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded focus:border-brand-blue focus:bg-white outline-none tabular-nums text-[11px]"
                            />
                            <span>
                              {i.unidadMedida ? `/ ${i.unidadMedida === "KGM" ? "kg" : i.unidadMedida === "LTR" ? "lt" : i.unidadMedida === "NIU" ? "c/u" : i.unidadMedida}` : "c/u"}
                            </span>
                          </div>

                          {stockDisp !== null && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold tabular-nums shrink-0 ${
                                stockDisp <= 0
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : stockDisp <= 5
                                    ? "bg-red-100 text-red-700 border border-red-200"
                                    : stockDisp <= 10
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                              title={`Stock restante disponible: ${prodInfo?.esPaquete ? `${stockDisp} und.` : `${formatearCantidadUnidad(stockDisp, i.unidadMedida)} ${abreviaturaUnidad(i.unidadMedida)}`}`}
                            >
                              Stock: {prodInfo?.esPaquete ? `${stockDisp} und.` : `${formatearCantidadUnidad(stockDisp, i.unidadMedida)} ${abreviaturaUnidad(i.unidadMedida)}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((it) => it.key !== i.key))}
                        className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(i.key, -1)}
                          className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={i.cantidadStr !== undefined ? i.cantidadStr : i.cantidad === 0 ? "" : i.cantidad}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          if (raw === "" || raw === ".") {
                            setItems((prev) => prev.map((it) => (it.key === i.key ? { ...it, cantidad: 0, cantidadStr: raw } : it)));
                          } else if (/^\d*\.?\d*$/.test(raw)) {
                            const parsed = parseFloat(raw);
                            actualizarCantidadDirecta(i.key, isNaN(parsed) ? 0 : parsed, raw);
                          }
                        }}
                        onBlur={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          const parsed = parseFloat(raw);
                          if (isNaN(parsed) || parsed <= 0) {
                            setItems((prev) => prev.filter((it) => it.key !== i.key));
                          } else {
                            setItems((prev) => prev.map((it) => (it.key === i.key ? { ...it, cantidad: parseFloat(parsed.toFixed(3)), cantidadStr: undefined } : it)));
                          }
                        }}
                        className="w-12 h-6 text-center text-xs font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded focus:border-brand-blue focus:bg-white outline-none tabular-nums px-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(i.key, 1)}
                        className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-400 font-medium">Total:</span>
                      <span className="text-xs font-bold text-gray-900 tabular-nums">
                        S/ {(i.precio * i.cantidad).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Footer del Drawer */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">Total ({totales.unidades % 1 === 0 ? totales.unidades : parseFloat(totales.unidades.toFixed(3))} und.)</span>
                <span className="font-bold text-brand-blue tabular-nums text-base">S/ {totales.total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrarCarritoMobile(false);
                  abrirPago();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-blue py-3.5 text-white text-base font-bold shadow-md hover:bg-[#0a2050] active:scale-[0.99] transition-all cursor-pointer"
              >
                Cobrar S/ {totales.total.toFixed(2)}
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalEliminar
        isOpen={confirmarLimpiarTodo}
        mensaje="Vaciarás el carrito completo"
        nombre={`Se quitarán ${items.length} producto${items.length === 1 ? "" : "s"} agregados a la venta.`}
        onClose={() => setConfirmarLimpiarTodo(false)}
        onConfirm={() => {
          setItems([]);
          setConfirmarLimpiarTodo(false);
        }}
      />

      {/* ── Modal: Confirmar Pago ── */}
      <Modal
        isOpen={mostrarPago}
        onClose={() => setMostrarPago(false)}
        title={`Confirmar Pago · ${items.length} producto${items.length === 1 ? "" : "s"}`}
        className="max-w-4xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* ── Izquierda: resumen de productos ── */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="rounded-md border border-gray-100 overflow-hidden">
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                {items.map((i) => (
                  <div key={i.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {i.cantidad} {abreviaturaUnidad(i.unidadMedida)} · {i.descripcion}
                      </p>
                      <p className="text-xs text-gray-400">{i.unidadMedida}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 tabular-nums shrink-0">
                      S/ {(i.precio * i.cantidad).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-gray-50 px-4 py-3 space-y-1 text-sm">
              {tipoComprobante !== "Nota de Venta" ? (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>Base imponible</span>
                    <span className="tabular-nums">S/ {totales.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>IGV ({igvPct}%)</span>
                    <span className="tabular-nums">S/ {totales.igv.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-gray-500 text-xs italic">
                  <span>Nota de Venta</span>
                  <span>Sin IGV discriminado</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                <span>Total</span>
                <span className="tabular-nums">S/ {totales.total.toFixed(2)}</span>
              </div>
              {totalComisionPagoTarjeta > 0 && (
                <div className="mt-2.5 rounded-lg border-2 border-brand-blue/70 bg-blue-50/80 p-3 shadow-xs space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-blue-900">
                    <span>Comisión POS ({comisionPagoTarjetaPct}%)</span>
                    <span className="tabular-nums font-bold text-blue-900">+S/ {totalComisionPagoTarjeta.toFixed(2)}</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1.5 border-t border-blue-200">
                    <span className="text-base font-extrabold text-blue-950">Total + Comisión</span>
                    <span className="text-2xl font-black text-brand-blue tabular-nums">
                      S/ {(totales.total + totalComisionPagoTarjeta).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-700/80 font-medium">Informativo — no afecta el comprobante</p>
                </div>
              )}
            </div>

            {/* Monto recibido + vuelto (cuando es Efectivo y no es pago dividido ni crédito) */}
            {!pagoDividido && !esCredito && medioPago === "Efectivo" && (
              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Monto recibido</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">S/</span>
                  <input
                    ref={montoInputRef}
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value.replace(/[^0-9.]/g, ""))}
                    onFocus={(e) => e.target.select()}
                    onMouseUp={(e) => {
                      if (
                        document.activeElement === e.currentTarget &&
                        e.currentTarget.selectionStart === 0 &&
                        e.currentTarget.selectionEnd === e.currentTarget.value.length
                      ) {
                        e.preventDefault();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (Date.now() - modalAbiertoAtRef.current < 400) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        if (
                          !emitiendo &&
                          !(pagoDividido && faltanteDividido > 0) &&
                          !(esCredito && (!cuotasCuadran || cuotasCredito.some((c) => (parseFloat(c.monto) || 0) <= 0)))
                        ) {
                          emitirVenta();
                        }
                      }
                    }}
                    inputMode="decimal"
                    className="w-full h-11 pl-8 pr-9 rounded-md border border-gray-200 text-right text-lg font-bold tabular-nums outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                  />
                  {montoRecibido && (
                    <button
                      type="button"
                      onClick={() => {
                        setMontoRecibido("");
                        montoInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                      title="Limpiar monto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMontoRecibido(totales.total.toFixed(2));
                      montoInputRef.current?.focus();
                      montoInputRef.current?.select();
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                      parseFloat(montoRecibido) === totales.total
                        ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    Exacto (S/ {totales.total.toFixed(2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMontoRecibido("");
                      montoInputRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-gray-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpiar
                  </button>
                  {obtenerMontosRapidos(totales.total).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMontoRecibido(m.toFixed(2));
                        montoInputRef.current?.focus();
                        montoInputRef.current?.select();
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                        parseFloat(montoRecibido) === m
                          ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      S/ {m}
                    </button>
                  ))}
                </div>
                <div
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${
                    faltante > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <span>{faltante > 0 ? "Falta" : "Vuelto"}</span>
                  <span className="tabular-nums">S/ {(faltante > 0 ? faltante : vuelto).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Botón en columna izquierda: Confirmar e Imprimir */}
            <div className="pt-2 mt-auto">
              <button
                type="button"
                onClick={() => emitirVenta(true)}
                disabled={!puedeEmitir}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-[#004b23] py-3.5 px-4 text-white text-base font-bold shadow-sm hover:bg-[#00381a] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-center"
              >
                {emitiendo ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin shrink-0" /> Emitiendo...
                  </>
                ) : esCredito ? (
                  <>
                    <Printer className="w-4.5 h-4.5 shrink-0" /> Registrar al crédito e Imprimir
                  </>
                ) : boletaMayor700SinDoc ? (
                  "Ingresa DNI (Boleta ≥ S/ 700)"
                ) : boletaDniIncompleto ? (
                  `Ingresa DNI de 8 dígitos (${documentoTrim.length}/8)`
                ) : notaVentaDocIncompleto ? (
                  "Ingresa DNI (8) o RUC (11)"
                ) : facturaSinRuc ? (
                  "Ingresa RUC (11 dígitos)"
                ) : facturaSinRazonSocial ? (
                  "Ingresa Razón Social"
                ) : (
                  <>
                    <Printer className="w-4.5 h-4.5 shrink-0" />
                    {`Confirmar e Imprimir S/ ${totales.total.toFixed(2)}`}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Derecha: comprobante + pago ── */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Comprobante */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Comprobante</p>
              <div className={`grid gap-2 ${config?.useNotaVenta ? "grid-cols-3" : "grid-cols-2"}`}>
                <button
                  type="button"
                  onClick={() => elegirTipoComprobante("Boleta")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border-2 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    tipoComprobante === "Boleta"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Boleta
                </button>
                {config?.useNotaVenta && (
                  <button
                    type="button"
                    onClick={() => elegirTipoComprobante("Nota de Venta")}
                    className={`flex items-center justify-center gap-1.5 rounded-md border-2 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                      tipoComprobante === "Nota de Venta"
                        ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                        : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> N. Venta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => elegirTipoComprobante("Factura")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border-2 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    tipoComprobante === "Factura"
                      ? "border-brand-blue bg-brand-blue/10 text-brand-blue font-bold shadow-sm"
                      : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Factura
                </button>
              </div>

              {/* Alerta SUNAT Boleta >= S/ 700 sin DNI */}
              {tipoComprobante === "Boleta" && totales.total >= 700 && (!documentoTrim || documentoTrim.length < 8) && (
                <div className="mt-2 rounded-md border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <p className="font-bold text-rose-900">Normativa SUNAT obligatoria (≥ S/ 700.00)</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Debes registrar el <strong>DNI o CE</strong> del cliente para poder emitir esta boleta.
                    </p>
                  </div>
                </div>
              )}

              {/* Alerta SUNAT Factura sin RUC */}
              {tipoComprobante === "Factura" && documentoTrim.length !== 11 && (
                <div className="mt-2 rounded-md border border-brand-blue/30 bg-blue-50/80 p-2.5 text-xs text-brand-blue flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <p className="font-bold text-gray-900">RUC Requerido para Factura</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Ingresa el <strong>RUC (11 dígitos)</strong> de la empresa en el campo de abajo para emitir la factura.
                    </p>
                  </div>
                </div>
              )}

              {/* Cliente en el modal de cobro */}
              <div className="mt-2 text-xs">
                <div className="rounded-md border border-gray-200 bg-gray-50/70 p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-bold text-[11px] text-gray-600 uppercase tracking-wide flex items-center gap-1">
                      <UserRound className="w-3.5 h-3.5 text-brand-blue" />
                      {tipoComprobante === "Factura"
                        ? "RUC / Empresa *"
                        : tipoComprobante === "Nota de Venta"
                          ? "Cliente (DNI / RUC)"
                          : "Cliente (DNI)"}
                    </span>
                    {sinDocumento && tipoComprobante !== "Factura" && (
                      <span className="text-[11px] text-gray-400 font-medium">Clientes varios (opcional)</span>
                    )}
                  </div>

                  {/* Input de Documento en el Modal */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, maxDocLen))}
                      placeholder={
                        tipoComprobante === "Factura"
                          ? "Ingresa RUC de la empresa (11 dígitos) *"
                          : totales.total >= 700 && tipoComprobante === "Boleta"
                            ? "Ingresa DNI (8 dígitos) - Requerido por SUNAT"
                            : docPlaceholder
                      }
                      className={`w-full h-8.5 pl-3 pr-7 bg-white rounded border text-xs font-semibold outline-none transition-all ${
                        tipoComprobante === "Factura" && documentoTrim.length !== 11
                          ? "border-brand-blue focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30"
                          : totales.total >= 700 && tipoComprobante === "Boleta" && (!documentoTrim || documentoTrim.length < 8)
                            ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                            : boletaDniIncompleto || notaVentaDocIncompleto
                              ? "border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                              : "border-gray-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30"
                      }`}
                    />
                    {documento && (
                      <button
                        type="button"
                        onClick={() => setDocumento("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {boletaDniIncompleto && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      DNI incompleto: tiene {documentoTrim.length} de 8 dígitos requeridos (o bórralo para Clientes Varios)
                    </p>
                  )}

                  {/* Estado o Nombre del cliente */}
                  {documentoTrim ? (
                    <>
                      {loadingCliente && !nombreManualCliente ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 py-0.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" />
                          <span>Buscando en RENIEC/SUNAT...</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={nombreManualCliente}
                            onChange={(e) => setNombreManualCliente(e.target.value)}
                            placeholder={
                              documentoTrim.length === 11 || tipoComprobante === "Factura"
                                ? "Razón Social (obligatoria para Factura)"
                                : "Nombre del cliente (opcional)"
                            }
                            className="w-full h-8 px-2.5 bg-white rounded border border-gray-200 text-xs font-semibold text-gray-800 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30"
                          />
                          {(documentoTrim.length === 11 || tipoComprobante === "Factura") && (
                            <input
                              type="text"
                              value={direccionManualCliente}
                              onChange={(e) => setDireccionManualCliente(e.target.value)}
                              placeholder="Dirección fiscal (opcional)"
                              className="w-full h-7.5 px-2.5 bg-white rounded border border-gray-200 text-[11px] text-gray-600 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30"
                            />
                          )}
                        </div>
                      )}
                    </>
                  ) : tipoComprobante === "Factura" ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={nombreManualCliente}
                        onChange={(e) => setNombreManualCliente(e.target.value)}
                        placeholder="Razón Social (obligatoria para Factura)"
                        className="w-full h-8 px-2.5 bg-white rounded border border-gray-200 text-xs font-semibold text-gray-800 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30"
                      />
                      <input
                        type="text"
                        value={direccionManualCliente}
                        onChange={(e) => setDireccionManualCliente(e.target.value)}
                        placeholder="Dirección fiscal (opcional)"
                        className="w-full h-7.5 px-2.5 bg-white rounded border border-gray-200 text-[11px] text-gray-600 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Opciones adicionales: Emitir con otra fecha y Pago dividido */}
              <div className="mt-2.5 flex items-center justify-between gap-2">
                {!mostrarFechaManual ? (
                  <button
                    type="button"
                    onClick={() => setMostrarFechaManual(true)}
                    className="text-xs text-gray-500 hover:text-brand-blue flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-gray-400" /> Emitir con otra fecha
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMostrarFechaManual(false)}
                    className="text-xs text-brand-blue font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-brand-blue" /> Ocultar fecha manual
                  </button>
                )}

                <button
                  type="button"
                  onClick={togglePagoDividido}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border-2 ${
                    pagoDividido
                      ? "border-brand-blue bg-brand-blue text-white shadow-md ring-2 ring-brand-blue/20"
                      : "border-brand-blue/40 bg-blue-50/80 text-brand-blue hover:bg-brand-blue hover:text-white hover:border-brand-blue"
                  }`}
                >
                  <Columns3 className="w-4 h-4 shrink-0" />
                  <span>Pago dividido</span>
                  {pagoDividido && (
                    <span className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      Activo
                    </span>
                  )}
                </button>
              </div>

              {mostrarFechaManual && (
                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50/50 p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-semibold flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5 text-brand-blue" /> Fecha de emisión
                    </span>
                    <span className="text-[11px] text-gray-400">Min. {fechaMinimaEmision}</span>
                  </div>
                  <input
                    type="date"
                    value={fechaEmisionManual}
                    min={fechaMinimaEmision}
                    max={formatoFechaActual().fecha}
                    onChange={(e) => setFechaEmisionManual(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                  />
                  {fechaEmisionManual && fechaEmisionManual < formatoFechaActual().fecha && (
                    <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Emitirás con fecha pasada. SUNAT permite hasta 3
                      días atrás.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFechaEmisionManual(formatoFechaActual().fecha);
                      setMostrarFechaManual(false);
                    }}
                    className="text-[11px] font-semibold text-brand-blue hover:underline cursor-pointer"
                  >
                    Usar fecha de hoy
                  </button>
                </div>
              )}
            </div>

              {!pagoDividido ? (
                <>
                  {/* Medios de pago */}
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Medio de pago</p>
                    <div className="grid grid-cols-3 gap-2">
                      {MEDIOS_PAGO.map((m) => {
                        const activo = medioPago === m.nombre;
                        return (
                          <button
                            key={m.nombre}
                            type="button"
                            onClick={() => setMedioPago(m.nombre)}
                            className={`group relative h-20 sm:h-22 rounded-xl border-2 overflow-hidden cursor-pointer transition-all active:scale-[0.98] ${
                              activo
                                ? "border-brand-blue ring-3 ring-brand-blue/25 shadow-md scale-[1.02]"
                                : "border-gray-200 hover:border-gray-300 hover:shadow-xs opacity-85 hover:opacity-100"
                            }`}
                          >
                            {/* Imagen que ocupa toda la card */}
                            <img
                              src={m.imagen}
                              alt={m.nombre}
                              loading="eager"
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {/* Velo sutil cuando está activo */}
                            {activo && (
                              <div className="absolute inset-0 bg-brand-blue/10 pointer-events-none" />
                            )}

                            {/* Badge de selección en esquina */}
                            {activo && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md animate-in zoom-in-50 duration-150 z-10">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            )}

                            {/* Franja de degradado inferior con el nombre legible */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-4 pb-1.5 px-1.5 flex items-center justify-center z-10">
                              <span className="text-[11px] sm:text-xs font-bold text-white tracking-wide drop-shadow-sm truncate">
                                {m.nombre}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Al crédito: solo si hay documento y la config lo permite */}
                  {!sinDocumento && config?.isCredito && (
                    <button
                      onClick={toggleCredito}
                      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                        esCredito ? "text-brand-blue" : "text-gray-500 hover:text-brand-blue"
                      }`}
                    >
                      <HandCoins className="w-3.5 h-3.5" /> Al crédito{esCredito ? " (activo)" : ""}
                    </button>
                  )}

                  {esCredito ? (
                    /* Crédito: adelanto opcional + cuotas del saldo pendiente */
                    <div className="space-y-2.5">
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                          Adelanto (opcional)
                        </p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">S/</span>
                          <input
                            value={adelantoCredito}
                            onChange={(e) => setAdelantoCredito(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="w-full h-11 pl-8 pr-3 rounded-md border border-gray-200 text-right text-lg font-bold tabular-nums outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                          ¿En cuántas cuotas?
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4, 6, 12].map((n) => (
                            <button
                              key={n}
                              onClick={() => setNumeroCuotasCredito(n)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                                numeroCuotasCredito === n
                                  ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                                  : "border-gray-200 text-gray-500 hover:border-gray-300"
                              }`}
                            >
                              {n === 1 ? "1 (contado del saldo)" : `${n} cuotas`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {cuotasCredito.map((c, idx) => (
                          <div key={c.numeroCuota} className="grid grid-cols-2 gap-2 items-end">
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1">Monto {idx + 1}</p>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">S/</span>
                                <input
                                  value={c.monto}
                                  onChange={(e) => actualizarMontoCuota(idx, e.target.value)}
                                  inputMode="decimal"
                                  className="w-full h-10 pl-8 pr-2 rounded-md border border-gray-200 text-right text-sm font-semibold tabular-nums outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1">Vence</p>
                              <input
                                type="date"
                                value={c.fechaVencimiento}
                                min={idx > 0 ? cuotasCredito[idx - 1].fechaVencimiento : undefined}
                                onChange={(e) =>
                                  setCuotasCredito((prev) =>
                                    prev.map((cc, i) => (i === idx ? { ...cc, fechaVencimiento: e.target.value } : cc)),
                                  )
                                }
                                className="w-full h-10 px-2 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs text-gray-500">
                          Suma de cuotas: <span className="font-semibold text-gray-800">S/ {sumaCuotasCredito.toFixed(2)}</span>
                        </span>
                        {!cuotasCuadran && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-rose-600">No cuadra</span>
                            <button
                              onClick={cuadrarCuotasConSaldo}
                              className="px-3 py-1.5 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
                            >
                              Cuadrar atuomáticamente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                {/* Observaciones */}
                <div>
                  <input
                    value={notaPago}
                    onChange={(e) => setNotaPago(e.target.value)}
                    placeholder={
                      esCredito
                        ? "Observaciones (opcional)"
                        : medioPago === "Efectivo"
                          ? "Observaciones (opcional)"
                          : "N° de operación (opcional)"
                    }
                    className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Pago dividido: varias filas medio de pago + monto */}
                <div className="space-y-2.5">
                  {pagosDivididos.map((p, idx) => (
                    <div key={p.id} className="rounded-md border border-gray-200 px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                          Pago {idx + 1}
                        </span>
                        {pagosDivididos.length > 1 && (
                          <button
                            onClick={() => quitarPagoDividido(p.id)}
                            className="text-gray-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={p.medioPago}
                          onChange={(e) => actualizarPagoDividido(p.id, "medioPago", e.target.value)}
                          className="h-10 px-2 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                        >
                          {MEDIOS_PAGO.map((m) => (
                            <option key={m.nombre} value={m.nombre} disabled={medioEnUsoEnOtraFila(m.nombre, p.id)}>
                              {m.nombre}
                              {medioEnUsoEnOtraFila(m.nombre, p.id) ? " (en uso)" : ""}
                            </option>
                          ))}
                        </select>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">S/</span>
                          <input
                            value={p.monto}
                            onChange={(e) =>
                              actualizarPagoDividido(p.id, "monto", e.target.value.replace(/[^0-9.]/g, ""))
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            className="w-full h-10 pl-8 pr-2 rounded-md border border-gray-200 text-right text-sm font-semibold tabular-nums outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {pagosDivididos.length < MEDIOS_PAGO.length && (
                    <button
                      onClick={agregarPagoDividido}
                      className="w-full rounded-md border-2 border-dashed border-gray-200 py-2 text-xs font-semibold text-brand-blue hover:border-brand-blue/40 transition-colors"
                    >
                      + Agregar otro método
                    </button>
                  )}
                </div>

                <div className="rounded-md bg-gray-50 px-3 py-2.5 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Total a pagar</span>
                    <span className="tabular-nums">S/ {totales.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Ingresado</span>
                    <span className="tabular-nums">S/ {ingresadoDividido.toFixed(2)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-semibold ${
                      faltanteDividido > 0 ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    <span>{faltanteDividido > 0 ? "Falta" : "Sobra"}</span>
                    <span className="tabular-nums">
                      S/ {(faltanteDividido > 0 ? faltanteDividido : sobranteDividido).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <input
                    value={notaPago}
                    onChange={(e) => setNotaPago(e.target.value)}
                    placeholder="Observaciones (opcional)"
                    className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                  />
                </div>
              </>
            )}

            {/* Botón en columna derecha: Confirmar sin imprimir */}
            <div className="pt-2 mt-auto">
              <button
                type="button"
                onClick={() => emitirVenta(false)}
                disabled={!puedeEmitir || emitiendo}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-blue py-3.5 px-4 text-white text-base font-bold shadow-sm hover:bg-[#0a2050] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-center"
              >
                {esCredito ? (
                  "Registrar venta al crédito"
                ) : boletaMayor700SinDoc ? (
                  "Ingresa DNI (Boleta ≥ S/ 700)"
                ) : boletaDniIncompleto ? (
                  `Ingresa DNI de 8 dígitos (${documentoTrim.length}/8)`
                ) : notaVentaDocIncompleto ? (
                  "Ingresa DNI (8) o RUC (11)"
                ) : facturaSinRuc ? (
                  "Ingresa RUC (11 dígitos)"
                ) : facturaSinRazonSocial ? (
                  "Ingresa Razón Social"
                ) : (
                  `Confirmar S/ ${totales.total.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Bloqueo eliminado: la emisión corre en segundo plano y el cajero puede seguir cobrando al siguiente cliente */}

      {/* ── Modal de éxito tras emitir ─────────────────────────────── */}
      {/* Pantalla de éxito eliminada: el flujo pasa directo a nueva venta tras confirmar */}




      {/* Modal de Ajuste Rápido de Stock cuando un producto no tiene unidades disponibles */}
      <ModalAjustarStockRapido
        isOpen={!!productoSinStock}
        onClose={() => setProductoSinStock(null)}
        producto={productoSinStock}
        onStockGuardado={handleStockGuardado}
      />

      {/* Modal de Registro Rápido de Producto cuando un producto no existe en el catálogo */}
      <ModalCrearProductoRapido
        isOpen={modalCrearRapidoAbierto}
        onClose={() => setModalCrearRapidoAbierto(false)}
        codigoBarrasInicial={codigoBarrasNuevoProducto}
        nombreInicial={nombreNuevoProducto}
        categorias={categorias}
        totalProductos={productosSucursal.length}
        sucursalId={sucursalId || 1}
        onProductoCreado={handleProductoCreado}
      />
    </>
  );
}

/**
 * Caja Autopago con cuatro ventas simultáneas.
 *
 * La caja principal se queda tal cual está (carrito, cliente, pago) y F2, F3 y
 * F4 abren tres cajas idénticas en ventanas flotantes para cobrarle en el acto
 * a quienes solo llevan un producto. Las cuatro comparten catálogo, stock,
 * empresa y sucursal, así que ninguna vende unidades que otra ya tiene apartadas.
 *
 * Las ventanas flotantes nunca se destruyen: se minimizan. Así el cajero salta
 * entre las cuatro ventas sin perder ninguna, y mientras las rápidas están
 * minimizadas la principal sigue siendo usable (no hay fondo que la bloquee).
 *
 * Solo una ventana flotante puede estar abierta a la vez: al abrir una se
 * minimizan automáticamente las demás.
 *
 * Serie y correlativo no se duplican: los asigna el backend al emitir, y como
 * las cuatro cajas comparten `useSucursal`, al terminar una venta las demás ya
 * ven el siguiente número.
 */
export default function CajaAutopago() {
  const { user } = useAuth();
  const sucursalId = user?.sucursalID ? parseInt(user.sucursalID) : null;

  const productos = useProductosSucursal(sucursalId, !!sucursalId);
  const recursoSucursal = useSucursal();
  const recursoEmpresa = useEmpresaEmisor();
  const recursoCategorias = useCategoriasLista();
  const { ventasSincronizadas } = useOfflineSales();
  const ultimaRevalidacionRef = useRef(0);

  const { fetchCategorias } = recursoCategorias;
  useEffect(() => {
    if (user?.ruc) {
      fetchCategorias(user.ruc);
    }
  }, [user?.ruc, fetchCategorias]);

  // ── Revalidación del stock mientras la caja está abierta ─────────────
  const fetchProductosRef = useRef(productos.fetchProductosSucursal);
  useEffect(() => {
    fetchProductosRef.current = productos.fetchProductosSucursal;
  });

  useEffect(() => {
    if (!sucursalId || ventasSincronizadas === 0) return;
    ultimaRevalidacionRef.current = Date.now();
    fetchProductosRef.current().catch(() => {});
  }, [ventasSincronizadas, sucursalId]);

  const recursos: RecursosCaja = {
    productos,
    recursoSucursal,
    recursoEmpresa,
    recursoCategorias,
    ultimaRevalidacionRef,
  };

  const [carritoPrincipal, setCarritoPrincipal] = useState<ItemCarrito[]>(SIN_RESERVAS);
  const [reservasParaPrincipal, setReservasParaPrincipal] = useState<ItemCarrito[]>(SIN_RESERVAS);
  const [ventasRapidasInfo, setVentasRapidasInfo] = useState<VentaRapidaInfo[]>([]);
  const [algunaAbierta, setAlgunaAbierta] = useState(false);

  return (
    <>
      <CajaAutopagoVista
        recursos={recursos}
        activo={!algunaAbierta}
        reservasOtraCaja={reservasParaPrincipal}
        onCarritoCambio={setCarritoPrincipal}
        ventasRapidas={ventasRapidasInfo}
      />

      <VentasRapidas
        recursos={recursos}
        carritoPrincipal={carritoPrincipal}
        onReservasChange={setReservasParaPrincipal}
        onInfoChange={setVentasRapidasInfo}
        onAlgunaAbiertaChange={setAlgunaAbierta}
      />
    </>
  );
}
