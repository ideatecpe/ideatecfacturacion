"use client";

import React from "react";
import axios from "axios";
import { Plus, Loader2, ScanBarcode, CameraOff, Search, Sparkles } from "lucide-react";
import { scanImageData } from "@undecaf/zbar-wasm";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/utils/cn";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Proveedor, CompraProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/Proveedor";
import { useRegistrarCompraProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/useRegistrarCompraProveedor";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { avisarStockRepuestoWhatsapp } from "@/app/factufly/productos/gestioProductos/stockAlerta";
import LineaCompraRow, { LineaCompra, NUEVO_PROVEEDOR_VALUE } from "./LineaCompraRow";
import AgregarProveedor from "./AgregarProveedor";

/** Switch segmentado: misma data en todas las líneas que comparten sucursal,
 * para no repetir el fetch de productos cada vez que se agrega una línea. */
function useProductosPorSucursalCache() {
  const { accessToken } = useAuth();
  const [cache, setCache] = React.useState<Record<number, ProductoSucursal[]>>({});
  const [loadingIds, setLoadingIds] = React.useState<Set<number>>(new Set());
  const enVueloRef = React.useRef<Set<number>>(new Set());

  const ensureProductos = React.useCallback(
    async (sucursalId: number, force: boolean = false) => {
      if (!sucursalId) return;
      if (!force && cache[sucursalId]) return;
      if (enVueloRef.current.has(sucursalId)) return;
      enVueloRef.current.add(sucursalId);
      setLoadingIds((prev) => new Set(prev).add(sucursalId));
      try {
        const res = await axios.get<ProductoSucursal[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setCache((prev) => ({ ...prev, [sucursalId]: res.data }));
      } catch {
        // silencioso: la fila mostrará "Seleccione un producto" vacío
      } finally {
        enVueloRef.current.delete(sucursalId);
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(sucursalId);
          return next;
        });
      }
    },
    [accessToken, cache],
  );

  return { cache, loadingIds, ensureProductos };
}

function SwitchSegmentado<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  activeClassName,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  activeClassName: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5 border border-gray-200">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded transition-all whitespace-nowrap disabled:opacity-50",
              value === opt.value
                ? activeClassName
                : "text-gray-500 hover:text-gray-700 hover:bg-white/60",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proveedores: Proveedor[];
  proveedorPreseleccionado?: Proveedor | null;
  onCompraRegistrada: (compra: CompraProveedor) => void;
  onProveedorCreado?: (proveedor: Proveedor) => void;
}

let lineaKeySeq = 0;
const nuevaLinea = (proveedorId = 0, sucursalId = 0): LineaCompra => ({
  key: ++lineaKeySeq,
  proveedorId,
  sucursalId,
  productoId: 0,
  unidadMedida: "",
  cantidad: "",
  precioCompra: "",
  docReferencia: "",
  fechaVencimiento: "",
});

export default function RegistrarCompra({
  isOpen,
  onClose,
  proveedores,
  proveedorPreseleccionado,
  onCompraRegistrada,
  onProveedorCreado,
}: Props) {
  const { showToast } = useToast();
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";
  const sucursalFija = !isSuperAdmin
    ? { id: parseInt(user?.sucursalID ?? "0"), nombre: user?.nombreSucursal ?? "" }
    : undefined;

  const { registrarCompraProveedor } = useRegistrarCompraProveedor();
  // Se carga siempre (no solo para superadmin) porque el número de WhatsApp de
  // aviso de stock bajo ahora vive por sucursal, y lo necesitamos para avisar
  // aunque el usuario sea de una sola sucursal.
  const { sucursales } = useSucursalRuc(isOpen);
  const { cache: productosCache, loadingIds: productosLoadingIds, ensureProductos } =
    useProductosPorSucursalCache();

  const forzadoUnProveedor = !!proveedorPreseleccionado;

  const [modoProveedor, setModoProveedor] = React.useState<"unico" | "varios">("unico");
  const [modoDoc, setModoDoc] = React.useState<"unico" | "porLinea">("unico");
  const [proveedorIdHeader, setProveedorIdHeader] = React.useState<number>(0);
  const [docReferenciaHeader, setDocReferenciaHeader] = React.useState<string>("");
  const [lineas, setLineas] = React.useState<LineaCompra[]>([nuevaLinea()]);
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const [lineaErrors, setLineaErrors] = React.useState<Record<number, Record<string, boolean>>>({});
  const [guardando, setGuardando] = React.useState(false);
  const [progreso, setProgreso] = React.useState<{ total: number; actual: number } | null>(null);
  const [isAgregarProveedorOpen, setIsAgregarProveedorOpen] = React.useState(false);
  const [lineaTargetNuevoProveedor, setLineaTargetNuevoProveedor] = React.useState<number | null>(null);

  // Escáner de código de barras rápido y cámara
  const [quickSearch, setQuickSearch] = React.useState("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const scannerBufferRef = React.useRef<{ text: string; lastTime: number }>({ text: "", lastTime: 0 });
  const quickInputRef = React.useRef<HTMLInputElement | null>(null);

  const modoSucursal: "fijo" | "porItem" = isSuperAdmin ? "porItem" : "fijo";

  // Precalentar caché de productos fresca al abrir modal
  React.useEffect(() => {
    if (isOpen) {
      const sId = sucursalFija?.id ?? sucursales[0]?.sucursalId ?? 1;
      if (sId > 0) ensureProductos(sId, true);
    }
  }, [isOpen, sucursalFija?.id, sucursales, ensureProductos]);

  React.useEffect(() => {
    if (isOpen) {
      setModoProveedor("unico");
      setModoDoc("unico");
      setProveedorIdHeader(proveedorPreseleccionado?.proveedorId ?? 0);
      setDocReferenciaHeader("");
      setLineas([nuevaLinea(proveedorPreseleccionado?.proveedorId ?? 0, sucursalFija?.id ?? 0)]);
      setErrors({});
      setLineaErrors({});
      setGuardando(false);
      setProgreso(null);
      setQuickSearch("");
    } else {
      stopScanning();
    }
  }, [isOpen, proveedorPreseleccionado]);

  const handleScanOrSearchBarcode = React.useCallback(
    (scannedText: string) => {
      const raw = scannedText.trim();
      if (!raw) return;
      const text = raw.toLowerCase();
      const cleanDigits = raw.replace(/\s+/g, "").toLowerCase();

      const sucursalIdEfectiva =
        modoSucursal === "porItem" ? lineas[0]?.sucursalId || sucursalFija?.id || 1 : sucursalFija?.id ?? 1;
      const productosSucursal = productosCache[sucursalIdEfectiva] ?? [];

      // Coincidencia por código de barras (limpiando espacios), código o nombre
      const encontrado =
        productosSucursal.find((p) => {
          const pBarcode = (p.codigoBarras ?? "").replace(/\s+/g, "").toLowerCase();
          const pCodigo = (p.codigo ?? "").trim().toLowerCase();
          const pNombre = (p.nomProducto ?? "").trim().toLowerCase();
          return (
            (pBarcode && (pBarcode === cleanDigits || pBarcode.includes(cleanDigits))) ||
            pCodigo === text ||
            pNombre === text ||
            coincideBusqueda(raw, p.nomProducto, p.codigo, p.codigoBarras)
          );
        });

      if (!encontrado) {
        showToast(`No se encontró producto con código "${raw}"`, "info");
        return;
      }

      const ultimoCosto = encontrado.sucursalProducto?.ultimoPrecioCompra;
      const precioCompraDefault =
        ultimoCosto && ultimoCosto > 0 ? String(ultimoCosto) : "";

      // 1. Si hay una línea vacía en la tabla, la usamos
      const lineaVacia = lineas.find((l) => l.productoId === 0 && l.estado !== "guardado");
      if (lineaVacia) {
        setLineas((prev) =>
          prev.map((l) =>
            l.key === lineaVacia.key
              ? {
                  ...l,
                  productoId: encontrado.productoId,
                  unidadMedida: encontrado.unidadMedida,
                  precioCompra: l.precioCompra || precioCompraDefault,
                  cantidad: l.cantidad && Number(l.cantidad) > 0 ? l.cantidad : "1",
                }
              : l,
          ),
        );
        setLineaErrors((prev) => ({ ...prev, [lineaVacia.key]: {} }));
        showToast(
          `✓ ${encontrado.nomProducto}${
            ultimoCosto && ultimoCosto > 0
              ? ` (Costo: S/ ${ultimoCosto.toFixed(2)})`
              : ""
          }`,
          "success",
        );
        setQuickSearch("");
        return;
      }

      // 2. Si el producto ya existe en la lista, aumentamos la cantidad + 1
      const lineaExistente = lineas.find(
        (l) => l.productoId === encontrado.productoId && l.estado !== "guardado",
      );
      if (lineaExistente) {
        const nuevaCant = (Number(lineaExistente.cantidad) || 0) + 1;
        setLineas((prev) =>
          prev.map((l) =>
            l.key === lineaExistente.key
              ? {
                  ...l,
                  cantidad: String(nuevaCant),
                  precioCompra: l.precioCompra || precioCompraDefault,
                }
              : l,
          ),
        );
        showToast(`+1 ${encontrado.nomProducto} (Total: ${nuevaCant})`, "success");
        setQuickSearch("");
        return;
      }

      // 3. Si no, agregamos una nueva fila
      const nueva = nuevaLinea(
        modoProveedor === "unico" ? proveedorIdHeader : 0,
        sucursalFija?.id ?? 0,
      );
      nueva.productoId = encontrado.productoId;
      nueva.unidadMedida = encontrado.unidadMedida;
      nueva.precioCompra = precioCompraDefault;
      nueva.cantidad = "1";

      setLineas((prev) => [...prev, nueva]);
      showToast(
        `✓ ${encontrado.nomProducto}${
          ultimoCosto && ultimoCosto > 0
            ? ` (Costo: S/ ${ultimoCosto.toFixed(2)})`
            : ""
        }`,
        "success",
      );
      setQuickSearch("");
    },
    [
      lineas,
      modoSucursal,
      sucursalFija?.id,
      productosCache,
      showToast,
      modoProveedor,
      proveedorIdHeader,
    ],
  );

  const stopScanning = React.useCallback(() => {
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

        // 1. Detección nativa
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
              formats: [
                "ean_13",
                "code_128",
                "qr_code",
                "upc_a",
                "ean_8",
                "code_39",
                "upc_e",
                "itf",
                "codabar",
              ],
            });

            let scanned = false;
            const scanLoopNative = async () => {
              if (scanned || !videoRef.current || videoRef.current.paused || videoRef.current.ended)
                return;
              try {
                if (videoRef.current.readyState >= 2) {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    scanned = true;
                    const decodedText = barcodes[0].rawValue;
                    handleScanOrSearchBarcode(decodedText);
                    stopScanning();
                    return;
                  }
                }
              } catch {}
              animFrameRef.current = requestAnimationFrame(scanLoopNative);
            };
            scanLoopNative();
            return;
          } catch (err) {
            console.warn("Fallback a ZBar-WASM por falla en cámara nativa", err);
          }
        }

        // 2. Fallback ZBar WASM
        let scannedZbar = false;
        const scanLoopZbar = async () => {
          if (
            scannedZbar ||
            !videoRef.current ||
            videoRef.current.paused ||
            videoRef.current.ended ||
            !ctx
          )
            return;
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
                const decodedText = symbols[0].decode();
                if (decodedText) {
                  scannedZbar = true;
                  handleScanOrSearchBarcode(decodedText);
                  stopScanning();
                  return;
                }
              }
            }
          } catch {}
          animFrameRef.current = requestAnimationFrame(scanLoopZbar);
        };
        scanLoopZbar();
      } catch (err: unknown) {
        const errorName = (err as { name?: string })?.name;
        if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setCameraError("No se detectó ninguna cámara en este equipo.");
        } else if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setCameraError("Permiso de cámara denegado en tu navegador.");
        } else {
          setCameraError("No se pudo acceder a la cámara.");
        }
      }
    }, 50);
  };

  // Escáner USB / Inalámbrico en el modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target !== quickInputRef.current &&
        target.getAttribute("type") !== "number"
      ) {
        // Si el usuario está escribiendo un texto largo como documento de referencia, no interceptar
      }

      const now = Date.now();
      const timeDiff = now - scannerBufferRef.current.lastTime;

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff < 45) {
          scannerBufferRef.current.text += e.key;
        } else {
          scannerBufferRef.current.text = e.key;
        }
        scannerBufferRef.current.lastTime = now;
      }

      if (e.key === "Enter" && scannerBufferRef.current.text.length >= 3 && timeDiff < 100) {
        const scanned = scannerBufferRef.current.text.trim();
        if (scanned) {
          e.preventDefault();
          e.stopPropagation();
          handleScanOrSearchBarcode(scanned);
        }
        scannerBufferRef.current = { text: "", lastTime: 0 };
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, handleScanOrSearchBarcode]);

  const handleCambiarModoProveedor = (modo: "unico" | "varios") => {
    setModoProveedor(modo);
    if (modo === "unico") {
      setModoDoc("unico");
    }
    setLineas([nuevaLinea(modo === "unico" ? proveedorIdHeader : 0, sucursalFija?.id ?? 0)]);
    setLineaErrors({});
  };

  const handleAgregarLinea = () =>
    setLineas((prev) => [
      ...prev,
      nuevaLinea(modoProveedor === "unico" ? proveedorIdHeader : 0, sucursalFija?.id ?? 0),
    ]);

  const handleEliminarLinea = (key: number) =>
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const handleAbrirNuevoProveedor = (lineaKey: number | null) => {
    setLineaTargetNuevoProveedor(lineaKey);
    setIsAgregarProveedorOpen(true);
  };

  const handleProveedorCreado = (nuevo: Proveedor) => {
    onProveedorCreado?.(nuevo);

    if (lineaTargetNuevoProveedor != null) {
      const key = lineaTargetNuevoProveedor;
      setLineas((prev) =>
        prev.map((l) => (l.key === key ? { ...l, proveedorId: nuevo.proveedorId } : l)),
      );
      setLineaErrors((prev) => ({ ...prev, [key]: { ...prev[key], proveedorId: false } }));
    } else {
      setProveedorIdHeader(nuevo.proveedorId);
      setLineas((prev) => prev.map((l) => ({ ...l, proveedorId: nuevo.proveedorId })));
      if (errors.proveedorIdHeader) setErrors((prev) => ({ ...prev, proveedorIdHeader: false }));
    }
    setLineaTargetNuevoProveedor(null);
  };

  const handleLineaChange = (key: number, field: keyof Omit<LineaCompra, "key">, value: string | number) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
    setLineaErrors((prev) => ({ ...prev, [key]: { ...prev[key], [field]: false } }));
  };

  const resolverProductoDeLinea = (l: LineaCompra): ProductoSucursal | undefined => {
    const sucursalIdEfectiva = modoSucursal === "porItem" ? l.sucursalId : sucursalFija?.id ?? 0;
    const productosSucursal = productosCache[sucursalIdEfectiva] ?? [];
    return productosSucursal.find((p) => p.productoId === l.productoId);
  };

  const validar = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    if (modoProveedor === "unico" && proveedorIdHeader === 0) newErrors.proveedorIdHeader = true;

    const newLineaErrors: Record<number, Record<string, boolean>> = {};
    const mensajes: string[] = [];

    lineas.forEach((l, idx) => {
      if (l.estado === "guardado") return;

      const le: Record<string, boolean> = {};
      if (modoProveedor === "varios" && l.proveedorId === 0) le.proveedorId = true;
      if (modoSucursal === "porItem" && l.sucursalId === 0) le.sucursalId = true;
      if (l.productoId === 0) le.productoId = true;
      if (!l.cantidad || Number(l.cantidad) <= 0) le.cantidad = true;
      if (!l.precioCompra || Number(l.precioCompra) <= 0) le.precioCompra = true;

      if (l.productoId !== 0 && l.cantidad) {
        const producto = resolverProductoDeLinea(l);
        if (producto?.esPaquete) {
          if (!producto.productoBaseId || !producto.factorConversion) {
            le.productoId = true;
            mensajes.push(
              `Línea ${idx + 1}: "${producto.nomProducto}" es un paquete sin producto base/factor de conversión configurado. Corrígelo en Productos antes de comprarlo.`,
            );
          } else if (!Number.isInteger(Number(l.cantidad))) {
            le.cantidad = true;
            mensajes.push(
              `Línea ${idx + 1}: la cantidad de un paquete/caja debe ser un número entero. Si necesitas una fracción, regístrala usando el producto base (unidad).`,
            );
          }
        }
      }

      if (Object.keys(le).length > 0) newLineaErrors[l.key] = le;
    });

    setErrors(newErrors);
    setLineaErrors(newLineaErrors);

    if (mensajes.length > 0) showToast(mensajes[0], "error");

    return Object.keys(newErrors).length === 0 && Object.keys(newLineaErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    // Solo se reenvían las líneas que aún no se guardaron — evita duplicar compras
    // ya registradas si el usuario reintenta después de un error parcial.
    const pendientes = lineas.filter((l) => l.estado !== "guardado");
    if (pendientes.length === 0) return;

    setGuardando(true);
    setProgreso({ total: pendientes.length, actual: 0 });

    let huboError = false;
    let ultimaCreada: CompraProveedor | null = null;
    const registrosOk: { sucursalId: number; productoId: number; cantidad: number }[] = [];

    for (let i = 0; i < pendientes.length; i++) {
      const l = pendientes[i];
      setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, estado: "guardando" } : x)));

      const proveedorId = modoProveedor === "unico" ? proveedorIdHeader : l.proveedorId;
      const sucursalId = modoSucursal === "porItem" ? l.sucursalId : sucursalFija?.id ?? 0;
      const docReferencia =
        modoProveedor === "varios" && modoDoc === "porLinea"
          ? l.docReferencia
          : docReferenciaHeader;

      const producto = resolverProductoDeLinea(l);

      const creada = await registrarCompraProveedor({
        proveedorId,
        sucursalId,
        productoId: l.productoId,
        precioCompra: Number(l.precioCompra),
        cantidad: Number(l.cantidad),
        unidadMedida: l.unidadMedida || undefined,
        docReferencia: docReferencia.trim() || undefined,
        idUsuario: user?.id ? Number(user.id) : undefined,
        fechaVencimiento: l.fechaVencimiento || undefined,
      });

      if (creada) {
        ultimaCreada = creada;
        // Los paquetes reponen el stock del producto BASE (no el vendido en la línea),
        // así que no se puede calcular el cruce de umbral con los datos de esta línea.
        if (!producto?.esPaquete) {
          registrosOk.push({ sucursalId, productoId: l.productoId, cantidad: Number(l.cantidad) });
        }
        setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, estado: "guardado" } : x)));
      } else {
        huboError = true;
        setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, estado: "error" } : x)));
      }
      setProgreso({ total: pendientes.length, actual: i + 1 });
    }

    setGuardando(false);
    if (ultimaCreada) onCompraRegistrada(ultimaCreada);

    if (registrosOk.length) {
      avisarStockRepuestoSiAplica(registrosOk);
    }

    if (!huboError) onClose();
  };

  // ── Avisar por WhatsApp si algún producto repuesto cruzó el umbral de stock bajo ──
  // El número de aviso es por sucursal, así que agrupamos los repuestos por la
  // sucursal donde se registró la compra y avisamos al número propio de cada una.
  const avisarStockRepuestoSiAplica = async (
    registros: { sucursalId: number; productoId: number; cantidad: number }[],
  ) => {
    const umbral = config?.umbralStockBajo ?? 10;
    const sucursalIds = Array.from(new Set(registros.map((r) => r.sucursalId)));
    const numeroPorSucursal = new Map(sucursales.map((s) => [s.sucursalId, s.numeroStockBajo]));
    const frescos = new Map<number, ProductoSucursal[]>();

    await Promise.all(
      sucursalIds.map(async (sucursalId) => {
        try {
          const res = await axios.get<ProductoSucursal[]>(
            `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          frescos.set(sucursalId, res.data);
        } catch {
          // silencioso: esa sucursal simplemente no participa del aviso
        }
      }),
    );

    const repuestosPorSucursal = new Map<number, { nomProducto: string; stock: number }[]>();
    registros.forEach((r) => {
      const producto = frescos.get(r.sucursalId)?.find((p) => p.productoId === r.productoId);
      if (!producto) return;
      const stockDespues = producto.sucursalProducto.stock ?? 0;
      const stockAntes = stockDespues - r.cantidad;
      if (stockAntes > umbral || stockDespues <= umbral) return;
      const lista = repuestosPorSucursal.get(r.sucursalId) ?? [];
      lista.push({ nomProducto: producto.nomProducto, stock: stockDespues });
      repuestosPorSucursal.set(r.sucursalId, lista);
    });

    repuestosPorSucursal.forEach((repuestos, sucursalId) => {
      const numero = numeroPorSucursal.get(sucursalId);
      if (numero && repuestos.length) avisarStockRepuestoWhatsapp(repuestos, numero);
    });
  };

  const totalGeneral = lineas.reduce(
    (acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precioCompra) || 0),
    0,
  );

  const mostrarColProveedor = modoProveedor === "varios";
  const mostrarColSucursal = modoSucursal === "porItem";
  const mostrarColDoc = modoProveedor === "varios" && modoDoc === "porLinea";

  const guardadosCount = lineas.filter((l) => l.estado === "guardado").length;
  const erroresCount = lineas.filter((l) => l.estado === "error").length;
  const hayGuardados = guardadosCount > 0;
  const hayPendientes = lineas.some((l) => l.estado !== "guardado");

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar nueva compra / ingreso de stock" className="max-w-7xl">
      <form className="space-y-2.5" onSubmit={handleGuardar}>
        {/* ── Switches: modo de compra + modo documento, en 2 columnas ── */}
        {(!forzadoUnProveedor || modoProveedor === "varios") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!forzadoUnProveedor && (
              <SwitchSegmentado
                label="Modo de compra"
                value={modoProveedor}
                disabled={guardando || hayGuardados}
                onChange={handleCambiarModoProveedor}
                activeClassName="bg-white text-brand-blue shadow-sm"
                options={[
                  { value: "unico", label: "Un proveedor" },
                  { value: "varios", label: "Varios proveedores" },
                ]}
              />
            )}

            {modoProveedor === "varios" && (
              <SwitchSegmentado
                label="Documento de referencia"
                value={modoDoc}
                disabled={guardando}
                onChange={setModoDoc}
                activeClassName="bg-white text-emerald-700 shadow-sm"
                options={[
                  { value: "unico", label: "Único (interno)" },
                  { value: "porLinea", label: "Por proveedor" },
                ]}
              />
            )}
          </div>
        )}

        {/* ── Proveedor (cabecera, solo modo único) ── */}
        {modoProveedor === "unico" && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
              Proveedor <span className="text-rose-500">*</span>
            </label>
            <select
              value={proveedorIdHeader}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id === NUEVO_PROVEEDOR_VALUE) {
                  handleAbrirNuevoProveedor(null);
                  return;
                }
                setProveedorIdHeader(id);
                setLineas((prev) => prev.map((l) => ({ ...l, proveedorId: id })));
                if (errors.proveedorIdHeader) setErrors((prev) => ({ ...prev, proveedorIdHeader: false }));
              }}
              disabled={guardando || forzadoUnProveedor}
              className={`w-full h-8 px-2.5 text-sm bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60 ${
                errors.proveedorIdHeader ? "border-rose-400" : "border-gray-200"
              }`}
            >
              <option value={0}>Seleccione un proveedor</option>
              <option value={NUEVO_PROVEEDOR_VALUE} className="font-semibold text-brand-blue">
                + Agregar nuevo proveedor
              </option>
              {proveedores.map((p) => (
                <option key={p.proveedorId} value={p.proveedorId}>
                  {p.razonSocial}
                </option>
              ))}
            </select>
            {errors.proveedorIdHeader && (
              <p className="text-xs text-rose-500 font-medium">Debe seleccionar un proveedor</p>
            )}
          </div>
        )}

        {/* ── Documento de Referencia + Sucursal, en 2 columnas ── */}
        {((modoProveedor === "unico" || modoDoc === "unico") || (!isSuperAdmin && sucursalFija)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(modoProveedor === "unico" || modoDoc === "unico") && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  Documento de Referencia <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={docReferenciaHeader}
                  onChange={(e) => setDocReferenciaHeader(e.target.value)}
                  placeholder="N° de factura/guía o informe interno"
                  disabled={guardando}
                  className="w-full h-8 px-2.5 text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60"
                />
              </div>
            )}

            {!isSuperAdmin && sucursalFija && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Sucursal</label>
                <div className="w-full h-8 flex items-center px-2.5 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-semibold">
                  {sucursalFija.nombre}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Barra de escaneo rápido y búsqueda para ingreso de mercadería ── */}
        <div className="bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-xl space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-blue uppercase flex items-center gap-1.5">
                <ScanBarcode className="w-4 h-4 text-brand-blue" />
                Ingreso Rápido con Escáner / Código de Barras
              </span>
              <span className="hidden sm:inline-block text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full border border-blue-100 font-medium">
                Pistola USB / Bluetooth lista
              </span>
            </div>
            <button
              type="button"
              onClick={isScanning ? stopScanning : startScanning}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors border shadow-2xs self-start sm:self-auto ${
                isScanning
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-white border-blue-200 text-brand-blue hover:bg-blue-50"
              }`}
            >
              <ScanBarcode className="w-3.5 h-3.5" />
              <span>{isScanning ? "Cerrar cámara" : "Escanear con cámara"}</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              ref={quickInputRef}
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScanOrSearchBarcode(quickSearch);
                }
              }}
              placeholder="Escanea el código de barras con pistola o escribe aquí (EAN-13, código o nombre)..."
              className="w-full h-8 pl-9 pr-24 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue text-gray-800 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => handleScanOrSearchBarcode(quickSearch)}
              className="absolute right-1 px-2.5 py-1 text-[11px] font-bold text-white bg-brand-blue hover:bg-brand-blue/90 rounded-md transition-colors shadow-2xs"
            >
              Añadir
            </button>
          </div>

          {/* Visor de cámara en vivo si está activo */}
          {isScanning && (
            <div className="space-y-2 p-2.5 bg-gray-100/90 rounded-xl border border-gray-200 text-gray-800">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  Buscando código de barras con la cámara...
                </span>
                <button
                  type="button"
                  onClick={stopScanning}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors px-2 py-0.5 bg-gray-200/80 hover:bg-gray-300 rounded-lg"
                >
                  Cerrar
                </button>
              </div>
              <div className="relative w-full max-w-56 aspect-square mx-auto bg-black rounded-xl overflow-hidden border border-gray-200 shadow-md flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                {cameraError ? (
                  <div className="absolute inset-0 z-20 bg-gray-950/95 flex flex-col items-center justify-center text-center p-3 text-white">
                    <CameraOff className="w-8 h-8 text-gray-400 mb-1 animate-bounce" />
                    <p className="text-xs font-semibold text-gray-200">{cameraError}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Puedes ingresar el código manualmente o con lector USB
                    </p>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-2.5 border-2 border-white/20 rounded-lg flex items-center justify-center overflow-hidden z-10">
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)] animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Líneas de productos (tabla) ── */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-500 uppercase">
            Productos a ingresar
          </label>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "min(38vh, 340px)" }}>
              <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed", minWidth: "640px" }}>
                <colgroup>
                  <col style={{ width: "32px" }} />
                  {mostrarColProveedor && <col />}
                  {mostrarColSucursal && <col />}
                  {mostrarColDoc && <col />}
                  <col />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "115px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "95px" }} />
                  <col style={{ width: "32px" }} />
                </colgroup>
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">#</th>
                    {mostrarColProveedor && (
                      <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                        Proveedor
                      </th>
                    )}
                    {mostrarColSucursal && (
                      <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                        Sucursal
                      </th>
                    )}
                    {mostrarColDoc && (
                      <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                        Doc. Ref.
                      </th>
                    )}
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Producto
                    </th>
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Cantidad
                    </th>
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Precio compra unitario
                    </th>
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Vencimiento <span className="normal-case font-normal text-gray-400">(opc.)</span>
                    </th>
                    <th className="px-1.5 py-2 text-right font-bold text-gray-500 uppercase text-[10px]">
                      Subtotal
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {lineas.map((l, idx) => (
                    <LineaCompraRow
                      key={l.key}
                      index={idx}
                      linea={l}
                      mostrarProveedor={mostrarColProveedor}
                      mostrarSucursal={mostrarColSucursal}
                      mostrarDocLinea={mostrarColDoc}
                      proveedores={proveedores}
                      sucursales={sucursales}
                      sucursalFija={sucursalFija}
                      productosCache={productosCache}
                      productosLoadingIds={productosLoadingIds}
                      ensureProductos={ensureProductos}
                      errors={lineaErrors[l.key] ?? {}}
                      disabled={guardando || l.estado === "guardado"}
                      canRemove={lineas.length > 1 && l.estado !== "guardado"}
                      onChange={handleLineaChange}
                      onRemove={handleEliminarLinea}
                      onAgregarProveedor={handleAbrirNuevoProveedor}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAgregarLinea}
              disabled={guardando}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar producto
            </button>

            <p className="text-xs text-gray-500">
              Total general:{" "}
              <span className="text-sm font-bold text-emerald-700">S/ {totalGeneral.toFixed(2)}</span>
            </p>
          </div>
        </div>

        {/* ── Progreso ── */}
        {guardando && progreso && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Registrando compra...
              </span>
              <span className="font-semibold">
                {progreso.actual} / {progreso.total}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-blue transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((progreso.actual / progreso.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          {/* ── Estado: pequeño y discreto, solo aparece después de intentar guardar ── */}
          {(guardadosCount > 0 || erroresCount > 0) && (
            <p className="text-[11px] text-gray-500">
              <span className="text-emerald-600 font-semibold">{guardadosCount} guardado{guardadosCount === 1 ? "" : "s"}</span>
              {erroresCount > 0 && (
                <>
                  {" "}·{" "}
                  <span className="text-rose-600 font-semibold">{erroresCount} con error</span>
                </>
              )}
              {" "}de {lineas.length} línea{lineas.length === 1 ? "" : "s"}
            </p>
          )}

          <div className="flex justify-end gap-3 sm:ml-auto">
            <Button variant="outline" type="button" onClick={onClose} disabled={guardando} className="flex-1 sm:flex-none">
              {hayGuardados ? "Cerrar" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={guardando || !hayPendientes} className="flex-1 sm:flex-none">
              {guardando ? "Registrando..." : hayGuardados ? "Guardar faltantes" : "Registrar Ingreso"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>

    <AgregarProveedor
      isOpen={isAgregarProveedorOpen}
      onClose={() => {
        setIsAgregarProveedorOpen(false);
        setLineaTargetNuevoProveedor(null);
      }}
      onProveedorAgregado={handleProveedorCreado}
      elevated
    />
    </>
  );
}
