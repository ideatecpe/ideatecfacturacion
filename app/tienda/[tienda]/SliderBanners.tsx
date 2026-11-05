"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Cada cuánto pasa a la siguiente imagen. */
const INTERVALO_MS = 5000;

interface Props {
  /** URLs de las imágenes; vacío = la imagen de siempre de la tienda. */
  imagenes: string[];
  alt: string;
}

/**
 * Banner del encabezado: con varias imágenes pasan solas (fundido + zoom suave), se pausa
 * al poner el mouse encima, incluye controles laterales y barras de progreso interactivas.
 */
export default function SliderBanners({ imagenes, alt }: Props) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = imagenes.length;
  const indice = total > 0 ? actual % total : 0;

  useEffect(() => {
    if (total < 2 || pausado) return;
    const t = setInterval(() => setActual((i) => (i + 1) % total), INTERVALO_MS);
    return () => clearInterval(t);
  }, [total, pausado, indice]);

  if (total === 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/tienda/online1.jpeg"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/tienda/online1.png";
        }}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
      />
    );
  }

  const irAnterior = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActual((i) => (i - 1 + total) % total);
  };

  const irSiguiente = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActual((i) => (i + 1) % total);
  };

  return (
    <div
      className="absolute inset-0 select-none"
      // Solo con mouse: en el celular un toque "entra" y nunca "sale", y quedaría pausado.
      onPointerEnter={(e) => e.pointerType === "mouse" && setPausado(true)}
      onPointerLeave={() => setPausado(false)}
    >
      {imagenes.map((url, i) => {
        const activa = i === indice;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={url}
            alt={activa ? alt : ""}
            aria-hidden={!activa}
            // La primera carga ya; el resto, cuando el navegador tenga tiempo.
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-out ${
              activa ? "opacity-100 scale-100 group-hover:scale-[1.03]" : "opacity-0 scale-105 pointer-events-none"
            }`}
          />
        );
      })}

      {/* Flechas laterales en escritorio al pasar el mouse */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={irAnterior}
            aria-label="Imagen anterior"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-slate-950/50 hover:bg-slate-950/80 text-white border border-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={irSiguiente}
            aria-label="Siguiente imagen"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-slate-950/50 hover:bg-slate-950/80 text-white border border-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Indicadores inferiores con barra de progreso animada */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-slate-950/50 px-2.5 py-1.5 backdrop-blur-md border border-white/15">
          {imagenes.map((_, i) => {
            const esActual = i === indice;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActual(i)}
                aria-label={`Ver imagen ${i + 1}`}
                className={`relative h-1.5 rounded-full overflow-hidden transition-all duration-300 ${
                  esActual ? "w-6 bg-white/30" : "w-1.5 bg-white/45 hover:bg-white/75"
                }`}
              >
                {esActual && (
                  <span
                    key={`${indice}-${pausado ? "p" : "r"}`}
                    className="absolute inset-y-0 left-0 bg-[var(--t-sec,#FBBF24)] rounded-full"
                    style={{
                      width: pausado ? "100%" : undefined,
                      animation: pausado ? "none" : `sliderProgress ${INTERVALO_MS}ms linear forwards`,
                    }}
                  />
                )}
              </button>
            );
          })}
          <style>{`
            @keyframes sliderProgress {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
