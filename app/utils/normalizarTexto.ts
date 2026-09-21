// Minúsculas + sin tildes/diéresis/otros signos diacríticos, para comparar texto
// ignorando mayúsculas y acentos (p.ej. "Alácena" y "alacena" quedan iguales).
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// True si todas las palabras de `busqueda` aparecen, en cualquier orden y como
// substrings, dentro de `campos` — ignorando mayúsculas y tildes. Así "Alacena
// Mayonesa" o "MAYONESA 250" encuentran "Mayonesa Alacena 250 g".
export function coincideBusqueda(
  busqueda: string,
  ...campos: (string | null | undefined)[]
): boolean {
  const tokens = normalizarTexto(busqueda.trim()).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const texto = normalizarTexto(campos.filter(Boolean).join(" "));
  return tokens.every((token) => texto.includes(token));
}

// Cuánto vale cada tipo de coincidencia. Buscar "bon" debe traer primero
// "Bon o Bon" (empieza igual) y recién al final "Jabones" o "Carbón", donde el
// texto aparece escondido dentro de una palabra.
const PESO_EXACTO = 1000;
const PESO_INICIO = 600;
const PESO_PALABRA = 400;
const PESO_DENTRO = 100;

const PESO_FRASE_EXACTA = 2000;
const PESO_FRASE_INICIO = 800;
const PESO_FRASE_DENTRO = 400;

/**
 * Qué tan relevante es un producto para lo que se buscó. 0 = no coincide (usa
 * el mismo criterio que `coincideBusqueda`, así que nunca esconde resultados).
 * A mayor puntaje, más arriba debe ir en la lista. Entre dos con el mismo
 * puntaje gana el de texto más corto, que suele ser el que el usuario quiere.
 */
export function puntajeBusqueda(
  busqueda: string,
  ...campos: (string | null | undefined)[]
): number {
  const frase = normalizarTexto(busqueda.trim());
  const tokens = frase.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  if (!coincideBusqueda(busqueda, ...campos)) return 0;

  const textos = campos.filter(Boolean).map((c) => normalizarTexto(c as string));
  const palabras = textos.map((t) => t.split(/[^\p{L}\p{N}]+/u).filter(Boolean));

  let total = 0;
  for (const token of tokens) {
    // Ya sabemos que el token aparece en alguna parte; buscamos el mejor lugar.
    let mejor = PESO_DENTRO;
    textos.forEach((texto, i) => {
      if (texto === token) mejor = Math.max(mejor, PESO_EXACTO);
      else if (texto.startsWith(token)) mejor = Math.max(mejor, PESO_INICIO);
      else if (palabras[i].some((p) => p.startsWith(token))) mejor = Math.max(mejor, PESO_PALABRA);
    });
    total += mejor;
  }

  // Premio extra si lo escrito aparece tal cual ("bon o bon" → "Bon o Bon Blanco").
  for (const texto of textos) {
    if (texto === frase) { total += PESO_FRASE_EXACTA; break; }
    if (texto.startsWith(frase)) { total += PESO_FRASE_INICIO; break; }
    if (texto.includes(frase)) { total += PESO_FRASE_DENTRO; break; }
  }

  const largo = Math.min(textos.reduce((n, t) => n + t.length, 0), 999);
  return total * 1000 - largo;
}
