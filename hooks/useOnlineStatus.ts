import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // 1. Estado inicial de navigator.onLine
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 2. Comprobar inmediatamente al montar si la red responde (para capturar F5 en DevTools offline o fallos sin evento OS)
    const testConnectivity = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`/logofnsb.png?_t=${Date.now()}`, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok && res.status === 0) {
          setIsOnline(false);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setIsOnline(false);
        }
      }
    };

    testConnectivity();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
