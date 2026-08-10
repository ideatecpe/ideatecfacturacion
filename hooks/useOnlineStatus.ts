import { useEffect, useState } from "react";

export function useOnlineStatus() {
  // Arranca siempre en `true`, igual que el servidor (que no tiene forma de
  // saber el estado real de la red del cliente) — evita un mismatch de
  // hidratación. El valor real de navigator.onLine se aplica recién en el
  // efecto, que solo corre en el cliente después de hidratar.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
