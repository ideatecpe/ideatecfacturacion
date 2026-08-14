// Señales de red compartidas entre el interceptor global de peticiones
// (app/factufly/layout.tsx) y el detector de conexión (hooks/useOnlineStatus).
//
// El detector se apoyaba solo en un ping: si el ping tardaba, asumía "sin
// internet". Eso falla justo cuando la app SÍ está usando la red de forma
// intensa (ej. subir una foto de 4 MB desde un celular), porque la subida
// satura el canal y el ping queda encolado detrás. Estas señales dan dos
// pruebas de vida que no dependen del ping.

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
