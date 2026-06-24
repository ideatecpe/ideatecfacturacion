"use client";

import React from "react";
import axios from "axios";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { Categoria, EditProducto, NuevoProducto, ProductoSucursal } from "./Producto";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosEmpresaLista } from "./useProductosEmpresaLista";

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
}

const emptyForm: NuevoProducto = {
  codigo: "",
  tipoProducto: "BIEN",
  nomProducto: "",
  unidadMedida: "NIU",
  tipoAfectacionIGV: "10",
  incluirIGV: true,
  categoriaId: 0,
  sucursalId: 1,
  precioUnitario: 0,
  codigoBarras: "",
  esPaquete: false,
  productoBaseId: null,
  factorConversion: null,
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
  const { productosEmpresa } = useProductosEmpresaLista();
  const [form, setForm] = React.useState<NuevoProducto>(emptyForm);
  const [precioInput, setPrecioInput] = React.useState("0.00");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!producto) return;

    setForm({
      codigo: producto.codigo,
      tipoProducto: producto.tipoProducto ?? "BIEN",
      nomProducto: producto.nomProducto,
      unidadMedida: producto.unidadMedida,
      tipoAfectacionIGV: producto.tipoAfectacionIGV,
      incluirIGV: producto.incluirIGV,
      categoriaId: producto.categoria?.categoriaId ?? 0,
      sucursalId: 0, // solo para no romper inteface Nuevo Producto
      precioUnitario: producto.sucursalProducto.precioUnitario,
      stock: producto.sucursalProducto.stock ?? 0,
      codigoBarras: producto.codigoBarras ?? "",
      esPaquete: producto.esPaquete ?? false,
      productoBaseId: producto.productoBaseId ?? null,
      factorConversion: producto.factorConversion ?? null,
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
      stock:
        config?.isStock && form.tipoProducto === "BIEN"
          ? form.stock ?? 0
          : null,
      codigoBarras: form.codigoBarras || null,
      esPaquete: form.esPaquete ?? false,
      productoBaseId: form.esPaquete ? form.productoBaseId ?? null : null,
      factorConversion: form.esPaquete ? form.factorConversion ?? null : null,
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
        codigoBarras: payload.codigoBarras,
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
        />

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FormEditarProducto({ form, setForm, precioInput, setPrecioInput, onChange, categorias, isStock, productosEmpresa, productoActualId }: FormFieldsProps) {
  return (
    <>
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
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
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
            label="Precio Unitario"
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
        <InputBase
          label="Código de Barras"
          labelOptional="(opcional)"
          value={form.codigoBarras ?? ""}
          onChange={onChange("codigoBarras")}
          placeholder="EAN13 / Code128"
        />

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
      </div>

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
                .filter((p) => p.productoId !== productoActualId)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputBase
            label="Stock"
            type="number"
            value={String(form.stock ?? 0)}
            onChange={onChange("stock")}
            placeholder="0"
          />
        </div>
      )}
    </>
  );
}