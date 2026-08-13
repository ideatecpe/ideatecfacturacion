// Minúsculas + sin tildes/diéresis/otros signos diacríticos, para comparar texto
// ignorando mayúsculas y acentos (p.ej. "Alácena" y "alacena" quedan iguales).
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
