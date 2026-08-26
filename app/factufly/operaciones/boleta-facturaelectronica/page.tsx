"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import BoletaPage from "../boleta/page";
import FacturaPage from "../factura/page";
import NotaVentaPage from "../nota-venta/page";
import EmisionRapidaPage from "../../emision/page";
import CajaAutopago from "../components/CajaAutopago";
import { sharedVentaStore } from "../sharedVentaStore";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useOfflineSales } from "@/app/components/offline/OfflineSalesProvider";
import { useToast } from "@/app/components/ui/Toast";
import { ControlCaja } from "@/app/components/caja/ControlCaja";

type Tipo = "boleta" | "factura" | "notaventa";

const TABS: { key: Tipo; label: string; amber?: boolean }[] = [
  { key: "boleta",     label: "Boleta"      },
  { key: "factura",    label: "Factura"     },
  { key: "notaventa",  label: "Nota de Venta", amber: true },
];

const TITULOS: Record<Tipo, string> = {
  boleta:    "Nueva Boleta de Venta",
  factura:   "Nueva Factura Electrónica",
  notaventa: "Nueva Nota de Venta",
};

const SUBTITULOS: Record<Tipo, string> = {
  boleta:    "Emisión de comprobante electrónico",
  factura:   "Emisión de comprobante electrónico",
  notaventa: "Documento de control interno · No se envía a SUNAT",
};

export default function BoletaFacturaElectronicaPage() {
  const { user } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const { isOnline } = useOfflineSales();
  const { showToast } = useToast();
  const router = useRouter();

  const [tipoManual, setTipoManual] = useState<Tipo | null>(null);
  const tipo: Tipo =
    tipoManual ?? (
      config?.isBoletaOrFactura === "f" ? "factura" :
      config?.isBoletaOrFactura === "n" ? "notaventa" :
      "boleta"
    );

  useEffect(() => {
    sharedVentaStore.clear();
    return () => { sharedVentaStore.clear(); };
  }, []);

  if (!user || loadingConfig) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isNV = tipo === "notaventa";
  const cajaAutopago = !!(config?.isStock && config?.isCajaAutopago);

  // En modo Caja Autopago, renderizamos directamente CajaAutopago sin montar
  // BoletaPage (evita descargas innecesarias de clientes, vales y sucursales).
  const contenido = cajaAutopago ? (
    <div className="flex flex-col h-full">
      <CajaAutopago />
    </div>
  ) : (
    <div className="flex flex-col h-full space-y-2">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 animate-in fade-in duration-300">
        {/* Volver + Título */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (!isOnline) {
                showToast("Sin conexión: solo Nueva Venta está disponible sin internet.", "error");
                return;
              }
              router.push("/factufly/dashboard");
            }}
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
            style={{ background: isNV ? "rgba(245,158,11,0.1)" : "rgba(15,46,100,0.08)" }}
            onMouseEnter={e => (e.currentTarget.style.background = isNV ? "rgba(245,158,11,0.2)" : "rgba(15,46,100,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = isNV ? "rgba(245,158,11,0.1)" : "rgba(15,46,100,0.08)")}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: isNV ? "#d97706" : "#0f2e64" }} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold leading-tight" style={{ color: isNV ? "#b45309" : "#0f2e64" }}>
                {TITULOS[tipo]}
              </h3>
              {isNV && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Control Interno
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{SUBTITULOS[tipo]}</p>
          </div>
        </div>

        {/* Toggle Boleta / Factura / Nota de Venta */}
        <div
          className="flex p-0.5 rounded-lg w-full sm:w-auto"
          style={{ background: "rgba(15,46,100,0.07)", border: "1px solid rgba(15,46,100,0.1)" }}
        >
          {TABS.filter(t => t.key !== "notaventa" || config?.useNotaVenta).map(({ key, label, amber }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTipoManual(key)}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
              style={tipo === key
                ? amber
                  ? { background: "#d97706", color: "white", boxShadow: "0 1px 4px rgba(217,119,6,0.3)" }
                  : { background: "#0f2e64", color: "white", boxShadow: "0 1px 4px rgba(15,46,100,0.3)" }
                : { color: "rgba(15,46,100,0.5)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1">
        {tipo === "boleta"    && <BoletaPage />}
        {tipo === "factura"   && <FacturaPage />}
        {tipo === "notaventa" && <NotaVentaPage />}
      </div>
    </div>
  );

  // Con el control de caja activo, nada del módulo de venta se monta hasta que
  // haya una caja abierta y el usuario tenga su turno iniciado.
  return config?.administraCaja ? <ControlCaja>{contenido}</ControlCaja> : contenido;
}
