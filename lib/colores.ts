/**
 * Colores de marca de la tienda online: validación de hexadecimales, contraste y
 * los tonos que se derivan de los dos colores que elige cada negocio.
 */

/** Colores originales de FactuFly (los que se usan si el negocio no elige otros). */
export const COLORES_TIENDA_ORIGINALES = {
  primario: "#0B1F49",
  secundario: "#FBBF24",
  fondo: "#F8FAFC",
  tarjeta: "#FFFFFF",
  qr: "#000000",
  qrFondo: "#FFFFFF",
} as const;

/** "#abc", "abc123", "#ABC123" → "#ABC123". null si no es un color válido. */
export function normalizarHex(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let hex = valor.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) hex = hex.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function aRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Mezcla `hex` con `con` en la proporción `peso` (0 = hex, 1 = con). */
export function mezclar(hex: string, con: string, peso: number): string {
  const a = aRgb(hex);
  const b = aRgb(con);
  return aHex([a[0] + (b[0] - a[0]) * peso, a[1] + (b[1] - a[1]) * peso, a[2] + (b[2] - a[2]) * peso]);
}

/** Luminancia relativa WCAG (0 = negro, 1 = blanco). */
export function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Texto que se lee mejor encima de `fondo`: blanco o casi negro. */
export function textoSobre(fondo: string): string {
  return contraste(fondo, "#FFFFFF") >= contraste(fondo, "#0F172A") ? "#FFFFFF" : "#0F172A";
}

/**
 * Variables CSS del tema de la tienda. Combina los 4 colores (primario, secundario,
 * fondo general y tarjetas) y deriva contrastes, bordes y hovers automáticos.
 */
export function variablesTemaTienda(
  primario?: string | null,
  secundario?: string | null,
  fondo?: string | null,
  tarjeta?: string | null,
): Record<string, string> {
  const pri = normalizarHex(primario) ?? COLORES_TIENDA_ORIGINALES.primario;
  const sec = normalizarHex(secundario) ?? COLORES_TIENDA_ORIGINALES.secundario;
  const fon = normalizarHex(fondo) ?? COLORES_TIENDA_ORIGINALES.fondo;
  const tar = normalizarHex(tarjeta) ?? COLORES_TIENDA_ORIGINALES.tarjeta;

  const priEsOscuro = luminancia(pri) < 0.35;
  const fonEsOscuro = luminancia(fon) < 0.35;
  const tarEsOscuro = luminancia(tar) < 0.35;

  return {
    "--t-pri": pri,
    // Sobre un color oscuro, el hover y las superficies se aclaran; sobre uno claro, se oscurecen.
    "--t-pri-hover": priEsOscuro ? mezclar(pri, "#FFFFFF", 0.1) : mezclar(pri, "#000000", 0.1),
    "--t-pri-claro": priEsOscuro ? mezclar(pri, "#FFFFFF", 0.12) : mezclar(pri, "#000000", 0.08),
    "--t-pri-oscuro": mezclar(pri, "#000000", 0.45),
    "--t-sobre-pri": textoSobre(pri),

    "--t-sec": sec,
    "--t-sobre-sec": textoSobre(sec),

    // Fondo general de la tienda
    "--t-fondo": fon,
    "--t-sobre-fondo": textoSobre(fon),
    "--t-fondo-sutil": fonEsOscuro ? mezclar(fon, "#FFFFFF", 0.06) : mezclar(fon, "#000000", 0.04),

    // Tarjetas de productos y combos
    "--t-tarjeta": tar,
    "--t-sobre-tarjeta": textoSobre(tar),
    "--t-tarjeta-borde": tarEsOscuro ? mezclar(tar, "#FFFFFF", 0.12) : mezclar(tar, "#000000", 0.08),
    "--t-tarjeta-footer": tarEsOscuro ? mezclar(tar, "#FFFFFF", 0.06) : mezclar(tar, "#000000", 0.03),
  };
}
