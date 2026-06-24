"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { useAuth } from "@/context/AuthContext";
import { Proveedor, NuevoProveedor } from "@/app/factufly/proveedores/gestionProveedorCompra/Proveedor";
import { useRegistrarProveedor } from "@/app/factufly/proveedores/gestionProveedorCompra/useRegistrarProveedor";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProveedorAgregado: (proveedor: Proveedor) => void;
}

const emptyForm: Omit<NuevoProveedor, "rucEmpresa"> = {
  numDocumento: "",
  razonSocial: "",
  nombreComercial: "",
  direccion: "",
  telefono: "",
  email: "",
  personaContacto: "",
};

export default function AgregarProveedor({ isOpen, onClose, onProveedorAgregado }: Props) {
  const { user } = useAuth();
  const { registrarProveedor, loadingRegistrar } = useRegistrarProveedor();

  const [form, setForm] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const [loadingRuc, setLoadingRuc] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setErrors({});
      setLoadingRuc(false);
    }
  }, [isOpen]);

  const handleChange =
    (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleBuscarRuc = async () => {
    const ruc = form.numDocumento.trim();
    if (ruc.length !== 11 || !/^\d{11}$/.test(ruc) || loadingRuc) return;

    setLoadingRuc(true);
    try {
      const result = await consultaRuc(ruc);
      if (result) {
        setForm((prev) => ({
          ...prev,
          razonSocial: result.razonSocial || prev.razonSocial,
          direccion: result.direccionLineal || prev.direccion,
        }));
        if (errors.razonSocial) setErrors((prev) => ({ ...prev, razonSocial: false }));
      }
    } finally {
      setLoadingRuc(false);
    }
  };

  const handleNumDocumentoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBuscarRuc();
    }
  };

  const validar = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    if (!form.numDocumento.trim()) newErrors.numDocumento = true;
    if (!form.razonSocial.trim()) newErrors.razonSocial = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    if (!user?.ruc) return;

    const creado = await registrarProveedor({ ...form, rucEmpresa: user.ruc });
    if (creado) {
      onProveedorAgregado(creado);
      setForm(emptyForm);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar nuevo proveedor">
      <form className="space-y-4" onSubmit={handleGuardar}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="relative">
              <InputBase
                label="N° Documento (RUC/DNI)"
                value={form.numDocumento}
                onChange={handleChange("numDocumento")}
                onBlur={handleBuscarRuc}
                onKeyDown={handleNumDocumentoKeyDown}
                placeholder="20123456789"
                showError={!!errors.numDocumento}
                maxLength={11}
                disabled={loadingRuc}
              />
              {loadingRuc && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 absolute right-3 top-9" />
              )}
            </div>
            {loadingRuc && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5 pl-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando datos del RUC...
              </p>
            )}
          </div>
          <InputBase
            label="Razón Social"
            value={form.razonSocial}
            onChange={handleChange("razonSocial")}
            placeholder="Se completa al ingresar el RUC"
            showError={!!errors.razonSocial}
          />
        </div>

        <InputBase
          label="Nombre Comercial"
          labelOptional="(opcional)"
          value={form.nombreComercial ?? ""}
          onChange={handleChange("nombreComercial")}
          placeholder="Nombre comercial"
          showError={false}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputBase
            label="Teléfono"
            labelOptional="(opcional)"
            value={form.telefono ?? ""}
            onChange={handleChange("telefono")}
            placeholder="999999999"
            showError={false}
          />
          <InputBase
            label="Email"
            labelOptional="(opcional)"
            value={form.email ?? ""}
            onChange={handleChange("email")}
            placeholder="contacto@proveedor.com"
            showError={false}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputBase
            label="Persona de Contacto"
            labelOptional="(opcional)"
            value={form.personaContacto ?? ""}
            onChange={handleChange("personaContacto")}
            placeholder="Nombre del contacto"
            showError={false}
          />
          <InputBase
            label="Dirección"
            labelOptional="(opcional)"
            value={form.direccion ?? ""}
            onChange={handleChange("direccion")}
            placeholder="Dirección del proveedor"
            showError={false}
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loadingRegistrar}>
            {loadingRegistrar ? "Guardando..." : "Guardar Proveedor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
