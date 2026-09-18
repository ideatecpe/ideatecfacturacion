export const formatoSoles = (monto: number) => `S/ ${(Number.isFinite(monto) ? monto : 0).toFixed(2)}`;

/**
 * Desplazamiento suave con respaldo. Si el navegador no anima el scroll (ahorro de
 * energía, pestaña sin pintar), la posición no cambia y el usuario creería que el
 * botón no hace nada: a los 400 ms se salta directo al destino.
 */
export function desplazarConRespaldo(mover: (comportamiento: ScrollBehavior) => void, posicionActual: () => number) {
  const inicio = posicionActual();
  mover("smooth");
  setTimeout(() => {
    if (posicionActual() === inicio) mover("instant");
  }, 400);
}

/** Sin tildes ni mayúsculas, para que "cafe" encuentre "Café". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function formatearCelular(numero: string | null): string {
  const d = (numero ?? "").replace(/\D/g, "");
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
}

// El carrito, el pedido en curso y los datos del cliente se guardan en el
// navegador del cliente. En modo privado o con el almacenamiento bloqueado la
// tienda sigue funcionando, solo que no recuerda nada al recargar.
export function leerLocal<T>(clave: string, porDefecto: T): T {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function guardarLocal(clave: string, valor: unknown) {
  try {
    if (valor == null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento no disponible */
  }
}
