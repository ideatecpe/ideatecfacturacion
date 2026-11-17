"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Equal, Loader2, Lock, Minus, Plus,
  ShoppingCart, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { ModuloGastos } from "../gestionGastos/ModuloGastos";
import { useApiGastos } from "../gestionGastos/useGastos";
import { MESES, formatSoles, type ResumenGasto, type ResumenMes } from "../gestionGastos/tipos";

export default function ResumenMesPage() {
  return (
    <ModuloGastos>
      <Resumen />
    </ModuloGastos>
  );
}

/** Variación contra el mes anterior en %, o null si el mes anterior fue 0. */
const variacion = (actual: number, anterior: number) =>
  anterior === 0 ? null : ((actual - anterior) / Math.abs(anterior)) * 100;

function Resumen() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";
  const api = useApiGastos();
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [datos, setDatos] = useState<ResumenMes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { listo, getResumen } = api;

  const cargar = useCallback(async () => {
    if (!listo || !esAdmin) return;
    setLoading(true);
    setError(null);
    try {
      setDatos(await getResumen(periodo.anio, periodo.mes));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
    // getResumen se recrea en cada render; lo que importa es el periodo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, esAdmin, periodo.anio, periodo.mes]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!esAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-600">Solo un administrador puede ver el resumen del mes.</p>
        </div>
      </div>
    );
  }

  const moverMes = (delta: number) =>
    setPeriodo((p) => {
      const d = new Date(p.anio, p.mes - 1 + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  const esMesActual = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1;

  const a = datos?.actual;
  const b = datos?.anterior;
  const mesAnterior = MESES[(periodo.mes + 10) % 12].toLowerCase();

  return (
    <div className="space-y-3">
      {/* Mes */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-1">
          <button onClick={() => moverMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="min-w-36 text-center text-sm font-bold text-gray-800">{MESES[periodo.mes - 1]} {periodo.anio}</p>
          <button
            onClick={() => moverMes(1)}
            disabled={esMesActual}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400">Ventas + otros ingresos − gastos. Comparado con {mesAnterior}.</p>
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-rose-600">{error}</p>
      ) : loading && !datos ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : a && b ? (
        <>
          {/* Resultado */}
          <div className={cn(
            "rounded-2xl border px-5 py-4 shadow-xs",
            a.resultado >= 0 ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60",
          )}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500">
                  {a.resultado >= 0 ? "Te quedó en el mes" : "Gastaste más de lo que ingresó"}
                </p>
                <p className={cn("text-3xl font-black tabular-nums", a.resultado >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {a.resultado < 0 ? "− " : ""}{formatSoles(Math.abs(a.resultado))}
                </p>
              </div>
              <Comparacion actual={a.resultado} anterior={b.resultado} mayorEsMejor etiqueta={mesAnterior} />
            </div>
            {/* La cuenta, a la vista */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
              <span className="font-semibold text-gray-800 tabular-nums">{formatSoles(a.ventas)}</span> ventas
              <Plus className="w-3 h-3 text-gray-400" />
              <span className="font-semibold text-gray-800 tabular-nums">{formatSoles(a.otrosIngresos)}</span> otros ingresos
              <Minus className="w-3 h-3 text-gray-400" />
              <span className="font-semibold text-gray-800 tabular-nums">{formatSoles(a.gastos)}</span> gastos
              <Equal className="w-3 h-3 text-gray-400" />
              <span className={cn("font-bold tabular-nums", a.resultado >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {a.resultado < 0 ? "− " : ""}{formatSoles(Math.abs(a.resultado))}
              </span>
            </div>
          </div>

          {/* Las tres partes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Bloque
              icono={ShoppingCart}
              color="text-brand-blue bg-brand-blue/10"
              titulo="Ventas"
              valor={a.ventas}
              anterior={b.ventas}
              mayorEsMejor
              detalle={`${a.cantidadComprobantes} comprobante${a.cantidadComprobantes === 1 ? "" : "s"}`}
              etiquetaAnterior={mesAnterior}
            >
              <Linea texto="Facturas y boletas" valor={a.ventasComprobantes} />
              {a.notasVenta > 0 && <Linea texto="Notas de venta" valor={a.notasVenta} />}
              {a.notasCredito > 0 && <Linea texto="Notas de crédito" valor={-a.notasCredito} />}
              {a.notasDebito > 0 && <Linea texto="Notas de débito" valor={a.notasDebito} />}
              {a.ingresosFacturados > 0 && (
                <>
                  <Linea texto="Ingresos con comprobante" valor={-a.ingresosFacturados} />
                  <p className="pt-1 text-[11px] text-gray-400">
                    Sus comprobantes se cuentan en Otros ingresos, donde los registraste, para no sumarlos dos veces.
                  </p>
                </>
              )}
            </Bloque>
            <Bloque
              icono={TrendingUp}
              color="text-emerald-600 bg-emerald-50"
              titulo="Otros ingresos"
              valor={a.otrosIngresos}
              anterior={b.otrosIngresos}
              mayorEsMejor
              detalle={`${a.cantidadOtrosIngresos} ingreso${a.cantidadOtrosIngresos === 1 ? "" : "s"}`
                + (a.cantidadIngresosFacturados > 0 ? ` · ${a.cantidadIngresosFacturados} con comprobante` : "")}
              etiquetaAnterior={mesAnterior}
            >
              <Categorias items={datos!.ingresosPorCategoria} vacio="Sin ingresos extra este mes." />
              {a.ingresosFacturados > 0 && (
                <p className="pt-1 text-[11px] text-gray-400">
                  Incluye {formatSoles(a.ingresosFacturados)} con comprobante emitido.
                </p>
              )}
            </Bloque>
            <Bloque
              icono={TrendingDown}
              color="text-rose-600 bg-rose-50"
              titulo="Gastos"
              valor={a.gastos}
              anterior={b.gastos}
              detalle={`${a.cantidadGastos} gasto${a.cantidadGastos === 1 ? "" : "s"}`}
              etiquetaAnterior={mesAnterior}
            >
              <Categorias items={datos!.gastosPorCategoria} vacio="Sin gastos este mes." />
            </Bloque>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Comparacion({
  actual, anterior, mayorEsMejor, etiqueta,
}: {
  actual: number;
  anterior: number;
  mayorEsMejor?: boolean;
  etiqueta: string;
}) {
  const v = variacion(actual, anterior);
  if (v === null || !Number.isFinite(v)) {
    return <p className="text-[11px] text-gray-400">{etiqueta}: {formatSoles(anterior)}</p>;
  }
  const sube = v >= 0;
  const bueno = mayorEsMejor ? sube : !sube;
  const Icono = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
      bueno ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
    )}>
      <Icono className="w-3 h-3" />
      {Math.abs(v).toFixed(0)}% vs {etiqueta}
    </span>
  );
}

function Bloque({
  icono: Icono, color, titulo, valor, anterior, mayorEsMejor, detalle, etiquetaAnterior, children,
}: {
  icono: React.ComponentType<{ className?: string }>;
  color: string;
  titulo: string;
  valor: number;
  anterior: number;
  mayorEsMejor?: boolean;
  detalle: string;
  etiquetaAnterior: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", color)}>
            <Icono className="w-4 h-4" />
          </span>
          <p className="text-[11px] font-semibold text-gray-500">{titulo}</p>
        </div>
        <Comparacion actual={valor} anterior={anterior} mayorEsMejor={mayorEsMejor} etiqueta={etiquetaAnterior} />
      </div>
      <div>
        <p className="text-xl font-black tabular-nums text-gray-900">{formatSoles(valor)}</p>
        <p className="text-[11px] text-gray-400">{detalle}</p>
      </div>
      <div className="border-t border-gray-100 pt-2 space-y-1">{children}</div>
    </div>
  );
}

function Linea({ texto, valor }: { texto: string; valor: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{texto}</span>
      <span className={cn("font-semibold tabular-nums", valor < 0 ? "text-rose-600" : "text-gray-800")}>
        {valor < 0 ? "− " : ""}{formatSoles(Math.abs(valor))}
      </span>
    </div>
  );
}

function Categorias({ items, vacio }: { items: ResumenGasto[]; vacio: string }) {
  if (items.length === 0) return <p className="text-xs text-gray-400 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{vacio}</p>;
  const max = Math.max(...items.map((i) => i.total));
  return (
    <div className="space-y-1.5">
      {items.slice(0, 6).map((i) => (
        <div key={i.clave}>
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-gray-600">{i.nombre}</span>
            <span className="font-semibold tabular-nums text-gray-800">{formatSoles(i.total)}</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(i.total / max) * 100}%`, backgroundColor: i.color ?? "#0F2E64" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
