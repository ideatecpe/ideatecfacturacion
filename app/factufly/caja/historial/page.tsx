"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Lock, Unlock, ChevronLeft, ChevronRight, Users, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { soles } from "@/app/components/caja/ModalCuadrarCaja";
import type { CajaApertura, CajaTurno } from "@/hooks/useCaja";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const PAGE_SIZE = 20;

interface CajaHistorialItem extends CajaApertura {
  cantidadTurnos: number;
  totalVentas: number;
}

interface CajaDetalle {
  caja: CajaApertura;
  turnos: CajaTurno[];
}

const fechaHora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

/** Faltante en rojo, sobrante en ámbar, cuadrada en verde. */
function Diferencia({ valor }: { valor?: number | null }) {
  if (valor == null) return <span className="text-gray-300">—</span>;

  const cuadrada = Math.abs(valor) < 0.005;
  const color = cuadrada ? "text-emerald-600" : valor < 0 ? "text-rose-600" : "text-amber-600";
  const signo = cuadrada ? "" : valor < 0 ? "−" : "+";

  return <span className={`font-semibold tabular-nums ${color}`}>{signo}{soles(Math.abs(valor))}</span>;
}

export default function CajaPage() {
  const { user, accessToken } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();

  const [items, setItems] = useState<CajaHistorialItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState("");

  const [detalle, setDetalle] = useState<CajaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async () => {
    if (!user?.ruc || !accessToken) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (desde)  params.set("desde", `${desde}T00:00:00`);
      // La fecha "hasta" es inclusiva: el backend compara contra fechaApertura.
      if (hasta)  params.set("hasta", `${hasta}T23:59:59`);
      if (estado) params.set("estado", estado);

      const res = await fetch(`${BASE_URL}/api/Caja/historial/${user.ruc}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("No se pudo cargar el historial de cajas");

      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user?.ruc, accessToken, page, desde, hasta, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cualquier cambio de filtro invalida la página en la que estabas.
  useEffect(() => { setPage(1); }, [desde, hasta, estado]);

  const verDetalle = async (cajaAperturaId: number) => {
    setCargandoDetalle(true);
    try {
      const res = await fetch(`${BASE_URL}/api/Caja/${cajaAperturaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      setDetalle(await res.json());
    } catch {
      setError("No se pudo cargar el detalle de la caja");
    } finally {
      setCargandoDetalle(false);
    }
  };

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

  if (user?.rol === "facturador") {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">No autorizado</h3>
          <p className="text-xs text-gray-500">No tienes acceso al historial de caja.</p>
        </div>
      </div>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                 className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                 className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}
                  className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50">
            <option value="">Todas</option>
            <option value="ABIERTA">Abiertas</option>
            <option value="CERRADA">Cerradas</option>
          </select>
        </label>
        {(desde || hasta || estado) && (
          <button type="button"
                  onClick={() => { setDesde(""); setHasta(""); setEstado(""); }}
                  className="h-8 px-3 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Listado */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                <th className="text-left  font-bold px-4 py-2.5">Apertura</th>
                <th className="text-left  font-bold px-4 py-2.5">Abrió</th>
                <th className="text-left  font-bold px-4 py-2.5">Cierre</th>
                <th className="text-left  font-bold px-4 py-2.5">Cerró</th>
                <th className="text-right font-bold px-4 py-2.5">Inicial</th>
                <th className="text-right font-bold px-4 py-2.5">Vendido</th>
                <th className="text-right font-bold px-4 py-2.5">Diferencia</th>
                <th className="text-center font-bold px-4 py-2.5">Turnos</th>
                <th className="text-center font-bold px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Cargando…</td></tr>
              )}

              {!loading && items.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  No hay cajas registradas con estos filtros
                </td></tr>
              )}

              {!loading && items.map((item) => (
                <tr key={item.cajaAperturaId}
                    onClick={() => verDetalle(item.cajaAperturaId)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fechaHora(item.fechaApertura)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{item.nombreUsuarioApertura ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fechaHora(item.fechaCierre)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{item.nombreUsuarioCierre ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{soles(item.montoInicial)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{soles(item.totalVentas)}</td>
                  <td className="px-4 py-2.5 text-right"><Diferencia valor={item.diferencia} /></td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{item.cantidadTurnos}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.estado === "ABIERTA"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}>
                      {item.estado === "ABIERTA"
                        ? <Unlock className="w-2.5 h-2.5" />
                        : <Lock className="w-2.5 h-2.5" />}
                      {item.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <span className="text-[11px] text-gray-400">
              {total} caja(s) · página {page} de {totalPaginas}
            </span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ModalDetalleCaja
        detalle={detalle}
        cargando={cargandoDetalle}
        onClose={() => setDetalle(null)}
      />
    </div>
  );
}

function ModalDetalleCaja({
  detalle, cargando, onClose,
}: {
  detalle: CajaDetalle | null;
  cargando: boolean;
  onClose: () => void;
}) {
  const abierto = cargando || detalle !== null;

  return (
    <Modal isOpen={abierto} onClose={onClose} title="Detalle de caja" className="max-w-3xl">
      {cargando && <p className="text-sm text-gray-400 py-8 text-center">Cargando detalle…</p>}

      {!cargando && detalle && (
        <div className="space-y-5">
          {/* Resumen de la caja */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
            <Dato titulo="Monto inicial" valor={soles(detalle.caja.montoInicial)} />
            <Dato titulo="Efectivo esperado"
                  valor={detalle.caja.efectivoEsperado != null ? soles(detalle.caja.efectivoEsperado) : "—"} />
            <Dato titulo="Efectivo contado"
                  valor={detalle.caja.efectivoContado != null ? soles(detalle.caja.efectivoContado) : "—"} />
            <Dato titulo="Diferencia" valor={<Diferencia valor={detalle.caja.diferencia} />} />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-500">
            <span>Abrió: <b className="text-gray-700">{detalle.caja.nombreUsuarioApertura ?? "—"}</b> · {fechaHora(detalle.caja.fechaApertura)}</span>
            <span>Cerró: <b className="text-gray-700">{detalle.caja.nombreUsuarioCierre ?? "—"}</b> · {fechaHora(detalle.caja.fechaCierre)}</span>
          </div>

          {detalle.caja.observaciones && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {detalle.caja.observaciones}
            </p>
          )}

          {/* Turnos */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Turnos ({detalle.turnos.length})
            </p>

            <div className="space-y-2">
              {detalle.turnos.map((turno) => (
                <div key={turno.cajaTurnoId} className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {turno.nombreUsuario ?? "Usuario"}
                        {turno.esCierreCaja && (
                          <span className="ml-2 text-[9px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full uppercase">
                            Cerró caja
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {fechaHora(turno.fechaInicio)} → {fechaHora(turno.fechaFin)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-gray-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {soles(turno.totalVentas ?? 0)}
                      </span>
                      <Diferencia valor={turno.diferencia} />
                    </div>
                  </div>

                  <div className="px-4 py-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 bg-white">
                    <Linea etiqueta="Saldo inicial" valor={soles(turno.saldoInicial)} />
                    <Linea etiqueta="Efectivo turno"
                           valor={turno.efectivoEsperado != null
                             ? soles(turno.efectivoEsperado - turno.saldoInicial)
                             : "—"} />
                    <Linea etiqueta="Efectivo esperado"
                           valor={turno.efectivoEsperado != null ? soles(turno.efectivoEsperado) : "—"} />
                    <Linea etiqueta="Efectivo contado"
                           valor={turno.efectivoContado != null ? soles(turno.efectivoContado) : "—"} />
                    {turno.medios
                      .filter((m) => m.medioPago !== "Efectivo" && m.montoEsperado > 0)
                      .map((m) => (
                        <Linea key={m.medioPago} etiqueta={m.medioPago} valor={soles(m.montoEsperado)} />
                      ))}
                  </div>

                  {turno.observaciones && (
                    <p className="px-4 pb-2.5 text-[11px] text-gray-500 bg-white">{turno.observaciones}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase">{titulo}</p>
      <p className="text-sm font-bold text-gray-800 mt-0.5 tabular-nums">{valor}</p>
    </div>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-500">{etiqueta}</span>
      <span className="text-gray-800 tabular-nums">{valor}</span>
    </div>
  );
}
