import { useEffect, useState } from "react";

// Evento custom que dispara una re-verificación real de conectividad en vez
// de asumir directamente que no hay internet.
const EVENTO_POSIBLE_OFFLINE = "app:posible-sin-conexion";

async function hayConexionReal(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
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

    const verificarConexion = async () => {
      // 1. Si el navegador reporta offline directamente, marcar offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelado) setIsOnline(false);
        return false;
      }
      // 2. Probar conectividad real con ping
      const conectado = await hayConexionReal();
      if (!cancelado) {
        setIsOnline(conectado);
      }
      return conectado;
    };

    const handleOnline = () => {
      verificarConexion();
    };

    const handleOffline = () => {
      if (!cancelado) setIsOnline(false);
    };

    const handlePosibleOffline = () => {
      verificarConexion();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(EVENTO_POSIBLE_OFFLINE, handlePosibleOffline);
    window.addEventListener("focus", handleOnline);
    window.addEventListener("visibilitychange", handleOnline);
    window.addEventListener("pointerdown", handleOnline);

    // Heartbeat de auto-recuperación (revisa cada 3 segundos si volvió la red sin requerir F5)
    const intervalId = setInterval(() => {
      verificarConexion();
    }, 3000);

    // Verificación inmediata al montar
    verificarConexion();

    return () => {
      cancelado = true;
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(EVENTO_POSIBLE_OFFLINE, handlePosibleOffline);
      window.removeEventListener("focus", handleOnline);
      window.removeEventListener("visibilitychange", handleOnline);
      window.removeEventListener("pointerdown", handleOnline);
    };
  }, []);

  return isOnline;
}
