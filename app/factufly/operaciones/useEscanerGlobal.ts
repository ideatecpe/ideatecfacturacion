import { useEffect, useRef } from "react";

interface OpcionesEscaner {
  minLength?: number;
  maxGapMs?: number;
}

/**
 * Escucha globalmente el lector de código de barras en la pantalla de emisión.
 *
 * Solo se desactiva cuando el foco está en un TEXTAREA de búsqueda de producto
 * (marcado con data-escaner-producto), ya que ahí el textarea maneja el escaneo
 * por sí mismo. Para cualquier otro campo (checkbox, input de precio, cantidad,
 * select, etc.) el escáner global sigue activo.
 */
export function useEscanerGlobal(
  onScan: (codigo: string) => void,
  opciones?: OpcionesEscaner,
) {
  const minLength = opciones?.minLength ?? 4;
  const maxGap = opciones?.maxGapMs ?? 50;

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef("");
  const ultimaTeclaRef = useRef(0);

  useEffect(() => {
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
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [maxGap, minLength]);
}
