import { useEffect, useRef } from "react";

interface OpcionesEscaner {
  minLength?: number;
  maxGapMs?: number;
  // Permite apagar el listener sin romper la regla de hooks (siempre se llama,
  // pero no engancha el keydown). Útil cuando otra vista con su propio escáner
  // ya está montada, para evitar que ambos capturen la misma lectura.
  enabled?: boolean;
}

export function useEscanerGlobal(
  onScan: (codigo: string) => void,
  opciones?: OpcionesEscaner,
) {
  const minLength = opciones?.minLength ?? 4;
  const maxGap = opciones?.maxGapMs ?? 50;
  const enabled = opciones?.enabled ?? true;

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef("");
  const ultimaTeclaRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const el = document.activeElement as HTMLElement | null;

      if (el?.dataset?.escanerProducto === "true") {
        bufferRef.current = "";
        return;
      }

      const ahora = Date.now();
      const gap = ahora - ultimaTeclaRef.current;
      ultimaTeclaRef.current = ahora;

      if (gap > maxGap) bufferRef.current = "";

      if (e.key === "Enter") {
        const codigo = bufferRef.current;
        bufferRef.current = "";
        if (codigo.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(codigo);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (gap <= maxGap && bufferRef.current.length >= 2 && el) {
          const tag = el.tagName;
          if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
            el.blur();
          }
        }
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [maxGap, minLength, enabled]);
}
