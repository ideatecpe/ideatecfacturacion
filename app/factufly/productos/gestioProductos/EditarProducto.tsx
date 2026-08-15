"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { Camera, X as XIcon, ImageOff, ScanBarcode, CameraOff, CalendarClock, PackageX } from "lucide-react";
import { scanImageData } from "@undecaf/zbar-wasm";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { Categoria, EditProducto, NuevoProducto, ProductoSucursal } from "./Producto";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosEmpresaLista } from "./useProductosEmpresaLista";
import ModalCatalogoSunat from "./ModalCatalogoSunat";
import { SelectConBuscador } from "@/app/components/ui/SelectConBuscador";
import { esUnidadContable } from "./unidadMedida";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoSucursal | null;
  onProductoEditado: (producto: ProductoSucursal) => void;
  categorias: Categoria[];
}

interface FormFieldsProps {
  form: NuevoProducto;
  setForm: React.Dispatch<React.SetStateAction<NuevoProducto>>;
  precioInput: string;
  setPrecioInput: React.Dispatch<React.SetStateAction<string>>;
  onChange: (field: keyof NuevoProducto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  categorias: Categoria[];
  isStock?: boolean;
  umbralStockBajo?: number | null;
  productosEmpresa: ProductoSucursal[];
  productoActualId?: number;
  imgError: boolean;
  setImgError: React.Dispatch<React.SetStateAction<boolean>>;
  imgPreview: string | null;
  setImgPreview: React.Dispatch<React.SetStateAction<string | null>>;
  subiendoImagen: boolean;
  setSubiendoImagen: React.Dispatch<React.SetStateAction<boolean>>;
  confirmandoEliminarImagen: boolean;
  setConfirmandoEliminarImagen: React.Dispatch<React.SetStateAction<boolean>>;
  onAbrirCatalogo: () => void;
  isScanning: boolean;
  startScanning: () => void;
  stopScanning: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraError: string | null;
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
  sucursalId: 1,
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
  alertaVencimientoActiva: true,
  alertaStockBajoActiva: true,
  stockMinimoAlerta: null,
};

export default function EditarProducto({
  isOpen,
  onClose,
  producto,
  onProductoEditado,
  categorias,
}: Props) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const { config } = useConfiguracion();
  const { productosEmpresa, fetchProductosEmpresa } = useProductosEmpresaLista();
  const [form, setForm] = React.useState<NuevoProducto>(emptyForm);
  const [precioInput, setPrecioInput] = React.useState("0.00");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [modalCatalogoOpen, setModalCatalogoOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [confirmandoEliminarImagen, setConfirmandoEliminarImagen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Escáner de código de barras (Cámara + USB) ──
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scannerBufferRef = useRef<{ text: string; lastTime: number }>({ text: "", lastTime: 0 });

  const stopScanning = useCallback(() => {
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

        // 1. Detección nativa por GPU (Chrome / Android / Edge)
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

        // 2. Detección C-WASM ultra-rápida con ZBar (Safari / Firefox)
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

  // Detener cámara al cerrar el modal o desmontar
  useEffect(() => {
    if (!isOpen) {
      stopScanning();
    }
  }, [isOpen, stopScanning]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  // Soporte para pistola/lector de código de barras USB/Bluetooth en el modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
          setForm((prev) => ({ ...prev, codigoBarras: scanned }));
          showToast(`Código escaneado: ${scanned}`, "success");
        }
        scannerBufferRef.current = { text: "", lastTime: 0 };
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, showToast]);

  // Refresca la lista de productos base cada vez que se abre el modal.
  React.useEffect(() => {
    if (isOpen) fetchProductosEmpresa();
  }, [isOpen]);

  React.useEffect(() => {
    if (!producto || !isOpen) return;

    setImgError(false);
    setImgPreview(null);
    setConfirmandoEliminarImagen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm({
      codigo: producto.codigo,
      tipoProducto: producto.tipoProducto ?? "BIEN",
      nomProducto: producto.nomProducto,
      unidadMedida: producto.unidadMedida,
      tipoAfectacionIGV: producto.tipoAfectacionIGV,
      incluirIGV: producto.incluirIGV,
      categoriaId: producto.categoria?.categoriaId ?? 0,
      sucursalId: 0,
      precioUnitario: producto.sucursalProducto.precioUnitario,
      stock: producto.sucursalProducto.stock ?? 0,
      costoUnitario: producto.sucursalProducto.ultimoPrecioCompra ?? null,
      urlImagenProducto: producto.urlImagenProducto ?? null,
      codigoBarras: producto.codigoBarras ?? "",
      codigoSunat: producto.codigoSunat ?? "",
      esPaquete: producto.esPaquete ?? false,
      productoBaseId: producto.productoBaseId ?? null,
      factorConversion: producto.factorConversion ?? null,
      precioMayorista: producto.sucursalProducto.precioMayorista ?? null,
      cantidadMinimaMayorista: producto.sucursalProducto.cantidadMinimaMayorista ?? null,
      enPromocion: producto.sucursalProducto.enPromocion ?? false,
      porcentajeDescuento: producto.sucursalProducto.porcentajeDescuento ?? null,
      ubicacionTienda: producto.sucursalProducto.ubicacionTienda ?? null,
      alertaVencimientoActiva: producto.sucursalProducto.alertaVencimientoActiva ?? true,
      alertaStockBajoActiva: producto.sucursalProducto.alertaStockBajoActiva ?? true,
      stockMinimoAlerta: producto.sucursalProducto.stockMinimoAlerta ?? null,
    });

    setPrecioInput(producto.sucursalProducto.precioUnitario.toFixed(2));
  }, [producto, isOpen]);

  const handleFormChange =
    (field: keyof NuevoProducto) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const target = e.target as HTMLInputElement;

      let value: string | number | boolean;

      if (target.type === "checkbox") {
        value = target.checked;
      } else if (target.type === "number" || field === "categoriaId") {
        value = Number(target.value);
      } else {
        value = target.value;
      }

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
          // Un servicio no lleva código de barras.
          codigoBarras: esUnidadContable(nuevaUnidad) ? prev.codigoBarras : "",
        }));
        return;
      }

      if (field === "unidadMedida") {
        const nuevaUnidad = value as string;
        setForm((prev) => ({
          ...prev,
          unidadMedida: nuevaUnidad,
          // Solo Unidad / Caja conservan código de barras; kilo, litro, metro, etc. lo limpian.
          codigoBarras: esUnidadContable(nuevaUnidad) ? prev.codigoBarras : "",
        }));
        return;
      }

      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto || isSubmitting) return;

    if (!form.nomProducto || form.nomProducto.trim() === "") {
      showToast("El nombre del producto es obligatorio.", "info");
      return;
    }

    if (Number(precioInput) <= 0) {
      showToast("El precio debe ser mayor a 0.", "info");
      return;
    }

    if (form.enPromocion && (!form.porcentajeDescuento || form.porcentajeDescuento <= 0)) {
      showToast("Ingresa el % de descuento de la promoción.", "info");
      return;
    }

    // Si el stock sube sin costo, el backend genera un lote PEPS con costo 0 que luego se
    // arrastra en kardex/valorizado/rentabilidad hasta corregirlo a mano.
    const stockActual = producto.sucursalProducto.stock ?? 0;
    if (
      config?.isStock &&
      form.tipoProducto === "BIEN" &&
      form.stock !== null &&
      form.stock !== undefined &&
      form.stock > stockActual &&
      (!form.costoUnitario || form.costoUnitario <= 0)
    ) {
      showToast("Debes registrar el costo de compra cuando aumentas el stock del producto.", "info");
      return;
    }

    setIsSubmitting(true);

    const payload: EditProducto = {
      productoId: producto.productoId,
      codigo: form.codigo,
      tipoProducto: form.tipoProducto,
      nomProducto: form.nomProducto,
      unidadMedida: form.unidadMedida,
      tipoAfectacionIGV: form.tipoAfectacionIGV,
      incluirIGV: form.incluirIGV,
      categoriaId: form.categoriaId,
      sucursalProductoId: producto.sucursalProducto.sucursalProductoId,
      precioUnitario: Number(precioInput || 0),
      urlImagenProducto: form.urlImagenProducto ?? null,
      stock:
        config?.isStock && form.tipoProducto === "BIEN"
          ? form.stock ?? 0
          : null,
      // Se persiste siempre como último precio de compra; si además el stock sube, este
      // costo también se usa para el nuevo lote PEPS creado por la diferencia.
      costoUnitario: config?.isStock && form.tipoProducto === "BIEN" ? form.costoUnitario : null,
      alertaVencimientoActiva:
        config?.isStock && form.tipoProducto === "BIEN" ? form.alertaVencimientoActiva ?? true : null,
      alertaStockBajoActiva:
        config?.isStock && form.tipoProducto === "BIEN" ? form.alertaStockBajoActiva ?? true : null,
      stockMinimoAlerta:
        config?.isStock && form.tipoProducto === "BIEN" ? form.stockMinimoAlerta : null,
      codigoBarras: form.codigoBarras || null,
      codigoSunat: form.codigoSunat || undefined,
      esPaquete: form.esPaquete ?? false,
      productoBaseId: form.esPaquete ? form.productoBaseId ?? null : null,
      factorConversion: form.esPaquete ? form.factorConversion ?? null : null,
      precioMayorista: form.precioMayorista ?? null,
      cantidadMinimaMayorista: form.cantidadMinimaMayorista ?? null,
      enPromocion: form.enPromocion ?? false,
      porcentajeDescuento: form.enPromocion ? form.porcentajeDescuento ?? null : null,
      ubicacionTienda: config?.isStock ? form.ubicacionTienda ?? null : null,
      usuarioId: user?.id ? parseInt(user.id) : null,
    };

    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${producto.productoId}`, payload, 
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const categoriaActualizada = categorias.find(
        (c) => c.categoriaId === form.categoriaId
      ) ?? producto.categoria;

      const productoActualizado: ProductoSucursal = {
        ...producto,
        codigo: form.codigo,
        tipoProducto: form.tipoProducto,
        nomProducto: form.nomProducto,
        unidadMedida: form.unidadMedida,
        tipoAfectacionIGV: form.tipoAfectacionIGV,
        incluirIGV: form.incluirIGV,
        categoria: categoriaActualizada,
        urlImagenProducto: payload.urlImagenProducto,
        codigoBarras: payload.codigoBarras,
        codigoSunat: payload.codigoSunat ?? null,
        esPaquete: payload.esPaquete,
        productoBaseId: payload.productoBaseId,
        factorConversion: payload.factorConversion,
        sucursalProducto: {
          ...producto.sucursalProducto,
          precioUnitario: Number(precioInput || 0),
          stock:
            config?.isStock && form.tipoProducto === "BIEN"
              ? form.stock ?? 0
              : null,
          // El backend persiste este costo como último precio de compra al guardar
          // (ver EditarProductoAsync); se refleja aquí para no requerir un refresh.
          ultimoPrecioCompra:
            payload.costoUnitario ?? producto.sucursalProducto.ultimoPrecioCompra,
          fechaUltimaCompra:
            payload.costoUnitario !== null && payload.costoUnitario !== undefined
              ? new Date().toISOString()
              : producto.sucursalProducto.fechaUltimaCompra,
          precioMayorista: payload.precioMayorista,
          cantidadMinimaMayorista: payload.cantidadMinimaMayorista,
          enPromocion: payload.enPromocion,
          porcentajeDescuento: payload.porcentajeDescuento,
          ubicacionTienda: payload.ubicacionTienda,
          usuarioId: payload.usuarioId,
          alertaVencimientoActiva: payload.alertaVencimientoActiva,
          alertaStockBajoActiva: payload.alertaStockBajoActiva,
          stockMinimoAlerta: payload.stockMinimoAlerta,
        },
      };

      showToast("Producto actualizado correctamente.", "success");
      onProductoEditado(productoActualizado);
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          showToast("No se encontró el producto a actualizar.", "error");
        } else if (status === 400) {
          showToast(
            String(error.response?.data?.mensaje ?? "Los datos ingresados no son válidos."),
            "error",
          );
        } else {
          showToast("No se pudo actualizar el producto. Intenta nuevamente.", "error");
        }
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Producto" className="max-w-4xl">
      <form className="space-y-3" onSubmit={handleEditar}>
        <ModalCatalogoSunat
          isOpen={modalCatalogoOpen}
          onClose={() => setModalCatalogoOpen(false)}
          codigoActual={form.codigoSunat || undefined}
          onSeleccionar={(codigo) => setForm((prev) => ({ ...prev, codigoSunat: codigo }))}
        />
        <FormEditarProducto
          form={form}
          setForm={setForm}
          precioInput={precioInput}
          setPrecioInput={setPrecioInput}
          onChange={handleFormChange}
          categorias={categorias}
          isStock={config?.isStock}
          umbralStockBajo={config?.umbralStockBajo}
          productosEmpresa={productosEmpresa}
          productoActualId={producto?.productoId}
          imgError={imgError}
          setImgError={setImgError}
          imgPreview={imgPreview}
          setImgPreview={setImgPreview}
          subiendoImagen={subiendoImagen}
          setSubiendoImagen={setSubiendoImagen}
          confirmandoEliminarImagen={confirmandoEliminarImagen}
          setConfirmandoEliminarImagen={setConfirmandoEliminarImagen}
          onAbrirCatalogo={() => setModalCatalogoOpen(true)}
          isScanning={isScanning}
          startScanning={startScanning}
          stopScanning={stopScanning}
          videoRef={videoRef}
          cameraError={cameraError}
        />

        <div className="pt-2 flex justify-end gap-2.5 border-t border-gray-100">
          <Button variant="outline" type="button" onClick={onClose} className="py-1.5 px-4 text-xs">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || subiendoImagen} className="py-1.5 px-5 text-xs">
            {subiendoImagen ? "Subiendo imagen..." : isSubmitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FormEditarProducto({
  form,
  setForm,
  precioInput,
  setPrecioInput,
  onChange,
  categorias,
  isStock,
  umbralStockBajo,
  productosEmpresa,
  productoActualId,
  imgError,
  setImgError,
  imgPreview,
  setImgPreview,
  subiendoImagen,
  setSubiendoImagen,
  confirmandoEliminarImagen,
  setConfirmandoEliminarImagen,
  onAbrirCatalogo,
  isScanning,
  startScanning,
  stopScanning,
  videoRef,
  cameraError,
}: FormFieldsProps) {
  const { showToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSeleccionarImagen = () => {
    fileInputRef.current?.click();
  };

  // Extrae el imageId de una URL de Cloudflare Images.
  // Formato: https://imagedelivery.net/{hash}/{imageId}/{variant}
  const extractCloudflareImageId = (url: string): string | null => {
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean);
      return parts.length >= 2 ? parts[parts.length - 2] : null;
    } catch { return null; }
  };

  const eliminarImagenCloudflare = async (url: string) => {
    const imageId = extractCloudflareImageId(url);
    if (!imageId) return;
    try {
      await fetch("/api/upload-imagen", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
    } catch { /* fallo silencioso */ }
  };

  const uploadImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Por favor selecciona o pega una imagen válida.", "info");
      return;
    }
    setImgError(false);
    setImgPreview(URL.createObjectURL(file));
    setSubiendoImagen(true);
    // Eliminar imagen anterior de Cloudflare antes de subir la nueva
    if (form.urlImagenProducto) {
      await eliminarImagenCloudflare(form.urlImagenProducto);
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-imagen", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setForm((prev) => ({ ...prev, urlImagenProducto: data.url }));
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
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImageFile(file);
  };

  // ── Ctrl+V para pegar imagen del portapapeles ──
  React.useEffect(() => {
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
  }, [form.urlImagenProducto]);

  const handleQuitarImagen = () => {
    const urlAnterior = form.urlImagenProducto;
    setForm((prev) => ({ ...prev, urlImagenProducto: null }));
    setImgPreview(null);
    setImgError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Eliminar de Cloudflare en segundo plano sin bloquear la UI
    if (urlAnterior) eliminarImagenCloudflare(urlAnterior);
  };

  return (
    <>
      {/* ── 1. Imagen + Nombre + Alertas ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center gap-3.5 shrink-0">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-white overflow-hidden flex items-center justify-center shadow-xs">
              {(imgPreview || form.urlImagenProducto) && !imgError ? (
                <img
                  src={imgPreview ?? form.urlImagenProducto!}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : imgError ? (
                <ImageOff className="w-7 h-7 text-gray-300" />
              ) : (
                <Camera className="w-7 h-7 text-gray-300" />
              )}
            </div>
            {form.urlImagenProducto && !confirmandoEliminarImagen && (
              <button
                type="button"
                onClick={() => setConfirmandoEliminarImagen(true)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs transition-colors"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
            {form.urlImagenProducto && confirmandoEliminarImagen && (
              <div className="absolute -top-2 -right-2 flex gap-1 z-10">
                <button
                  type="button"
                  onClick={() => { handleQuitarImagen(); setConfirmandoEliminarImagen(false); }}
                  className="text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white px-1.5 py-0.5 rounded shadow-xs"
                >
                  Quitar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoEliminarImagen(false)}
                  className="text-[10px] font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded shadow-xs"
                >
                  No
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleSeleccionarImagen}
              disabled={subiendoImagen}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-blue bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              {subiendoImagen ? "Subiendo…" : form.urlImagenProducto ? "Cambiar foto" : "Subir foto"}
            </button>
            {form.urlImagenProducto && !imgError && (
              <span className="text-[11px] text-emerald-600 font-semibold pl-0.5">✓ Subida</span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <InputBase
            compact
            className="h-9"
            label="Nombre del Producto"
            value={form.nomProducto}
            onChange={onChange("nomProducto")}
            placeholder='Ej: Monitor LED 24"'
            required
          />

          {isStock && form.tipoProducto === "BIEN" && (
            <div className="flex items-center gap-4 flex-wrap text-xs pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.alertaVencimientoActiva ?? true}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, alertaVencimientoActiva: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 accent-brand-blue"
                />
                <CalendarClock className="w-3 h-3 text-gray-400" />
                <span className="text-[11px] font-medium text-gray-600">
                  Alertar vencimiento
                </span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.alertaStockBajoActiva ?? true}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, alertaStockBajoActiva: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 accent-brand-blue"
                  />
                  <PackageX className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-600">
                    Stock bajo
                  </span>
                </label>

                {(form.alertaStockBajoActiva ?? true) && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-amber-200/70">
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
                      placeholder={umbralStockBajo != null ? String(umbralStockBajo) : "5"}
                      className="w-11 px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-md outline-none focus:border-brand-blue/50 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">
                      {form.stockMinimoAlerta === null || form.stockMinimoAlerta === undefined
                        ? umbralStockBajo != null
                          ? `mín. sin definir · usa el general (${umbralStockBajo})`
                          : "mín. sin definir · usa el general"
                        : "unidades mínimas"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Clasificación (4 selects en 1 fila en Desktop) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Tipo Producto</label>
          <select
            value={form.tipoProducto}
            onChange={onChange("tipoProducto")}
            className="w-full h-9 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-blue/50"
          >
            <option value="BIEN">Bien</option>
            <option value="SERVICIO">Servicio</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Categoría</label>
          <select
            value={form.categoriaId}
            onChange={onChange("categoriaId")}
            className="w-full h-9 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-blue/50"
          >
            <option value={0}>Seleccione categoría</option>
            {categorias.map((cat) => (
              <option key={cat.categoriaId} value={cat.categoriaId}>
                {cat.categoriaNombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Tipo Afectación IGV</label>
          <select
            value={form.tipoAfectacionIGV}
            onChange={onChange("tipoAfectacionIGV")}
            className="w-full h-9 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-blue/50"
          >
            <option value="10">10 - Gravado</option>
            <option value="20">20 - Exonerado</option>
            <option value="30">30 - Inafecto</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Unidad de Medida</label>
          <select
            value={form.unidadMedida}
            onChange={onChange("unidadMedida")}
            className="w-full h-9 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-blue/50"
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

      {/* ── 3. Precios, Costo, Stock y Ubicación (4 columnas en Desktop) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-start">
        <div className="space-y-1">
          <InputBase
            compact
            className="h-9"
            label={form.esPaquete ? "Precio Paquete" : "Precio Venta"}
            type="text"
            value={precioInput}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                setPrecioInput(value);
                setForm((prev) => ({
                  ...prev,
                  precioUnitario: value === "" ? 0 : parseFloat(value),
                }));
              }
            }}
            onBlur={() => {
              const num = parseFloat(precioInput || "0");
              setPrecioInput(num.toFixed(2));
            }}
            placeholder="0.00"
            required
          />
          {form.tipoAfectacionIGV === "10" && (
            <label className="flex items-center gap-1.5 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={form.incluirIGV}
                onChange={onChange("incluirIGV")}
                className="w-3.5 h-3.5 accent-brand-blue"
              />
              <span className="text-[11px] font-medium text-gray-600">
                Precio Incluye IGV
              </span>
            </label>
          )}
        </div>

        {isStock && form.tipoProducto === "BIEN" ? (
          <InputBase
            compact
            className="h-9"
            label="Precio Compra"
            labelOptional="(costo)"
            type="number"
            step="0.01"
            value={form.costoUnitario === null || form.costoUnitario === undefined ? "" : String(form.costoUnitario)}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                costoUnitario: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            placeholder="Ej: 3.50"
          />
        ) : <div />}

        {isStock && form.tipoProducto === "BIEN" ? (
          <InputBase
            compact
            className="h-9"
            label="Stock"
            labelOptional="(unidades)"
            type="number"
            value={form.stock === null || form.stock === undefined ? "" : String(form.stock)}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                stock: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            placeholder="Ej: 50"
          />
        ) : <div />}

        {isStock && form.tipoProducto === "BIEN" ? (
          <InputBase
            compact
            className="h-9"
            label="Ubicación Tienda"
            labelOptional="(opcional)"
            value={form.ubicacionTienda ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                ubicacionTienda: e.target.value.trim() === "" ? null : e.target.value,
              }))
            }
            placeholder="Ej: Pasillo 3, Estante B"
          />
        ) : <div />}
      </div>

      {/* ── 4. Códigos (Interno y Barras) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
        <InputBase
          compact
          className="h-9"
          label="Código"
          value={form.codigo}
          onChange={onChange("codigo")}
          placeholder="PROD-001"
          required
        />

        {esUnidadContable(form.unidadMedida) ? (
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
              <span>
                Código de Barras{" "}
                <span className="text-gray-400 font-normal normal-case">(opcional)</span>
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={form.codigoBarras ?? ""}
                  onChange={onChange("codigoBarras")}
                  placeholder="EAN13 / Code128 o escanear..."
                  className="w-full h-9 px-4 py-1.5 pr-8 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50 text-gray-800"
                />
                {form.codigoBarras && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, codigoBarras: "" }))}
                    title="Borrar código"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
                  >
                    <XIcon className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={isScanning ? stopScanning : startScanning}
                className={`h-9 shrink-0 flex items-center gap-1.5 px-3.5 text-xs font-semibold rounded-xl transition-colors border ${
                  isScanning
                    ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                    : "bg-blue-50 border-blue-200 text-brand-blue hover:bg-blue-100"
                }`}
                title="Escanear código de barras con la cámara"
              >
                <ScanBarcode className="w-4 h-4" />
                <span>{isScanning ? "Cerrar" : "Escanear"}</span>
              </button>
            </div>
          </div>
        ) : <div />}
      </div>

      {/* Visor de Cámara si está activo */}
      {isScanning && esUnidadContable(form.unidadMedida) && (
        <div className="space-y-2 p-2.5 bg-gray-100/80 rounded-xl border border-gray-200 text-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              Buscando código de barras...
            </span>
            <button
              type="button"
              onClick={stopScanning}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors px-2 py-0.5 bg-gray-200/80 hover:bg-gray-300 rounded-lg"
            >
              Cancelar
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

      {/* ── 5. Paquete / Caja (opcional) ── */}
      {isStock && (
        <div className="flex items-center gap-2 pt-0.5">
          <input
            type="checkbox"
            id="checkbox-esPaquete"
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
            className="w-3.5 h-3.5 accent-brand-blue"
          />
          <label htmlFor="checkbox-esPaquete" className="text-xs font-semibold text-gray-600 cursor-pointer">
            ¿Es un paquete/caja con unidades dentro?
          </label>
        </div>
      )}

      {isStock && form.esPaquete && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase">
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
                .filter((p) => p.productoId !== productoActualId && !p.esPaquete)
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
          />
        </div>
      )}

      {/* ── 6. Mayorista y Promoción (Compacto) ── */}
      {isStock && form.tipoProducto === "BIEN" && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            Mayorista y Promoción
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
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
            />
            <InputBase
              compact
              label="Cant. Mínima Mayorista"
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
            />
            <div className="flex items-center gap-2 h-8">
              <input
                type="checkbox"
                id="checkbox-enPromocion"
                checked={!!form.enPromocion}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, enPromocion: e.target.checked }))
                }
                className="w-3.5 h-3.5 accent-brand-blue"
              />
              <label htmlFor="checkbox-enPromocion" className="text-xs font-semibold text-gray-600 cursor-pointer">
                ¿En promoción?
              </label>
            </div>
            {form.enPromocion ? (
              <InputBase
                compact
                label="% Descuento"
                type="number"
                step="0.01"
                value={String(form.porcentajeDescuento ?? "")}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    porcentajeDescuento: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Ej: 50"
              />
            ) : <div />}
          </div>
        </div>
      )}

      {isStock && form.tipoProducto === "BIEN" && form.esPaquete && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          El stock de este paquete se calcula automáticamente a partir del producto base y se
          actualiza desde el módulo de Compras. Aquí solo puedes editar sus precios.
        </p>
      )}
    </>
  );
}

interface CodigoSunatEditarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAbrirCatalogo: () => void;
}

function CodigoSunatEditar({ value, onChange, onAbrirCatalogo }: CodigoSunatEditarProps) {
  const [habilitado, setHabilitado] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase">
        Código SUNAT{" "}
        <span className="text-gray-400 font-normal normal-case">(opcional)</span>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={value}
            readOnly
            placeholder="Seleccionar desde catálogo..."
            className="w-full px-4 py-2 pr-8 bg-gray-100 border border-gray-200 rounded-xl text-sm truncate text-gray-600 cursor-default outline-none"
          />
          {value && habilitado && (
            <button
              type="button"
              onClick={() => onChange({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 text-white transition-colors"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onAbrirCatalogo}
          disabled={!habilitado}
          className="shrink-0 px-3 py-2 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Editar
        </button>
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={habilitado}
          onChange={(e) => setHabilitado(e.target.checked)}
          className="w-3.5 h-3.5 accent-brand-blue"
        />
        <span className="text-[11px] text-gray-400 font-medium">Habilitar edición del código SUNAT</span>
      </label>
    </div>
  );
}