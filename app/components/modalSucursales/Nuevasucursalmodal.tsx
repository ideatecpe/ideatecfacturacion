"use client";
import React, { useState } from "react";
import { Building2, Eye, EyeOff, FileText, Loader2, Lock, User, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { NuevaSucursalForm, Sucursal } from "./types";
import { FormInput, SerieRowModal } from "./Sucursalformshared";


// ─── Helpers ──────────────────────────────────────────────────────────────────
function nextSerie(sucursales: Sucursal[], prefix: string, key: keyof Sucursal): string {
  const nums = sucursales
    .map((s) => {
      const val = s[key] as string;
      return val ? parseInt(val.replace(prefix, "")) : 0;
    })
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  const padLength = 4 - prefix.length;
  return `${prefix}${String(max + 1).padStart(padLength, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NuevaSucursalModal({
  onClose,
  onSave,
  nextCode,
  sucursales,
}: {
  onClose: () => void;
  onSave: (form: NuevaSucursalForm) => Promise<void>;
  nextCode: string;
  sucursales: Sucursal[];
}) {
  const [step, setStep] = useState<"warn" | "form">("warn");
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  const [form, setForm] = useState<NuevaSucursalForm>({
    nombre: "",
    direccion: "",
    usuario: "",
    password: "",
    confirmPassword: "",
    serieFactura:                  nextSerie(sucursales, "F", "serieFactura"),
    correlativoFactura:            1,
    serieBoleta:                   nextSerie(sucursales, "B", "serieBoleta"),
    correlativoBoleta:             1,
    serieNotaCreditoFactura:       nextSerie(sucursales, "FC", "serieNotaCreditoFactura"),
    correlativoNotaCreditoFactura: 1,
    serieNotaCreditoBoleta:        nextSerie(sucursales, "BC", "serieNotaCreditoBoleta"),
    correlativoNotaCreditoBoleta:  1,
    serieNotaDebitoFactura:        nextSerie(sucursales, "FD", "serieNotaDebitoFactura"),
    correlativoNotaDebitoFactura:  1,
    serieNotaDebitoBoleta:         nextSerie(sucursales, "BD", "serieNotaDebitoBoleta"),
    correlativoNotaDebitoBoleta:   1,
    serieGuiaRemision:             nextSerie(sucursales, "T", "serieGuiaRemision"),
    correlativoGuiaRemision:       1,
    serieGuiaTransportista:        nextSerie(sucursales, "V", "serieGuiaTransportista"),
    correlativoGuiaTransportista:  1,
  });

  const upd =
    (k: keyof NuevaSucursalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.usuario || !form.password) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }
    if (form.password !== form.confirmPassword) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }
    if (form.password.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Nueva Sucursal</p>
              <p className="text-xs text-gray-500">
                {step === "warn" ? "Información importante" : "Completa los datos de la sucursal"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Advertencia ── */}
        {step === "warn" && (
          <div className="p-6 flex flex-col gap-6">
            <div className="flex gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-amber-800">¿Estás seguro de crear una nueva sucursal?</p>
                <p className="text-sm text-amber-700">Al crear una nueva sucursal debes tener en cuenta lo siguiente:</p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>Se asignará el código <strong>{nextCode}</strong> a esta sucursal.</li>
                  <li>Se crearán <strong>nuevas series y correlativos</strong> de comprobantes de pago independientes.</li>
                  <li>Deberás crear un <strong>usuario y contraseña</strong> exclusivos para esta sucursal.</li>
                  <li>Esta acción no puede deshacerse fácilmente una vez guardada.</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={() => setStep("form")} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
                Entendido, continuar
              </button>
            </div>
          </div>
        )}

        {/* ── Formulario ── */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Datos generales */}
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-4">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-gray-800">Datos de la Sucursal</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Nombre" required icon={Building2} value={form.nombre} onChange={upd("nombre")} placeholder="Ej: Tienda San Isidro" />
                  <FormInput label="Dirección" icon={Building2} value={form.direccion} onChange={upd("direccion")} placeholder="Ej: Av. Principal 123" />
                </div>
              </div>

              {/* Usuario */}
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-4">
                  <User className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-gray-800">Acceso a la Sucursal</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Usuario" required icon={User} value={form.usuario} onChange={upd("usuario")} placeholder="Ej: san_isidro" hint="Sin espacios ni caracteres especiales" />

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      Contraseña <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={form.password}
                        onChange={upd("password")}
                        placeholder="Mín. 6 caracteres"
                        className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 bg-white transition-colors"
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5 sm:col-span-2 sm:max-w-xs">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      Confirmar Contraseña <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        required
                        value={form.confirmPassword}
                        onChange={upd("confirmPassword")}
                        placeholder="Repite la contraseña"
                        className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 bg-white transition-colors"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Series */}
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-4">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-gray-800">Series de Comprobantes</p>
                  <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Generadas automáticamente</span>
                </div>
                <div className="space-y-4">
                  <SerieRowModal label="Factura"              serieKey="serieFactura"               correlativoKey="correlativoFactura"               form={form} setForm={setForm} prefix="F" />
                  <SerieRowModal label="Boleta"               serieKey="serieBoleta"                correlativoKey="correlativoBoleta"                form={form} setForm={setForm} prefix="B" />
                  <SerieRowModal label="Nota Crédito Factura" serieKey="serieNotaCreditoFactura"    correlativoKey="correlativoNotaCreditoFactura"    form={form} setForm={setForm} prefix="FC" />
                  <SerieRowModal label="Nota Crédito Boleta"  serieKey="serieNotaCreditoBoleta"     correlativoKey="correlativoNotaCreditoBoleta"     form={form} setForm={setForm} prefix="BC" />
                  <SerieRowModal label="Nota Débito Factura"  serieKey="serieNotaDebitoFactura"     correlativoKey="correlativoNotaDebitoFactura"     form={form} setForm={setForm} prefix="FD" />
                  <SerieRowModal label="Nota Débito Boleta"   serieKey="serieNotaDebitoBoleta"      correlativoKey="correlativoNotaDebitoBoleta"      form={form} setForm={setForm} prefix="BD" />
                  <SerieRowModal label="Guía de Remisión"     serieKey="serieGuiaRemision"          correlativoKey="correlativoGuiaRemision"          form={form} setForm={setForm} prefix="T" />
                  <SerieRowModal label="Guía Transportista"   serieKey="serieGuiaTransportista"     correlativoKey="correlativoGuiaTransportista"     form={form} setForm={setForm} prefix="V" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Guardando..." : "Crear Sucursal"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}