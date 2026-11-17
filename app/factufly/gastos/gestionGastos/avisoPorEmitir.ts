"use client";

// Cuántos ingresos programados esperan que se emita su comprobante. Lo muestran la campanita
// y el menú ("Movimientos"), y lo mantienen al día el layout (cada 5 minutos y al volver a la
// pestaña) y Movimientos (cada vez que carga o se emite / descarta uno).
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";

const INTERVALO_MS = 5 * 60 * 1000;

let cantidad = 0;
const oyentes = new Set<() => void>();

export function publicarPorEmitir(n: number) {
  const valor = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (valor === cantidad) return;
  cantidad = valor;
  oyentes.forEach((f) => f());
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
};

/** Solo lee el número (campanita). */
export function useCantidadPorEmitir() {
  return useSyncExternalStore(suscribir, () => cantidad, () => 0);
}

/**
 * Lo consulta al servidor y devuelve el número. Va una sola vez en el layout; `habilitado` es
 * false si la empresa no usa Gastos e ingresos o el usuario no es administrador (solo ellos emiten).
 */
export function useAvisoPorEmitir(habilitado: boolean) {
  const { accessToken, user } = useAuth();
  const ruc = user?.ruc ?? "";
  const n = useCantidadPorEmitir();

  useEffect(() => {
    if (!habilitado || !accessToken || !ruc) {
      publicarPorEmitir(0);
      return;
    }
    let vivo = true;
    const cargar = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/gastos/por-emitir?ruc=${encodeURIComponent(ruc)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return;
        const lista: unknown = await res.json();
        if (vivo) publicarPorEmitir(Array.isArray(lista) ? lista.length : 0);
      } catch { /* sin conexión: se queda con el último número */ }
    };
    cargar();
    const id = window.setInterval(cargar, INTERVALO_MS);
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [habilitado, accessToken, ruc]);

  return habilitado ? n : 0;
}
