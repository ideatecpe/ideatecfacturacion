"use client";

import React from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { Proveedor, EditProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/Proveedor";
import { useEditarProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/useEditarProveedor";

interface Props {
  isOpen: boolean;
  proveedor: Proveedor | null;
  onClose: () => void;
  onProveedorEditado: (proveedor: Proveedor) => void;
}

export default function EditarProveedor({ isOpen, proveedor, onClose, onProveedorEditado }: Props) {
  const { editarProveedor, loadingEditar } = useEditarProveedor();

  const [form, setForm] = React.useState<EditProveedor | null>(null);
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (isOpen && proveedor) {
      setForm({
        proveedorId: proveedor.proveedorId,
        numDocumento: proveedor.numDocumento,
        razonSocial: proveedor.razonSocial,
        nombreComercial: proveedor.nombreComercial ?? "",
        direccion: proveedor.direccion ?? "",
        telefono: proveedor.telefono ?? "",
        email: proveedor.email ?? "",
        personaContacto: proveedor.personaContacto ?? "",
      });
      setErrors({});
    }
  }, [isOpen, proveedor]);

  const handleChange =
    (field: keyof EditProveedor) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!form) return;
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));
      setForm({ ...form, [field]: e.target.value });
    };

  const validar = (): boolean => {
    if (!form) return false;
    const newErrors: Record<string, boolean> = {};
    if (!form.numDocumento.trim()) newErrors.numDocumento = true;
    if (!form.razonSocial.trim()) newErrors.razonSocial = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !validar()) return;

    const ok = await editarProveedor(form);
    if (ok && proveedor) {
      onProveedorEditado({
        ...proveedor,
        numDocumento: form.numDocumento,
        razonSocial: form.razonSocial,
        nombreComercial: form.nombreComercial ?? null,
        direccion: form.direccion ?? null,
        telefono: form.telefono ?? null,
        email: form.email ?? null,
        personaContacto: form.personaContacto ?? null,
      });
      onClose();
    }
  };

  if (!form) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar proveedor">
      <form className="space-y-4" onSubmit={handleGuardar}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputBase
            label="N° Documento (RUC/DNI)"
            value={form.numDocumento}
            onChange={handleChange("numDocumento")}
            showError={!!errors.numDocumento}
          />
          <InputBase
            label="Razón Social"
            value={form.razonSocial}
            onChange={handleChange("razonSocial")}
            showError={!!errors.razonSocial}
          />
        </div>

        <InputBase
          label="Nombre Comercial"
          labelOptional="(opcional)"
          value={form.nombreComercial ?? ""}
          onChange={handleChange("nombreComercial")}
          showError={false}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputBase
            label="Teléfono"
            labelOptional="(opcional)"
            value={form.telefono ?? ""}
            onChange={handleChange("telefono")}
            showError={false}
          />
          <InputBase
            label="Email"
            labelOptional="(opcional)"
            value={form.email ?? ""}
            onChange={handleChange("email")}
            showError={false}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputBase
            label="Persona de Contacto"
            labelOptional="(opcional)"
            value={form.personaContacto ?? ""}
            onChange={handleChange("personaContacto")}
            showError={false}
          />
          <InputBase
            label="Dirección"
            labelOptional="(opcional)"
            value={form.direccion ?? ""}
            onChange={handleChange("direccion")}
            showError={false}
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loadingEditar}>
            {loadingEditar ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
