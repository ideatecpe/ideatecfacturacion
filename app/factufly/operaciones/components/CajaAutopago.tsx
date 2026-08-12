"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Users,
  ImageOff,
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
} from "lucide-react";

import { scanImageData } from "@undecaf/zbar-wasm";

import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
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
import {
  generarXml,
  enviarASunatApi,
  crearNotaVenta,
  descontarStockApi,
  esErrorTransitorio,
} from "@/app/factufly/operaciones/boleta/gestionBoletas/emitirBoletaApi";
import { useOfflineSales } from "@/app/components/offline/OfflineSalesProvider";
import { imprimirTicketProvisional } from "@/app/factufly/operaciones/components/TicketProvisional";

interface MedioPagoOpcion {
  nombre: string;
  icon: typeof Banknote;
  activo: string;
}

const MEDIOS_PAGO: MedioPagoOpcion[] = [
  { nombre: "Efectivo", icon: Banknote, activo: "border-emerald-500 bg-emerald-50 text-emerald-700" },
  { nombre: "Tarjeta", icon: CreditCard, activo: "border-brand-blue bg-brand-blue/5 text-brand-blue" },
  { nombre: "Yape", icon: Smartphone, activo: "border-violet-500 bg-violet-50 text-violet-700" },
  { nombre: "Plin", icon: Smartphone, activo: "border-sky-500 bg-sky-50 text-sky-700" },
  { nombre: "Transferencia", icon: Landmark, activo: "border-amber-500 bg-amber-50 text-amber-700" },
  { nombre: "Otro", icon: MoreHorizontal, activo: "border-gray-500 bg-gray-100 text-gray-700" },
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

interface ItemCarrito {
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

// Precio de venta efectivo: si el producto está en promoción, aplica el
// porcentaje de descuento sobre precioUnitario (mismo cálculo que en
// productos/lista/ProductoCard.tsx y en boleta/factura/nota-venta).
const precioConDescuento = (p: ProductoSucursal) => {
  const base = p.sucursalProducto.precioUnitario ?? 0;
  const { enPromocion, porcentajeDescuento } = p.sucursalProducto;
  if (enPromocion && porcentajeDescuento) {
    return base * (1 - porcentajeDescuento / 100);
  }
  return base;
};

// Cuántas unidades adicionales del producto `p` caben en el pool compartido de stock,
// descontando lo que el carrito ya tiene comprometido (incluyendo paquetes × factor).
// Devuelve null cuando isStock está apagado o el producto es un servicio.
function calcularDisponible(
  p: ProductoSucursal,
  cartItems: ItemCarrito[],
  allProducts: ProductoSucursal[],
  isStock: boolean,
): number | null {
  if (!isStock || p.tipoProducto !== "BIEN") return null;
  const baseId = p.esPaquete && p.productoBaseId ? p.productoBaseId : p.productoId;
  const baseProd = p.esPaquete && p.productoBaseId
    ? allProducts.find((x) => x.productoId === p.productoBaseId)
    : p;
  const stockBase = baseProd?.sucursalProducto.stock ?? 0;
  const comprometido = cartItems.reduce((total, it) => {
    if (it.tipoProducto !== "BIEN") return total;
    const itProd = allProducts.find((x) => x.productoId === it.productoId);
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

// Tarjeta de producto para el grid de la izquierda (imagen + nombre + precio).
function ProductoGridCard({
  p,
  cantidadEnCarrito = 0,
  stockDisp = null,
  onClick,
}: {
  p: ProductoSucursal;
  cantidadEnCarrito?: number;
  stockDisp?: number | null;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const tieneImagen = !!p.urlImagenProducto && !imgError;
  const enOferta = !!p.sucursalProducto.enPromocion && !!p.sucursalProducto.porcentajeDescuento;
  const seleccionado = cantidadEnCarrito > 0;
  const hoy = new Date().toISOString().split("T")[0];
  const vencido = !!p.sucursalProducto.proximoVencimiento && p.sucursalProducto.proximoVencimiento < hoy;
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col rounded-md border transition-all text-left overflow-hidden ${
        seleccionado
          ? "border-gray-100 bg-[#008000]/5"
          : "border-gray-100 bg-white hover:border-brand-blue hover:shadow-md active:scale-[0.97]"
      }`}
    >
      <div className="aspect-square w-full bg-gray-50 flex items-center justify-center overflow-hidden relative p-2">
        {tieneImagen ? (
          <img
            src={conVarianteImagen(p.urlImagenProducto as string, "thumbnail")}
            alt={p.nomProducto}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff className="w-5 h-5 text-gray-300" />
        )}

        {/* Badge de seleccionado / Check + Cantidad (#008000) */}
        {seleccionado && (
          <span
            className={`absolute top-1.5 right-1.5 flex items-center justify-center bg-[#008000] text-white shadow-md animate-in zoom-in-75 duration-200 z-10 ${
              cantidadEnCarrito === 1
                ? "w-6 h-6 rounded-full"
                : "min-w-6 h-6 px-1.5 rounded-full gap-0.5 text-[10px] font-bold"
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-3" />
            {cantidadEnCarrito !== 1 && (
              <span>{cantidadEnCarrito % 1 === 0 ? cantidadEnCarrito : parseFloat(cantidadEnCarrito.toFixed(3))}</span>
            )}
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
      <div className="p-1">
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
        {stockDisp !== null && stockDisp <= 10 && (
          <p className="text-[10px] font-extrabold text-red-600 leading-tight tabular-nums mt-0.5">
            {formatearCantidadUnidad(stockDisp, p.unidadMedida)} {abreviaturaUnidad(p.unidadMedida)}
          </p>
        )}
      </div>
    </button>
  );
}

export default function CajaAutopago() {
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const { showToast } = useToast();

  const sucursalId = user?.sucursalID ? parseInt(user.sucursalID) : null;
  const { productosSucursal, loadingSucursal, setProductosSucursal, fetchProductosSucursal, descontarStockLocal } = useProductosSucursal(sucursalId, !!sucursalId);
  const { empresa } = useEmpresaEmisor();
  const { sucursal, fetchSucursal } = useSucursal();
  const { cliente, loadingCliente, errorCliente, buscarCliente } = useClienteBoleta();
  const { enqueueVenta } = useOfflineSales();
  const [offlineEncolada, setOfflineEncolada] = useState(false);
  const [ultimoTicketOffline, setUltimoTicketOffline] = useState<
    Parameters<typeof imprimirTicketProvisional>[0] | null
  >(null);

  const [items, setItems] = useState<ItemCarrito[]>([]);
  const itemsRef = useRef<ItemCarrito[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const [busqueda, setBusqueda] = useState("");
  const [confirmarLimpiarTodo, setConfirmarLimpiarTodo] = useState(false);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [mostrarCarritoMobile, setMostrarCarritoMobile] = useState(false);
  const [documento, setDocumento] = useState("");
  const [tipoSinDocumento, setTipoSinDocumento] = useState<"Boleta" | "Nota de Venta">("Boleta");
  // Con DNI/CE (no RUC), el cajero puede pasar de Boleta a Nota de Venta; por defecto Boleta.
  const [tipoConDocumento, setTipoConDocumento] = useState<"Boleta" | "Nota de Venta">("Boleta");
  const inputRef = useRef<HTMLInputElement>(null);
  const montoInputRef = useRef<HTMLInputElement>(null);
  const tipoSinDocInitRef = useRef(false);

  // ── Cámara Escáner de Código de Barras (Móvil / Web) ───────────────
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  // ── Agregar / quitar / cantidad ──────────────────────────────
  const agregarProducto = useCallback((p: ProductoSucursal) => {
    const hoy = new Date().toISOString().split("T")[0];
    const tieneVencido = !!p.sucursalProducto.proximoVencimiento && p.sucursalProducto.proximoVencimiento < hoy;
    if (tieneVencido) {
      showToast("⚠ Este producto tiene lotes vencidos sin retirar del inventario", "error");
    }
    const disp = calcularDisponible(p, itemsRef.current, productosSucursal, config?.isStock ?? false);
    if (disp !== null && disp <= 0) {
      showToast(`Stock insuficiente: no hay unidades disponibles de "${p.nomProducto}"`, "error");
      return;
    }
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productoId === p.productoId);
      if (idx !== -1) {
        // Re-adding a product already in cart: check stock before incrementing
        if (disp !== null && disp < 1) {
          showToast(`Stock insuficiente: solo quedan ${parseFloat(disp.toFixed(3))} disponibles de "${p.nomProducto}"`, "info");
          return prev;
        }
        const copia = [...prev];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      }
      // New product: cap initial quantity at available stock if less than 1
      const cantidadInicial = disp !== null && disp < 1 ? parseFloat(disp.toFixed(3)) : 1;
      return [
        ...prev,
        {
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
        },
      ];
    });
    setBusqueda("");
    const active = document.activeElement;
    const isEditingOtherInput =
      !!active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT") &&
      active !== inputRef.current;
    const isMobileDevice =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);

    if (!isEditingOtherInput && !isMobileDevice) {
      inputRef.current?.focus();
    }
  }, [showToast, config?.isStock, productosSucursal]);

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
        console.error("Error en búsqueda remota de productos:", err);
        return [];
      }
    },
    [sucursalId, accessToken, setProductosSucursal],
  );

  const processScannedBarcode = useCallback(
    async (decodedText: string) => {
      const code = decodedText.trim().toLowerCase();
      if (!code) return;

      // Cooldown de 3.5s para el MISMO código (evita duplicar unidades al sostener la cámara sobre el mismo producto),
      // pero si cambia de producto (código diferente), escanea al instante sin esperar.
      const now = Date.now();
      if (lastScannedCodeRef.current.code === code && now - lastScannedCodeRef.current.time < 3500) {
        return;
      }
      lastScannedCodeRef.current = { code, time: now };

      let p = productosSucursal.find(
        (prod) =>
          prod.codigoBarras?.trim().toLowerCase() === code ||
          prod.codigo?.trim().toLowerCase() === code,
      );

      if (!p) {
        const remotos = await buscarEnServidor(code);
        if (remotos.length > 0) {
          p = remotos.find(
            (prod) =>
              prod.codigoBarras?.trim().toLowerCase() === code ||
              prod.codigo?.trim().toLowerCase() === code,
          ) ?? remotos[0];
        }
      }

      if (p) {
        if (config?.isStock && p.tipoProducto === "BIEN") {
          const disp = calcularDisponible(p, itemsRef.current, productosSucursal, true);
          if (disp !== null && disp <= 0) {
            showToast(`"${p.nomProducto}" sin stock — registra una compra primero`, "error");
            return;
          }
        }
        agregarProducto(p);
        showToast(`✓ Agregado: ${p.nomProducto}`, "success");
      } else {
        showToast(`No se encontró producto con código: ${decodedText}`, "error");
      }
    },
    [productosSucursal, config?.isStock, showToast, agregarProducto, buscarEnServidor],
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

  // Default del tipo de comprobante (sin documento) según "Tipo por defecto":
  // si el predeterminado es Nota de Venta y está habilitada, arranca en Nota de Venta.
  useEffect(() => {
    if (!config || tipoSinDocInitRef.current) return;
    tipoSinDocInitRef.current = true;
    if (config.useNotaVenta && config.isBoletaOrFactura === "n") {
      setTipoSinDocumento("Nota de Venta");
    }
  }, [config]);

  // Tipo de comprobante resultante: sin documento → elección manual (Boleta/NV);
  // RUC (11 díg.) → siempre Factura; DNI/CE (8 o 9) → Boleta o Nota de Venta (elección manual).
  const documentoTrim = documento.trim();
  const sinDocumento = documentoTrim.length === 0;
  const esRuc = documentoTrim.length === 11;
  const tipoComprobante = sinDocumento ? tipoSinDocumento : esRuc ? "Factura" : tipoConDocumento;

  // Consulta el nombre / razón social en cuanto se escribe un documento válido
  // (8=DNI, 9=CE, 11=RUC), con debounce. Guarda el último documento consultado
  // para no repetir la llamada al abrir el modal de cobro: una sola consulta a la
  // API por documento. buscarCliente no está memoizado, se accede por ref.
  const buscarClienteRef = useRef(buscarCliente);
  useEffect(() => { buscarClienteRef.current = buscarCliente; });
  const ultimoDocConsultadoRef = useRef("");
  useEffect(() => {
    const len = documentoTrim.length;
    if (![8, 9, 11].includes(len)) {
      ultimoDocConsultadoRef.current = "";
      return;
    }
    if (ultimoDocConsultadoRef.current === documentoTrim) return;
    const timer = setTimeout(() => {
      ultimoDocConsultadoRef.current = documentoTrim;
      buscarClienteRef.current(len === 11 ? "06" : len === 9 ? "04" : "01", documentoTrim);
    }, 500);
    return () => clearTimeout(timer);
  }, [documentoTrim]);

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

  // ── Grid de productos (filtrado en vivo por el buscador) ───────
  const productosGrid = useMemo(() => {
    // Con control de stock activo, solo se muestran los bienes que tienen al menos
    // 1 unidad disponible en el pool compartido (desconta lo comprometido en el carrito).
    // Los servicios no manejan stock y siempre se muestran.
    const conStock = config?.isStock
      ? productosSucursal.filter((p) => {
          if (p.tipoProducto !== "BIEN") return true;
          // Si ya está en el carrito siempre se muestra (aunque su pool esté agotado).
          if (items.some((i) => i.productoId === p.productoId)) return true;
          const disp = calcularDisponible(p, items, productosSucursal, true);
          return disp === null || disp > 0;
        })
      : productosSucursal;
    const q = busqueda.trim().toLowerCase();
    if (!q) return conStock;
    return conStock.filter(
      (p) =>
        p.nomProducto?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.codigoBarras?.toLowerCase().includes(q),
    );
  }, [busqueda, productosSucursal, config?.isStock, items]);

  const cambiarCantidad = (key: string, delta: number) => {
    if (delta > 0) {
      const item = items.find((i) => i.key === key);
      if (item) {
        const prod = productosSucursal.find((p) => p.productoId === item.productoId);
        if (prod) {
          const disp = calcularDisponible(prod, items, productosSucursal, config?.isStock ?? false);
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
        const disp = calcularDisponible(prod, items, productosSucursal, config?.isStock ?? false);
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

  // ── Paginación y límite de renderizado inicial (36 ítems por página) ──
  const [limiteVistaGrid, setLimiteVistaGrid] = useState(24);
  useEffect(() => { setLimiteVistaGrid(24); }, [busqueda]);

  const productosGridVisualizados = useMemo(() => {
    return productosGrid.slice(0, limiteVistaGrid);
  }, [productosGrid, limiteVistaGrid]);

  // Búsqueda remota automática cuando no hay coincidencias locales
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) return;

    const tieneCoincidenciaLocal = productosSucursal.some(
      (p) =>
        p.nomProducto?.toLowerCase().includes(q.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(q.toLowerCase()) ||
        p.codigoBarras?.toLowerCase().includes(q.toLowerCase()),
    );

    if (!tieneCoincidenciaLocal) {
      const timer = setTimeout(() => {
        buscarEnServidor(q);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [busqueda, productosSucursal, buscarEnServidor]);

  // Auto-adición instantánea al escanear con lector físico o ingresar código exacto
  useEffect(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return;

    const exacto = productosSucursal.find(
      (p) =>
        (p.codigoBarras && p.codigoBarras.trim().toLowerCase() === q) ||
        (p.codigo && p.codigo.trim().toLowerCase() === q),
    );

    if (exacto) {
      if (config?.isStock && exacto.tipoProducto === "BIEN") {
        const disp = calcularDisponible(exacto, itemsRef.current, productosSucursal, true);
        if (disp !== null && disp <= 0) {
          showToast(`"${exacto.nomProducto}" sin stock — registra una compra primero`, "error");
          setBusqueda("");
          return;
        }
      }
      agregarProducto(exacto);
      showToast(`✓ Agregado: ${exacto.nomProducto}`, "success");
      setBusqueda("");
    }
  }, [busqueda, productosSucursal, config?.isStock, showToast, agregarProducto]);

  // Enter en el buscador o escáner de código de barras físico:
  // Agrega directo el producto encontrado por código de barras / código o el primero del grid,
  // limpiando siempre la búsqueda para la siguiente lectura.
  const onEnterBusqueda = useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery ?? busqueda).trim().toLowerCase();
      if (!q) return;

      // 1. Buscar coincidencia exacta local por código de barras o código
      let exacto = productosSucursal.find(
        (p) =>
          p.codigoBarras?.trim().toLowerCase() === q ||
          p.codigo?.trim().toLowerCase() === q,
      );

      // 2. Si no está en memoria local, consultar al servidor
      if (!exacto) {
        const remotos = await buscarEnServidor(q);
        if (remotos.length > 0) {
          exacto = remotos.find(
            (p) =>
              p.codigoBarras?.trim().toLowerCase() === q ||
              p.codigo?.trim().toLowerCase() === q,
          ) ?? remotos[0];
        }
      }

      if (exacto) {
        if (config?.isStock && exacto.tipoProducto === "BIEN" && (exacto.sucursalProducto.stock ?? 0) <= 0) {
          showToast(`El producto "${exacto.nomProducto}" no tiene stock disponible (0 unidades).`, "error");
          setBusqueda("");
          return;
        }
        agregarProducto(exacto);
        showToast(`✓ Agregado: ${exacto.nomProducto}`, "success");
        setBusqueda("");
        return;
      }

      // 3. Si no hay coincidencia exacta, buscar si hay resultados en el grid
      if (productosGrid.length > 0) {
        const matchGrid = productosGrid.find(
          (p) =>
            p.codigoBarras?.trim().toLowerCase() === q ||
            p.codigo?.trim().toLowerCase() === q,
        ) ?? productosGrid[0];

        if (config?.isStock && matchGrid.tipoProducto === "BIEN" && (matchGrid.sucursalProducto.stock ?? 0) <= 0) {
          showToast(`El producto "${matchGrid.nomProducto}" no tiene stock disponible (0 unidades).`, "error");
          setBusqueda("");
          return;
        }

        agregarProducto(matchGrid);
        setBusqueda("");
      } else {
        showToast(`No se encontró producto con el código o nombre: "${q}"`, "error");
        setBusqueda("");
      }
    },
    [busqueda, productosGrid, productosSucursal, config?.isStock, showToast, agregarProducto, buscarEnServidor],
  );

  // Foco inicial único al cargar la página (solo en computadoras/laptops)
  useEffect(() => {
    const isMobile = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, []);

  // Captura global de lecturas de códigos de barras (escáner físico USB/Bluetooth)
  // incluso si el usuario hace clic afuera del input.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mostrarPago) return;

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

      // Si las teclas se envían en menos de 45ms (típico de pistola de código de barras)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff < 45) {
          scannerBufferRef.current.text += e.key;
        } else {
          scannerBufferRef.current.text = e.key;
        }
        scannerBufferRef.current.lastTime = now;
      }

      if (e.key === "Enter") {
        const barcodeFromScanner = scannerBufferRef.current.text.trim();
        const currentQuery = (inputRef.current?.value || busqueda).trim();
        const queryToUse = barcodeFromScanner.length >= 3 ? barcodeFromScanner : currentQuery;

        scannerBufferRef.current = { text: "", lastTime: 0 };

        if (queryToUse) {
          e.preventDefault();
          onEnterBusqueda(queryToUse);
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
  }, [onEnterBusqueda, mostrarPago, busqueda]);

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

  // ── Pago ────────────────────────────────────────────────────
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [emitido, setEmitido] = useState(false);
  const [comprobanteIdEmitido, setComprobanteIdEmitido] = useState<number | null>(null);
  const [serieCorrelativoEmitido, setSerieCorrelativoEmitido] = useState<string | null>(null);
  const [medioPagoEmitido, setMedioPagoEmitido] = useState("Efectivo");
  const [vueltoEmitido, setVueltoEmitido] = useState(0);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [telWhatsapp, setTelWhatsapp] = useState("");
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);

  // Emitir con otra fecha (fecha de emisión manual, en vez de la fecha/hora actual)
  // SUNAT permite emitir hasta 3 días atrás de la fecha actual.
  const [mostrarFechaManual, setMostrarFechaManual] = useState(false);
  const [fechaEmisionManual, setFechaEmisionManual] = useState("");
  const fechaMinimaEmision = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  // Pago dividido (varios medios de pago para un mismo comprobante)
  const [pagoDividido, setPagoDividido] = useState(false);
  const [pagosDivididos, setPagosDivididos] = useState<
    { id: string; medioPago: string; monto: string }[]
  >([]);

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

  // Al crédito (mismo motor de tipoPago Contado/Credito/CreditoInicial de
  // boleta/factura/nota-venta): solo disponible con DNI/RUC del cliente.
  const [esCredito, setEsCredito] = useState(false);
  const [adelantoCredito, setAdelantoCredito] = useState("");
  const [numeroCuotasCredito, setNumeroCuotasCredito] = useState(1);
  const [cuotasCredito, setCuotasCredito] = useState<
    { numeroCuota: string; monto: string; fechaVencimiento: string }[]
  >([]);

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
  // ya traídos por useClienteBoleta (buscarCliente, disparado al abrir el pago).
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
    return {
      clienteId: coincide ? (cliente?.clienteId ?? null) : null,
      tipoDocumento,
      numeroDocumento: documentoTrim,
      razonSocial: coincide ? (cliente?.razonSocial ?? "") : "",
      ubigeo: coincide ? (cliente?.ubigeo || "") : "",
      direccionLineal: coincide ? (cliente?.direccionLineal || "") : "",
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
      tipoComprobanteCod === "01" && clienteBase.tipoDocumento === "06"
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
    };
  };

  // ── Descontar stock (solo si config.isStock) ───────────────────
  const calcularStockItems = () => {
    const acumulado = new Map<number, number>();
    items.forEach((it) => {
      if (it.tipoProducto !== "BIEN" || !it.sucursalProductoId) return;
      acumulado.set(it.sucursalProductoId, (acumulado.get(it.sucursalProductoId) ?? 0) + it.cantidad);
    });
    return { acumulado, items: Array.from(acumulado.entries()).map(([sucursalProductoId, cantidad]) => ({
      sucursalProductoId,
      cantidad,
    })) };
  };

  const descontarStockSiAplica = async (comprobanteId: number) => {
    if (!config?.isStock) return;
    const { acumulado, items: payloadItems } = calcularStockItems();
    if (!payloadItems.length) return;

    // Descuento optimista inmediato: actualiza el stock en memoria sin
    // recargar todos los productos del servidor (evita flash visual).
    descontarStockLocal(payloadItems);

    try {
      await descontarStockApi(comprobanteId, payloadItems, accessToken);
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
    } catch (err) {
      // La venta YA quedó registrada; lo que falló es solo el descuento de stock.
      // Se avisa explícitamente para que el cajero sepa que debe ajustarlo a mano.
      const axErr = err as {
        response?: { status?: number; data?: { mensaje?: string; message?: string; detalle?: string } };
      };
      const data = axErr?.response?.data;
      const motivo = data?.detalle ?? data?.mensaje ?? data?.message;
      showToast(
        motivo
          ? `Venta registrada, pero no se descontó el stock: ${motivo}`
          : "Venta registrada, pero no se pudo descontar el stock. Ajústalo manualmente.",
        "error",
      );
      console.error(
        "descontar-stock falló:",
        { status: axErr?.response?.status, data: axErr?.response?.data, payloadItems },
      );
    }
  };

  // ── Obtener el comprobante ya emitido (HTML ticket o PDF) ───────
  const obtenerBlobComprobante = async (
    comprobanteId: number,
    tamano: string,
  ): Promise<Blob | null> => {
    const esTicket = tamano === "Ticket58mm" || tamano === "Ticket80mm";
    try {
      if (esTicket) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/html?tamano=${tamano}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return null;
        return new Blob([await res.text()], { type: "text/html" });
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=${tamano}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return null;
      return new Blob([await res.blob()], { type: "application/pdf" });
    } catch {
      return null;
    }
  };

  const imprimirBlob = (blob: Blob) => {
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    };
  };

  // ── Impresión automática (según config.isImprime), justo al emitir ──
  const imprimirSiAplica = async (comprobanteId: number) => {
    if (!config?.isImprime) return;
    setImprimiendo(true);
    const tamanoMap: Record<string, string> = { "58": "Ticket58mm", "80": "Ticket80mm", A4: "A4" };
    const tamano = config?.tamañoImpresion ? (tamanoMap[config.tamañoImpresion] ?? "A4") : "A4";
    const blob = await obtenerBlobComprobante(comprobanteId, tamano);
    if (blob) imprimirBlob(blob);
    setImprimiendo(false);
  };

  // ── Reimpresión manual desde la pantalla de éxito ───────────────
  const imprimirManual = async (tamanoKey: "80" | "58" | "A4") => {
    if (!comprobanteIdEmitido) return;
    const blob = await obtenerBlobComprobante(comprobanteIdEmitido, TAMANO_MAP[tamanoKey]);
    if (!blob) {
      showToast("No se pudo generar el comprobante", "error");
      return;
    }
    imprimirBlob(blob);
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
    // El cliente ya se consultó al escribir el documento (efecto con debounce),
    // así que aquí no se vuelve a llamar a la API. Si el debounce aún no disparó
    // (clic muy rápido), el efecto pendiente lo resuelve una sola vez.
    setTipoConDocumento("Boleta");
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

  const elegirTipoComprobante = (t: "Boleta" | "Nota de Venta") => {
    if (sinDocumento) setTipoSinDocumento(t);
    else setTipoConDocumento(t);
  };

  // ── Venta sin conexión: se encola localmente ────────────────────
  const manejarVentaSinConexion = async (
    payload: Record<string, unknown>,
    tipo: "comprobante" | "notaventa",
  ) => {
    const stockItems = config?.isStock ? calcularStockItems().items : [];

    const resumenTicket = {
      clienteNombre:
        cliente?.razonSocial || (sinDocumento ? "Clientes Varios" : documentoTrim || "Cliente"),
      items: items.map((it) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioVenta: it.precio,
      })),
      total: totales.total,
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
    // Mismo criterio que la impresión automática online (imprimirSiAplica):
    // solo imprime solo si el negocio activó "Auto-imprimir" en Empresa.
    // Si está apagado, el ticket queda disponible para reimprimir manual.
    if (config?.isImprime) imprimirTicketProvisional(datosTicket);

    showToast(
      "Sin conexión: la venta se guardó localmente y se enviará al reconectar.",
      "success",
    );

    // El serie-correlativo que se había "congelado" antes de intentar guardar
    // es solo una previsualización optimista: como la venta no llegó al
    // backend, ese número no está confirmado (y podría no ser el que se le
    // asigne realmente al sincronizar). Se limpia para no mostrar un dato falso.
    setSerieCorrelativoEmitido(null);
    setComprobanteIdEmitido(null);
    setMedioPagoEmitido(esCredito ? "Crédito" : pagoDividido ? "Pago dividido" : medioPago);
    setVueltoEmitido(esCredito ? 0 : pagoDividido ? sobranteDividido : vuelto);
    setOfflineEncolada(true);
    setEmitido(true);
  };

  const emitirVenta = async () => {
    if (!empresa) {
      showToast("No se pudo cargar la empresa emisora. Intenta de nuevo.", "error");
      return;
    }
    if (tipoComprobante !== "Nota de Venta" && !sucursal) {
      showToast("No se pudo cargar la sucursal (serie/correlativo). Intenta de nuevo.", "error");
      return;
    }
    setMostrarPago(false);
    setEmitiendo(true);
    setOfflineEncolada(false);
    try {
      let comprobanteId: number;

      // Congelamos serie-correlativo mostrados ANTES de emitir (el backend
      // los asigna y luego el refetch de sucursal muestra el siguiente).
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
        setSerieCorrelativoEmitido(serie && correlativo ? `${serie}-${String(correlativo).padStart(8, "0")}` : null);
      }

      const esNotaVenta = tipoComprobante === "Nota de Venta";
      const payload = esNotaVenta
        ? prepararNotaVenta()
        : prepararComprobante(tipoComprobante === "Factura" ? "01" : "03");

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
          // Sin internet, o el backend respondió pero su propia infraestructura
          // falló (ej. no pudo conectar a su base de datos): en ambos casos no
          // es culpa de la venta, así que se guarda como pendiente en vez de perderla.
          await manejarVentaSinConexion(payload, esNotaVenta ? "notaventa" : "comprobante");
          return;
        }
        throw errGuardar;
      }

      if (!esNotaVenta) {
        // Envío a SUNAT: si SUNAT rechaza o no responde, el comprobante ya quedó
        // registrado en el sistema (igual que en Boleta/Factura), así que no
        // detenemos el flujo de caja — solo avisamos el resultado.
        try {
          const resSunat = await enviarASunatApi(comprobanteId, accessToken);
          showToast(
            resSunat.exitoso
              ? (resSunat.mensaje ?? `${tipoComprobante} emitida correctamente.`)
              : (resSunat.mensaje ?? `${tipoComprobante} quedó pendiente/rechazada por SUNAT.`),
            resSunat.exitoso ? "success" : "error",
          );
        } catch (errSunat) {
          const errRes = errSunat as { response?: { data?: { mensaje?: string } } };
          showToast(
            errRes?.response?.data?.mensaje ?? "No se pudo conectar con SUNAT. Verifica el estado en Comprobantes.",
            "error",
          );
        }
      }

      setComprobanteIdEmitido(comprobanteId);
      setMedioPagoEmitido(esCredito ? "Crédito" : pagoDividido ? "Pago dividido" : medioPago);
      setVueltoEmitido(esCredito ? 0 : pagoDividido ? sobranteDividido : vuelto);
      setEmitido(true);
      setEmitiendo(false);

      // Tareas secundarias post-emisión (descuento de stock, impresión y actualización de correlativos)
      // Se ejecutan en segundo plano para que el usuario vea la pantalla verde de éxito de inmediato.
      descontarStockSiAplica(comprobanteId);
      imprimirSiAplica(comprobanteId);
      fetchSucursal();
    } catch (err) {
      const data = (err as { response?: { data?: { mensaje?: string; message?: string; detalle?: string } } })?.response?.data;
      const mensaje = data?.mensaje ?? data?.message ?? "Error al generar el comprobante";
      const detalle = data?.detalle;
      showToast(detalle ? `${mensaje}: ${detalle}` : mensaje, "error");
    } finally {
      setEmitiendo(false);
    }
  };

  // Confirmación con la tecla Enter en el modal de pago
  useEffect(() => {
    if (!mostrarPago) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (
          !emitiendo &&
          !(pagoDividido && faltanteDividido > 0) &&
          !(esCredito && (!cuotasCuadran || cuotasCredito.some((c) => (parseFloat(c.monto) || 0) <= 0)))
        ) {
          e.preventDefault();
          emitirVenta();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mostrarPago, emitiendo, pagoDividido, faltanteDividido, esCredito, cuotasCuadran, cuotasCredito]);

  const nuevaVenta = () => {
    setItems([]);
    setDocumento("");
    setTipoConDocumento("Boleta");
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
    setTelWhatsapp("");
    setComprobanteIdEmitido(null);
    setSerieCorrelativoEmitido(null);
    setOfflineEncolada(false);
    setUltimoTicketOffline(null);
    setMostrarPago(false);
    setMostrarCarritoMobile(false);
    setConfirmarLimpiarTodo(false);
    setBusqueda("");
    setEmitido(false);
    // Sincronización silenciosa: refresca el catálogo desde el servidor
    // para reconciliar stock real. Como los productos ya están en pantalla
    // el hook NO muestra skeletons, solo actualiza datos en segundo plano.
    fetchProductosSucursal();
    setTimeout(() => {
      const isMobile = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
      if (!isMobile) {
        inputRef.current?.focus();
      }
    }, 50);
  };

  // Enter para "Nueva venta" cuando se muestra la pantalla de éxito
  useEffect(() => {
    if (!emitido) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === "INPUT" && telWhatsapp.trim()) {
          return;
        }
        e.preventDefault();
        nuevaVenta();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [emitido, telWhatsapp]);

  // ── Pantalla principal: grid de productos + carrito ───────────
  return (
    <>
      <div className="w-full rounded-md border border-gray-200 bg-white shadow-sm flex flex-col lg:flex-row lg:h-[calc(100vh-125px)] lg:overflow-hidden">
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
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onEnterBusqueda();
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

            {!isScanning ? (
              <button
                type="button"
                onClick={startScanning}
                className="h-9.5 flex items-center justify-center gap-1.5 px-3 bg-brand-blue text-white rounded-md text-xs font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm shrink-0"
              >
                <ScanBarcode size={14} />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanning}
                className="h-9.5 flex items-center justify-center gap-1.5 px-3 bg-rose-500 text-white rounded-md text-xs font-semibold hover:bg-rose-600 active:scale-[0.98] transition-all shadow-sm shrink-0"
              >
                <X size={14} />
                <span>Cerrar</span>
              </button>
            )}
          </div>

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
                  <div className="pointer-events-none absolute inset-3 border-2 border-white/20 rounded-xl flex items-center justify-center overflow-hidden z-10">
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)] animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 lg:overflow-y-auto p-3">
            {loadingSucursal ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 animate-pulse">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex flex-col rounded-md border border-gray-100 bg-white overflow-hidden">
                    <div className="aspect-square w-full bg-gray-100" />
                    <div className="p-1 space-y-1.5">
                      <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : productosGrid.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="bg-gray-100 rounded-full p-5 mb-4">
                  <PackageSearch className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-500 font-semibold">Sin resultados</p>
                <p className="text-gray-400 text-sm mt-1">Prueba con otro nombre o código</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5">
                  {productosGridVisualizados.map((p) => {
                    const itemCarrito = items.find((i) => i.productoId === p.productoId);
                    const stockDisp = config?.isStock
                      ? calcularDisponible(p, items, productosSucursal, true)
                      : null;
                    return (
                      <ProductoGridCard
                        key={p.productoId}
                        p={p}
                        cantidadEnCarrito={itemCarrito?.cantidad ?? 0}
                        stockDisp={stockDisp}
                        onClick={() => agregarProducto(p)}
                      />
                    );
                  })}
                </div>

                {productosGrid.length > limiteVistaGrid && (
                  <div className="flex justify-center pt-2 pb-1">
                    <button
                      type="button"
                      onClick={() => setLimiteVistaGrid((prev) => prev + 24)}
                      className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition-colors shadow-2xs"
                    >
                      Cargar más productos (mostrando {limiteVistaGrid} de {productosGrid.length})
                    </button>
                  </div>
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

          <div className="flex-1 lg:overflow-y-auto px-3 py-3 space-y-2">
            {items.length > 0 && (
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Productos ({items.length})
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmarLimpiarTodo(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-700 hover:underline transition-colors"
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
              items.map((i) => (
                <div
                  key={i.key}
                  className="rounded-lg border border-gray-100 bg-white p-2 hover:border-gray-200 transition-all shadow-2xs space-y-1.5"
                >
                  {/* Fila superior: Imagen + Nombre + Precio Unitario Editable + Eliminar */}
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

                      {/* Precio Unitario Editable */}
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
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
                    </div>

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((it) => it.key !== i.key))}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
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
                        className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
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
                        className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
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
              ))
            )}
          </div>

          {/* Footer con totales y cobrar — fijo en la parte inferior en desktop */}
          <div className="shrink-0 sticky bottom-0 lg:static border-t border-gray-200 bg-white px-4 py-4 space-y-3 z-10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                Total ({totales.unidades % 1 === 0 ? totales.unidades : parseFloat(totales.unidades.toFixed(3))} und.)
              </span>
              <span className="text-base font-bold text-brand-blue tabular-nums">
                S/ {totales.total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={abrirPago}
              disabled={items.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-blue py-3.5 text-white text-base font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
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
            className="flex items-center gap-2.5 min-w-0 text-left"
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
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-white text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all shrink-0"
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
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {items.map((i) => (
                <div
                  key={i.key}
                  className="rounded-lg border border-gray-100 bg-white p-2.5 shadow-2xs space-y-1.5"
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
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
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
              ))}
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-blue py-3.5 text-white text-base font-bold shadow-md hover:bg-blue-700 active:scale-[0.99] transition-all"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Izquierda: resumen de productos ── */}
          <div className="space-y-3">
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
                <div className="pt-1.5 border-t border-gray-200 space-y-0.5">
                  <div className="flex justify-between text-xs text-cyan-700">
                    <span>Comisión POS ({comisionPagoTarjetaPct}%)</span>
                    <span className="tabular-nums font-medium">+S/ {totalComisionPagoTarjeta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-cyan-800">
                    <span>Total + Comisión</span>
                    <span className="tabular-nums">S/ {(totales.total + totalComisionPagoTarjeta).toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">Informativo — no afecta el comprobante</p>
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
          </div>

          {/* ── Derecha: comprobante + pago ── */}
          <div className="space-y-4">
            {/* Comprobante */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Comprobante</p>
              <div className={`grid gap-2 ${config?.useNotaVenta ? "grid-cols-3" : "grid-cols-2"}`}>
                <button
                  onClick={() => elegirTipoComprobante("Boleta")}
                  disabled={esRuc}
                  className={`flex items-center justify-center gap-1.5 rounded-md border-2 py-2.5 text-xs font-semibold transition-colors ${
                    tipoComprobante === "Boleta"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : esRuc
                        ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                        : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Boleta
                </button>
                {config?.useNotaVenta && (
                  <button
                    onClick={() => elegirTipoComprobante("Nota de Venta")}
                    disabled={esRuc}
                    className={`flex items-center justify-center gap-1.5 rounded-md border-2 py-2.5 text-xs font-semibold transition-colors ${
                      tipoComprobante === "Nota de Venta"
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : esRuc
                          ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> N. Venta
                  </button>
                )}
                <button
                  disabled={!esRuc}
                  className={`flex items-center justify-center gap-1.5 rounded-md border-2 py-2.5 text-xs font-semibold transition-colors ${
                    tipoComprobante === "Factura"
                      ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                      : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Factura
                </button>
              </div>

              {/* Cliente */}
              <div className="mt-2 text-xs">
                {sinDocumento ? (
                  <span className="text-gray-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Clientes varios
                  </span>
                ) : (
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-semibold">{cliente?.razonSocial || "Cargando cliente..."}</span>
                    <span className="text-gray-400">{documentoTrim}</span>
                  </div>
                )}
              </div>

              {/* Emitir con otra fecha */}
              {!mostrarFechaManual ? (
                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={() => setMostrarFechaManual(true)}
                    className="text-xs text-gray-500 hover:text-brand-blue flex items-center gap-1 font-medium transition-colors"
                  >
                    <CalendarClock className="w-3.5 h-3.5" /> Emitir con otra fecha
                  </button>
                  <button
                    onClick={togglePagoDividido}
                    className={`text-xs flex items-center gap-1 font-medium transition-colors ${
                      pagoDividido ? "text-brand-blue" : "text-gray-500 hover:text-brand-blue"
                    }`}
                  >
                    <Columns3 className="w-3.5 h-3.5" /> Pago dividido{pagoDividido ? " (activo)" : ""}
                  </button>
                </div>
              ) : (
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
                    onClick={() => {
                      setFechaEmisionManual(formatoFechaActual().fecha);
                      setMostrarFechaManual(false);
                    }}
                    className="text-[11px] font-semibold text-brand-blue hover:underline"
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
                            onClick={() => setMedioPago(m.nombre)}
                            className={`flex flex-col items-center gap-1 rounded-md border-2 py-2.5 transition-colors ${
                              activo ? m.activo : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                            }`}
                          >
                            <m.icon className="w-4.5 h-4.5" />
                            <span className="text-[11px] font-semibold">{m.nombre}</span>
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
                  ) : medioPago === "Tarjeta" ? (
                    <div className="rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-500">
                      El cobro se realiza en el POS físico. Se registrará como pago con Tarjeta.
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

            {/* Confirmar */}
            <button
              onClick={emitirVenta}
              disabled={
                emitiendo ||
                (pagoDividido && faltanteDividido > 0) ||
                (esCredito && (!cuotasCuadran || cuotasCredito.some((c) => (parseFloat(c.monto) || 0) <= 0)))
              }
              className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-blue py-3.5 text-white text-base font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {emitiendo ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" /> Emitiendo...
                </>
              ) : esCredito ? (
                "Registrar venta al crédito"
              ) : (
                `Confirmar S/ ${totales.total.toFixed(2)}`
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Bloqueo total mientras se emite (nada es clickeable hasta el éxito) ── */}
      {emitiendo && (
        <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-md shadow-2xl px-10 py-9 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
            <div className="text-center">
              <p className="text-base font-bold text-gray-800">Emitiendo comprobante...</p>
              <p className="text-xs text-gray-400 mt-1">No cierres ni recargues la página</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de éxito tras emitir ─────────────────────────────── */}
      {emitido && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-md my-auto rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 shrink-0">
            {/* Cabecera verde */}
            <div className="bg-linear-to-br from-emerald-500 to-emerald-600 px-6 py-7 text-center text-white">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 mb-3">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <p className="text-3xl font-extrabold tabular-nums">S/ {totales.total.toFixed(2)}</p>
              {(medioPagoEmitido === "Efectivo" || medioPagoEmitido === "Pago dividido") && vueltoEmitido > 0 && (
                <p className="text-emerald-50 text-sm font-semibold mt-1">
                  Vuelto: S/ {vueltoEmitido.toFixed(2)}
                </p>
              )}
              {serieCorrelativoEmitido && (
                <p className="text-emerald-50 text-xs font-bold mt-2 tracking-wide">{serieCorrelativoEmitido}</p>
              )}
              <p className="text-emerald-100 text-xs mt-0.5">
                {tipoComprobante} · {medioPagoEmitido}
              </p>
              {imprimiendo && (
                <p className="text-white text-xs font-semibold flex items-center justify-center gap-1.5 mt-2">
                  <Printer className="w-3.5 h-3.5 animate-pulse" /> Enviando a imprimir...
                </p>
              )}
            </div>

            {/* Acciones */}
            <div className="p-5 space-y-3">
              {offlineEncolada && (
                <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-amber-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">
                      Venta guardada sin conexión
                      {config?.isImprime
                        ? " — ya se imprimió un ticket provisional."
                        : "."}{" "}
                      El comprobante oficial (con su serie y correlativo SUNAT)
                      se generará automáticamente cuando vuelva el internet.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      ultimoTicketOffline &&
                      imprimirTicketProvisional(ultimoTicketOffline)
                    }
                    className="w-full flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-white py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir ticket
                    provisional
                  </button>
                </div>
              )}
              {!offlineEncolada && (
              <>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => imprimirManual("80")}
                  className="flex flex-col items-center gap-1 rounded-md border border-gray-200 py-2.5 text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">80mm</span>
                </button>
                <button
                  onClick={() => imprimirManual("58")}
                  className="flex flex-col items-center gap-1 rounded-md border border-gray-200 py-2.5 text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">58mm</span>
                </button>
                <button
                  onClick={() => imprimirManual("A4")}
                  className="flex flex-col items-center gap-1 rounded-md border border-gray-200 py-2.5 text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">A4</span>
                </button>
              </div>

              <button
                onClick={descargarPDF}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> Descargar PDF
              </button>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Send size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={telWhatsapp}
                    onChange={(e) => setTelWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    placeholder="WhatsApp del cliente"
                    className="w-full pl-8 pr-7 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
                  />
                  {telWhatsapp && (
                    <button
                      type="button"
                      onClick={() => setTelWhatsapp("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  onClick={enviarComprobantePorWhatsapp}
                  disabled={!telWhatsapp.trim() || enviandoWhatsapp}
                  className="h-8.5 px-3.5 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                >
                  {enviandoWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Enviar"}
                </button>
              </div>
              </>
              )}

              <button
                onClick={nuevaVenta}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-blue py-4 text-white text-lg font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all mt-2 cursor-pointer"
              >
                Nueva venta
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
