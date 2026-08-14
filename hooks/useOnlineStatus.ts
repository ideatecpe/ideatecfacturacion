import { useEffect, useState } from "react";

// Evento custom que dispara una re-verificación real de conectividad en vez
// de asumir directamente que no hay internet (ver factufly/layout.tsx: un
// fetch/axios puede fallar por 401, CORS, timeout del backend o una API de
// terceros caída, sin que el usuario se haya quedado sin internet).
const EVENTO_POSIBLE_OFFLINE = "app:posible-sin-conexion";

async function hayConexionReal(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`/logofnsb.png?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Un solo request fallido no confirma que no haya internet: se verifica
    // con una petición real antes de mostrar el banner de "sin conexión".
    const handlePosibleOffline = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        return;
      }
      const conectado = await hayConexionReal();
      if (!cancelado && !conectado) setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(EVENTO_POSIBLE_OFFLINE, handlePosibleOffline);

    // Estado real al montar (captura offline de DevTools o fallos sin evento OS)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
    } else {
      hayConexionReal().then((conectado) => {
        if (!cancelado && !conectado) setIsOnline(false);
      });
    }

    return () => {
      cancelado = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(EVENTO_POSIBLE_OFFLINE, handlePosibleOffline);
    };
  }, []);

  return isOnline;
}
