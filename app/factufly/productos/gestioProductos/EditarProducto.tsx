"use client";

import React, { useState } from "react";
import axios from "axios";
import { Camera, X as XIcon, ImageOff } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { Categoria, EditProducto, NuevoProducto, ProductoSucursal } from "./Producto";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosEmpresaLista } from "./useProductosEmpresaLista";
import ModalCatalogoSunat from "./ModalCatalogoSunat";


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
  urlImagenProducto: null,
  codigoBarras: "",
  esPaquete: false,
  productoBaseId: null,
  factorConversion: null,
  precioMayorista: null,
  cantidadMinimaMayorista: null,
  enPromocion: false,
  porcentajeDescuento: null,
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

  // Refresca la lista de productos base cada vez que se abre el modal.
  React.useEffect(() => {
    if (isOpen) fetchProductosEmpresa();
  }, [isOpen]);

  React.useEffect(() => {
    if (!producto) return;

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
    });

    setPrecioInput(producto.sucursalProducto.precioUnitario.toFixed(2));
  }, [producto]);

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
        setForm((prev) => ({
          ...prev,
          tipoProducto: value as string,
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
      codigoBarras: form.codigoBarras || null,
      codigoSunat: form.codigoSunat || undefined,
      esPaquete: form.esPaquete ?? false,
      productoBaseId: form.esPaquete ? form.productoBaseId ?? null : null,
      factorConversion: form.esPaquete ? form.factorConversion ?? null : null,
      precioMayorista: form.precioMayorista ?? null,
      cantidadMinimaMayorista: form.cantidadMinimaMayorista ?? null,
      enPromocion: form.enPromocion ?? false,
      porcentajeDescuento: form.enPromocion ? form.porcentajeDescuento ?? null : null,
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
          precioMayorista: payload.precioMayorista,
          cantidadMinimaMayorista: payload.cantidadMinimaMayorista,
          enPromocion: payload.enPromocion,
          porcentajeDescuento: payload.porcentajeDescuento,
        },
      };

      showToast("Producto actualizado correctamente.", "success");
      onProductoEditado(productoActualizado);
      onClose();
    } catch (error) {
      console.error("Error editando producto:", error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          showToast("No se encontró el producto a actualizar.", "error");
        } else if (status === 400) {
          showToast("Los datos ingresados no son válidos.", "error");
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
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Producto">
      <form className="space-y-4" onSubmit={handleEditar}>
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
        />

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || subiendoImagen}>
            {subiendoImagen ? "Subiendo imagen..." : isSubmitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FormEditarProducto({ form, setForm, precioInput, setPrecioInput, onChange, categorias, isStock, productosEmpresa, productoActualId, imgError, setImgError, imgPreview, setImgPreview, subiendoImagen, setSubiendoImagen, confirmandoEliminarImagen, setConfirmandoEliminarImagen, onAbrirCatalogo }: FormFieldsProps) {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      {/* ── Imagen del producto ── */}
      <div className="flex items-start gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="relative shrink-0">
          <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
            {(imgPreview || form.urlImagenProducto) && !imgError ? (
              <img
                src={imgPreview ?? form.urlImagenProducto!}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : imgError ? (
              <ImageOff className="w-8 h-8 text-gray-300" />
            ) : (
              <Camera className="w-8 h-8 text-gray-300" />
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

        <div className="flex flex-col justify-center gap-1.5 min-w-0 pt-1">
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
            <p className="text-[11px] text-gray-400">JPG, PNG o WebP — máx. 2 MB</p>
          )}
          <button
            type="button"
            onClick={handleSeleccionarImagen}
            disabled={subiendoImagen}
            className="w-fit flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <Camera className="w-3.5 h-3.5" />
            {subiendoImagen ? "Subiendo…" : form.urlImagenProducto ? "Cambiar imagen" : "Subir imagen"}
          </button>
        </div>
      </div>

      <InputBase
        label="Nombre del Producto"
        value={form.nomProducto}
        onChange={onChange("nomProducto")}
        placeholder='Ej: Monitor LED 24"'
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Tipo Producto</label>
          <select
            value={form.tipoProducto}
            onChange={onChange("tipoProducto")}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
          >
            <option value="BIEN">Bien</option>
            <option value="SERVICIO">Servicio</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Categoría</label>
          <select
            value={form.categoriaId}
            onChange={onChange("categoriaId")}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
          >
            <option value={0}>Seleccione categoría</option>
            {categorias.map((cat) => (
              <option key={cat.categoriaId} value={cat.categoriaId}>
                {cat.categoriaNombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Tipo Afectación IGV</label>
          <select
            value={form.tipoAfectacionIGV}
            onChange={onChange("tipoAfectacionIGV")}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
          >
            <option value="10">10 - Gravado</option>
            <option value="20">20 - Exonerado</option>
            <option value="30">30 - Inafecto</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Unidad de Medida</label>
          <select
            value={form.unidadMedida}
            onChange={onChange("unidadMedida")}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
          >
            <option value="NIU">NIU - Unidad</option>
            <option value="KGM">KGM - Kilogramo</option>
            <option value="LTR">LTR - Litro</option>
            <option value="ZZ">ZZ - Servicio</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <InputBase
            label={form.esPaquete ? "Precio del Paquete/Caja" : "Precio Venta Unitario"}
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
          />

          {form.tipoAfectacionIGV === "10" && (
            <div className="flex items-center gap-2 pl-1">
              <input
                type="checkbox"
                checked={form.incluirIGV}
                onChange={onChange("incluirIGV")}
                className="w-4 h-4 accent-brand-blue"
              />
              <label className="text-xs font-semibold text-gray-600">
                Precio Incluye IGV
              </label>
            </div>
          )}
        </div>

        <InputBase
          label="Código"
          value={form.codigo}
          onChange={onChange("codigo")}
          placeholder="PROD-001"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <InputBase
            label="Código de Barras"
            labelOptional="(opcional)"
            value={form.codigoBarras ?? ""}
            onChange={onChange("codigoBarras")}
            placeholder="EAN13 / Code128"
          />
          <button
            type="button"
            disabled
            className="text-[10px] font-semibold text-gray-300 cursor-not-allowed"
          >
            Generar código automático
          </button>
        </div>

        <CodigoSunatEditar
          value={form.codigoSunat ?? ""}
          onChange={onChange("codigoSunat")}
          onAbrirCatalogo={onAbrirCatalogo}
        />

        {isStock && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">&nbsp;</label>
            <div className="flex items-center gap-2 h-10 px-1">
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
              <label className="text-xs font-semibold text-gray-600">
                ¿Es un paquete/caja con unidades dentro?
              </label>
            </div>
          </div>
        )}
      </div>

      {isStock && form.esPaquete && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
            >
              <option value={0}>Seleccione el producto unidad</option>
              {productosEmpresa
                .filter((p) => p.productoId !== productoActualId && !p.esPaquete)
                .map((p) => (
                  <option key={p.productoId} value={p.productoId}>
                    {p.nomProducto} ({p.codigo})
                  </option>
                ))}
            </select>
          </div>

          <InputBase
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
          />
        </div>
      )}

      {isStock && form.tipoProducto === "BIEN" && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <p className="text-xs font-bold text-gray-500 uppercase">Mayorista y Promoción</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputBase
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
          )}
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