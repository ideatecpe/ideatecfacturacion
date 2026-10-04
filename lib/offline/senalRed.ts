// Señales de red compartidas entre el interceptor global de peticiones
// (app/factufly/layout.tsx) y el detector de conexión (hooks/useOnlineStatus).
//
// El detector se apoyaba solo en un ping: si el ping tardaba, asumía "sin
// internet". Eso falla justo cuando la app SÍ está usando la red de forma
// intensa (ej. subir una foto de 4 MB desde un celular), porque la subida
// satura el canal y el ping queda encolado detrás. Estas señales dan dos
// pruebas de vida que no dependen del ping.

import axios from "axios";

let peticionesEnVuelo = 0;

export function marcarPeticionIniciada() {
  peticionesEnVuelo++;
}

export function marcarPeticionTerminada() {
  peticionesEnVuelo = Math.max(0, peticionesEnVuelo - 1);
}

/** Hay tráfico de la app en curso que todavía no ha fallado: un ping lento
 *  en este momento no prueba nada, solo que el canal está ocupado. */
export function hayPeticionesEnVuelo() {
  return peticionesEnVuelo > 0;
}

/** Una petición real de la app respondió bien: prueba directa de que hay
 *  internet, más fiable que cualquier ping. */
export const EVENTO_HAY_CONEXION = "app:hay-conexion";

export function avisarConexionViva() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_HAY_CONEXION));
  }
}

/**
 * Sin red, public/sw.js responde él mismo un 504 marcado con esta cabecera (no
 * puede devolver "nada"). No vino del servidor, así que no prueba que haya
 * conexión: tomarlo como respuesta hacía que la app alternara entre "con" y
 * "sin conexión" cada pocos segundos.
 */
const CABECERA_SIN_RED = "x-factufly-sin-red";

export function esRespuestaSinRed(
  res: { headers?: unknown } | null | undefined,
): boolean {
  const headers = res?.headers as
    | { get?: (k: string) => unknown; [k: string]: unknown }
    | undefined;
  if (!headers) return false;
  const valor =
    typeof headers.get === "function" ? headers.get(CABECERA_SIN_RED) : headers[CABECERA_SIN_RED];
  return valor != null && valor !== "";
}

/**
 * ¿El fallo se debe a la red y no al servidor ni a un bug?
 *
 * Sirve para no mostrar toasts de "Error al cargar X" cuando el usuario ya está
 * viendo la franja de "Sin conexión": esos avisos no aportan nada y tapan la
 * pantalla. Se deja pasar todo lo demás (4xx/5xx, errores de validación,
 * fallos de código), que sí hay que mostrar.
 */
export function esFalloDeRed(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (axios.isAxiosError(err)) {
    // Si no hay respuesta, la petición ni siquiera llegó al servidor.
    return !err.response || esRespuestaSinRed(err.response);
  }
  // fetch lanza TypeError cuando no logra conectar.
  return err instanceof TypeError;
}
