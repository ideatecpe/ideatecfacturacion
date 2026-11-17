"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Loader2, Lock, PiggyBank, Save } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { ModuloGastos } from "../gestionGastos/ModuloGastos";
import { useInicioGastos } from "../gestionGastos/useGastos";
import { IconoCategoria } from "../gestionGastos/iconosGasto";
import { BarraAvance } from "../gestionGastos/BarraAvance";
import { MESES, formatSoles, nivelPresupuesto } from "../gestionGastos/tipos";

export default function PresupuestosGastoPage() {
  return (
    <ModuloGastos>
      <Presupuestos />
    </ModuloGastos>
  );
}

function Presupuestos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const { inicio, setInicio, loading, error, api } = useInicioGastos(periodo.anio, periodo.mes);

  // Montos escritos por categoría (texto, para no pelear con el cursor al tipear).
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [copiando, setCopiando] = useState(false);

  useEffect(() => {
    if (!inicio) return;
    const m: Record<number, string> = {};
    inicio.categorias.forEach((c) => { m[c.categoriaId] = c.presupuesto ? String(c.presupuesto) : ""; });
    setMontos(m);
  }, [inicio]);

  const categorias = useMemo(
    // Se muestran las activas y las desactivadas que aún tienen gasto o presupuesto en el mes.
    () => (inicio?.categorias ?? []).filter((c) => c.tipo === "G" && (c.activa || c.gastadoMes > 0 || (c.presupuesto ?? 0) > 0)),
    [inicio],
  );

  const cambios = useMemo(
    () => categorias.some((c) => (parseFloat(montos[c.categoriaId] ?? "") || 0) !== (c.presupuesto ?? 0)),
    [categorias, montos],
  );

  const totalPresupuesto = categorias.reduce((s, c) => s + (parseFloat(montos[c.categoriaId] ?? "") || 0), 0);
  const totalGastado = categorias.reduce((s, c) => s + c.gastadoMes, 0);
  const disponible = totalPresupuesto - totalGastado;
  const avanceTotal = nivelPresupuesto(totalGastado, totalPresupuesto);

  const moverMes = (delta: number) => {
    if (cambios && !window.confirm("Tienes cambios sin guardar. ¿Cambiar de mes de todas formas?")) return;
    setPeriodo((p) => {
      const d = new Date(p.anio, p.mes - 1 + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const items = categorias.map((c) => ({
        categoriaId: c.categoriaId,
        monto: Math.max(0, Math.round((parseFloat(montos[c.categoriaId] ?? "") || 0) * 100) / 100),
      }));
      setInicio(await api.guardarPresupuestos(periodo.anio, periodo.mes, items));
      showToast("Presupuesto guardado", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar el presupuesto", "error");
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    setCopiando(true);
    try {
      const nuevo = await api.copiarPresupuestos(periodo.anio, periodo.mes);
      setInicio(nuevo);
      showToast("Se copió el presupuesto del mes anterior en las categorías vacías", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo copiar", "error");
    } finally {
      setCopiando(false);
    }
  };

  if (!esAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-600">Solo un administrador puede gestionar los presupuestos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mes y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-1">
          <button onClick={() => moverMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="min-w-36 text-center text-sm font-bold text-gray-800">
            {MESES[periodo.mes - 1]} {periodo.anio}
          </p>
          <button onClick={() => moverMes(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copiar} disabled={copiando || guardando || loading} className="text-xs">
            {copiando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Copiar del mes anterior
          </Button>
          <Button onClick={guardar} disabled={!cambios || guardando}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Resumen titulo="Presupuestado" valor={formatSoles(totalPresupuesto)} />
        <Resumen titulo="Gastado" valor={formatSoles(totalGastado)}>
          {totalPresupuesto > 0 && <BarraAvance porcentaje={avanceTotal.porcentaje} nivel={avanceTotal.nivel} />}
        </Resumen>
        <Resumen
          titulo={disponible >= 0 ? "Disponible" : "Te pasaste por"}
          valor={formatSoles(Math.abs(disponible))}
          className={disponible < 0 ? "text-rose-600" : "text-emerald-600"}
        />
      </div>

      {/* Categorías */}
      <div className="rounded-xl border border-[#E2EAF6] bg-white shadow-xs overflow-hidden">
        {error ? (
          <p className="py-10 text-center text-sm text-rose-600">{error}</p>
        ) : loading && !inicio ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : categorias.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <PiggyBank className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-600">Primero crea tus categorías de gastos.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categorias.map((c) => {
              const presupuesto = parseFloat(montos[c.categoriaId] ?? "") || 0;
              const avance = nivelPresupuesto(c.gastadoMes, presupuesto);
              const resta = presupuesto - c.gastadoMes;
              return (
                <li key={c.categoriaId} className="px-3.5 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.2fr)] gap-x-4 gap-y-2 items-center">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconoCategoria icono={c.icono} color={c.color} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.nombre}</p>
                      {!c.activa && <p className="text-[11px] text-gray-400">Desactivada</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 focus-within:border-brand-blue/50 focus-within:bg-white">
                    <span className="text-xs font-semibold text-gray-400">S/</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={montos[c.categoriaId] ?? ""}
                      onChange={(e) => setMontos((m) => ({ ...m, [c.categoriaId]: e.target.value }))}
                      placeholder="Sin límite"
                      className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-gray-600">
                        Gastado <span className="font-bold text-gray-900 tabular-nums">{formatSoles(c.gastadoMes)}</span>
                      </span>
                      {presupuesto > 0 && (
                        <span className={cn(
                          "font-semibold tabular-nums",
                          avance.nivel === "pasado" ? "text-rose-600" : avance.nivel === "alerta" ? "text-amber-600" : "text-emerald-600",
                        )}>
                          {resta >= 0 ? `Quedan ${formatSoles(resta)}` : `Pasado por ${formatSoles(-resta)}`}
                        </span>
                      )}
                    </div>
                    {presupuesto > 0 && <BarraAvance porcentaje={avance.porcentaje} nivel={avance.nivel} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Resumen({
  titulo, valor, className, children,
}: {
  titulo: string;
  valor: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs">
      <p className="text-[11px] font-semibold text-gray-500">{titulo}</p>
      <p className={cn("mt-1 text-lg font-black tabular-nums text-gray-900", className)}>{valor}</p>
      {children}
    </div>
  );
}
