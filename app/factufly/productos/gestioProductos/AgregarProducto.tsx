"use client";

import React, { useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import dynamic from "next/dynamic";
import axios from "axios";
import { ChevronDown, Camera, X as XIcon, ImageOff, ScanBarcode, RotateCcw, Globe, Loader2 } from "lucide-react";
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
import { generarEAN13Interno, formatoBarcodeSeguro } from "./barcodeFormato";

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

  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState("");

  const [isModalCategoriaOpen, setIsModalCategoriaOpen] = useState(false);
  const [showMayorista, setShowMayorista] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [confirmandoEliminarImagen, setConfirmandoEliminarImagen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [buscandoInternet, setBuscandoInternet] = useState(false);
  const [modalCatalogoOpen, setModalCatalogoOpen] = useState(false);
  const [codigoSunatLabel, setCodigoSunatLabel] = useState("");

  const [isScanning, setIsScanning] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  const stopScanning = React.useCallback(async () => {
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
        console.error("Error stopping barcode scanner", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanning = async () => {
    setIsScanning(true);

    // Esperar 50ms a que React renderice los nodos DOM <video> y <div id="reader">
    setTimeout(async () => {
      // 1. Detección NATIVA ultra-rápida (BarcodeDetector API de Chrome / Android)
      if ("BarcodeDetector" in window) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
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
            formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
          });

          let scanned = false;
          const scanLoop = async () => {
            if (scanned || !videoRef.current) return;
            try {
              if (videoRef.current.readyState >= 2) {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  scanned = true;
                  const decodedText = barcodes[0].rawValue;
                  setForm((prev) => ({ ...prev, codigoBarras: decodedText }));
                  showToast(`Código escaneado: ${decodedText}`, "success");
                  stopScanning();
                  if (decodedText.trim().length >= 8) {
                    buscarProductoPorInternet(decodedText.trim());
                  }
                  return;
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
          console.warn("Fallback a html5-qrcode por falla en cámara nativa", err);
        }
      }

      // 2. Fallback con html5-qrcode (escaneando el 95% del frame a 30 FPS)
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
            setForm((prev) => ({ ...prev, codigoBarras: decodedText }));
            showToast(`Código escaneado: ${decodedText}`, "success");
            stopScanning();
            if (decodedText.trim().length >= 8) {
              buscarProductoPorInternet(decodedText.trim());
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Error starting barcode scanner", err);
        showToast("No se pudo acceder a la cámara. Revisa los permisos.", "error");
        setIsScanning(false);
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

  const handleQuitarImagen = () => {
    const idAnterior = currentImageId;
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
  const buscarProductoPorInternet = async (barcodeOverride?: string) => {
    const barcode = barcodeOverride || form.codigoBarras?.trim();
    if (!barcode) return;
    setBuscandoInternet(true);
    try {
      const res = await fetch("/api/buscar-producto-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();

      if (!data.ok) {
        showToast(data.error ?? "No se pudo buscar el producto.", "error");
        return;
      }
      if (!data.encontrado) {
        showToast("No se encontró información para este código de barras.", "info");
        return;
      }

      // Nombre: actualizar siempre con el producto escaneado
      if (data.nombre) {
        const nombre: string = data.nombre;
        setPalabraBusqueda("");
        setShowSugerencias(false);
        setForm((prev) => ({
          ...prev,
          nomProducto: nombre,
          codigo: generarCodigoProducto(
            nombre,
            productosEmpresa.length === 0 ? 0 : productosEmpresa.length,
          ),
        }));
        if (errors.nomProducto) setErrors((prev) => ({ ...prev, nomProducto: false }));
      }

      // Imagen: actualizar siempre con la imagen del producto escaneado
      if (data.url) {
        // Si había una imagen previa subida sin guardar, liberarla.
        if (currentImageId) eliminarImagenCloudflare(currentImageId);
        setImgError(false);
        setImgPreview(data.url);
        setForm((prev) => ({ ...prev, urlImagenProducto: data.url }));
        setCurrentImageId(data.imageId ?? null);
      }

      const partes = [data.nombre, data.marca].filter(Boolean).join(" · ");
      showToast(`Producto encontrado: ${partes || barcode}`, "success");
    } catch {
      showToast("Error de conexión al buscar el producto.", "error");
    } finally {
      setBuscandoInternet(false);
    }
  };

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
    if (isOpen) {
      setForm({ ...emptyForm, sucursalId: sucursalIdEfectivo });
      setErrors({});
      setImgError(false);
      setCodigoSunatLabel("");
    } else {
      setForm({ ...emptyForm, sucursalId: 0 });
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

  const { productosEmpresa, fetchProductosEmpresa } = useProductosEmpresaLista();

  // Refresca la lista de productos base cada vez que se abre el modal,
  // para que un producto base recién creado aparezca de inmediato al registrar su paquete.
  React.useEffect(() => {
    if (isOpen) fetchProductosEmpresa();
  }, [isOpen]);

  // REEMPLAZA ESTA FUNCIÓN COMPLETA:
  const handleNomProductoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPalabraBusqueda(value);

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

    if (value.trim().length === 0) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
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
        setForm((prev) => ({
          ...prev,
          tipoProducto,
          unidadMedida: tipoProducto === "SERVICIO" ? "ZZ" : "NIU",
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    stopScanning();
    if (!validar()) return;
    if (isSubmitting) return;

    // Validar código de barras duplicado antes de enviar
    const barcode = form.codigoBarras?.trim();
    if (barcode) {
      const duplicado = productosEmpresa.find(
        (p) => p.codigoBarras && p.codigoBarras === barcode,
      );
      if (duplicado) {
        showToast(
          `El código de barras ya está asignado a "${duplicado.nomProducto}".`,
          "error",
        );
        return;
      }
    }

    setIsSubmitting(true);
    const formConSucursal = {
      ...form,
      sucursalId: sucursalIdEfectivo,
      // El stock siempre arranca en 0: solo se incrementa desde el módulo de Compras a Proveedor.
      stock: config?.isStock && form.tipoProducto === "BIEN" ? 0 : null,
      // Campo informativo: solo aplica si la empresa maneja stock.
      ubicacionTienda: config?.isStock ? form.ubicacionTienda : null,
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
          const esConflictoCodigo =
            status === 409 && /c[oó]digo/i.test(mensaje);

          // Reintentar solo si el código es automático y aún quedan intentos.
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
          showToast("Los datos ingresados no son válidos.", "error");
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

        {/* ── Imagen del producto ── */}
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
                  JPG, PNG o WebP — máx. 2 MB
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

        {/* ── Nombre con búsqueda ── */}
        <div className="relative space-y-1.5">
          <InputBase
            compact
            label="Nombre del Producto"
            value={form.nomProducto}
            onChange={handleNomProductoChange}
            placeholder="Buscar o escribir nombre..."
            showError={!!errors.nomProducto}
          />
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

        {/* ── Escáner de Código de Barras (Cámara) ── */}
        {!soloSucursal && (
          <div className="space-y-2">
            {!isScanning ? (
              <button
                type="button"
                onClick={startScanning}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue font-bold rounded-xl text-xs transition-colors border border-brand-blue/20"
              >
                <ScanBarcode className="w-4 h-4" />
                Escanear Código de Barras con Cámara
              </button>
            ) : (
              <div className="space-y-3 p-3 bg-gray-900 text-white rounded-xl border border-gray-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Buscando código de barras...
                  </span>
                  <button
                    type="button"
                    onClick={stopScanning}
                    className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-2.5 py-1 bg-white/10 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="relative w-full aspect-[4/3] max-h-[300px] bg-black rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
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
                </div>
                <p className="text-[10px] text-gray-400 text-center">
                  Apunte la cámara al código de barras — no necesita estar perfectamente centrado.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Código de barras (siempre disponible) ── */}
        {!soloSucursal && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Código de Barras{" "}
              <span className="text-gray-400 font-normal normal-case">(opcional)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Entrada manual */}
              <input
                type="text"
                value={form.codigoBarras ?? ""}
                onChange={handleFormChange("codigoBarras")}
                placeholder="EAN13 / Code128"
                className="sm:w-52 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
              />

              {/* Panel: generar código automático o vista previa en vivo */}
              <div className="flex-1 rounded-xl border border-dashed border-brand-blue/40 bg-blue-50/50 px-3 py-2 flex items-center justify-center min-h-[64px]">
                {form.codigoBarras ? (
                  <div className="flex items-center justify-center gap-4 w-full">
                    <div className="bg-white rounded-lg px-3 py-1.5 border border-gray-100">
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
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, codigoBarras: generarEAN13Interno() }))
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" /> Regenerar
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, codigoBarras: "" }))}
                        className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:underline"
                      >
                        <XIcon className="w-3 h-3" /> Quitar código
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, codigoBarras: generarEAN13Interno() }))
                    }
                    className="w-full flex items-center justify-center gap-3 py-1 group"
                  >
                    <ScanBarcode className="w-8 h-8 text-brand-blue shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <span className="block text-xs font-bold text-brand-blue">
                        Generar código automático
                      </span>
                      <span className="block text-[10px] text-gray-400">
                        EAN-13 interno válido para imprimir y escanear
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Buscar datos del producto en internet por su código de barras */}
            {!!form.codigoBarras && form.codigoBarras.trim().length >= 8 && (
              <button
                type="button"
                onClick={() => buscarProductoPorInternet()}
                disabled={buscandoInternet}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-60"
              >
                {buscandoInternet ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                {buscandoInternet
                  ? "Buscando en internet…"
                  : "Buscar nombre e imagen por este código (internet)"}
              </button>
            )}
          </div>
        )}

        {/* ── Campos base ── */}
        {!soloSucursal && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Tipo Afectación IGV
                </label>
                <select
                  value={form.tipoAfectacionIGV}
                  onChange={handleFormChange("tipoAfectacionIGV")}
                  className="w-full px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
                >
                  <option value="10">10 - Gravado</option>
                  <option value="20">20 - Exonerado</option>
                  <option value="30">30 - Inafecto</option>
                </select>
              </div>

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
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <InputBase
              compact
              label={form.esPaquete ? "Precio del Paquete/Caja" : "Precio Venta Unitario"}
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
            {form.tipoAfectacionIGV === "10" && (
              <div className="flex items-center gap-2 pl-1">
                <input
                  type="checkbox"
                  checked={form.incluirIGV}
                  onChange={handleFormChange("incluirIGV")}
                  className="w-4 h-4 accent-brand-blue"
                />
                <label className="text-xs font-semibold text-gray-600">
                  Precio Incluye IGV
                </label>
              </div>
            )}
          </div>
 
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

        {/* ── Código de barras (siempre disponible) ── */}
        {!soloSucursal && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Código de Barras{" "}
              <span className="text-gray-400 font-normal normal-case">(opcional)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Entrada manual */}
              <input
                type="text"
                value={form.codigoBarras ?? ""}
                onChange={handleFormChange("codigoBarras")}
                placeholder="EAN13 / Code128"
                className="sm:w-52 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
              />

              {/* Panel: generar código automático o vista previa en vivo */}
              <div className="flex-1 rounded-xl border border-dashed border-brand-blue/40 bg-blue-50/50 px-3 py-2 flex items-center justify-center min-h-[64px]">
                {form.codigoBarras ? (
                  <div className="flex items-center justify-center gap-4 w-full">
                    <div className="bg-white rounded-lg px-3 py-1.5 border border-gray-100">
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
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, codigoBarras: generarEAN13Interno() }))
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" /> Regenerar
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, codigoBarras: "" }))}
                        className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:underline"
                      >
                        <XIcon className="w-3 h-3" /> Quitar código
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, codigoBarras: generarEAN13Interno() }))
                    }
                    className="w-full flex items-center justify-center gap-3 py-1 group"
                  >
                    <ScanBarcode className="w-8 h-8 text-brand-blue shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <span className="block text-xs font-bold text-brand-blue">
                        Generar código automático
                      </span>
                      <span className="block text-[10px] text-gray-400">
                        EAN-13 interno válido para imprimir y escanear
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Buscar datos del producto en internet por su código de barras */}
            {!!form.codigoBarras && form.codigoBarras.trim().length >= 8 && (
              <button
                type="button"
                onClick={buscarProductoPorInternet}
                disabled={buscandoInternet}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-60"
              >
                {buscandoInternet ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                {buscandoInternet
                  ? "Buscando en internet…"
                  : "Buscar nombre e imagen por este código (internet)"}
              </button>
            )}

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

        {/* ── Código SUNAT (UNSPSC) ── */}
        {!soloSucursal && (
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
                  <select
                    value={form.productoBaseId ?? 0}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        productoBaseId: Number(e.target.value) || null,
                      }))
                    }
                    className="w-full px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
                  >
                    <option value={0}>Seleccione el producto unidad</option>
                    {productosEmpresa
                      .filter((p) => !p.esPaquete)
                      .map((p) => (
                        <option key={p.productoId} value={p.productoId}>
                          {p.nomProducto} ({p.codigo})
                        </option>
                      ))}
                  </select>
                </div>

                <InputBase
                  compact
                  label="Factor de Conversión"
                  labelOptional="(unidades por paquete)"
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
