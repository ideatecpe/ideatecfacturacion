"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Receipt, Sparkles, X, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { activarModuloGastos, ocultarTarjeta, useEvaluarNovedades, useTarjetaNovedad, type Novedad } from "./novedades";

/**
 * Aviso de un módulo nuevo en el Dashboard, solo para administradores y solo si la empresa aún
 * no lo activó. Sale unos minutos cada vez que el usuario vuelve al sistema, hasta un máximo
 * de sesiones (ver novedades.ts). "Activar ahora" enciende el módulo sin pasar por
 * Configuración; "Ahora no" lo esconde el resto de la sesión.
 */
export function TarjetaNovedad() {
  useEvaluarNovedades();
  const novedad = useTarjetaNovedad();
  if (!novedad) return null;
  return <Tarjeta key={novedad.clave} novedad={novedad} />;
}

function Tarjeta({ novedad }: { novedad: Novedad }) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [activando, setActivando] = useState(false);

  const activar = async () => {
    setActivando(true);
    try {
      await activarModuloGastos(accessToken, user?.ruc);
      showToast(`${novedad.titulo} ya está activo`, "success");
      router.push(novedad.ruta);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo activar", "error");
      setActivando(false);
    }
  };

  return (
    <div className="novedad-entrada mb-3 relative overflow-hidden rounded-2xl border border-amber-300 bg-linear-to-r from-amber-100 via-amber-50 to-yellow-50 shadow-md shadow-amber-200/50">
      <style>{ANIMACIONES}</style>
      {/* Brillo que cruza la tarjeta cada pocos segundos */}
      <div aria-hidden className="novedad-brillo pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-white/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-amber-300/40 blur-2xl" />

      <button
        type="button"
        onClick={ocultarTarjeta}
        title="Ahora no"
        className="sm:hidden absolute top-2 right-2 z-10 p-1.5 rounded-lg text-amber-900/50 hover:bg-white/60 hover:text-amber-900"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0 pr-6 sm:pr-0">
          <span className="relative w-11 h-11 shrink-0">
            <span aria-hidden className="novedad-ping absolute inset-0 rounded-xl bg-amber-400 animate-ping opacity-40" />
            <span className="relative w-11 h-11 rounded-xl bg-amber-400 text-brand-blue shadow-sm flex items-center justify-center">
              <Receipt className="w-5.5 h-5.5" />
            </span>
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-black text-brand-blue">{novedad.titulo}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                <Sparkles className="novedad-destello w-3 h-3" /> Nuevo
              </span>
            </p>
            <p className="mt-0.5 text-xs text-amber-950/75 leading-relaxed">{novedad.texto}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-14.5 sm:pl-0">
          <button
            type="button"
            onClick={activar}
            disabled={activando}
            className="novedad-boton inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
          >
            {activando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
            Activar ahora
          </button>
          <button
            type="button"
            onClick={() => router.push(novedad.ruta)}
            className="group inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-brand-blue hover:bg-white/60"
          >
            Ver cómo funciona
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={ocultarTarjeta}
            className="hidden sm:inline-flex items-center rounded-lg px-2 py-2 text-xs font-medium text-amber-900/50 hover:bg-white/60 hover:text-amber-900"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

/** Animaciones de la tarjeta (con nombres propios para no chocar con otras). */
const ANIMACIONES = `
@keyframes novedad-entrada { from { opacity: 0; transform: translateY(-10px) scale(.98); } to { opacity: 1; transform: none; } }
.novedad-entrada { animation: novedad-entrada .55s cubic-bezier(.22, 1, .36, 1) both; }
@keyframes novedad-brillo { 0% { transform: translateX(0) skewX(-20deg); } 55%, 100% { transform: translateX(480%) skewX(-20deg); } }
.novedad-brillo { animation: novedad-brillo 5s ease-in-out .8s infinite; }
@keyframes novedad-boton { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, .6); } 60% { box-shadow: 0 0 0 7px rgba(245, 158, 11, 0); } }
.novedad-boton { animation: novedad-boton 2.2s ease-out infinite; }
@keyframes novedad-destello { 0%, 100% { transform: rotate(0) scale(1); } 50% { transform: rotate(18deg) scale(1.2); } }
.novedad-destello { animation: novedad-destello 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .novedad-entrada, .novedad-brillo, .novedad-boton, .novedad-destello { animation: none; }
  .novedad-ping { display: none; }
}
`;
