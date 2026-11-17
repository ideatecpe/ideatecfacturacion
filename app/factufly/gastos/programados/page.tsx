"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileCheck, Loader2, Lock, Pause, Pencil, Play, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { ModalGasto } from "@/app/components/modalGastos/ModalGasto";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { useSucursalRuc } from "../../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { ModuloGastos } from "../gestionGastos/ModuloGastos";
import { useInicioGastos } from "../gestionGastos/useGastos";
import { IconoCategoria } from "../gestionGastos/iconosGasto";
import { SelectorTipo, useTipoMovimiento } from "../gestionGastos/SelectorTipo";
import {
  formatFechaCorta, formatSoles, nombreComprobante, type GuardarProgramado, type Programado, type ResultadoProgramado,
} from "../gestionGastos/tipos";

export default function ProgramadosPage() {
  return (
    <ModuloGastos>
      <Programados />
    </ModuloGastos>
  );
}

function Programados() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";
  const esSuperAdmin = user?.rol === "superadmin";
  const hoy = new Date();
  const [tipo, setTipo] = useTipoMovimiento();
  const { inicio, api } = useInicioGastos(hoy.getFullYear(), hoy.getMonth() + 1);
  const { sucursales: todas } = useSucursalRuc(esSuperAdmin);
  const sucursales = useMemo(() => todas.filter((s) => s.estado !== false), [todas]);

  const [lista, setLista] = useState<Programado[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Programado | null>(null);
  const [eliminando, setEliminando] = useState<Programado | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const { listo, listarProgramados } = api;

  const cargar = useCallback(async () => {
    if (!listo || !esAdmin) return;
    setLoading(true);
    setError(null);
    try {
      setLista(await listarProgramados(tipo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los programados");
    } finally {
      setLoading(false);
    }
    // listarProgramados se recrea en cada render; lo que importa es el tipo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, esAdmin, tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!esAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-600">Solo un administrador puede programar gastos e ingresos.</p>
        </div>
      </div>
    );
  }

  const avisar = (r: ResultadoProgramado, accion: string) => {
    const siguiente = r.proximaFecha ? ` Próximo: ${formatFechaCorta(r.proximaFecha)}.` : "";
    const hoyRegistrado = r.registrados > 0
      ? ` ${r.registrados === 1 ? "1 fecha ya tocaba" : `${r.registrados} fechas ya tocaban`}: lo ves en Movimientos.`
      : "";
    showToast(`${accion}.${hoyRegistrado}${siguiente}`, "success");
  };

  const guardar = async (datos: GuardarProgramado, id: number | null) => {
    const r = id ? await api.editarProgramado(id, datos) : await api.crearProgramado(datos);
    avisar(r, id ? "Programación actualizada" : "Programado");
    cargar();
  };

  const alternar = async (p: Programado) => {
    setCambiando(p.programadoId);
    try {
      const r = p.activo ? await api.pausarProgramado(p.programadoId) : await api.reanudarProgramado(p.programadoId);
      if (p.activo) showToast("Programación en pausa: no se registrará hasta que la reanudes", "success");
      else avisar(r, "Programación reanudada");
      await cargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo cambiar la programación", "error");
    } finally {
      setCambiando(null);
    }
  };

  const eliminar = async () => {
    if (!eliminando) return;
    try {
      await api.eliminarProgramado(eliminando.programadoId);
      showToast("Programación eliminada. Lo ya registrado se mantiene.", "success");
      setEliminando(null);
      cargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  const activos = lista?.filter((p) => p.activo && p.proximaFecha) ?? [];
  const totalMensual = activos.reduce((s, p) => s + p.monto * vecesAlMes(p), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <SelectorTipo tipo={tipo} onChange={setTipo} />
          <div>
            <p className="text-sm font-semibold text-gray-800">{tipo === "I" ? "Ingresos programados" : "Gastos programados"}</p>
            <p className="text-xs text-gray-400">
              Se registran solos en cada fecha
              {activos.length > 0 && <> · aprox. <b className="text-gray-600">{formatSoles(totalMensual)}</b> al mes</>}
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditando(null); setModalAbierto(true); }} disabled={!inicio}>
          <Plus className="w-4 h-4" /> {tipo === "I" ? "Programar ingreso" : "Programar gasto"}
        </Button>
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-rose-600">{error}</p>
      ) : loading && !lista ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : !lista || lista.length === 0 ? (
        <div className="rounded-xl border border-[#E2EAF6] bg-white py-16 text-center space-y-2 shadow-xs">
          <Repeat className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-700">
            {tipo === "I" ? "Aún no tienes ingresos programados" : "Aún no tienes gastos programados"}
          </p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {tipo === "I"
              ? "Programa los ingresos que se repiten y se registrarán solos."
              : "Programa lo que pagas siempre (internet, alquiler, sueldos…) y se registrará solo cada mes."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {lista.map((p) => {
            const terminado = !p.proximaFecha;
            return (
              <div
                key={p.programadoId}
                className={cn("rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs", (!p.activo || terminado) && "opacity-70")}
              >
                <div className="flex items-start gap-3">
                  <IconoCategoria icono={p.categoriaIcono} color={p.categoriaColor} tamano="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.descripcion}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {[p.categoriaNombre, p.medioPago, esSuperAdmin && sucursales.length > 1 ? p.sucursalNombre ?? "Toda la empresa" : null]
                            .filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className={cn("text-base font-black tabular-nums shrink-0", p.tipo === "I" ? "text-emerald-700" : "text-gray-900")}>
                        {p.tipo === "I" ? "+ " : ""}{formatSoles(p.monto)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/8 px-2 py-0.5 font-semibold text-brand-blue">
                        <Repeat className="w-3 h-3" /> {p.regla}
                      </span>
                      {p.tipoComprobante && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                            p.emisionAutomatica ? "bg-brand-blue/10 text-brand-blue" : "bg-sky-50 text-sky-700",
                          )}
                          title={p.clienteRazonSocial ?? undefined}
                        >
                          {p.emisionAutomatica ? <Zap className="w-3 h-3" /> : <FileCheck className="w-3 h-3" />}
                          {nombreComprobante(p.tipoComprobante)} · {p.emisionAutomatica ? "se emite sola" : "te avisa para emitir"}
                        </span>
                      )}
                      {terminado ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500">Terminado</span>
                      ) : !p.activo ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">En pausa</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          <CalendarClock className="w-3 h-3" /> Próximo: {formatFechaCorta(p.proximaFecha!)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      {p.cantidadGenerados > 0
                        ? `${p.cantidadGenerados} registrado${p.cantidadGenerados === 1 ? "" : "s"} · último ${formatFechaCorta(p.ultimaFecha!)}`
                        : "Aún no se registró ninguno"}
                      {p.fechaFin ? ` · hasta ${formatFechaCorta(p.fechaFin)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-gray-100 pt-2">
                  {!terminado && (
                    <button
                      onClick={() => alternar(p)}
                      disabled={cambiando === p.programadoId}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {cambiando === p.programadoId
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : p.activo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {p.activo ? "Pausar" : "Reanudar"}
                    </button>
                  )}
                  <button
                    onClick={() => { setEditando(p); setModalAbierto(true); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => setEliminando(p)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalGasto
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        tipo={editando?.tipo ?? tipo}
        categorias={inicio?.categorias ?? []}
        gasto={null}
        programado={editando}
        iniciarRepitiendo
        esAdmin={esAdmin}
        esSuperAdmin={esSuperAdmin}
        cajaTurnoAbiertoId={null}
        sucursales={sucursales}
        onGuardar={async () => {}}
        onProgramar={guardar}
      />
      <ModalEliminar
        isOpen={!!eliminando}
        onClose={() => setEliminando(null)}
        onConfirm={eliminar}
        mensaje="Dejará de registrarse sola. Lo que ya se registró se mantiene en Movimientos. Vas a eliminar la programación"
        nombre={eliminando?.descripcion ?? ""}
        documento={eliminando?.regla}
      />
    </div>
  );
}

/** Cuántas veces se registra al mes, para el total aproximado. */
function vecesAlMes(p: Programado) {
  if (p.frecuencia === "QUINCENAL") return 2;
  if (p.frecuencia === "SEMANAL") return 52 / 12;
  return 1;
}
