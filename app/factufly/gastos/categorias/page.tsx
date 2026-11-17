"use client";

import { useState } from "react";
import { Loader2, Lock, Pencil, Plus, Power, Tags } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { ModalCategoriaGasto } from "@/app/components/modalGastos/ModalCategoriaGasto";
import { ModuloGastos } from "../gestionGastos/ModuloGastos";
import { useInicioGastos } from "../gestionGastos/useGastos";
import { IconoCategoria } from "../gestionGastos/iconosGasto";
import { BarraAvance } from "../gestionGastos/BarraAvance";
import { SelectorTipo, useTipoMovimiento } from "../gestionGastos/SelectorTipo";
import { MESES, formatSoles, nivelPresupuesto, type CategoriaGasto } from "../gestionGastos/tipos";

export default function CategoriasGastoPage() {
  return (
    <ModuloGastos>
      <Categorias />
    </ModuloGastos>
  );
}

function Categorias() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";
  const hoy = new Date();
  const { inicio, loading, error, recargar, api } = useInicioGastos(hoy.getFullYear(), hoy.getMonth() + 1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<CategoriaGasto | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const [tipo, setTipo] = useTipoMovimiento();

  if (!esAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-600">Solo un administrador puede gestionar las categorías.</p>
        </div>
      </div>
    );
  }

  const guardar = async (
    datos: { nombre: string; color: string; icono: string; conceptos: string[]; activa: boolean },
    id: number | null,
  ) => {
    if (id) await api.editarCategoria(id, datos);
    else await api.crearCategoria({ ...datos, tipo });
    showToast(id ? "Categoría actualizada" : "Categoría creada", "success");
    recargar();
  };

  const alternar = async (c: CategoriaGasto) => {
    setCambiando(c.categoriaId);
    try {
      await api.editarCategoria(c.categoriaId, {
        nombre: c.nombre, color: c.color, icono: c.icono ?? "tag", conceptos: c.conceptos, activa: !c.activa,
      });
      showToast(c.activa ? "Categoría desactivada" : "Categoría activada", "success");
      await recargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo cambiar la categoría", "error");
    } finally {
      setCambiando(null);
    }
  };

  const delTipo = inicio?.categorias.filter((c) => c.tipo === tipo) ?? [];
  const activas = delTipo.filter((c) => c.activa);
  const inactivas = delTipo.filter((c) => !c.activa);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <SelectorTipo tipo={tipo} onChange={setTipo} />
          <div>
            <p className="text-sm font-semibold text-gray-800">{tipo === "I" ? "Categorías de ingresos" : "Categorías de gastos"}</p>
            <p className="text-xs text-gray-400">
              Lo {tipo === "I" ? "ingresado" : "gastado"} corresponde a {MESES[hoy.getMonth()].toLowerCase()} {hoy.getFullYear()}.
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditando(null); setModalAbierto(true); }}>
          <Plus className="w-4 h-4" /> Nueva categoría
        </Button>
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-rose-600">{error}</p>
      ) : loading && !inicio ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {activas.map((c) => (
              <TarjetaCategoria key={c.categoriaId} c={c} cambiando={cambiando === c.categoriaId}
                onEditar={() => { setEditando(c); setModalAbierto(true); }} onAlternar={() => alternar(c)} />
            ))}
          </div>
          {activas.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Tags className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-600">No hay categorías activas.</p>
            </div>
          )}

          {inactivas.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase text-gray-400">Desactivadas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {inactivas.map((c) => (
                  <TarjetaCategoria key={c.categoriaId} c={c} cambiando={cambiando === c.categoriaId}
                    onEditar={() => { setEditando(c); setModalAbierto(true); }} onAlternar={() => alternar(c)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ModalCategoriaGasto
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        categoria={editando}
        onGuardar={guardar}
      />
    </div>
  );
}

function TarjetaCategoria({
  c, cambiando, onEditar, onAlternar,
}: {
  c: CategoriaGasto;
  cambiando: boolean;
  onEditar: () => void;
  onAlternar: () => void;
}) {
  const avance = nivelPresupuesto(c.gastadoMes, c.presupuesto);
  return (
    <div className={cn("rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs", !c.activa && "opacity-60")}>
      <div className="flex items-center gap-3">
        <IconoCategoria icono={c.icono} color={c.color} tamano="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{c.nombre}</p>
          <p className="text-xs text-gray-400">
            {c.cantidadMes} {c.tipo === "I" ? "ingreso" : "gasto"}{c.cantidadMes === 1 ? "" : "s"} este mes
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onEditar} title="Editar" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onAlternar}
            disabled={cambiando}
            title={c.activa ? "Desactivar" : "Activar"}
            className={cn(
              "p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50",
              c.activa ? "text-emerald-600" : "text-gray-400",
            )}
          >
            {cambiando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="text-base font-black tabular-nums text-gray-900">{formatSoles(c.gastadoMes)}</span>
        <span className="text-[11px] text-gray-400">
          {c.tipo === "I" ? "" : c.presupuesto ? `de ${formatSoles(c.presupuesto)}` : "Sin presupuesto"}
        </span>
      </div>
      {c.presupuesto ? <BarraAvance porcentaje={avance.porcentaje} nivel={avance.nivel} /> : null}
      {c.conceptos.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400 truncate" title={c.conceptos.join(", ")}>
          {c.conceptos.join(" · ")}
        </p>
      )}
    </div>
  );
}
