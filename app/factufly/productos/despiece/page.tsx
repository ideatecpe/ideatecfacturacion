"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Scissors,
  Settings2,
  ShoppingCart,
  Undo2,
} from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosSucursal } from "../gestioProductos/useProductosSucursal";
import { abreviaturaUnidad } from "../gestioProductos/unidadMedida";
import { Despiece, RecetaDespiece, cantidadTexto, mismaUnidad, porcentajeTexto, soles } from "./despiece";
import { useDespiece } from "./useDespiece";
import ModalConfigurarDespiece from "./ModalConfigurarDespiece";
import ModalDespiezar from "./ModalDespiezar";

const COLORES = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500"];

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const haceDiasIso = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function DespiecePage() {
  const { user } = useAuth();
  const { config, loading: cargandoConfig } = useConfiguracion();
  const { showToast } = useToast();
  const isSuperAdmin = user?.rol === "superadmin";
  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;
  const habilitado = !!config?.isStock && !isSuperAdmin && !!sucursalId;

  const { productosSucursal, fetchProductosSucursal } = useProductosSucursal(null, habilitado);
  const despiece = useDespiece(sucursalId, habilitado);
  const { recetas, cargando, cargado, error } = despiece;

  const [config_, setConfig_] = useState<{ abierto: boolean; productoBaseId: number | null }>({ abierto: false, productoBaseId: null });
  const [despiezarId, setDespiezarId] = useState<number | null>(null);

  // ── Historial ──
  const [desde, setDesde] = useState(haceDiasIso(30));
  const [hasta, setHasta] = useState(hoyIso());
  const [historial, setHistorial] = useState<Despiece[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [aDeshacer, setADeshacer] = useState<Despiece | null>(null);
  const [deshaciendo, setDeshaciendo] = useState(false);

  const { historial: pedirHistorial, deshacer } = despiece;
  const cargarHistorial = useCallback(async () => {
    if (!habilitado) return;
    setCargandoHistorial(true);
    try {
      setHistorial(await pedirHistorial({ desde, hasta }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo cargar el historial", "error");
    } finally {
      setCargandoHistorial(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado, pedirHistorial, desde, hasta]);

  useEffect(() => {
    void cargarHistorial();
  }, [cargarHistorial]);

  const recetaConfig = config_.productoBaseId != null ? recetas.find((r) => r.productoBaseId === config_.productoBaseId) ?? null : null;
  const recetaDespiezar = despiezarId != null ? recetas.find((r) => r.productoBaseId === despiezarId) ?? null : null;

  // Merma real promedio de los despieces del periodo, por producto.
  const mermaReal = useMemo(() => {
    const acumulado = new Map<number, { merma: number; total: number; veces: number }>();
    for (const d of historial) {
      if (d.estado !== "VIGENTE" || d.cantidadMerma == null || d.automatico) continue;
      const a = acumulado.get(d.productoBaseId) ?? { merma: 0, total: 0, veces: 0 };
      a.merma += d.cantidadMerma;
      a.total += d.cantidad;
      a.veces += 1;
      acumulado.set(d.productoBaseId, a);
    }
    return acumulado;
  }, [historial]);

  const confirmarDeshacer = async () => {
    if (!aDeshacer) return;
    setDeshaciendo(true);
    try {
      await deshacer(aDeshacer);
      showToast("Despiece deshecho: el stock volvió como estaba", "success");
      setADeshacer(null);
      void cargarHistorial();
      void fetchProductosSucursal();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo deshacer", "error");
    } finally {
      setDeshaciendo(false);
    }
  };

  if (cargandoConfig) return null;

  if (!habilitado) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-gray-100 rounded-full p-4 mb-3">
          <Lock className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 font-semibold text-sm">El despiece no está disponible</p>
        <p className="text-gray-400 text-xs mt-1">
          {isSuperAdmin
            ? "Ingresa con un usuario de la sucursal para despiezar."
            : "Tu empresa no tiene activada la gestión de stock/inventario."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-brand-blue" /> Despiece
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Para lo que compras entero (pollo, res, cerdo…) y vendes por partes. Al despiezar sale stock del entero y entra a cada parte con su costo real; lo que se bota queda como merma.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfig_({ abierto: true, productoBaseId: null })}
          className="h-9 px-3.5 rounded-md bg-brand-blue text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0a2050]"
        >
          <Plus className="w-3.5 h-3.5" /> Configurar producto
        </button>
      </div>

      {/* Productos que se despiezan */}
      {error && (
        <p className="flex items-center gap-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {!cargado && cargando ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-gray-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : recetas.length === 0 ? (
        <EstadoVacio onConfigurar={() => setConfig_({ abierto: true, productoBaseId: null })} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recetas.map((r) => (
            <TarjetaReceta
              key={r.productoBaseId}
              receta={r}
              mermaReal={mermaReal.get(r.productoBaseId) ?? null}
              onDespiezar={() => setDespiezarId(r.productoBaseId)}
              onConfigurar={() => setConfig_({ abierto: true, productoBaseId: r.productoBaseId })}
            />
          ))}
        </div>
      )}

      {/* Historial */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mr-auto">
            <History className="w-4 h-4 text-gray-400" /> Despieces hechos
          </h3>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays className="w-3.5 h-3.5" /> Del
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="h-8 px-2 rounded-md border border-gray-200 text-xs text-gray-700"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            al
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
              className="h-8 px-2 rounded-md border border-gray-200 text-xs text-gray-700"
            />
          </label>
          <button
            type="button"
            onClick={() => void cargarHistorial()}
            className="h-8 w-8 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-brand-blue"
            aria-label="Actualizar historial"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargandoHistorial ? "animate-spin" : ""}`} />
          </button>
        </div>

        {historial.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-gray-400">
            {cargandoHistorial ? "Cargando…" : "No hay despieces en estas fechas."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="w-8" />
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-left">Producto</th>
                  <th className="px-2 py-2 text-right">Despiezado</th>
                  <th className="px-2 py-2 text-left">Salió</th>
                  <th className="px-2 py-2 text-right">Merma</th>
                  <th className="px-2 py-2 text-right">Costo</th>
                  <th className="px-2 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historial.map((d) => {
                  const u = abreviaturaUnidad(d.unidadMedida);
                  const deshecho = d.estado === "DESHECHO";
                  const abierto = expandido === d.despieceId;
                  return (
                    <FilaHistorial
                      key={d.despieceId}
                      d={d}
                      u={u}
                      deshecho={deshecho}
                      abierto={abierto}
                      onToggle={() => setExpandido(abierto ? null : d.despieceId)}
                      onDeshacer={() => setADeshacer(d)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModalConfigurarDespiece
        isOpen={config_.abierto}
        onClose={() => setConfig_((c) => ({ ...c, abierto: false }))}
        receta={recetaConfig}
        productos={productosSucursal}
        recetas={recetas}
        guardarReceta={despiece.guardarReceta}
        eliminarReceta={despiece.eliminarReceta}
        onGuardado={(r, nuevas) => {
          showToast(
            nuevas > 0
              ? `Despiece guardado. Se ${nuevas === 1 ? "creó 1 producto nuevo" : `crearon ${nuevas} productos nuevos`}.`
              : "Despiece guardado",
            "success",
          );
          if (nuevas > 0) void fetchProductosSucursal();
          // Recién configurado: se ofrece despiezar de una vez si hay stock.
          if (!recetaConfig && r.stock > 0) setDespiezarId(r.productoBaseId);
        }}
        onEliminado={() => showToast("El producto ya no se despieza", "success")}
      />

      <ModalDespiezar
        isOpen={despiezarId != null}
        onClose={() => setDespiezarId(null)}
        receta={recetaDespiezar}
        despiezar={despiece.despiezar}
        onDespiezado={() => {
          void cargarHistorial();
          void fetchProductosSucursal();
        }}
        onConfigurar={() => {
          const id = despiezarId;
          setDespiezarId(null);
          setConfig_({ abierto: true, productoBaseId: id });
        }}
      />

      <Modal isOpen={!!aDeshacer} onClose={deshaciendo ? () => {} : () => setADeshacer(null)} title="Deshacer despiece" className="max-w-md">
        {aDeshacer && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Vuelven <strong>{cantidadTexto(aDeshacer.cantidad)} {abreviaturaUnidad(aDeshacer.unidadMedida)}</strong> a{" "}
              <strong>{aDeshacer.nomProducto}</strong> y se retira de las partes lo que entró:
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              {aDeshacer.partes.map((p) => (
                <li key={p.productoId} className="flex justify-between">
                  <span>{p.nomProducto}</span>
                  <span className="tabular-nums font-semibold text-rose-600">
                    −{cantidadTexto(p.cantidad)} {abreviaturaUnidad(p.unidadMedida)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400">Los precios que cambió este despiece vuelven a como estaban, salvo que los hayas cambiado después.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setADeshacer(null)}
                disabled={deshaciendo}
                className="h-9 px-4 rounded-md border border-gray-200 text-xs font-semibold text-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarDeshacer}
                disabled={deshaciendo}
                className="h-9 px-4 rounded-md bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-700 disabled:opacity-50"
              >
                {deshaciendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                Deshacer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EstadoVacio({ onConfigurar }: { onConfigurar: () => void }) {
  const pasos = [
    { t: "Elige lo que compras entero", d: "Por ejemplo «Pollo entero», por kilo. Sus compras siguen entrando por Compras." },
    { t: "Dile en qué partes lo despiezas", d: "Carne, menudencia… y cuánto sale normalmente de cada una. Si no existen, se crean solas." },
    { t: "Cada vez que despieces, pesa", d: "Indicas los kilos, corriges lo que salió y listo: stock, costos y precios quedan al día." },
  ];
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-brand-blue/10 flex items-center justify-center">
        <Scissors className="w-7 h-7 text-brand-blue" />
      </div>
      <p className="mt-3 text-base font-bold text-gray-900">Todavía no despiezas ningún producto</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3 text-left max-w-3xl mx-auto">
        {pasos.map((p, i) => (
          <div key={p.t} className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[11px] flex items-center justify-center">{i + 1}</span>
              {p.t}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">{p.d}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onConfigurar}
        className="mt-6 h-10 px-5 rounded-md bg-brand-blue text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#0a2050]"
      >
        <Plus className="w-4 h-4" /> Configurar mi primer producto
      </button>
    </div>
  );
}

function TarjetaReceta({
  receta,
  mermaReal,
  onDespiezar,
  onConfigurar,
}: {
  receta: RecetaDespiece;
  mermaReal: { merma: number; total: number; veces: number } | null;
  onDespiezar: () => void;
  onConfigurar: () => void;
}) {
  const unidad = abreviaturaUnidad(receta.unidadMedida);
  const enPorcentaje = receta.partes.every((p) => mismaUnidad(p.unidadMedida, receta.unidadMedida));
  const mermaNormal = enPorcentaje ? Math.max(0, 100 - receta.partes.reduce((s, p) => s + p.rendimiento * 100, 0)) : null;
  const mermaPromedio = mermaReal && mermaReal.total > 0 ? (mermaReal.merma / mermaReal.total) * 100 : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-brand-blue/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{receta.nomProducto}</p>
          {receta.despieceAlVender && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <ShoppingCart className="w-3 h-3" /> Se corta a pedido al vender
            </span>
          )}
          <p className="text-xs text-gray-500 tabular-nums">
            Stock <strong className={receta.stock > 0 ? "text-gray-800" : "text-rose-600"}>{cantidadTexto(receta.stock)} {unidad}</strong>
            {receta.costoUnitario != null && <> · costo {soles(receta.costoUnitario)} el {unidad}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={onConfigurar}
          className="shrink-0 flex items-center gap-1 h-7 px-2 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:text-brand-blue hover:border-brand-blue/40"
          aria-label="Configurar partes"
          title="Configurar partes"
        >
          <Settings2 className="w-3.5 h-3.5" /> Configurar
        </button>
      </div>

      {enPorcentaje && (
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
          {receta.partes.map((p, i) => (
            <div key={p.productoId} className={COLORES[i % COLORES.length]} style={{ width: `${p.rendimiento * 100}%` }} />
          ))}
          {mermaNormal != null && mermaNormal > 0 && <div className="bg-gray-300" style={{ width: `${mermaNormal}%` }} />}
        </div>
      )}

      <ul className="mt-2.5 space-y-1 flex-1">
        {receta.partes.map((p, i) => (
          <li key={p.productoId} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full shrink-0 ${p.disponible ? COLORES[i % COLORES.length] : "bg-gray-300"}`} />
            <span className={`flex-1 min-w-0 truncate ${p.disponible ? "text-gray-700" : "text-gray-400 line-through"}`}>{p.nomProducto}</span>
            <span className="text-gray-400 tabular-nums">
              {enPorcentaje ? `${cantidadTexto(p.rendimiento * 100)} %` : `${cantidadTexto(p.rendimiento)} ${abreviaturaUnidad(p.unidadMedida)}/${unidad}`}
            </span>
            <span className="w-16 text-right font-semibold text-gray-700 tabular-nums">{soles(p.precioUnitario)}</span>
          </li>
        ))}
        {mermaNormal != null && (
          <li className="flex items-center gap-2 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full shrink-0 bg-gray-300" />
            <span className="flex-1">Merma</span>
            <span className="tabular-nums">{cantidadTexto(mermaNormal)} %</span>
            <span className="w-16" />
          </li>
        )}
      </ul>

      {mermaPromedio != null && mermaNormal != null && (
        <p
          className={`mt-2 text-[11px] rounded-md px-2 py-1 ${mermaPromedio > mermaNormal + 3 ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-500"}`}
        >
          Merma real en los últimos despieces: <strong>{porcentajeTexto(mermaPromedio)}</strong> ({mermaReal!.veces}{" "}
          {mermaReal!.veces === 1 ? "vez" : "veces"})
        </p>
      )}

      <button
        type="button"
        onClick={onDespiezar}
        disabled={receta.stock <= 0}
        title={receta.stock <= 0 ? "No hay stock: registra la compra en Compras" : undefined}
        className="mt-3 h-10 rounded-md bg-brand-blue text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#0a2050] disabled:bg-gray-200 disabled:text-gray-500"
      >
        <Scissors className="w-4 h-4" /> {receta.stock > 0 ? "Despiezar" : "Sin stock para despiezar"}
      </button>
    </div>
  );
}

function FilaHistorial({
  d,
  u,
  deshecho,
  abierto,
  onToggle,
  onDeshacer,
}: {
  d: Despiece;
  u: string;
  deshecho: boolean;
  abierto: boolean;
  onToggle: () => void;
  onDeshacer: () => void;
}) {
  return (
    <>
      <tr className={`${deshecho ? "text-gray-400" : "text-gray-700"} hover:bg-gray-50/60 cursor-pointer`} onClick={onToggle}>
        <td className="pl-3 py-2.5 text-gray-400">
          {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </td>
        <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-xs">{fechaHora(d.fecha)}</td>
        <td className="px-2 py-2.5">
          <span className={`font-medium ${deshecho ? "line-through" : "text-gray-900"}`}>{d.nomProducto}</span>
          {deshecho && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Deshecho</span>
          )}
          {d.automatico && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
              title="Lo hizo el sistema al vender, con lo que sale normalmente"
            >
              <ShoppingCart className="w-3 h-3" /> Al vender
            </span>
          )}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">
          {cantidadTexto(d.cantidad)} {u}
        </td>
        <td className="px-2 py-2.5 text-xs">
          {d.partes.map((p) => `${p.nomProducto} ${cantidadTexto(p.cantidad)} ${abreviaturaUnidad(p.unidadMedida)}`).join(" · ")}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-xs whitespace-nowrap">
          {d.cantidadMerma != null ? (
            <>
              {cantidadTexto(d.cantidadMerma)} {u}{" "}
              <span className="text-gray-400">({porcentajeTexto(d.porcentajeMerma ?? 0)})</span>
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-xs whitespace-nowrap">{soles(d.costoTotal)}</td>
        <td className="px-2 py-2.5 text-xs">{d.usuario ?? "—"}</td>
        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
          {!deshecho && (
            <button
              type="button"
              onClick={onDeshacer}
              disabled={!d.sePuedeDeshacer}
              title={d.sePuedeDeshacer ? "Deshacer este despiece" : d.motivoNoDeshacer ?? undefined}
              className="h-7 px-2.5 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 inline-flex items-center gap-1 hover:border-rose-300 hover:text-rose-600 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600"
            >
              <Undo2 className="w-3 h-3" /> Deshacer
            </button>
          )}
        </td>
      </tr>
      {abierto && (
        <tr className="bg-gray-50/60">
          <td />
          <td colSpan={8} className="px-2 pb-3 pt-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400">
                  <th className="py-1 text-left font-semibold">Parte</th>
                  <th className="py-1 text-right font-semibold">Normal</th>
                  <th className="py-1 text-right font-semibold">Salió</th>
                  <th className="py-1 text-right font-semibold">Costo</th>
                  <th className="py-1 text-right font-semibold">Precio</th>
                  <th className="py-1 text-right font-semibold">Ya vendido</th>
                </tr>
              </thead>
              <tbody>
                {d.partes.map((p) => {
                  const pu = abreviaturaUnidad(p.unidadMedida);
                  const diferencia = p.cantidadEsperada != null ? p.cantidad - p.cantidadEsperada : null;
                  return (
                    <tr key={p.productoId} className="text-gray-600">
                      <td className="py-1">{p.nomProducto}</td>
                      <td className="py-1 text-right tabular-nums">
                        {p.cantidadEsperada != null ? `${cantidadTexto(p.cantidadEsperada)} ${pu}` : "—"}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {cantidadTexto(p.cantidad)} {pu}
                        {diferencia != null && Math.abs(diferencia) >= 0.001 && (
                          <span className={`ml-1 ${diferencia < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            ({diferencia > 0 ? "+" : ""}
                            {cantidadTexto(diferencia)})
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {soles(p.costoUnitario)} el {pu}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {p.precioNuevo != null ? `${soles(p.precioAnterior ?? 0)} → ${soles(p.precioNuevo)}` : "sin cambio"}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {deshecho ? "—" : `${cantidadTexto(p.cantidadVendida)} ${pu}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!deshecho && !d.sePuedeDeshacer && d.motivoNoDeshacer && (
              <p className="mt-2 text-[11px] text-gray-500">Ya no se puede deshacer: {d.motivoNoDeshacer}</p>
            )}
            {deshecho && d.fechaAnulacion && <p className="mt-2 text-[11px] text-gray-500">Deshecho el {fechaHora(d.fechaAnulacion)}.</p>}
          </td>
        </tr>
      )}
    </>
  );
}
