"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote, Lock, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar,
  Wallet, CreditCard, Tags, ArrowDownCircle, MessageSquare, Receipt, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { soles } from "@/app/components/caja/ModalCuadrarCaja";
import type { CajaRetiro, MedioPagoResumen } from "@/hooks/useCaja";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

interface VentaCategoria {
  categoria: string;
  monto: number;
}

interface ObservacionTurno {
  nombreUsuario?: string | null;
  texto: string;
}

interface CajeroResumen {
  usuarioId: number;
  nombreUsuario?: string | null;
}

interface CorteDiario {
  fecha: string;
  sucursalId: number;
  nombreSucursal?: string | null;
  usuarioId?: number | null;
  nombreUsuario?: string | null;
  dineroInicial: number;
  ventasEfectivo: number;
  totalRetiros: number;
  efectivoEsperado: number;
  ventasTotales: number;
  cantidadComprobantes: number;
  gananciaDia?: number | null;
  otrosMediosPago: MedioPagoResumen[];
  ventasPorCategoria: VentaCategoria[];
  retiros: CajaRetiro[];
  observaciones: ObservacionTurno[];
  cajerosDelDia: CajeroResumen[];
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const sumarDias = (fechaISO: string, dias: number) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
};

const fechaLarga = (fechaISO: string) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const texto = fecha.toLocaleDateString("es-PE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const horaCorta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—";

export default function CajaPage() {
  const { user, accessToken } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();

  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;
  // El facturador solo cuadra su propio turno, no el de otros cajeros.
  const esFacturador = user?.rol === "facturador";

  const [fecha, setFecha] = useState(hoyISO());
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [corte, setCorte] = useState<CorteDiario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!sucursalId || !accessToken) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fecha });
      const filtroUsuario = esFacturador ? (user?.id ? Number(user.id) : null) : usuarioId;
      if (filtroUsuario != null) params.set("usuarioId", String(filtroUsuario));

      const res = await fetch(`${BASE_URL}/api/Caja/corte/${sucursalId}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("No se pudo cargar el corte de caja");

      setCorte(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el corte de caja");
      setCorte(null);
    } finally {
      setLoading(false);
    }
  }, [sucursalId, accessToken, fecha, usuarioId, esFacturador, user?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const otrosSinEfectivo = (corte?.otrosMediosPago ?? []).filter((m) => m.medioPago !== "Efectivo");
  const totalOtrosSinEfectivo = otrosSinEfectivo.reduce((acc, m) => acc + m.montoEsperado, 0);

  if (loadingConfig) return null;

  if (!config?.administraCaja) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">Módulo no habilitado</h3>
          <p className="text-xs text-gray-500">
            Activa &quot;Administrar apertura/cierres de caja&quot; en Empresa → Configuración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtros: fecha y cajero */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Día:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFecha((f) => sumarDias(f, -1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <label className="flex items-center gap-1.5 h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-brand-blue/50 focus-within:bg-white transition-colors cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                  className="text-xs font-semibold text-gray-700 bg-transparent outline-none cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => setFecha((f) => sumarDias(f, 1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Día siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!esFacturador && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cajero:</span>
              <select
                value={usuarioId ?? ""}
                onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 px-2.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 focus:bg-white transition-colors min-w-[170px]"
              >
                <option value="">Todos los cajeros</option>
                {corte?.cajerosDelDia.map((c) => (
                  <option key={c.usuarioId} value={c.usuarioId}>{c.nombreUsuario ?? `Usuario ${c.usuarioId}`}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <p className="text-xs font-semibold text-gray-500 whitespace-nowrap">{fechaLarga(fecha)}</p>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading && (
        <p className="text-xs text-gray-400 text-center py-12">Cargando corte de caja…</p>
      )}

      {!loading && corte && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          <Seccion titulo="Entradas de Efectivo" icono={Wallet} color="emerald">
            <Linea etiqueta="Dinero inicial en caja" valor={soles(corte.dineroInicial)} />
            <Linea etiqueta="Total" valor={soles(corte.dineroInicial)} destacado />
          </Seccion>

          <Seccion titulo="Dinero en Caja" icono={Banknote} color="blue">
            <Linea etiqueta="Ventas en efectivo" prefijo="+" valor={soles(corte.ventasEfectivo)} positivo />
            <Linea etiqueta="Dinero inicial" prefijo="+" valor={soles(corte.dineroInicial)} positivo />
            <Linea etiqueta="Retiros de caja" prefijo="−" valor={soles(corte.totalRetiros)} negativo={corte.totalRetiros > 0} />
            <Linea etiqueta="Total" valor={soles(corte.efectivoEsperado)} destacado />
          </Seccion>

          <Seccion titulo="Otros medios de pago" icono={CreditCard} color="violet">
            {otrosSinEfectivo.length === 0 && (
              <EstadoVacio texto="Sin movimientos este día." />
            )}
            {otrosSinEfectivo.map((m) => (
              <Linea key={m.medioPago} etiqueta={m.medioPago} valor={soles(m.montoEsperado)} />
            ))}
            {otrosSinEfectivo.length > 0 && (
              <Linea etiqueta="Total" valor={soles(totalOtrosSinEfectivo)} destacado />
            )}
          </Seccion>

          <Seccion titulo="Ventas por Departamento" icono={Tags} color="amber">
            {corte.ventasPorCategoria.length === 0 && (
              <EstadoVacio texto="Sin ventas este día." />
            )}
            {corte.ventasPorCategoria.map((v) => (
              <Linea key={v.categoria} etiqueta={v.categoria} valor={soles(v.monto)} />
            ))}
          </Seccion>

          <Seccion titulo="Retiro de caja" icono={ArrowDownCircle} color="rose">
            {corte.retiros.length === 0 && (
              <EstadoVacio texto="Sin retiros registrados este día." />
            )}
            {corte.retiros.map((r) => (
              <div key={r.cajaRetiroId} className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 truncate font-medium">{r.motivo}</p>
                  <p className="text-[11px] text-gray-400">{r.nombreUsuario ?? "—"} · {horaCorta(r.fechaRetiro)}</p>
                </div>
                <span className="text-xs font-bold text-rose-600 tabular-nums shrink-0">
                  −{soles(r.monto)}
                </span>
              </div>
            ))}
          </Seccion>

          <Seccion titulo="Observaciones" icono={MessageSquare} color="slate">
            {corte.observaciones.length === 0 && (
              <EstadoVacio texto="Sin observaciones registradas este día." />
            )}
            {corte.observaciones.map((o, i) => (
              <div key={i} className="py-1.5 border-b border-gray-50 last:border-0">
                <p className="text-xs text-gray-700">{o.texto}</p>
                <p className="text-[11px] text-gray-400">{o.nombreUsuario ?? "—"}</p>
              </div>
            ))}
          </Seccion>
        </div>
      )}

      {!loading && corte && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="relative overflow-hidden rounded-xl border border-[#E2EAF6] bg-white px-4 py-3 flex items-center gap-3 shadow-xs">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: "#0f2e64" }} />
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(15,46,100,0.08)" }}>
              <Receipt className="w-4.5 h-4.5" style={{ color: "#0f2e64" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ventas Totales</p>
              <p className="text-lg sm:text-xl font-bold tabular-nums truncate leading-tight" style={{ color: "#0f2e64" }}>
                {soles(corte.ventasTotales)}
              </p>
              <p className="text-[10px] text-gray-400">{corte.cantidadComprobantes} comprobante(s)</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[#E2EAF6] bg-white px-4 py-3 flex items-center gap-3 shadow-xs">
            <span className={`absolute inset-y-0 left-0 w-1 ${corte.gananciaDia != null && corte.gananciaDia < 0 ? "bg-rose-500" : "bg-emerald-500"}`} />
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${corte.gananciaDia != null && corte.gananciaDia < 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
              {corte.gananciaDia != null && corte.gananciaDia < 0
                ? <TrendingDown className="w-4.5 h-4.5 text-rose-500" />
                : <TrendingUp className="w-4.5 h-4.5 text-emerald-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ganancia del día</p>
              <p className={`text-lg sm:text-xl font-bold tabular-nums truncate leading-tight ${corte.gananciaDia == null ? "text-gray-300" : "text-emerald-600"}`}>
                {corte.gananciaDia != null ? soles(corte.gananciaDia) : "—"}
              </p>
              <p className="text-[10px] text-gray-400">Ingresos menos costo de venta</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const COLOR_ICONO: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-500",
};

function Seccion({
  titulo, icono: Icono, color, children,
}: {
  titulo: string;
  icono: LucideIcon;
  color: keyof typeof COLOR_ICONO;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2EAF6] bg-white px-4 py-3 shadow-xs hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${COLOR_ICONO[color]}`}>
          <Icono className="w-3.5 h-3.5" />
        </div>
        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{titulo}</p>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function EstadoVacio({ texto }: { texto: string }) {
  return <p className="text-xs text-gray-400 py-1.5 italic">{texto}</p>;
}

function Linea({
  etiqueta, valor, prefijo, destacado, negativo, positivo,
}: {
  etiqueta: string;
  valor: string;
  prefijo?: string;
  destacado?: boolean;
  negativo?: boolean;
  positivo?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${destacado ? "pt-1.5 mt-1 border-t border-gray-100" : "py-0.5"}`}>
      <span className={`text-xs ${destacado ? "font-bold text-gray-800" : "text-gray-500"}`}>
        {prefijo ? `${prefijo} ` : ""}{etiqueta}
      </span>
      <span
        className={`text-xs tabular-nums ${destacado ? "font-bold text-sm" : ""} ${
          negativo ? "text-rose-600 font-semibold" : positivo ? "text-emerald-600 font-medium" : "text-gray-800"
        }`}
        style={destacado ? { color: "#0f2e64" } : undefined}
      >
        {valor}
      </span>
    </div>
  );
}
