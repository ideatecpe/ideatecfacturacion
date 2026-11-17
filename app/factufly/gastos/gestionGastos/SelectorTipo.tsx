"use client";

import { useSyncExternalStore } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { TipoMovimiento } from "./tipos";

const CLAVE = "gastos_tipoMovimiento";

// La pestaña elegida se recuerda en localStorage, que no existe en el servidor:
// useSyncExternalStore hidrata con "Gastos" y recién después aplica la guardada.
let tipoActual: TipoMovimiento | null = null;
const oyentes = new Set<() => void>();

const leer = (): TipoMovimiento => {
  if (tipoActual === null) {
    try {
      tipoActual = localStorage.getItem(CLAVE) === "I" ? "I" : "G";
    } catch {
      tipoActual = "G";
    }
  }
  return tipoActual;
};
const leerServidor = (): TipoMovimiento => "G";
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
};

/** Recuerda la pestaña (también la usa la emisión: al volver de facturar un ingreso, abre en Ingresos). */
export function recordarTipoMovimiento(t: TipoMovimiento) {
  tipoActual = t;
  try { localStorage.setItem(CLAVE, t); } catch { /* noop */ }
  oyentes.forEach((f) => f());
}

/** Pestaña Gastos / Ingresos recordada en el navegador (arranca en Gastos). */
export function useTipoMovimiento(): [TipoMovimiento, (t: TipoMovimiento) => void] {
  const tipo = useSyncExternalStore(suscribir, leer, leerServidor);
  return [tipo, recordarTipoMovimiento];
}

export function SelectorTipo({ tipo, onChange }: { tipo: TipoMovimiento; onChange: (t: TipoMovimiento) => void }) {
  const opciones: { id: TipoMovimiento; label: string; icono: typeof ArrowDownCircle }[] = [
    { id: "G", label: "Gastos", icono: ArrowUpCircle },
    { id: "I", label: "Ingresos", icono: ArrowDownCircle },
  ];
  return (
    <div className="inline-flex rounded-lg p-0.5 bg-[#0f2e64]/7 border border-[#0f2e64]/10">
      {opciones.map(({ id, label, icono: Icono }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
            tipo === id ? "bg-[#0f2e64] text-white shadow-sm" : "text-[#0f2e64]/60 hover:text-[#0f2e64]",
          )}
        >
          <Icono className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
