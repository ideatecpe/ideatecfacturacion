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
} from "lucide-react";

import { Html5Qrcode } from "html5-qrcode";

import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import ImagenProductoCuadrada from "@/app/factufly/operaciones/components/ImagenProductoCuadrada";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { Modal } from "@/app/components/ui/Modal";
import { useClienteBoleta } from "@/app/factufly/operaciones/boleta/gestionBoletas/useClienteBoleta";
import { useEmpresaEmisor } from "@/app/factufly/operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { avisarStockBajoWhatsapp } from "@/app/factufly/productos/gestioProductos/stockAlerta";
import { useToast } from "@/app/components/ui/Toast";

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
const TAMANO_MAP: Record<"80" | "58" | "A4", string> = { "80": "Ticket80mm", "58": "Ticket58mm", A4: "A4" };

interface ItemCarrito {
  key: string;
  productoId: number;
  sucursalProductoId: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  precio: number; // precio de venta (con IGV incluido)
  tipoAfectacionIGV: string;
  urlImagen: string | null;
  unidadMedida: string;
  tipoProducto: string | null;
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

// Tarjeta de producto para el grid de la izquierda (imagen + nombre + precio).
function ProductoGridCard({ p, onClick }: { p: ProductoSucursal; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const tieneImagen = !!p.urlImagenProducto && !imgError;
  const enOferta = !!p.sucursalProducto.enPromocion && !!p.sucursalProducto.porcentajeDescuento;
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-md border border-gray-100 bg-white overflow-hidden hover:border-brand-blue hover:shadow-md active:scale-[0.97] transition-all text-left"
    >
      <div className="aspect-square w-full bg-gray-50 flex items-center justify-center overflow-hidden relative p-2">
        {tieneImagen ? (
          <img
            src={p.urlImagenProducto as string}
            alt={p.nomProducto}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff className="w-5 h-5 text-gray-300" />
        )}
        {enOferta && (
          <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <Tag className="w-2.5 h-2.5" /> -{p.sucursalProducto.porcentajeDescuento}%
          </span>
        )}
      </div>
      <div className="p-1">
        <p className="text-[11px] font-semibold text-gray-800 line-clamp-1 leading-tight">
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
}

export default function CajaAutopago() {
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const { showToast } = useToast();

  const sucursalId = user?.sucursalID ? parseInt(user.sucursalID) : null;
  const { productosSucursal, fetchProductosSucursal } = useProductosSucursal(sucursalId, !!sucursalId);
  const { empresa } = useEmpresaEmisor();
  const { sucursal, fetchSucursal } = useSucursal();
  const { cliente, loadingCliente, errorCliente, buscarCliente } = useClienteBoleta();

  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [itemAEliminar, setItemAEliminar] = useState<ItemCarrito | null>(null);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [documento, setDocumento] = useState("");
  const [tipoSinDocumento, setTipoSinDocumento] = useState<"Boleta" | "Nota de Venta">("Boleta");
  // Con DNI/CE (no RUC), el cajero puede pasar de Boleta a Nota de Venta; por defecto Boleta.
  const [tipoConDocumento, setTipoConDocumento] = useState<"Boleta" | "Nota de Venta">("Boleta");
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoSinDocInitRef = useRef(false);

  // ── Cámara Escáner de Código de Barras (Móvil / Web) ───────────────
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  // ── Agregar / quitar / cantidad ──────────────────────────────
  const agregarProducto = useCallback((p: ProductoSucursal) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productoId === p.productoId);
      if (idx !== -1) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          productoId: p.productoId,
          sucursalProductoId: p.sucursalProducto.sucursalProductoId,
          codigo: p.codigo,
          descripcion: p.nomProducto,
          cantidad: 1,
          precio: precioConDescuento(p),
          tipoAfectacionIGV: p.tipoAfectacionIGV,
          urlImagen: p.urlImagenProducto ?? null,
          unidadMedida: p.unidadMedida ?? "NIU",
          tipoProducto: p.tipoProducto,
        },
      ];
    });
    setBusqueda("");
    inputRef.current?.focus();
  }, []);

  const stopScanning = useCallback(async () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Error stopping camera scanner", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const processScannedBarcode = useCallback(
    (decodedText: string) => {
      const code = decodedText.trim().toLowerCase();
      if (!code) return;

      // Cooldown de 1.2s para evitar agregar repetidamente el mismo producto mientras la cámara apunta
      const now = Date.now();
      if (lastScannedCodeRef.current.code === code && now - lastScannedCodeRef.current.time < 1200) {
        return;
      }
      lastScannedCodeRef.current = { code, time: now };

      const p = productosSucursal.find(
        (prod) =>
          prod.codigoBarras?.trim().toLowerCase() === code ||
          prod.codigo?.trim().toLowerCase() === code,
      );

      if (p) {
        if (config?.isStock && p.tipoProducto === "BIEN" && (p.sucursalProducto.stock ?? 0) <= 0) {
          showToast(`El producto "${p.nomProducto}" no tiene stock disponible.`, "error");
          return;
        }
        agregarProducto(p);
        showToast(`✓ Agregado: ${p.nomProducto}`, "success");
      } else {
        showToast(`No se encontró producto con código: ${decodedText}`, "error");
      }
    },
    [productosSucursal, config?.isStock, showToast, agregarProducto],
  );

  const startScanning = async () => {
    setIsScanning(true);

    setTimeout(async () => {
      // 1. Detección NATIVA ultra-rápida por GPU (Chrome / Android)
      if ("BarcodeDetector" in window) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              advanced: [{ focusMode: "continuous" }] as unknown as MediaTrackConstraintSet[],
            },
          });
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          const BarcodeDetectorClass = (
            window as unknown as {
              BarcodeDetector: new (options?: { formats: string[] }) => {
                detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
              };
            }
          ).BarcodeDetector;
          const detector = new BarcodeDetectorClass({
            formats: ["ean_13", "code_128", "qr_code", "upc_a", "ean_8"],
          });

          const scanLoop = async () => {
            if (!videoRef.current) return;
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
            animFrameRef.current = requestAnimationFrame(scanLoop);
          };
          scanLoop();
          return;
        } catch (err) {
          console.warn("Fallback a html5-qrcode en CajaAutopago", err);
        }
      }

      // 2. Fallback con html5-qrcode
      try {
        const html5Qrcode = new Html5Qrcode("reader");
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 30,
            qrbox: (w, h) => ({ width: Math.floor(w * 0.95), height: Math.floor(h * 0.95) }),
          },
          (decodedText: string) => {
            processScannedBarcode(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Error starting camera scanner in CajaAutopago", err);
        showToast("No se pudo acceder a la cámara. Revisa los permisos.", "error");
        setIsScanning(false);
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

  // ── Grid de productos (filtrado en vivo por el buscador) ───────
  const productosGrid = useMemo(() => {
    // Con control de stock activo, solo se listan los bienes con stock > 0
    // (los servicios no manejan stock, así que siempre se muestran).
    const conStock = config?.isStock
      ? productosSucursal.filter((p) => p.tipoProducto !== "BIEN" || (p.sucursalProducto.stock ?? 0) > 0)
      : productosSucursal;
    const q = busqueda.trim().toLowerCase();
    if (!q) return conStock;
    return conStock.filter(
      (p) =>
        p.nomProducto?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.codigoBarras?.toLowerCase().includes(q),
    );
  }, [busqueda, productosSucursal, config?.isStock]);



  // Al escribir o escanear un código de barras en el buscador:
  // Si el valor ingresado coincide EXACTAMENTE con un código de barras o código,
  // lo agrega DIRECTO al carrito de la derecha y limpia el campo al instante.
  useEffect(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return;

    const exacto = productosSucursal.find(
      (p) =>
        p.codigoBarras?.trim().toLowerCase() === q ||
        p.codigo?.trim().toLowerCase() === q,
    );

    if (exacto) {
      if (config?.isStock && exacto.tipoProducto === "BIEN" && (exacto.sucursalProducto.stock ?? 0) <= 0) {
        showToast(`El producto "${exacto.nomProducto}" no tiene stock disponible (0 unidades).`, "error");
        setBusqueda("");
        return;
      }
      agregarProducto(exacto);
      setBusqueda("");
    }
  }, [busqueda, productosSucursal, config?.isStock, agregarProducto, showToast]);

  const cambiarCantidad = (key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.key === key ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i,
        )
        .filter((i) => i.cantidad > 0),
    );
  };

  const confirmarEliminar = () => {
    if (!itemAEliminar) return;
    setItems((prev) => prev.filter((i) => i.key !== itemAEliminar.key));
    setItemAEliminar(null);
  };

  // Enter en el buscador o escáner de código de barras físico:
  // Agrega directo el producto encontrado por código de barras / código o el primero del grid,
  // limpiando la búsqueda para la siguiente lectura.
  const onEnterBusqueda = useCallback((overrideQuery?: string) => {
    const q = (overrideQuery ?? busqueda).trim().toLowerCase();
    if (!q) return;

    // 1. Buscar coincidencia exacta por código de barras o código
    const exacto = productosSucursal.find(
      (p) =>
        p.codigoBarras?.trim().toLowerCase() === q ||
        p.codigo?.trim().toLowerCase() === q,
    );

    if (exacto) {
      if (config?.isStock && exacto.tipoProducto === "BIEN" && (exacto.sucursalProducto.stock ?? 0) <= 0) {
        showToast(`El producto "${exacto.nomProducto}" no tiene stock disponible (0 unidades).`, "error");
        setBusqueda("");
        return;
      }
      agregarProducto(exacto);
      setBusqueda("");
      return;
    }

    // 2. Si no hay coincidencia exacta, buscar si hay resultados en el grid
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
      showToast("No se encontró ningún producto con ese código de barras o nombre.", "error");
      setBusqueda("");
    }
  }, [busqueda, productosGrid, productosSucursal, config?.isStock, showToast, agregarProducto]);

  // Captura global de lecturas de códigos de barras (escáner físico USB/Bluetooth)
  // incluso si el usuario hace clic afuera del input.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mostrarPago || !!itemAEliminar) return;

      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (e.key === "Enter" && !isInput) {
        e.preventDefault();
        onEnterBusqueda();
        return;
      }

      if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [onEnterBusqueda, mostrarPago, itemAEliminar]);

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
    return {
      clienteId: cliente?.clienteId ?? null,
      tipoDocumento,
      numeroDocumento: documentoTrim,
      razonSocial: cliente?.razonSocial ?? "",
      ubigeo: cliente?.ubigeo || "",
      direccionLineal: cliente?.direccionLineal || "",
      departamento: cliente?.departamento || "",
      provincia: cliente?.provincia || "",
      distrito: cliente?.distrito || "",
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
  const descontarStockSiAplica = async (comprobanteId: number) => {
    if (!config?.isStock) return;
    const acumulado = new Map<number, number>();
    items.forEach((it) => {
      if (it.tipoProducto !== "BIEN" || !it.sucursalProductoId) return;
      acumulado.set(it.sucursalProductoId, (acumulado.get(it.sucursalProductoId) ?? 0) + it.cantidad);
    });
    const payloadItems = Array.from(acumulado.entries()).map(([sucursalProductoId, cantidad]) => ({
      sucursalProductoId,
      cantidad,
    }));
    if (!payloadItems.length) return;
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/descontar-stock`,
        payloadItems,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const productosActualizados = await fetchProductosSucursal();
      if (sucursal?.numeroStockBajo) {
        const umbral = config.umbralStockBajo ?? 10;
        const bajos = (productosActualizados ?? [])
          .filter((p) => {
            const vendida = acumulado.get(p.sucursalProducto.sucursalProductoId);
            if (vendida === undefined) return false;
            const stockDespues = p.sucursalProducto.stock ?? 0;
            const stockAntes = stockDespues + vendida;
            return stockDespues <= umbral && stockAntes > umbral;
          })
          .map((p) => ({ nomProducto: p.nomProducto, stock: p.sucursalProducto.stock ?? 0 }));
        if (bajos.length) avisarStockBajoWhatsapp(bajos, sucursal.numeroStockBajo);
      }
    } catch {
      showToast("No se pudo actualizar el stock de los productos.", "error");
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
    if (len === 8) buscarCliente("01", documentoTrim);
    else if (len === 9) buscarCliente("04", documentoTrim);
    else if (len === 11) buscarCliente("06", documentoTrim);
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

      if (tipoComprobante === "Nota de Venta") {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/NotaVenta`,
          prepararNotaVenta(),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        comprobanteId = res.data.comprobanteId ?? res.data.ComprobanteId;
      } else {
        const cod = tipoComprobante === "Factura" ? "01" : "03";
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarXml`,
          prepararComprobante(cod),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        comprobanteId = res.data.comprobanteId;

        // Envío a SUNAT: si SUNAT rechaza o no responde, el comprobante ya quedó
        // registrado en el sistema (igual que en Boleta/Factura), así que no
        // detenemos el flujo de caja — solo avisamos el resultado.
        try {
          const resSunat = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`,
            null,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          showToast(
            resSunat.data.exitoso
              ? (resSunat.data.mensaje ?? `${tipoComprobante} emitida correctamente.`)
              : (resSunat.data.mensaje ?? `${tipoComprobante} quedó pendiente/rechazada por SUNAT.`),
            resSunat.data.exitoso ? "success" : "error",
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
      await descontarStockSiAplica(comprobanteId);
      await imprimirSiAplica(comprobanteId);
      fetchSucursal();
      setEmitido(true);
    } catch (err) {
      const data = (err as { response?: { data?: { mensaje?: string; message?: string; detalle?: string } } })?.response?.data;
      const mensaje = data?.mensaje ?? data?.message ?? "Error al generar el comprobante";
      const detalle = data?.detalle;
      showToast(detalle ? `${mensaje}: ${detalle}` : mensaje, "error");
    } finally {
      setEmitiendo(false);
    }
  };

  const nuevaVenta = () => {
    setItems([]);
    setDocumento("");
    setTipoSinDocumento("Boleta");
    setTipoConDocumento("Boleta");
    tipoSinDocInitRef.current = false;
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
    setEmitido(false);
  };

  // ── Pantalla de éxito tras emitir ───────────────────────────────
  if (emitido) {
    return (
      <div className="h-[calc(100vh-140px)] w-full flex items-center justify-center animate-in fade-in duration-500">
        <div className="w-full max-w-md rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden max-h-full overflow-y-auto">
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
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => imprimirManual("80")}
                className="flex flex-col items-center gap-1 rounded-md border border-gray-200 py-2.5 text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="text-[10px] font-semibold">80mm</span>
              </button>
              <button
                onClick={() => imprimirManual("58")}
                className="flex flex-col items-center gap-1 rounded-md border border-gray-200 py-2.5 text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="text-[10px] font-semibold">58mm</span>
              </button>
              <button
                onClick={() => imprimirManual("A4")}
                className="flex flex-col items-center gap-1 rounded-md border border-gray-200 py-2.5 text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="text-[10px] font-semibold">A4</span>
              </button>
            </div>

            <button
              onClick={descargarPDF}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-blue hover:text-brand-blue transition-colors"
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
                className="h-[34px] px-3.5 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center"
              >
                {enviandoWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Enviar"}
              </button>
            </div>

            <button
              onClick={nuevaVenta}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-blue py-4 text-white text-lg font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all mt-2"
            >
              Nueva venta
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla principal: grid de productos + carrito ───────────
  return (
    <>
      <div className="w-full rounded-md border border-gray-200 bg-white shadow-sm flex flex-col lg:flex-row lg:h-[calc(100vh-140px)] lg:overflow-hidden animate-in fade-in duration-500">
        {/* ── Columna izquierda: buscador + grid de productos ── */}
        <div className="flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100 lg:overflow-hidden">
          <div className="shrink-0 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onEnterBusqueda();
                  }
                }}
                placeholder="Escanea con la cámara, lector físico o busca por nombre / código"
                className="w-full pl-8 pr-7 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
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
                className="flex items-center gap-1.5 px-3 py-2.5 bg-brand-blue text-white rounded-md text-xs font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm shrink-0"
              >
                <ScanBarcode size={14} />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanning}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-500 text-white rounded-md text-xs font-semibold hover:bg-rose-600 active:scale-[0.98] transition-all shadow-sm shrink-0"
              >
                <X size={14} />
                <span>Cerrar</span>
              </button>
            )}
          </div>

          {/* Visor de cámara en vivo para ventas (cuando está activo) */}
          {isScanning && (
            <div className="shrink-0 p-3 bg-gray-900 border-b border-gray-800 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-white text-xs">
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Cámara activa · Escanea tus productos uno tras otro
                </span>
                <span className="text-[11px] text-gray-400">
                  {items.length} producto{items.length === 1 ? "" : "s"} en el carrito
                </span>
              </div>
              <div className="relative w-full h-44 bg-black rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <div
                  id="reader"
                  className="absolute inset-0 w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />
                <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 h-20 border-2 border-dashed border-emerald-400/70 rounded-lg bg-emerald-400/5 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 lg:overflow-y-auto p-3">
            {productosGrid.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="bg-gray-100 rounded-full p-5 mb-4">
                  <PackageSearch className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-500 font-semibold">Sin resultados</p>
                <p className="text-gray-400 text-sm mt-1">Prueba con otro nombre o código</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5">
                {productosGrid.map((p) => (
                  <ProductoGridCard key={p.productoId} p={p} onClick={() => agregarProducto(p)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: marca + documento + carrito ── */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col bg-gray-50/40 lg:overflow-hidden">
          <div
            className="shrink-0 px-5 py-4 text-white flex items-center gap-3"
            style={{ background: "linear-gradient(180deg, #0f2e64 0%, #091a3d 100%)" }}
          >
            <div className="w-9 h-9 rounded-md bg-white/15 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Caja Autopago</p>
              <p className="text-[11px] text-blue-100 truncate">
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
            <p className="text-xs text-gray-400 mt-1 px-1">
              DNI/CE → Boleta{config?.useNotaVenta ? " o Nota de Venta" : ""} · RUC → Factura · Vacío → Clientes varios
            </p>
          </div>

          <div className="flex-1 lg:overflow-y-auto px-3 py-3 space-y-2">
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
                  className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-3 py-2.5 hover:border-gray-200 transition-colors"
                >
                  <ImagenProductoCuadrada url={i.urlImagen} alt={i.descripcion} size="md" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {i.descripcion}
                    </p>
                    <p className="text-xs text-gray-400">S/ {i.precio.toFixed(2)} c/u</p>
                  </div>

                  {/* Control de cantidad */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => cambiarCantidad(i.key, -1)}
                      className="h-7 w-7 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-gray-800 tabular-nums">
                      {i.cantidad}
                    </span>
                    <button
                      onClick={() => cambiarCantidad(i.key, 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Total de línea */}
                  <span className="w-20 text-right text-sm font-bold text-gray-900 tabular-nums shrink-0">
                    S/ {(i.precio * i.cantidad).toFixed(2)}
                  </span>

                  {/* Eliminar */}
                  <button
                    onClick={() => setItemAEliminar(i)}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                    title="Eliminar producto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer con totales y cobrar — fijo en la parte inferior en mobile */}
          <div className="shrink-0 sticky bottom-0 lg:static border-t border-gray-200 bg-white px-4 py-4 space-y-3 z-10">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums">S/ {totales.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>IGV ({igvPct}%)</span>
              <span className="tabular-nums">S/ {totales.igv.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">
                Total ({totales.unidades} und.)
              </span>
              <span className="text-xl font-bold text-brand-blue tabular-nums">
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

      <ModalEliminar
        isOpen={!!itemAEliminar}
        mensaje="Quitarás de la venta"
        nombre={itemAEliminar?.descripcion ?? ""}
        documento={itemAEliminar?.codigo ?? undefined}
        onClose={() => setItemAEliminar(null)}
        onConfirm={confirmarEliminar}
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
                        {i.cantidad}x {i.descripcion}
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
              <div className="flex justify-between text-gray-500">
                <span>Base imponible</span>
                <span className="tabular-nums">S/ {totales.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>IGV ({igvPct}%)</span>
                <span className="tabular-nums">S/ {totales.igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                <span>Total</span>
                <span className="tabular-nums">S/ {totales.total.toFixed(2)}</span>
              </div>
            </div>
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
                ) : loadingCliente ? (
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando cliente...
                  </span>
                ) : errorCliente ? (
                  <span className="text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {errorCliente}
                  </span>
                ) : (
                  <span className="text-gray-600 font-medium">
                    {cliente?.razonSocial ?? "—"} · {documentoTrim}
                  </span>
                )}
              </div>
            </div>

            {/* Emitir con otra fecha · Pago dividido */}
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  setMostrarFechaManual((v) => !v);
                  if (!fechaEmisionManual) setFechaEmisionManual(formatoFechaActual().fecha);
                }}
                className="flex items-center gap-1.5 font-semibold text-gray-500 hover:text-brand-blue transition-colors"
              >
                <CalendarClock className="w-3.5 h-3.5" /> Emitir con otra fecha
              </button>
              <button
                onClick={togglePagoDividido}
                className={`flex items-center gap-1.5 font-semibold transition-colors ${
                  pagoDividido ? "text-brand-blue" : "text-gray-500 hover:text-brand-blue"
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" /> Pago dividido{pagoDividido ? " (activo)" : ""}
              </button>
            </div>

            {mostrarFechaManual && (
              <div className="rounded-md border border-gray-200 px-3 py-2.5 space-y-1.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Fecha de emisión</p>
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
                ) : medioPago === "Efectivo" ? (
                  /* Monto recibido + vuelto (solo efectivo) */
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Monto recibido</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">S/</span>
                      <input
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value.replace(/[^0-9.]/g, ""))}
                        inputMode="decimal"
                        className="w-full h-11 pl-8 pr-3 rounded-md border border-gray-200 text-right text-lg font-bold tabular-nums outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        onClick={() => setMontoRecibido(totales.total.toFixed(2))}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                          parseFloat(montoRecibido) === totales.total
                            ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        Exacto
                      </button>
                      {MONTOS_RAPIDOS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMontoRecibido(m.toFixed(2))}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
                        >
                          S/ {m}
                        </button>
                      ))}
                    </div>
                    <div
                      className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${
                        faltante > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <span>{faltante > 0 ? "Falta" : "Vuelto"}</span>
                      <span className="tabular-nums">S/ {(faltante > 0 ? faltante : vuelto).toFixed(2)}</span>
                    </div>
                  </div>
                ) : medioPago === "Tarjeta" ? (
                  /* Tarjeta: se cobra en el POS físico, solo mostramos el monto */
                  <div className="rounded-md border border-gray-200 px-3 py-3 space-y-2.5">
                    <p className="text-xs text-gray-500">
                      El cobro se realiza en el POS físico. Se registra como pago con tarjeta.
                    </p>
                    <div className="rounded-md bg-gray-50 px-3 py-2.5 text-center">
                      <span className="text-lg font-bold text-gray-900 tabular-nums">S/ {totales.total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  /* Yape / Plin / Transferencia / Otro: monto a cobrar + N° operación opcional */
                  <div className="rounded-md border border-gray-200 px-3 py-3 space-y-2.5">
                    <div className="rounded-md bg-gray-50 px-3 py-2.5 text-center">
                      <span className="text-lg font-bold text-gray-900 tabular-nums">S/ {totales.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

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
    </>
  );
}
