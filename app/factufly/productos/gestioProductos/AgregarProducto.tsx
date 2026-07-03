"use client";

import React, { useState } from "react";
import axios from "axios";
import { ChevronDown, Camera, X as XIcon, ImageOff } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
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
import { SelectConAgregar } from "@/app/components/ui/SelectConAgregar";

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

const URL_IMAGEN_DEMO = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop&auto=format";

const emptyForm: NuevoProducto = {
  codigo: "",
  tipoProducto: "BIEN",
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
};

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSeleccionarImagen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError(false);
    const localUrl = URL.createObjectURL(file);
    setImgPreview(localUrl);
    // URL que se guarda en DB — se reemplazará con Cloudinary
    setForm((prev) => ({ ...prev, urlImagenProducto: URL_IMAGEN_DEMO }));
  };

  const handleQuitarImagen = () => {
    setForm((prev) => ({ ...prev, urlImagenProducto: null }));
    setImgPreview(null);
    setImgError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    } else {
      setForm({ ...emptyForm, sucursalId: 0 });
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
    if (!validar()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    const formConSucursal = {
      ...form,
      sucursalId: sucursalIdEfectivo,
      // El stock siempre arranca en 0: solo se incrementa desde el módulo de Compras a Proveedor.
      stock: config?.isStock && form.tipoProducto === "BIEN" ? 0 : null,
    };

    try {
      const response = await axios.post<ProductoSucursal>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos`,
        formConSucursal,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      showToast("Producto guardado exitosamente.", "success");
      onProductoAgregado(response.data);
      setForm({ ...emptyForm, sucursalId: sucursalIdEfectivo });
      onClose();
    } catch (error) {
      console.error("Error guardando producto:", error);
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
      <form className="space-y-4" onSubmit={handleGuardar}>
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
              className={`w-full px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:border-brand-blue ${
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
          <div className="flex items-start gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Thumbnail */}
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
              {form.urlImagenProducto && (
                <button
                  type="button"
                  onClick={handleQuitarImagen}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Texto + botón */}
            <div className="flex flex-col justify-center gap-1.5 min-w-0 pt-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Imagen del producto
                <span className="ml-1 font-normal text-gray-400 normal-case">(opcional)</span>
              </p>
              {form.urlImagenProducto && !imgError ? (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  ✓ Imagen seleccionada
                </p>
              ) : (
                <p className="text-[11px] text-gray-400">
                  JPG, PNG o WebP — máx. 2 MB
                </p>
              )}
              <button
                type="button"
                onClick={handleSeleccionarImagen}
                className="w-fit flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {form.urlImagenProducto ? "Cambiar imagen" : "Subir imagen"}
              </button>
            </div>
          </div>
        )}

        {!soloSucursal && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Tipo Producto
            </label>
            <select
              value={form.tipoProducto}
              onChange={handleFormChange("tipoProducto")}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
            >
              <option value="BIEN">Bien</option>
              <option value="SERVICIO">Servicio</option>
            </select>
          </div>
        )}

        {/* ── Nombre con búsqueda ── */}
        <div className="relative space-y-1.5">
          <InputBase
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

        {/* ── Campos base ── */}
        {!soloSucursal && (
          <>
            <div className="grid grid-cols-1 gap-4">
              {/* ── Categoría con error ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  Categoría <span className="text-rose-500">*</span>
                </label>
                <SelectConAgregar
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
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Tipo Afectación IGV
                </label>
                <select
                  value={form.tipoAfectacionIGV}
                  onChange={handleFormChange("tipoAfectacionIGV")}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <InputBase
              label={form.esPaquete ? "Precio del Paquete/Caja" : "Precio Unitario"}
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
 
          {!soloSucursal && (
            <InputBase
              label="Código"
              labelOptional="(auto)"
              value={form.codigo}
              readOnly
              placeholder="Se genera automáticamente"
              showError={false}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          )}

        </div>

        {/* ── Código de barras (siempre disponible) ── */}
        {!soloSucursal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <InputBase
                label="Código de Barras"
                labelOptional="(opcional)"
                value={form.codigoBarras ?? ""}
                onChange={handleFormChange("codigoBarras")}
                placeholder="EAN13 / Code128"
                showError={false}
              />
              <button
                type="button"
                onClick={() => {
                  const ts = Date.now().toString().slice(-10);
                  setForm((prev) => ({ ...prev, codigoBarras: `200${ts}` }));
                }}
                className="text-[10px] font-semibold text-brand-blue hover:underline"
              >
                Generar código automático
              </button>
            </div>

            {config?.isStock && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  &nbsp;
                </label>
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
        )}

        {/* ── Paquete: producto base + factor de conversión (solo si maneja stock) ── */}
        {!soloSucursal && config?.isStock && (
          <>
            {form.esPaquete && (
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
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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
              <div className="p-4 space-y-4 border-t border-gray-200">
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
                    showError={false}
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Producto"}
          </Button>
        </div>
      </form>
      <ModalAgregarCategoria
        isOpen={isModalCategoriaOpen}
        onClose={() => setIsModalCategoriaOpen(false)}
        onAgregarCategoria={onAgregarCategoria}
        loadingCategoria={loadingCategoria}
      />
    </Modal>
  );
}
