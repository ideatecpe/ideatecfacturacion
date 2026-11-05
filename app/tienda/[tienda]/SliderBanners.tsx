"use client";

import { useEffect, useState } from "react";

/** Cada cuánto pasa a la siguiente imagen. */
const INTERVALO_MS = 5000;

interface Props {
  /** URLs de las imágenes; vacío = la imagen de siempre de la tienda. */
  imagenes: string[];
  alt: string;
}

/**
 * Banner del encabezado: con varias imágenes pasan solas (fundido), se pausa al poner
 * el mouse encima y los puntos permiten saltar a una. Con una sola, queda fija.
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
  }, [total, pausado]);

  if (total === 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/tienda/online1.jpeg"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/tienda/online1.png";
        }}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      />
    );
  }

  return (
    <div
      className="absolute inset-0"
      // Solo con mouse: en el celular un toque "entra" y nunca "sale", y quedaría pausado.
      onPointerEnter={(e) => e.pointerType === "mouse" && setPausado(true)}
      onPointerLeave={() => setPausado(false)}
    >
      {imagenes.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${i}`}
          src={url}
          alt={i === indice ? alt : ""}
          aria-hidden={i !== indice}
          // La primera carga ya; el resto, cuando el navegador tenga tiempo.
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === indice ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {total > 1 && (
        <div className="absolute top-3 right-3 z-10 flex gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-sm">
          {imagenes.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Ver imagen ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === indice ? "w-4 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
