"use client";

import React, { useState } from "react";
import axios from "axios";
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

  const { productosEmpresa } = useProductosEmpresaLista();

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
      let value: string | number | boolean =
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
        setForm((prev) => ({
          ...prev,
          tipoProducto: value as string,
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    const formConSucursal = { ...form, sucursalId: sucursalIdEfectivo };

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
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Nuevo Producto">
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
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <InputBase
              label="Precio Unitario"
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
