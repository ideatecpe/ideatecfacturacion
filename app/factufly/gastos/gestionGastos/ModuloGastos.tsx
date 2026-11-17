"use client";

import { useState } from "react";
import {
  BarChart3, Loader2, Lock, PiggyBank, Receipt, Repeat, TrendingUp, Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useToast } from "@/app/components/ui/Toast";
import { activarModuloGastos } from "@/app/components/novedades/novedades";

const FUNCIONES = [
  { icono: Receipt, titulo: "Gastos del día a día", texto: "Luz, alquiler, sueldos, insumos… por categoría y con conceptos que eliges con un clic." },
  { icono: TrendingUp, titulo: "Ingresos extra", texto: "Polladas, alquiler del local, servicios. Si te piden boleta, factura o nota de venta, la emites ahí mismo." },
  { icono: Repeat, titulo: "Programados", texto: "Lo que se repite cada mes, quincena o semana se registra solo. Hasta puede emitir su comprobante." },
  { icono: Wallet, titulo: "Conectado a tu caja", texto: "Lo que sale o entra del efectivo del turno se considera solo al cuadrar la caja." },
  { icono: PiggyBank, titulo: "Presupuestos", texto: "Define cuánto piensas gastar por categoría y ve a tiempo si te estás pasando." },
  { icono: BarChart3, titulo: "Resumen del mes", texto: "Ventas + otros ingresos − gastos: cuánto te quedó realmente, comparado con el mes anterior." },
];

/**
 * Si la empresa no tiene activado Gastos e ingresos, muestra la presentación del módulo: el
 * administrador lo activa ahí mismo; el resto ve que debe pedírselo.
 */
export function ModuloGastos({ children }: { children: React.ReactNode }) {
  const { config, loading } = useConfiguracion();

  if (loading && !config) return null;
  if (!config?.usaGastos) return <PresentacionGastos />;
  return <>{children}</>;
}

function PresentacionGastos() {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();
  const [activando, setActivando] = useState(false);
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";

  const activar = async () => {
    setActivando(true);
    try {
      await activarModuloGastos(accessToken, user?.ruc);
      showToast("Gastos e ingresos ya está activo", "success");
      // La página se vuelve el módulo en cuanto llega la configuración nueva.
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo activar", "error");
      setActivando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-4">
      <div className="rounded-2xl border border-[#E2EAF6] bg-white px-5 py-6 sm:px-8 sm:py-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
            <Receipt className="w-7 h-7" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xl font-black text-gray-900">
              Gastos e ingresos
            </p>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              Anota todo lo que gasta y lo que entra a tu negocio fuera de las ventas, en soles, y mira cuánto te quedó
              realmente cada mes.
            </p>
          </div>
          <div className="shrink-0">
            {esAdmin ? (
              <button
                type="button"
                onClick={activar}
                disabled={activando}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {activando && <Loader2 className="w-4 h-4 animate-spin" />}
                Activar ahora
              </button>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-gray-500 max-w-52">
                <Lock className="w-4 h-4 shrink-0 text-gray-400" />
                Pídele al administrador que lo active.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FUNCIONES.map(({ icono: Icono, titulo, texto }) => (
          <div key={titulo} className="rounded-xl border border-[#E2EAF6] bg-white px-4 py-3.5 shadow-xs">
            <span className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
              <Icono className="w-4 h-4" />
            </span>
            <p className="mt-2 text-sm font-semibold text-gray-800">{titulo}</p>
            <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{texto}</p>
          </div>
        ))}
      </div>

      {esAdmin && (
        <p className="text-center text-[11px] text-gray-400">
          Es opcional: puedes desactivarlo cuando quieras en Configuración → Empresa.
        </p>
      )}
    </div>
  );
}
