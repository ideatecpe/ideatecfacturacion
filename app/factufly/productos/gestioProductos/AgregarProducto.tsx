"use client";

import React, { useState } from "react";
import { scanImageData } from "@undecaf/zbar-wasm";
import dynamic from "next/dynamic";
import axios from "axios";
import { ChevronDown, Camera, X as XIcon, ImageOff, ScanBarcode, CameraOff, Bell, CalendarClock, PackageX } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";

const BarcodePreview = dynamic(() => import("react-barcode"), { ssr: false });
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import {
  Categoria,
  NuevoProducto,
  ProductoBase,
  ProductoSucursal,
} from "./Producto";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { generarCodigoProducto } from "./generarCodigoProducto";
import { useProductosEmpresaLista } from "./useProductosEmpresaLista";
import { useSucursalRuc } from "../../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useProductosBaseDisponiblesLista } from "./useProductosBaseDisponiblesLista";
import { useSearchProductosBaseDisponiblesLista } from "./useSearchProductosBaseDisponiblesLista";
import ModalAgregarCategoria from "./ModalAgregarCategoria";
import ModalCatalogoSunat from "./ModalCatalogoSunat";
import { SelectConAgregar } from "@/app/components/ui/SelectConAgregar";
import { SelectConBuscador } from "@/app/components/ui/SelectConBuscador";
import { generarEAN13Interno, formatoBarcodeSeguro } from "./barcodeFormato";
import { esUnidadContable } from "./unidadMedida";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProductoAgregado: (producto: ProductoSucursal) => void;
  categorias: Categoria[];
  onAgregarCategoria: (dto: {
    categoriaNombre: string;
    descripcion?: string;
  }) => Promise<boolean>; // ← nuevo
  loadingCategoria: boolean; // ← nuevo
}


const emptyForm: NuevoProducto = {
  codigo: "",
  tipoProducto: "BIEN",
  codigoSunat: "",
  nomProducto: "",
  unidadMedida: "NIU",
  tipoAfectacionIGV: "10",
  incluirIGV: true,
  categoriaId: 0,
  sucursalId: 0,
  precioUnitario: 0,
  stock: null,
  costoUnitario: null,
  urlImagenProducto: null,
  codigoBarras: "",
  esPaquete: false,
  productoBaseId: null,
  factorConversion: null,
  precioMayorista: null,
  cantidadMinimaMayorista: null,
  enPromocion: false,
  porcentajeDescuento: null,
  usuarioId: null,
  ubicacionTienda: null,
  alertaVencimientoActiva: false,
  alertaStockBajoActiva: true,
  stockMinimoAlerta: null,
};

// Incrementa el correlativo de un código tipo "COC-001" → "COC-002",
// respetando el relleno de ceros. Se usa para reintentar cuando el
// backend rechaza un código ya existente (p. ej. de un producto eliminado).
function incrementarCodigo(codigo: string): string {
  const m = codigo.match(/^(.*?)(\d+)$/);
  if (!m) return `${codigo}-1`;
  const [, base, num] = m;
  const siguiente = String(Number(num) + 1).padStart(num.length, "0");
  return base + siguiente;
}

export default function AgregarProducto({
  isOpen,
  onClose,
  onProductoAgregado,
  categorias,
  onAgregarCategoria,
  loadingCategoria,
}: Props) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const { config } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";

  const [form, setForm] = React.useState<NuevoProducto>(emptyForm);
  const [productoExistente, setProductoExistente] =
    React.useState<ProductoBase | null>(null);

  const [sugerencias, setSugerencias] = React.useState<ProductoBase[]>([]);
  const [showSugerencias, setShowSugerencias] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Debounce para la búsqueda por internet cuando se pega un código de barras
  // directamente en el campo Nombre.
  const busquedaBarcodeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (busquedaBarcodeTimerRef.current) clearTimeout(busquedaBarcodeTimerRef.current);
    };
  }, []);

  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState("");

  const [isModalCategoriaOpen, setIsModalCategoriaOpen] = useState(false);
  const [showMayorista, setShowMayorista] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [confirmandoEliminarImagen, setConfirmandoEliminarImagen] = useState(false);
  // true cuando la imagen actual fue subida a mano (cámara/archivo/pegar) — en ese
  // caso una nueva búsqueda por código de barras nunca debe reemplazarla. Si es
  // false (sin imagen, o imagen traída de una búsqueda anterior) sí se reemplaza.
  const imagenManualRef = React.useRef(false);
  // Último nombre autocompletado por la búsqueda de código de barras. Sirve para
  // distinguir "el usuario escribió este nombre" (no se toca) de "lo puso una
  // búsqueda anterior" (sí se reemplaza al escanear otro código).
  const nombreAutoRef = React.useRef<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [modalCatalogoOpen, setModalCatalogoOpen] = useState(false);
  const [codigoSunatLabel, setCodigoSunatLabel] = useState("");

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const animFrameRef = React.useRef<number | null>(null);

  const stopScanning = React.useCallback(async () => {
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

  // Pre-calentar el motor de escaneo nativo en memoria GPU al abrir el modal
  React.useEffect(() => {
    if (isOpen && "BarcodeDetector" in window) {
      try {
        const BarcodeDetectorClass = (
          window as unknown as {
            BarcodeDetector: new (options?: { formats: string[] }) => {
              detect: (src: HTMLCanvasElement) => Promise<unknown>;
            };
          }
        ).BarcodeDetector;
        const dummyDetector = new BarcodeDetectorClass({
          formats: ["ean_13", "code_128", "qr_code", "upc_a", "ean_8"],
        });
        const dummyCanvas = document.createElement("canvas");
        dummyCanvas.width = 32;
        dummyCanvas.height = 32;
        dummyDetector.detect(dummyCanvas).catch(() => {});
      } catch {
        // Silencioso
      }
    }
  }, [isOpen]);

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

        // 1. Camino NATIVO por GPU (Chrome / Android / Edge)
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

            let scanned = false;
            const scanLoopNative = async () => {
              if (scanned || !videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
              try {
                if (videoRef.current.readyState >= 2) {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    scanned = true;
                    const decodedText = barcodes[0].rawValue;
                    setForm((prev) => ({ ...prev, codigoBarras: decodedText }));
                    showToast(`Código escaneado: ${decodedText}`, "success");
                    stopScanning();
                    buscarProductoPorCodigoBarras(decodedText);
                    return;
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
        let scannedZbar = false;
        const scanLoopZbar = async () => {
          if (scannedZbar || !videoRef.current || videoRef.current.paused || videoRef.current.ended || !ctx) return;
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
                  setForm((prev) => ({ ...prev, codigoBarras: decodedText }));
                  showToast(`Código escaneado: ${decodedText}`, "success");
                  stopScanning();
                  buscarProductoPorCodigoBarras(decodedText);
                  return;
                }
              }
            }
          } catch {
            // Silencioso por fotograma
          }
          animFrameRef.current = requestAnimationFrame(scanLoopZbar);
        };
        scanLoopZbar();
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

  React.useEffect(() => {
    if (!isOpen) {
      stopScanning();
    }
    return () => {
      stopScanning();
    };
  }, [isOpen, stopScanning]);

  // Al abrir el modal: en COMPUTADORA enfoca el input "Nombre del producto";
  // en CELULAR abre directamente la cámara para escanear el código de barras.
  React.useEffect(() => {
    if (!isOpen) return;
    const esMovil =
      typeof window !== "undefined" &&
      ("ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 1024);
    const puedeEscanear =
      !productoExistente && esUnidadContable(form.unidadMedida);

    const t = setTimeout(() => {
      if (esMovil && puedeEscanear) {
        startScanning();
      } else {
        document
          .getElementById("agregar-producto-nombre")
          ?.focus();
      }
    }, 150);
    return () => clearTimeout(t);
    // Solo debe dispararse al abrir/cerrar el modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Busca datos del producto (nombre + imagen) por su código de barras en la
  // API pública de Superfood, y completa el nombre (si está vacío) y la
  // imagen (si no hay una) sin sobreescribir lo que el usuario ya escribió.
  const buscarProductoPorCodigoBarras = async (codigo: string) => {
    if (!codigo) return;
    try {
      const res = await fetch("/api/buscar-producto-superfood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: codigo }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.encontrado) return;

      setForm((prev) => {
        // El nombre se reemplaza si está vacío o si lo puso una búsqueda previa;
        // si lo escribió el usuario se respeta.
        const nombreEsReemplazable =
          prev.nomProducto.trim().length === 0 ||
          prev.nomProducto === nombreAutoRef.current;
        const nombreFinal =
          nombreEsReemplazable && data.nombre ? data.nombre : prev.nomProducto;
        const codigoAuto =
          nombreFinal !== prev.nomProducto && nombreFinal.trim().length > 0
            ? generarCodigoProducto(
                nombreFinal,
                productosEmpresa.length === 0 ? 0 : productosEmpresa.length,
              )
            : prev.codigo;
        return {
          ...prev,
          nomProducto: nombreFinal,
          codigo: codigoAuto,
          // Solo una imagen subida a mano es intocable: la de una búsqueda
          // anterior se reemplaza por la del código recién buscado.
          urlImagenProducto: imagenManualRef.current
            ? prev.urlImagenProducto
            : (data.imagenUrl ?? null),
        };
      });
      nombreAutoRef.current = data.nombre ?? null;
      if (!imagenManualRef.current) {
        setImgError(false);
        setImgPreview(null);
      }
    } catch {
      // Silencioso: si falla, el usuario completa nombre/imagen manualmente.
    }
  };

  const eliminarImagenCloudflare = async (imageId: string) => {
    try {
      await fetch("/api/upload-imagen", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
    } catch { /* si falla el delete en CF, no bloqueamos al usuario */ }
  };

  const handleSeleccionarImagen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImageFile(file);
  };

  // Lógica compartida de subida de imagen (usada por file input, cámara y paste)
  const uploadImageFile = async (file: File) => {
    // Validar tipo de archivo
    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(file.type)) {
      showToast("Solo se permiten imágenes JPG, PNG o WebP.", "error");
      return;
    }
    // Validar tamaño (máx 4 MB)
    if (file.size > 4 * 1024 * 1024) {
      showToast("La imagen no debe superar 4 MB.", "error");
      return;
    }

    imagenManualRef.current = true;
    setImgError(false);
    setImgPreview(URL.createObjectURL(file));
    setSubiendoImagen(true);
    // Si ya había una imagen subida antes de guardar, eliminarla de Cloudflare
    if (currentImageId) {
      await eliminarImagenCloudflare(currentImageId);
      setCurrentImageId(null);
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-imagen", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setForm((prev) => ({ ...prev, urlImagenProducto: data.url }));
        setCurrentImageId(data.imageId ?? null);
      } else {
        showToast("Error al subir imagen: " + data.error, "error");
        setImgPreview(null);
      }
    } catch {
      showToast("Error de conexión al subir imagen.", "error");
      setImgPreview(null);
    } finally {
      setSubiendoImagen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  // ── Ctrl+V para pegar imagen del portapapeles ──
  React.useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) uploadImageFile(file);
          return;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isOpen, currentImageId]);

  const handleQuitarImagen = () => {
    const idAnterior = currentImageId;
    imagenManualRef.current = false;
    setForm((prev) => ({ ...prev, urlImagenProducto: null }));
    setImgPreview(null);
    setImgError(false);
    setCurrentImageId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    // Eliminar de Cloudflare en segundo plano
    if (idAnterior) eliminarImagenCloudflare(idAnterior);
  };

  // Busca datos del producto por su código de barras en internet (Open Food Facts)
  // y autocompleta el nombre (si está vacío) y la imagen (si no hay una).
  //seleccionar sucursal para agregar si es superadmin
  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [sucursalSeleccionada, setSucursalSeleccionada] =
    React.useState<number>(0);
  const sucursalIdEfectivo = isSuperAdmin
    ? sucursalSeleccionada
    : parseInt(user?.sucursalID ?? "0");

  //Producto base sin estock ni precio de una empresa que no estan sucursal actual
  const [palabraBusqueda, setPalabraBusqueda] = useState("");
  const { productosBase, loadingBase } = useSearchProductosBaseDisponiblesLista(
    sucursalIdEfectivo,
    palabraBusqueda,
  );

  //const { productosBase } = useProductosBaseDisponiblesLista(sucursalIdEfectivo); sin usar la palbra

  // ─── NUEVO: estado de errores ─────────────────────────────
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    imagenManualRef.current = false;
    nombreAutoRef.current = null;
    if (isOpen) {
      setForm({ ...emptyForm, sucursalId: sucursalIdEfectivo });
      setCostoInput("");
      setErrors({});
      setImgError(false);
      setCodigoSunatLabel("");
    } else {
      setForm({ ...emptyForm, sucursalId: 0 });
      setCostoInput("");
      setCodigoSunatLabel("");
      setProductoExistente(null);
      setSugerencias([]);
      setShowSugerencias(false);
      setErrors({});
      setSucursalSeleccionada(0);
      setShowNuevaCategoria(false);
      setNombreNuevaCategoria("");
      setIsModalCategoriaOpen(false);
      setShowMayorista(false);
      setImgError(false);
      setImgPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      // Si el modal se cerró sin guardar y había una imagen subida, eliminarla de Cloudflare
      if (currentImageId) eliminarImagenCloudflare(currentImageId);
      setCurrentImageId(null);
      setConfirmandoEliminarImagen(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (palabraBusqueda.trim().length === 0) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }
    setSugerencias(productosBase);
    setShowSugerencias(productosBase.length > 0);
  }, [productosBase, palabraBusqueda]);

  // enabled=false: igual que en EditarProducto, el catálogo solo se descarga
  // cuando el modal se abre (efecto de abajo), no al montarlo cerrado.
  const { productosEmpresa, fetchProductosEmpresa } = useProductosEmpresaLista(false);

  // El costo se edita como TEXTO: con String(numero) al escribir "10.0" se
  // reescribia como "10" y era imposible teclear importes como 10.02.
  const [costoInput, setCostoInput] = React.useState("");

  // Refresca la lista de productos base cada vez que se abre el modal,
  // para que un producto base recién creado aparezca de inmediato al registrar su paquete.
  React.useEffect(() => {
    if (isOpen) fetchProductosEmpresa();
  }, [isOpen]);

  // REEMPLAZA ESTA FUNCIÓN COMPLETA:
  const handleNomProductoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Si lo que se escribe/pega es SOLO dígitos con largo de código de barras
    // (EAN-8, UPC, EAN-13, ITF-14), se trata como un código: se busca por
    // internet y se rellena nombre + foto, sin ir al campo de código de abajo.
    const esCodigoBarras = /^\d{8,14}$/.test(value.trim());

    setPalabraBusqueda(esCodigoBarras ? "" : value);

    // 👇 genera código automático usando el componente
    const codigoAuto =
      value.trim().length > 0
        ? generarCodigoProducto(
            value,
            productosEmpresa.length === 0 ? 0 : productosEmpresa.length,
          )
        : "";

    setForm((prev) => ({ ...prev, nomProducto: value, codigo: codigoAuto }));
    setProductoExistente(null);

    if (errors.nomProducto)
      setErrors((prev) => ({ ...prev, nomProducto: false }));

    // Cancela cualquier búsqueda por código pendiente al seguir escribiendo.
    if (busquedaBarcodeTimerRef.current) {
      clearTimeout(busquedaBarcodeTimerRef.current);
      busquedaBarcodeTimerRef.current = null;
    }

    if (value.trim().length === 0) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    if (esCodigoBarras) {
      // El valor tecleado/pegado es un código de barras: lo guardamos como tal
      // (sin buscar nada en internet) y dejamos el nombre en blanco para que el
      // usuario lo escriba y ponga la foto manualmente.
      setShowSugerencias(false);
      const codigo = value.trim();
      busquedaBarcodeTimerRef.current = setTimeout(() => {
        setForm((prev) => ({
          ...prev,
          codigoBarras: esUnidadContable(prev.unidadMedida) ? codigo : prev.codigoBarras,
          nomProducto: prev.nomProducto.trim() === codigo ? "" : prev.nomProducto,
          codigo: prev.nomProducto.trim() === codigo ? "" : prev.codigo,
        }));
        buscarProductoPorCodigoBarras(codigo);
      }, 600);
    }
  };

  const handleSeleccionarSugerencia = (prod: ProductoBase) => {
    setProductoExistente(prod);
    setForm((prev) => ({
      ...prev,
      nomProducto: prod.nomProducto,
      codigo: prod.codigo,
      tipoProducto: prod.tipoProducto ?? "BIEN",
      unidadMedida: prod.unidadMedida,
      tipoAfectacionIGV: prod.tipoAfectacionIGV,
      incluirIGV: prod.incluirIGV,
      categoriaId: prod.categoria?.categoriaId ?? 0,
    }));
    setSugerencias([]);
    setShowSugerencias(false);
  };

  const handleFormChange =
    (field: keyof NuevoProducto) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const target = e.target as HTMLInputElement;
      const value: string | number | boolean =
        target.type === "checkbox"
          ? target.checked
          : target.type === "number"
            ? Number(target.value)
            : target.value;

      if (field === "tipoAfectacionIGV") {
        const aplicaIGV = value === "10";
        setForm((prev) => ({
          ...prev,
          tipoAfectacionIGV: value as string,
          incluirIGV: aplicaIGV ? prev.incluirIGV : true,
        }));
        return;
      }
      if (field === "tipoProducto") {
        const tipoProducto = value as string;
        const nuevaUnidad = tipoProducto === "SERVICIO" ? "ZZ" : "NIU";
        setForm((prev) => ({
          ...prev,
          tipoProducto,
          unidadMedida: nuevaUnidad,
          // Un servicio no lleva código de barras: se descarta si lo hubiera.
          codigoBarras: esUnidadContable(nuevaUnidad) ? prev.codigoBarras : "",
        }));
        return;
      }
      if (field === "unidadMedida") {
        const nuevaUnidad = value as string;
        setForm((prev) => ({
          ...prev,
          unidadMedida: nuevaUnidad,
          // Solo las unidades contables (Unidad / Caja) conservan código de barras;
          // al pasar a kilo, litro, metro, etc. se limpia para no guardarlo.
          codigoBarras: esUnidadContable(nuevaUnidad) ? prev.codigoBarras : "",
        }));
        return;
      }
      // ─── limpiar error al escribir ───
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));

      setForm((prev) => ({ ...prev, [field]: value }));
    };

  // ─── NUEVO: función de validación ────────────────────────
  const validar = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    const soloSucursal = !!productoExistente;

    if (isSuperAdmin && sucursalSeleccionada === 0) newErrors.sucursalId = true;
    if (!form.nomProducto.trim()) newErrors.nomProducto = true;
    if (form.precioUnitario <= 0) newErrors.precioUnitario = true;

    if (!soloSucursal) {
      if (form.categoriaId === 0) newErrors.categoriaId = true;
    }

    if (form.enPromocion && (!form.porcentajeDescuento || form.porcentajeDescuento <= 0)) {
      newErrors.porcentajeDescuento = true;
    }

    // Sin costo, el stock inicial genera un lote PEPS con costo 0 que luego se arrastra en
    // kardex/valorizado/rentabilidad hasta corregirlo a mano.
    if (
      config?.isStock &&
      form.tipoProducto === "BIEN" &&
      (form.stock ?? 0) > 0 &&
      (!form.costoUnitario || form.costoUnitario <= 0)
    ) {
      newErrors.costoUnitario = true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    stopScanning();
    if (!validar()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    const formConSucursal = {
      ...form,
      sucursalId: sucursalIdEfectivo,
      // Stock inicial opcional: si no se informa, arranca en 0 y se carga después
      // desde el módulo de Compras a Proveedor.
      stock: config?.isStock && form.tipoProducto === "BIEN" ? (form.stock ?? 0) : null,
      costoUnitario: config?.isStock && form.tipoProducto === "BIEN" ? form.costoUnitario : null,
      // Campo informativo: solo aplica si la empresa maneja stock.
      ubicacionTienda: config?.isStock ? form.ubicacionTienda : null,
      alertaVencimientoActiva:
        config?.isStock && form.tipoProducto === "BIEN" ? form.alertaVencimientoActiva ?? false : null,
      alertaStockBajoActiva:
        config?.isStock && form.tipoProducto === "BIEN" ? form.alertaStockBajoActiva ?? true : null,
      stockMinimoAlerta:
        config?.isStock && form.tipoProducto === "BIEN" ? form.stockMinimoAlerta : null,
      usuarioId: user?.id ? parseInt(user.id) : null,
    };

    // El código automático puede chocar con un registro que la lista no ve
    // (producto eliminado que conserva su código, u otra sucursal). Si el backend
    // responde 409 por código duplicado, reintentamos con el siguiente correlativo.
    const codigoEsAutomatico = !soloSucursal;
    const MAX_REINTENTOS = 25;
    let codigoActual = formConSucursal.codigo;

    try {
      for (let intento = 0; ; intento++) {
        try {
          const response = await axios.post<ProductoSucursal>(
            `${process.env.NEXT_PUBLIC_API_URL}/api/productos`,
            { ...formConSucursal, codigo: codigoActual },
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          showToast("Producto guardado exitosamente.", "success");
          onProductoAgregado(response.data);
          setForm({ ...emptyForm, sucursalId: sucursalIdEfectivo });
          setCostoInput("");
          setCurrentImageId(null); // imagen ya guardada en BD, no es huérfana
          onClose();
          return;
        } catch (error) {
          const status = axios.isAxiosError(error)
            ? error.response?.status
            : undefined;
          const mensaje = axios.isAxiosError(error)
            ? String(error.response?.data?.mensaje ?? "")
            : "";

          // Diferenciar conflicto de CÓDIGO PRODUCTO vs CÓDIGO DE BARRAS.
          // Si el 409 es por código de barras, NUNCA regenerar: el usuario
          // eligió ese código y debe registrarse con él. Solo mostrar el error.
          const esConflictoBarcode =
            status === 409 && /c[oó]digo\s*de\s*barras/i.test(mensaje);
          const esConflictoCodigo =
            status === 409 && !esConflictoBarcode && /c[oó]digo/i.test(mensaje);

          // Conflicto de código de barras → no reintentar, mostrar error directo.
          if (esConflictoBarcode) {
            throw error;
          }

          // Reintentar solo si el código de producto es automático y aún quedan intentos.
          if (
            esConflictoCodigo &&
            codigoEsAutomatico &&
            intento < MAX_REINTENTOS
          ) {
            codigoActual = incrementarCodigo(codigoActual);
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 409) {
          showToast(error.response?.data?.mensaje, "info");
        } else if (status === 400) {
          showToast(
            String(error.response?.data?.mensaje ?? "Los datos ingresados no son válidos."),
            "error",
          );
        } else {
          showToast(
            "No se pudo registrar el producto. Intenta nuevamente.",
            "error",
          );
        }
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const soloSucursal = !!productoExistente;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar nuevo producto / servicio">
      <form className="space-y-3" onSubmit={handleGuardar}>
        {/* ── Selector sucursal (solo superAdmin) ── */}
        {isSuperAdmin && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
              Sucursal <span className="text-rose-500">*</span>
            </label>
            <select
              value={sucursalSeleccionada}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSucursalSeleccionada(id);
                if (errors.sucursalId)
                  setErrors((prev) => ({ ...prev, sucursalId: false }));
              }}
              className={`w-full px-4 py-1.5 bg-gray-50 border rounded-xl outline-none focus:border-brand-blue/50 ${
                errors.sucursalId ? "border-rose-400" : "border-gray-200"
              }`}
            >
              <option value={0}>Seleccione una sucursal</option>
              {sucursales.map((s) => (
                <option key={s.sucursalId} value={s.sucursalId}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {errors.sucursalId && (
              <p className="text-xs text-rose-500 font-medium">
                Debe seleccionar una sucursal
              </p>
            )}
          </div>
        )}

        {/* ── Imagen del producto + Alertas ── */}
        {(!soloSucursal || (config?.isStock && form.tipoProducto === "BIEN")) && (
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            {!soloSucursal && (
              <div className="flex items-start gap-3">
                {/* Input oculto para subir desde galería/archivos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {/* Input oculto con "capture": en celulares abre la cámara directamente */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Thumbnail */}
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                    {(imgPreview || form.urlImagenProducto) && !imgError ? (
                      <img
                        // La key fuerza a montar un <img> nuevo cuando cambia la URL,
                        // para que al buscar otro código de barras no quede pintada
                        // la foto del producto anterior.
                        key={imgPreview ?? form.urlImagenProducto!}
                        src={imgPreview ?? form.urlImagenProducto!}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : imgError ? (
                      <ImageOff className="w-6 h-6 text-gray-300" />
                    ) : (
                      <Camera className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  {form.urlImagenProducto && !confirmandoEliminarImagen && (
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminarImagen(true)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                  {form.urlImagenProducto && confirmandoEliminarImagen && (
                    <div className="absolute -top-2 -right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => { handleQuitarImagen(); setConfirmandoEliminarImagen(false); }}
                        className="text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white px-1.5 py-0.5 rounded shadow-sm"
                      >
                        Quitar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoEliminarImagen(false)}
                        className="text-[10px] font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded shadow-sm"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>

                {/* Texto + botones */}
                <div className="flex flex-col justify-center gap-1 min-w-0">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Imagen del producto
                    <span className="ml-1 font-normal text-gray-400 normal-case">(opcional)</span>
                  </p>
                  {subiendoImagen ? (
                    <p className="text-[11px] text-blue-500 font-semibold animate-pulse">
                      Subiendo imagen…
                    </p>
                  ) : form.urlImagenProducto && !imgError ? (
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      ✓ Imagen subida
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      JPG, PNG o WebP — máx. 4 MB
                    </p>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        stopScanning();
                        cameraInputRef.current?.click();
                      }}
                      disabled={subiendoImagen}
                      className="w-fit flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Tomar foto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopScanning();
                        handleSeleccionarImagen();
                      }}
                      disabled={subiendoImagen}
                      className="w-fit flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      {subiendoImagen ? "Subiendo…" : form.urlImagenProducto ? "Cambiar" : "Subir imagen"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {config?.isStock && form.tipoProducto === "BIEN" && (
              <div className="flex-1 min-w-0 space-y-2.5 border-t sm:border-t-0 sm:border-l border-gray-100 pt-2.5 sm:pt-0 sm:pl-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  <Bell className="w-3.5 h-3.5" />
                  Alertas de inventario
                </p>

                <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={form.alertaVencimientoActiva ?? false}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, alertaVencimientoActiva: e.target.checked }))
                    }
                    className="w-4 h-4 accent-brand-blue"
                  />
                  <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-600">
                    Alertar por fecha de vencimiento
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                    <input
                      type="checkbox"
                      checked={form.alertaStockBajoActiva ?? true}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, alertaStockBajoActiva: e.target.checked }))
                      }
                      className="w-4 h-4 accent-brand-blue"
                    />
                    <PackageX className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600">
                      Alertar por stock bajo
                    </span>
                  </label>

                  {(form.alertaStockBajoActiva ?? true) && (
                    <div className="ml-6 flex items-center gap-1.5 pl-2.5 border-l-2 border-amber-200/70">
                      <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap">
                        Mínimo:
                      </span>
                      <input
                        type="number"
                        value={form.stockMinimoAlerta === null || form.stockMinimoAlerta === undefined ? "" : String(form.stockMinimoAlerta)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            stockMinimoAlerta: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => e.currentTarget.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={
                          config?.umbralStockBajo != null
                            ? String(config.umbralStockBajo)
                            : "5"
                        }
                        className="w-11 px-1.5 py-1 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">
                        {form.stockMinimoAlerta === null || form.stockMinimoAlerta === undefined
                          ? config?.umbralStockBajo != null
                            ? `usa el general (${config.umbralStockBajo})`
                            : "sin definir"
                          : "unidades"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Nombre con búsqueda + Botón Cámara ── */}
        <div className="relative space-y-1.5">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <InputBase
                id="agregar-producto-nombre"
                compact
                label="Nombre del Producto"
                value={form.nomProducto}
                onChange={handleNomProductoChange}
                placeholder="Escribe el nombre o pega el código de barras…"
                showError={!!errors.nomProducto}
              />
            </div>
            {!soloSucursal && !isScanning && esUnidadContable(form.unidadMedida) && (
              <button
                type="button"
                onClick={startScanning}
                title="Escanear código de barras con cámara"
                className="h-9.5 w-9.5 flex items-center justify-center shrink-0 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded-xl transition-colors border border-brand-blue/20"
              >
                <ScanBarcode className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSugerencias && (
            <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {sugerencias.map((p) => (
                <li
                  key={p.productoId}
                  onMouseDown={() => handleSeleccionarSugerencia(p)}
                  className="px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 hover:text-brand-blue"
                >
                  <span className="font-semibold">{p.nomProducto}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.codigo}</span>
                </li>
              ))}
            </ul>
          )}
          {productoExistente && (
            <p className="text-xs text-green-600 font-semibold pl-1">
              ✓ Producto encontrado — completa precio para esta sucursal
            </p>
          )}
        </div>

        {/* ── Escáner de Código de Barras (Visor Cámara cuando está activo) ── */}
        {!soloSucursal && isScanning && esUnidadContable(form.unidadMedida) && (
          <div className="space-y-2">
            <div className="space-y-3 p-3 bg-gray-100/80 rounded-xl border border-gray-200 text-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  Buscando código de barras...
                </span>
                <button
                  type="button"
                  onClick={stopScanning}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors px-2.5 py-1 bg-gray-200/80 hover:bg-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
              <div className="relative w-full max-w-65 aspect-square mx-auto bg-black rounded-2xl overflow-hidden border border-gray-200 shadow-xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {cameraError ? (
                  <div className="absolute inset-0 z-20 bg-gray-950/95 flex flex-col items-center justify-center text-center p-4 text-white">
                    <CameraOff className="w-9 h-9 text-gray-400 mb-2 animate-bounce" />
                    <p className="text-xs font-semibold text-gray-200">
                      {cameraError}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Puedes ingresar el código manualmente o con lector USB
                    </p>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-3 border-2 border-white/20 rounded-xl flex items-center justify-center overflow-hidden z-10">
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)] animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* El código de barras se muestra más abajo, después del selector de
            unidad, y solo para unidades contables (Unidad / Caja). */}

        {/* ── Campos base ── */}
        {!soloSucursal && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* ── Tipo de producto ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Tipo Producto
                </label>
                <select
                  value={form.tipoProducto}
                  onChange={handleFormChange("tipoProducto")}
                  className="w-full px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
                >
                  <option value="BIEN">Bien</option>
                  <option value="SERVICIO">Servicio</option>
                </select>
              </div>

              {/* ── Categoría con error ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  Categoría <span className="text-rose-500">*</span>
                </label>
                <SelectConAgregar
                  compact
                  placeholder="Seleccione categoría"
                  showError={!!errors.categoriaId}
                  value={form.categoriaId === 0 ? null : form.categoriaId}
                  onChange={(val) => {
                    setForm((prev) => ({ ...prev, categoriaId: val }));
                    if (errors.categoriaId)
                      setErrors((prev) => ({ ...prev, categoriaId: false }));
                  }}
                  onAgregar={() => setIsModalCategoriaOpen(true)}
                  opciones={categorias.map((cat) => ({
                    value: cat.categoriaId,
                    label: cat.categoriaNombre,
                  }))}
                />
                {errors.categoriaId && (
                  <p className="text-xs text-rose-500 font-medium">
                    Campo obligatorio
                  </p>
                )}

                {/* ── Mini formulario nueva categoría ── */}
                {showNuevaCategoria && (
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      value={nombreNuevaCategoria}
                      onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                      placeholder="Nombre de la categoría"
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
                    />
                    <Button
                      type="button"
                      disabled={
                        loadingCategoria || !nombreNuevaCategoria.trim()
                      }
                      onClick={async () => {
                        const ok = await onAgregarCategoria({
                          categoriaNombre: nombreNuevaCategoria.trim(),
                        });
                        if (ok) {
                          setNombreNuevaCategoria("");
                          setShowNuevaCategoria(false);
                        }
                      }}
                    >
                      {loadingCategoria ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowNuevaCategoria(false);
                        setNombreNuevaCategoria("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Unidad de Medida (Tipo Afectación IGV oculto temporalmente: siempre "10 - Gravado") ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Unidad de Medida
                </label>
                <select
                  value={form.unidadMedida}
                  onChange={handleFormChange("unidadMedida")}
                  className="w-full px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
                >
                  <option value="NIU">NIU - Unidad</option>
                  <option value="ZZ">ZZ - Servicio</option>
                  <option value="KGM">KGM - Kilogramo</option>
                  <option value="GRM">GRM - Gramo</option>
                  <option value="TNE">TNE - Tonelada métrica</option>
                  <option value="LTR">LTR - Litro</option>
                  <option value="MLT">MLT - Mililitro</option>
                  <option value="MTR">MTR - Metro</option>
                  <option value="MTK">MTK - Metro cuadrado</option>
                  <option value="MTQ">MTQ - Metro cúbico</option>
                  <option value="BX">BX - Caja</option>
                </select>
              </div>
            </div>

            {/* ── Código de barras: solo unidades contables (Unidad / Caja) ── */}
            {esUnidadContable(form.unidadMedida) && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Código de Barras
                </label>
                <div className="w-full rounded-xl border border-dashed border-brand-blue/40 bg-blue-50/50 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.codigoBarras ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          codigoBarras: e.target.value.replace(/\s/g, ""),
                        }))
                      }
                      placeholder="Escribe o pega el código…"
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm font-mono bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, codigoBarras: generarEAN13Interno() }))
                      }
                      title={form.codigoBarras ? "Regenerar código automático" : "Generar código automático"}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-brand-blue bg-white hover:bg-blue-50 border border-brand-blue/30 rounded-lg transition-colors"
                    >
                      <ScanBarcode className="w-3.5 h-3.5" />
                      {form.codigoBarras ? "Regenerar" : "Generar"}
                    </button>
                    {form.codigoBarras && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, codigoBarras: "" }))}
                        title="Quitar código"
                        className="shrink-0 flex items-center justify-center w-8 h-8 text-rose-500 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {form.codigoBarras ? (
                    <div className="flex items-center justify-center bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                      <BarcodePreview
                        value={form.codigoBarras}
                        format={formatoBarcodeSeguro(form.codigoBarras)}
                        width={1.5}
                        height={38}
                        fontSize={12}
                        margin={0}
                        displayValue
                        background="transparent"
                        lineColor="#1e293b"
                      />
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 text-center">
                      Escribe tu propio código, escanéalo o genera uno EAN-13 automático
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Precio de Venta, Precio de Compra y Stock Inicial (misma línea) ── */}
        {/* Precio Incluye IGV oculto: todos los productos se registran con el precio incluyendo IGV (form.incluirIGV = true por defecto). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputBase
            compact
            label={form.esPaquete ? "Precio del Paquete/Caja" : "Precio de Venta"}
            type="number"
            value={String(form.precioUnitario)}
            onChange={(e) => {
              handleFormChange("precioUnitario")(e);
              if (errors.precioUnitario)
                setErrors((prev) => ({ ...prev, precioUnitario: false }));
            }}
            placeholder="0.00"
            step="0.01"
            showError={!!errors.precioUnitario}
            errorMessage="Debe ser mayor a 0"
          />

          {config?.isStock && form.tipoProducto === "BIEN" && (
            <InputBase
              compact
              label="Precio de Compra"
              labelOptional={(form.stock ?? 0) > 0 ? undefined : "(opcional)"}
              type="text"
              inputMode="decimal"
              value={costoInput}
              onChange={(e) => {
                const valor = e.target.value;
                if (!/^\d*\.?\d{0,2}$/.test(valor)) return;
                if (errors.costoUnitario) setErrors((prev) => ({ ...prev, costoUnitario: false }));
                setCostoInput(valor);
                setForm((prev) => ({
                  ...prev,
                  costoUnitario: valor === "" || valor === "." ? null : parseFloat(valor),
                }));
              }}
              onBlur={() => {
                if (costoInput === "" || costoInput === ".") {
                  setCostoInput("");
                  setForm((prev) => ({ ...prev, costoUnitario: null }));
                  return;
                }
                const num = parseFloat(costoInput);
                setCostoInput(num.toFixed(2));
                setForm((prev) => ({ ...prev, costoUnitario: num }));
              }}
              placeholder="Ej: 3.50"
              showError={!!errors.costoUnitario}
              errorMessage="Obligatorio cuando registras stock inicial"
            />
          )}

          {config?.isStock && form.tipoProducto === "BIEN" && (
            <InputBase
              compact
              label="Stock Inicial"
              labelOptional="(opcional)"
              type="number"
              value={form.stock === null || form.stock === undefined ? "" : String(form.stock)}
              onChange={(e) => {
                const nuevoStock = e.target.value === "" ? null : Number(e.target.value);
                if (errors.costoUnitario && (nuevoStock ?? 0) <= 0)
                  setErrors((prev) => ({ ...prev, costoUnitario: false }));
                setForm((prev) => ({ ...prev, stock: nuevoStock }));
              }}
              placeholder="Ej: 50"
              showError={false}
            />
          )}

          {/* Campo Código (auto) oculto/comentado porque se genera automáticamente */}
          {/* {!soloSucursal && (
            <InputBase
              compact
              label="Código"
              labelOptional="(auto)"
              value={form.codigo}
              readOnly
              placeholder="Se genera automáticamente"
              showError={false}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          )} */}
        </div>


        {/* ── Código SUNAT (UNSPSC) (Comentado temporalmente) ── */}
        {/* {!soloSucursal && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Código SUNAT{" "}
              <span className="text-gray-400 font-normal normal-case">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={codigoSunatLabel || form.codigoSunat || ""}
                  readOnly
                  placeholder="Seleccionar desde catálogo..."
                  title={codigoSunatLabel}
                  className="w-full px-4 py-2.5 pr-8 bg-gray-100 border border-gray-200 rounded-xl text-sm truncate text-gray-600 cursor-default outline-none"
                />
                {(form.codigoSunat) && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, codigoSunat: "" }));
                      setCodigoSunatLabel("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 text-white transition-colors"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalCatalogoOpen(true)}
                className="shrink-0 px-3 py-2 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
              >
                Ver catálogo
              </button>
            </div>
          </div>
        )} */}

        {/* ¿Es un paquete/caja? — fila propia */}
        {!soloSucursal && config?.isStock && (
          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={!!form.esPaquete}
              onChange={(e) => {
                const checked = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  esPaquete: checked,
                  productoBaseId: checked ? prev.productoBaseId : null,
                  factorConversion: checked ? prev.factorConversion : null,
                }));
              }}
              className="w-4 h-4 accent-brand-blue"
            />
            <span className="text-xs font-semibold text-gray-600">
              ¿Es un paquete/caja con unidades dentro?
            </span>
          </label>
        )}

        {/* ── Paquete: producto base + factor de conversión (solo si maneja stock) ── */}
        {!soloSucursal && config?.isStock && (
          <>
            {form.esPaquete && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Producto Base (unidad)
                  </label>
                  <SelectConBuscador
                    value={form.productoBaseId ?? null}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        productoBaseId: val,
                      }))
                    }
                    placeholder="Seleccione el producto unidad"
                    opciones={productosEmpresa
                      .filter((p) => !p.esPaquete)
                      .map((p) => ({
                        value: p.productoId,
                        label: `${p.nomProducto} (${p.codigo})`,
                      }))}
                  />
                </div>

                <InputBase
                  compact
                  label="Unidades por paquete"
                  type="number"
                  value={String(form.factorConversion ?? "")}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      factorConversion: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="Ej: 12"
                  showError={false}
                />
              </div>
            )}
          </>
        )}

        {/* ── Mayorista y Promoción (comprimido, no es prioritario al registrar) ── */}
        {!soloSucursal && config?.isStock && form.tipoProducto === "BIEN" && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMayorista((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="text-xs font-bold text-gray-500 uppercase">
                Mayorista y Promoción <span className="text-gray-400 font-normal">(opcional)</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${showMayorista ? "rotate-180" : ""}`}
              />
            </button>

            {showMayorista && (
              <div className="p-3 space-y-3 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputBase
                    compact
                    label="Precio Mayorista"
                    labelOptional="(opcional)"
                    type="number"
                    step="0.01"
                    value={String(form.precioMayorista ?? "")}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        precioMayorista: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="0.00"
                    showError={false}
                  />
                  <InputBase
                    compact
                    label="Cantidad mínima para mayorista"
                    labelOptional={form.esPaquete ? "(paquetes)" : "(unidades)"}
                    type="number"
                    value={String(form.cantidadMinimaMayorista ?? "")}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        cantidadMinimaMayorista: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="Ej: 12"
                    showError={false}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form.enPromocion}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, enPromocion: e.target.checked }))
                    }
                    className="w-4 h-4 accent-brand-blue"
                  />
                  <label className="text-xs font-semibold text-gray-600">
                    ¿Producto en promoción?
                  </label>
                </div>

                {form.enPromocion && (
                  <InputBase
                    compact
                    label="% Descuento"
                    type="number"
                    step="0.01"
                    value={String(form.porcentajeDescuento ?? "")}
                    showError={!!errors.porcentajeDescuento}
                    errorMessage="Ingresa el % de descuento de la promoción"
                    onChange={(e) => {
                      if (errors.porcentajeDescuento)
                        setErrors((prev) => ({ ...prev, porcentajeDescuento: false }));
                      setForm((prev) => ({
                        ...prev,
                        porcentajeDescuento: e.target.value === "" ? null : Number(e.target.value),
                      }));
                    }}
                    placeholder="Ej: 50"
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || subiendoImagen}>
            {subiendoImagen ? "Subiendo imagen..." : isSubmitting ? "Guardando..." : "Guardar Producto"}
          </Button>
        </div>
      </form>
      <ModalCatalogoSunat
        isOpen={modalCatalogoOpen}
        onClose={() => setModalCatalogoOpen(false)}
        codigoActual={form.codigoSunat || undefined}
        onSeleccionar={(codigo, descripcion) => {
          setForm((prev) => ({ ...prev, codigoSunat: codigo }));
          setCodigoSunatLabel(`${codigo} - ${descripcion}`);
        }}
      />
      <ModalAgregarCategoria
        isOpen={isModalCategoriaOpen}
        onClose={() => setIsModalCategoriaOpen(false)}
        onAgregarCategoria={onAgregarCategoria}
        loadingCategoria={loadingCategoria}
      />
    </Modal>
  );
}
