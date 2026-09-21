"use client";

import { useId } from "react";
import { QRCodeSVG } from "qrcode.react";
import { COLORES_TIENDA_ORIGINALES } from "@/lib/colores";

export interface ColoresQr {
  color: string | null;
  /** Con valor, los módulos van en degradado de `color` a `color2`. */
  color2: string | null;
  fondo: string | null;
}

/**
 * QR con los colores del negocio. El degradado va en un <defs> dentro del MISMO
 * <svg>, así al descargarlo como imagen o imprimirlo (se serializa ese svg) el
 * degradado viaja con él.
 */
export function QrPersonalizado({ valor, tamano, colores }: { valor: string; tamano: number; colores: ColoresQr }) {
  const idDegradado = `degradado-qr-${useId().replace(/:/g, "")}`;
  const color = colores.color ?? COLORES_TIENDA_ORIGINALES.qr;
  const fondo = colores.fondo ?? COLORES_TIENDA_ORIGINALES.qrFondo;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={tamano}
      height={tamano}
      viewBox={`0 0 ${tamano} ${tamano}`}
      data-fondo={fondo}
    >
      {colores.color2 && (
        <defs>
          <linearGradient id={idDegradado} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={colores.color2} />
          </linearGradient>
        </defs>
      )}
      <QRCodeSVG
        value={valor}
        size={tamano}
        level="M"
        bgColor={fondo}
        fgColor={colores.color2 ? `url(#${idDegradado})` : color}
      />
    </svg>
  );
}
