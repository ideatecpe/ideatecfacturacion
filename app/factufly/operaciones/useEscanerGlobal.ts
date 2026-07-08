import { useEffect, useRef } from "react";

interface OpcionesEscaner {
  /** Longitud mínima del código para considerarlo un escaneo válido. */
  minLength?: number;
  /** Máximo de milisegundos entre teclas para tratarlas como una ráfaga del escáner. */
  maxGapMs?: number;
}

/**
 * Escucha globalmente el lector de código de barras en la pantalla de emisión.
 *
 * Un lector actúa como "teclado" que emite los caracteres del código muy rápido
 * (mucho más que un humano) y termina con Enter. Detectamos esa ráfaga por el
 * tiempo entre teclas y, al recibir el Enter final, resolvemos el código con
 * `onScan` — sin importar dónde esté el foco.
 *
 * Si el foco está en un campo editable (input/textarea/select), NO interferimos:
 * el usuario está escribiendo manualmente y ese caso lo maneja el propio campo.
 * El Enter de un escaneo válido se cancela (preventDefault) para que no active
 * botones ni envíe formularios.
 */
export function useEscanerGlobal(
  onScan: (codigo: string) => void,
  opciones?: OpcionesEscaner,
) {
  const minLength = opciones?.minLength ?? 4;
  const maxGap = opciones?.maxGapMs ?? 50;

  // Se actualiza en cada render para que el listener use siempre la última versión.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef("");
  const ultimaTeclaRef = useRef(0);

  useEffect(() => {
    const esEditable = (el: Element | null): boolean => {
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el as HTMLElement).isContentEditable
      );
    };

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Escribiendo en un campo: dejar el manejo normal.
      if (esEditable(document.activeElement)) {
        bufferRef.current = "";
        return;
      }

      const ahora = Date.now();
      const gap = ahora - ultimaTeclaRef.current;
      ultimaTeclaRef.current = ahora;

      // Tecla lenta = nueva ráfaga (o tecleo humano suelto).
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
