"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import BoletaPage from "../boleta/page";
import FacturaPage from "../factura/page";
import EmisionRapidaPage from "../../emision/page";
import { sharedVentaStore } from "../sharedVentaStore";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";

export default function BoletaFacturaElectronicaPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const router = useRouter();
  // MODO SIMPLE — oculto temporalmente, descomentar cuando se requiera
  // const [complejidad, setComplejidad] = useState<"simple" | "compleja">("compleja");

  // Tipo: si el usuario lo cambió manualmente usa ese, sino el de configuración
  const [tipoManual, setTipoManual] = useState<"boleta" | "factura" | null>(null);
  const tipo: "boleta" | "factura" =
    tipoManual ?? (config?.isBoletaOrFactura === "f" ? "factura" : "boleta");
  const setTipo = setTipoManual;

  useEffect(() => {
    sharedVentaStore.clear();
    return () => { sharedVentaStore.clear(); };
  }, []);

  // Esperar a que carguen usuario y configuración antes de renderizar
  if (!user || loadingConfig) return null;

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 animate-in fade-in duration-300">
        {/* Fila 1: Volver + Título */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/factufly/operaciones")}
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
            style={{ background: "rgba(15,46,100,0.08)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(15,46,100,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(15,46,100,0.08)")}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: "#0f2e64" }} />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold leading-tight" style={{ color: "#0f2e64" }}>
              {tipo === "boleta" ? "Nueva Boleta de Venta" : "Nueva Factura Electrónica"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Emisión de comprobante electrónico</p>
          </div>
        </div>

        {/* Fila 2 en móvil / misma fila en desktop: Toggle Boleta / Factura */}
        <div
          className="flex p-0.5 rounded-lg w-full sm:w-auto"
          style={{ background: "rgba(15,46,100,0.07)", border: "1px solid rgba(15,46,100,0.1)" }}
        >
          {(["boleta", "factura"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
              style={tipo === t
                ? { background: "#0f2e64", color: "white", boxShadow: "0 1px 4px rgba(15,46,100,0.3)" }
                : { color: "rgba(15,46,100,0.5)" }
              }
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1">
        {tipo === "boleta" ? <BoletaPage /> : <FacturaPage />}
      </div>
    </div>
  );
}
