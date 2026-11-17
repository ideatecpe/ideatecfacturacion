"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type {
  FiltrosGastos, GuardarGasto, GuardarProgramado, InicioGastos, ListaGastos, PorEmitir, Programado, ResultadoProgramado,
  ResumenMes, TipoMovimiento,
} from "./tipos";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function mensajeDeError(res: Response, porDefecto: string) {
  try {
    const data = await res.json();
    return data?.mensaje || porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Llamadas al API de gastos con el token del usuario. Lanzan Error con el mensaje del backend. */
export function useApiGastos() {
  const { accessToken, user } = useAuth();
  const ruc = user?.ruc ?? "";

  const pedir = useCallback(
    async <T,>(ruta: string, init: RequestInit = {}, porDefecto = "No se pudo completar la operación"): Promise<T> => {
      const sep = ruta.includes("?") ? "&" : "?";
      const res = await fetch(`${BASE_URL}/api/gastos${ruta}${sep}ruc=${encodeURIComponent(ruc)}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(await mensajeDeError(res, porDefecto));
      return res.json() as Promise<T>;
    },
    [accessToken, ruc],
  );

  const listo = !!accessToken && !!ruc;

  return {
    listo,
    pedir,
    getInicio: (anio: number, mes: number) =>
      pedir<InicioGastos>(`/inicio?anio=${anio}&mes=${mes}`, {}, "No se pudieron cargar las categorías"),
    listar: (f: FiltrosGastos) => pedir<ListaGastos>(`?${paramsFiltro(f)}`, {}, "No se pudieron cargar los gastos"),
    crear: (g: GuardarGasto) =>
      pedir<{ gastoId: number }>("", { method: "POST", body: JSON.stringify(g) }, "No se pudo registrar el gasto"),
    editar: (id: number, g: GuardarGasto) =>
      pedir<{ gastoId: number }>(`/${id}`, { method: "PUT", body: JSON.stringify(g) }, "No se pudo guardar el gasto"),
    anular: (id: number, motivo: string) =>
      pedir<{ anulado: boolean; retiroEliminado: boolean; retiroSeMantiene: boolean }>(
        `/${id}/anular`, { method: "POST", body: JSON.stringify({ motivo }) }, "No se pudo anular el gasto"),
    crearCategoria: (c: { tipo: TipoMovimiento; nombre: string; color: string; icono: string; conceptos: string[] }) =>
      pedir<{ categoriaId: number }>("/categorias", { method: "POST", body: JSON.stringify(c) }, "No se pudo crear la categoría"),
    editarCategoria: (id: number, c: { nombre: string; color: string; icono: string; conceptos: string[]; activa: boolean }) =>
      pedir<{ categoriaId: number }>(`/categorias/${id}`, { method: "PUT", body: JSON.stringify(c) }, "No se pudo guardar la categoría"),
    guardarPresupuestos: (anio: number, mes: number, items: { categoriaId: number; monto: number }[]) =>
      pedir<InicioGastos>(`/presupuestos/${anio}/${mes}`, { method: "PUT", body: JSON.stringify({ items }) },
        "No se pudo guardar el presupuesto"),
    listarProgramados: (tipo: TipoMovimiento) =>
      pedir<Programado[]>(`/programados?tipo=${tipo}`, {}, "No se pudieron cargar los programados"),
    crearProgramado: (p: GuardarProgramado) =>
      pedir<ResultadoProgramado>("/programados", { method: "POST", body: JSON.stringify(p) }, "No se pudo programar"),
    editarProgramado: (id: number, p: GuardarProgramado) =>
      pedir<ResultadoProgramado>(`/programados/${id}`, { method: "PUT", body: JSON.stringify(p) }, "No se pudo guardar la programación"),
    pausarProgramado: (id: number) =>
      pedir<ResultadoProgramado>(`/programados/${id}/pausar`, { method: "POST" }, "No se pudo pausar"),
    reanudarProgramado: (id: number) =>
      pedir<ResultadoProgramado>(`/programados/${id}/reanudar`, { method: "POST" }, "No se pudo reanudar"),
    eliminarProgramado: (id: number) =>
      pedir<{ eliminado: boolean }>(`/programados/${id}`, { method: "DELETE" }, "No se pudo eliminar la programación"),
    listarPorEmitir: () => pedir<PorEmitir[]>("/por-emitir", {}, "No se pudieron cargar los ingresos por emitir"),
    descartarPorEmitir: (id: number) =>
      pedir<{ descartado: boolean }>(`/por-emitir/${id}/descartar`, { method: "POST" }, "No se pudo descartar"),
    getResumen: (anio: number, mes: number) =>
      pedir<ResumenMes>(`/resumen?anio=${anio}&mes=${mes}`, {}, "No se pudo cargar el resumen del mes"),
    copiarPresupuestos: (anio: number, mes: number) =>
      pedir<InicioGastos>(`/presupuestos/${anio}/${mes}/copiar-anterior`, { method: "POST" },
        "No se pudo copiar el presupuesto"),
  };
}

function paramsFiltro(f: FiltrosGastos) {
  const p = new URLSearchParams();
  p.set("tipo", f.tipo);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.categoriaId) p.set("categoriaId", String(f.categoriaId));
  if (f.sucursalId) p.set("sucursalId", String(f.sucursalId));
  if (f.medioPago) p.set("medioPago", f.medioPago);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.incluirAnulados) p.set("incluirAnulados", "true");
  p.set("page", String(f.page));
  p.set("pageSize", String(f.pageSize));
  return p.toString();
}

/** Categorías del mes con gastado y presupuesto, y si el usuario tiene turno de caja abierto. */
export function useInicioGastos(anio: number, mes: number) {
  const api = useApiGastos();
  const [inicio, setInicio] = useState<InicioGastos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);
  const { listo, getInicio } = api;

  const recargar = useCallback(async () => {
    if (!listo) return;
    const id = ++pedido.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getInicio(anio, mes);
      if (id === pedido.current) setInicio(data);
    } catch (e) {
      if (id === pedido.current) setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      if (id === pedido.current) setLoading(false);
    }
    // getInicio se recrea en cada render; listo/anio/mes son lo que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, anio, mes]);

  useEffect(() => { recargar(); }, [recargar]);

  return { inicio, setInicio, loading, error, recargar, api };
}

/** Página de gastos con totales del filtro. */
export function useListaGastos(filtros: FiltrosGastos) {
  const api = useApiGastos();
  const [lista, setLista] = useState<ListaGastos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);
  const clave = JSON.stringify(filtros);
  const { listo, listar } = api;

  const recargar = useCallback(async () => {
    if (!listo) return;
    const id = ++pedido.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listar(JSON.parse(clave));
      if (id === pedido.current) setLista(data);
    } catch (e) {
      if (id === pedido.current) setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      if (id === pedido.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clave]);

  useEffect(() => { recargar(); }, [recargar]);

  return { lista, loading, error, recargar };
}
