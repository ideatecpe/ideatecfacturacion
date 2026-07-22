"use client";
import React, { useState } from "react";
import { Building2, Edit2, Loader2, MessageCircle, X } from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { EditSucursalForm, Sucursal } from "./types";
import { FormInput } from "./Sucursalformshared";

export function EditarSucursalModal({
  sucursal,
  onClose,
  onSave,
}: {
  sucursal: Sucursal;
  onClose: () => void;
  onSave: (id: string, data: EditSucursalForm) => void;
}) {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [form, setForm] = useState<EditSucursalForm>({
    nombre: sucursal.nombre === "S/N" ? "" : sucursal.nombre,
    direccion: sucursal.direccion ?? "",
    numeroStockBajo: sucursal.numeroStockBajo ?? "",
  });

  const upd =
    (k: keyof EditSucursalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre) {
      showToast("El nombre es obligatorio", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave(sucursal.id, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
              <Edit2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Editar Sucursal</p>
              <p className="text-xs text-gray-500">Código: {sucursal.codigo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <FormInput label="Nombre" required icon={Building2} value={form.nombre} onChange={upd("nombre")} placeholder="Nombre de la sucursal" />
            <FormInput label="Dirección" icon={Building2} value={form.direccion} onChange={upd("direccion")} placeholder="Ej: Av. Principal 123" />
            <FormInput
              label="WhatsApp para aviso de stock bajo"
              icon={MessageCircle}
              value={form.numeroStockBajo}
              onChange={(e) =>
                setForm((f) => ({ ...f, numeroStockBajo: e.target.value.replace(/\D/g, "").slice(0, 9) }))
              }
              placeholder="987654321"
              hint="Se notificará a este número cuando un producto de esta sucursal quede con pocas unidades"
            />
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}