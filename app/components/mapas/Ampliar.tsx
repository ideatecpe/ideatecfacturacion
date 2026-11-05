"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Mapa ampliado a casi toda la pantalla: mismo mapa (no se vuelve a crear), solo cambia
 * de tamaño. Se cierra con el botón, con Esc o tocando el fondo.
 */
export function useMapaAmpliado() {
  const [ampliado, setAmpliado] = useState(false);

  useEffect(() => {
    if (!ampliado) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliado(false);
    };
    const desbordeAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPresionar);
    return () => {
      document.body.style.overflow = desbordeAntes;
      window.removeEventListener("keydown", alPresionar);
    };
  }, [ampliado]);

  return {
    ampliado,
    alternar: () => setAmpliado((a) => !a),
    cerrar: () => setAmpliado(false),
    /** Clases del contenedor del mapa. */
    claseContenedor: ampliado
      ? "fixed inset-3 sm:inset-8 z-[3000] rounded-xl border border-gray-300 shadow-2xl bg-white"
      : "relative rounded-lg border border-gray-200",
  };
}

/** Fondo oscuro detrás del mapa ampliado. */
export function FondoAmpliado({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  if (!visible) return null;
  return <div className="fixed inset-0 z-[2999] bg-black/50" onClick={onCerrar} aria-hidden />;
}

export function BotonAmpliar({ ampliado, onClick, className = "" }: { ampliado: boolean; onClick: () => void; className?: string }) {
  const Icono = ampliado ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      onClick={onClick}
      title={ampliado ? "Achicar el mapa (Esc)" : "Ampliar el mapa"}
      aria-label={ampliado ? "Achicar el mapa" : "Ampliar el mapa"}
      className={`absolute z-[1000] inline-flex items-center justify-center w-9 h-9 rounded-md bg-white text-gray-700 shadow-md border border-gray-200 hover:text-brand-blue ${className}`}
    >
      <Icono className="w-4 h-4" />
    </button>
  );
}
