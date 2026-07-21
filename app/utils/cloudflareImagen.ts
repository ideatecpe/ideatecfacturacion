/**
 * Cambia la variante de una URL de Cloudflare Images.
 * Formato de estas URLs: https://imagedelivery.net/{hash}/{imageId}/{variante}
 *
 * Se usa para pedir una variante liviana (ej. "thumbnail") en vez de la
 * original ("public") al mostrar miniaturas en grillas, carritos o listas,
 * donde la imagen se ve en unos pocos cm y no hace falta el archivo completo.
 */
export function conVarianteImagen(url: string, variante: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("imagedelivery.net")) return url;
    const partes = u.pathname.split("/").filter(Boolean);
    if (partes.length < 2) return url;
    partes[partes.length - 1] = variante;
    u.pathname = "/" + partes.join("/");
    return u.toString();
  } catch {
    return url;
  }
}
