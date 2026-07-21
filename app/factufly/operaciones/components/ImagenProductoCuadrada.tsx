"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";

interface ImagenProductoCuadradaProps {
  url?: string | null;
  alt: string;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
};

const ICON_SIZE: Record<"sm" | "md", string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
};

export default function ImagenProductoCuadrada({
  url,
  alt,
  size = "md",
  className = "",
}: ImagenProductoCuadradaProps) {
  // Intenta primero la variante liviana "thumbnail"; si no existe todavía en
  // Cloudflare (404), cae a la imagen original en vez de mostrar "sin imagen".
  const [intento, setIntento] = useState<"thumbnail" | "original" | "error">("thumbnail");

  useEffect(() => {
    setIntento("thumbnail");
  }, [url]);

  const mostrarImagen = !!url && intento !== "error";

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center ${className}`}
    >
      {mostrarImagen ? (
        <img
          src={intento === "thumbnail" ? conVarianteImagen(url as string, "thumbnail") : (url as string)}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setIntento((prev) => (prev === "thumbnail" ? "original" : "error"))}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <ImageOff className={`${ICON_SIZE[size]} text-gray-300`} />
        </div>
      )}
    </div>
  );
}
