"use client";

import { createContext, useContext } from "react";

/**
 * Cuando Boleta, Factura o Nota de venta se muestran dentro de otro módulo (por ejemplo,
 * para facturar un ingreso desde "Gastos e ingresos"), siempre usan el formulario clásico:
 * aunque la empresa trabaje con Caja Autopago, no se reemplazan por la caja.
 */
const EmisionEmbebidaContext = createContext(false);

export function EmisionEmbebida({ children }: { children: React.ReactNode }) {
  return <EmisionEmbebidaContext.Provider value={true}>{children}</EmisionEmbebidaContext.Provider>;
}

export const useEmisionEmbebida = () => useContext(EmisionEmbebidaContext);
