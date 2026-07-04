import React from "react";
import { NuevaSucursalForm } from "./types";

// ─── FieldLabel ───────────────────────────────────────────────────────────────
export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

// ─── FormInput ────────────────────────────────────────────────────────────────
export function FormInput({
  label,
  required,
  hint,
  icon: Icon,
  type = "text",
  ...props
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: React.ElementType;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        {Icon && (
          <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        )}
        <input
          type={type}
          required={required}
          className={`w-full py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 bg-white transition-colors ${Icon ? "pl-9 pr-4" : "px-4"}`}
          {...props}
        />
      </div>
      {hint && <p className="text-[10px] text-gray-400 italic">{hint}</p>}
    </div>
  );
}

// ─── SerieRowModal ────────────────────────────────────────────────────────────
export function SerieRowModal({
  label,
  serieKey,
  correlativoKey,
  form,
  setForm,
  prefix,
  hint,
}: {
  label: string;
  serieKey: keyof NuevaSucursalForm;
  correlativoKey: keyof NuevaSucursalForm;
  form: NuevaSucursalForm;
  setForm: React.Dispatch<React.SetStateAction<NuevaSucursalForm>>;
  prefix: string;
  hint?: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1 space-y-1.5">
        <FieldLabel>{label} — Serie</FieldLabel>
        <input
          className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 bg-white transition-colors"
          value={form[serieKey] as string}
          onChange={(e) =>
            setForm((f) => ({ ...f, [serieKey]: e.target.value }))
          }
          placeholder={hint ?? ""}
          maxLength={4}
        />
        <p className="text-[10px] text-gray-400 italic">
          Empieza con "{prefix}" — máx. 4 chars
        </p>
      </div>
      <div className="w-32 space-y-1.5">
        <FieldLabel>Correlativo</FieldLabel>
        <input
          type="number"
          min={1}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 bg-white transition-colors"
          value={form[correlativoKey] as number}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              [correlativoKey]: Math.max(1, parseInt(e.target.value) || 1),
            }))
          }
        />
      </div>
    </div>
  );
}