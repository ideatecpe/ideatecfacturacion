"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ShoppingCart } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Red de seguridad: si una sola pantalla se cae (ej. "Comprobantes" intentando
// cargar datos sin internet), esto evita que se caiga TODA la app incluido el
// menú lateral — sin esto, en la PWA instalada (sin barra de direcciones ni
// botón de retroceso) el usuario queda completamente atascado, sin forma de
// volver a Nueva Venta.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("ErrorBoundary capturó un error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-full min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Esta sección no pudo cargar
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Puede deberse a que no hay conexión a internet en este momento.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/factufly/operaciones/boleta-facturaelectronica";
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-blue text-white text-sm font-semibold py-2.5 hover:bg-blue-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Volver a Nueva Venta
            </button>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
