import { useEffect, useState } from "react";
import {
  EVENTO_HAY_CONEXION,
  hayPeticionesEnVuelo,
} from "@/lib/offline/senalRed";

// Evento custom que dispara una re-verificación real de conectividad en vez
// de asumir directamente que no hay internet.
const EVENTO_POSIBLE_OFFLINE = "app:posible-sin-conexion";

// Una red lenta (2G/3G, señal débil, celular en movimiento) NO es una red
// caída: el ping necesita margen de sobra para responder antes de darlo por
// perdido. Con un timeout corto, cualquier red lenta se veía como "sin
// internet" y expulsaba al usuario de la pantalla en la que estaba.
const PING_TIMEOUT_MS = 15000;
// Nunca se declara "sin conexión" por un solo ping fallido: hacen falta
// varios seguidos para descartar un bache puntual de una conexión lenta.
const FALLOS_PARA_OFFLINE = 3;
// Heartbeat suave mientras hay conexión, y agresivo solo cuando creemos que
// se cayó (para recuperar rápido sin saturar una red ya congestionada).
// Nota: una red realmente caída hace que el fetch falle en milisegundos (DNS /
// conexión rechazada), así que los 3 fallos se acumulan en segundos; el
// timeout largo solo cuesta tiempo en el caso ambiguo de red lenta.
const INTERVALO_ONLINE_MS = 20000;
const INTERVALO_OFFLINE_MS = 3000;

async function pingOk(timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    // Ping liviano sin caché al favicon
    const res = await fetch(`/favicon-16x16.png?_ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let cancelado = false;
    // Evita pings solapados: en una red lenta el anterior sigue en vuelo y
    // encolar más peticiones solo empeora la congestión.
    let verificando = false;
    let fallosSeguidos = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Mientras haya fallos acumulados asumimos red en problemas: se sondea
    // más seguido para volver a "online" en cuanto la red responda.
    const creemosOffline = () => fallosSeguidos > 0;

    const verificarConexion = async () => {
      if (cancelado || verificando) return;

      // El navegador reporta que no hay red: es una señal fiable de corte real.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        fallosSeguidos = FALLOS_PARA_OFFLINE;
        setIsOnline(false);
        return;
      }

      verificando = true;
      const ok = await pingOk(PING_TIMEOUT_MS);
      verificando = false;
      if (cancelado) return;

      if (ok) {
        fallosSeguidos = 0;
        setIsOnline(true);
        return;
      }

      // El ping falló, pero hay peticiones de la app todavía en curso (ej.
      // subiendo una foto de varios MB desde un celular): el canal está
      // ocupado, no caído. No cuenta como fallo — era justo el caso que
      // expulsaba al usuario a media subida.
      if (hayPeticionesEnVuelo()) return;

      // Falló el ping: solo se declara "sin conexión" tras varios fallos
      // consecutivos, para no sacar al usuario de su pantalla por lentitud.
      fallosSeguidos++;
      if (fallosSeguidos >= FALLOS_PARA_OFFLINE) setIsOnline(false);
    };

    const programarSiguiente = () => {
      if (cancelado) return;
      const delay = creemosOffline() ? INTERVALO_OFFLINE_MS : INTERVALO_ONLINE_MS;
      timeoutId = setTimeout(async () => {
        await verificarConexion();
        programarSiguiente();
      }, delay);
    };

    const handleOnline = () => {
      verificarConexion();
    };

    const handleOffline = () => {
      // Evento nativo del navegador: la interfaz de red se cayó de verdad.
      if (cancelado) return;
      fallosSeguidos = FALLOS_PARA_OFFLINE;
      setIsOnline(false);
    };

    const handlePosibleOffline = () => {
      verificarConexion();
    };

    // Una petición real de la app respondió: es prueba directa de que hay
    // internet, mejor que cualquier ping. Se limpia el contador de fallos.
    const handleHayConexion = () => {
      if (cancelado) return;
      fallosSeguidos = 0;
      setIsOnline(true);
    };

    // Al interactuar solo revalidamos si creemos estar caídos; hacerlo en cada
    // toque con red sana disparaba un ping por click y saturaba la conexión.
    const handlePointerDown = () => {
      if (creemosOffline()) verificarConexion();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(EVENTO_POSIBLE_OFFLINE, handlePosibleOffline);
    window.addEventListener(EVENTO_HAY_CONEXION, handleHayConexion);
    window.addEventListener("focus", handleOnline);
    window.addEventListener("visibilitychange", handleOnline);
    window.addEventListener("pointerdown", handlePointerDown);

    // Verificación inmediata al montar + heartbeat de auto-recuperación
    verificarConexion();
    programarSiguiente();

    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(EVENTO_POSIBLE_OFFLINE, handlePosibleOffline);
      window.removeEventListener(EVENTO_HAY_CONEXION, handleHayConexion);
      window.removeEventListener("focus", handleOnline);
      window.removeEventListener("visibilitychange", handleOnline);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return isOnline;
}
