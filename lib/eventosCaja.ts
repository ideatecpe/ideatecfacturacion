/**
 * Aviso de "se registró una venta" para que el saldo en caja que muestra la
 * barra de Nueva Venta se actualice sin recargar la pantalla.
 *
 * Va en su propio módulo (y no dentro de useCaja) para que las funciones de
 * emisión, que son módulos sueltos sin React, puedan dispararlo sin arrastrar
 * hooks ni provocar imports circulares.
 */
const cajaEmitter = new EventTarget();

const EVENTO_VENTA = "venta-registrada";

/** Se llama después de que el comprobante quedó guardado en la base. */
export function notificarVentaRegistrada() {
  cajaEmitter.dispatchEvent(new Event(EVENTO_VENTA));
}

/** Devuelve la función para desuscribirse, pensada para el cleanup de useEffect. */
export function suscribirVentaRegistrada(callback: () => void) {
  cajaEmitter.addEventListener(EVENTO_VENTA, callback);
  return () => cajaEmitter.removeEventListener(EVENTO_VENTA, callback);
}
