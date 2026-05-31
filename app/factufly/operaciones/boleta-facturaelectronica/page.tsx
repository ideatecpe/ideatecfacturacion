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
      {/* Cabecera — mismo grid que el contenido (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
        {/* Col izquierda: volver + título (ocupa 2/3) */}
        <div className="lg:col-span-2 flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/factufly/operaciones")}
            className="h-8 w-8 p-0 rounded-xl bg-gray-200 hover:bg-gray-300 shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {tipo === "boleta" ? "Nueva Boleta de Venta" : "Nueva Factura Electrónica"}
            </h3>
            <p className="text-sm text-gray-500">Regresar a selección de comprobante</p>
          </div>
        </div>

        {/* Col derecha: toggle alineado con Vista Previa (ocupa 1/3) */}




<div className="flex w-full bg-gray-100 rounded-2xl p-1 gap-0.5">
  <button
    type="button"
    onClick={() => setTipo("boleta")}
    className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
      tipo === "boleta"
        ? "bg-brand-blue text-white shadow-md"
        : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
    }`}
  >
    Boleta
  </button>
  <button
    type="button"
    onClick={() => setTipo("factura")}
    className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
      tipo === "factura"
        ? "bg-brand-blue text-white shadow-md"
        : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
    }`}
  >
    Factura
  </button>
</div>


      </div>

      {/* Contenido */}
      <div className="flex-1">
        {/* MODO SIMPLE — oculto temporalmente
        {complejidad === "simple" ? (
          <EmisionRapidaPage tipoExterno={tipo} />
        ) : tipo === "boleta" ? (
          <BoletaPage />
        ) : (
          <FacturaPage />
        )}
        */}
        {tipo === "boleta" ? <BoletaPage /> : <FacturaPage />}
      </div>
    </div>
  );
}
