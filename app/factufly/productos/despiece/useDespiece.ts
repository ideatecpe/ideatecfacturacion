import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Despiece, GuardarParteReceta, RecetaDespiece } from "./despiece";

const API = `${process.env.NEXT_PUBLIC_API_URL}/api/despiece`;

/** Error de la API con el mensaje que manda el backend (ya pensado para el usuario). */
async function pedir<T>(url: string, accessToken: string | null | undefined, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.mensaje ?? "No se pudo completar la operación.");
  return data as T;
}

export interface DespiezarPayload {
  productoBaseId: number;
  cantidad: number;
  actualizarPrecios: boolean;
  margenObjetivo: number | null;
  partes: { productoId: number; cantidad: number; precioVenta: number | null }[];
}

/** Recetas de despiece de la sucursal y las operaciones sobre ellas. */
export function useDespiece(sucursalId: number | null, enabled = true) {
  const { accessToken, user } = useAuth();
  const [recetas, setRecetas] = useState<RecetaDespiece[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usuarioId = user?.id ? Number(user.id) : null;

  const cargarRecetas = useCallback(async () => {
    if (!sucursalId || !accessToken) return [];
    setCargando(true);
    try {
      const data = await pedir<RecetaDespiece[]>(`${API}/recetas/${sucursalId}`, accessToken);
      setRecetas(data);
      setError(null);
      setCargado(true);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los despieces.");
      return [];
    } finally {
      setCargando(false);
    }
  }, [sucursalId, accessToken]);

  useEffect(() => {
    if (enabled) void cargarRecetas();
  }, [enabled, cargarRecetas]);

  /** Reemplaza (o agrega) una receta en la lista local sin volver a pedir todas. */
  const ponerReceta = useCallback((receta: RecetaDespiece) => {
    setRecetas((prev) => {
      const existe = prev.some((r) => r.productoBaseId === receta.productoBaseId);
      const next = existe ? prev.map((r) => (r.productoBaseId === receta.productoBaseId ? receta : r)) : [...prev, receta];
      return next.sort((a, b) => (a.nomProducto ?? "").localeCompare(b.nomProducto ?? ""));
    });
  }, []);

  const recargarReceta = useCallback(
    async (productoBaseId: number) => {
      const receta = await pedir<RecetaDespiece>(`${API}/recetas/${sucursalId}/${productoBaseId}`, accessToken);
      ponerReceta(receta);
      return receta;
    },
    [sucursalId, accessToken, ponerReceta],
  );

  const guardarReceta = useCallback(
    async (productoBaseId: number, partes: GuardarParteReceta[], margenObjetivo: number | null, despieceAlVender: boolean) => {
      const receta = await pedir<RecetaDespiece>(`${API}/recetas/${productoBaseId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ sucursalId, margenObjetivo, despieceAlVender, usuarioId, partes }),
      });
      ponerReceta(receta);
      return receta;
    },
    [sucursalId, accessToken, usuarioId, ponerReceta],
  );

  const eliminarReceta = useCallback(
    async (productoBaseId: number) => {
      await pedir(`${API}/recetas/${productoBaseId}`, accessToken, { method: "DELETE" });
      setRecetas((prev) => prev.filter((r) => r.productoBaseId !== productoBaseId));
    },
    [accessToken],
  );

  const despiezar = useCallback(
    async (payload: DespiezarPayload) => {
      const resultado = await pedir<Despiece>(API, accessToken, {
        method: "POST",
        body: JSON.stringify({ ...payload, sucursalId, usuarioId }),
      });
      // Stock, costo y precios cambiaron: se relee la receta para que la pantalla quede al día.
      void recargarReceta(payload.productoBaseId).catch(() => {});
      return resultado;
    },
    [sucursalId, accessToken, usuarioId, recargarReceta],
  );

  const historial = useCallback(
    async (filtros: { productoBaseId?: number | null; desde?: string; hasta?: string } = {}) => {
      const params = new URLSearchParams();
      if (filtros.productoBaseId) params.set("productoBaseId", String(filtros.productoBaseId));
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      const qs = params.toString();
      return pedir<Despiece[]>(`${API}/historial/${sucursalId}${qs ? `?${qs}` : ""}`, accessToken);
    },
    [sucursalId, accessToken],
  );

  const deshacer = useCallback(
    async (despiece: Despiece) => {
      const resultado = await pedir<Despiece>(`${API}/${despiece.despieceId}/deshacer?sucursalId=${sucursalId}`, accessToken, {
        method: "POST",
        body: "{}",
      });
      void recargarReceta(despiece.productoBaseId).catch(() => {});
      return resultado;
    },
    [sucursalId, accessToken, recargarReceta],
  );

  return {
    recetas,
    cargando,
    cargado,
    error,
    cargarRecetas,
    guardarReceta,
    eliminarReceta,
    despiezar,
    historial,
    deshacer,
  };
}

export type UseDespiece = ReturnType<typeof useDespiece>;
