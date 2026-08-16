import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export interface MedioPagoResumen {
  medioPago: string;
  montoEsperado: number;
  montoContado?: number | null;
  diferencia?: number | null;
}

export interface CajaApertura {
  cajaAperturaId: number;
  empresaRuc?: string | null;
  sucursalId: number;
  nombreSucursal?: string | null;
  montoInicial: number;
  fechaApertura: string;
  usuarioApertura: number;
  nombreUsuarioApertura?: string | null;
  fechaCierre?: string | null;
  usuarioCierre?: number | null;
  nombreUsuarioCierre?: string | null;
  efectivoEsperado?: number | null;
  efectivoContado?: number | null;
  diferencia?: number | null;
  estado: string;
  observaciones?: string | null;
}

export interface CajaTurno {
  cajaTurnoId: number;
  cajaAperturaId: number;
  usuarioId: number;
  nombreUsuario?: string | null;
  fechaInicio: string;
  fechaFin?: string | null;
  saldoInicial: number;
  efectivoEsperado?: number | null;
  efectivoContado?: number | null;
  diferencia?: number | null;
  totalVentas?: number | null;
  cantidadComprobantes?: number | null;
  estado: string;
  esCierreCaja: boolean;
  observaciones?: string | null;
  medios: MedioPagoResumen[];
}

export interface CajaEstado {
  cajaAbierta: boolean;
  caja?: CajaApertura | null;
  /** Turno abierto del usuario actual. */
  turnoActual?: CajaTurno | null;
  /** Turno abierto de otro usuario que olvidó cuadrar: bloquea al actual. */
  turnoDeOtroUsuario?: CajaTurno | null;
  saldoEfectivo: number;
}

export interface CuadreTurno {
  cajaTurnoId: number;
  cajaAperturaId: number;
  nombreUsuario?: string | null;
  fechaInicio: string;
  saldoInicial: number;
  ventasEfectivo: number;
  efectivoEsperado: number;
  totalVentas: number;
  cantidadComprobantes: number;
  medios: MedioPagoResumen[];
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/** Lee el `mensaje` que devuelven los controllers para poder mostrarlo tal cual. */
async function mensajeDeError(res: Response, porDefecto: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.mensaje || data?.message || porDefecto;
  } catch {
    return porDefecto;
  }
}

interface Opciones {
  /**
   * Crea el turno del usuario automáticamente cuando entra a una caja ya
   * abierta que nadie está usando. Solo lo activa Nueva Venta: el módulo
   * Caja consulta el estado sin abrir turnos.
   */
  autoIniciarTurno?: boolean;
  /** Permite no consultar nada cuando la configuración tiene el módulo apagado. */
  activo?: boolean;
}

export function useCaja({ autoIniciarTurno = false, activo = true }: Opciones = {}) {
  const { user, accessToken } = useAuth();
  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;

  const [estado, setEstado] = useState<CajaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Evita que dos renders seguidos disparen dos POST de inicio de turno.
  const iniciandoTurno = useRef(false);

  const headers = useCallback(
    (): HeadersInit => ({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [accessToken],
  );

  const refrescar = useCallback(async (): Promise<CajaEstado | null> => {
    if (!sucursalId || !accessToken || !activo) {
      setLoading(false);
      return null;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/Caja/estado/${sucursalId}`, { headers: headers() });
      if (!res.ok) throw new Error(await mensajeDeError(res, "No se pudo consultar la caja"));

      const data: CajaEstado = await res.json();
      setEstado(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la caja");
      return null;
    } finally {
      setLoading(false);
    }
  }, [sucursalId, accessToken, activo, headers]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const abrirCaja = useCallback(
    async (montoInicial: number, observaciones?: string) => {
      const res = await fetch(`${BASE_URL}/api/Caja/abrir`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ sucursalId, montoInicial, observaciones }),
      });
      if (!res.ok) throw new Error(await mensajeDeError(res, "No se pudo abrir la caja"));

      const data: CajaEstado = await res.json();
      setEstado(data);
      return data;
    },
    [sucursalId, headers],
  );

  const iniciarTurno = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/api/Caja/turno/iniciar`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ sucursalId }),
    });
    if (!res.ok) throw new Error(await mensajeDeError(res, "No se pudo iniciar el turno"));

    const data: CajaEstado = await res.json();
    setEstado(data);
    return data;
  }, [sucursalId, headers]);

  const obtenerCuadre = useCallback(
    async (cajaTurnoId: number): Promise<CuadreTurno> => {
      const res = await fetch(`${BASE_URL}/api/Caja/turno/${cajaTurnoId}/cuadre`, { headers: headers() });
      if (!res.ok) throw new Error(await mensajeDeError(res, "No se pudo calcular el cuadre"));

      return res.json();
    },
    [headers],
  );

  const cuadrar = useCallback(
    async (cajaTurnoId: number, efectivoContado: number, cerrarCaja: boolean, observaciones?: string) => {
      const res = await fetch(`${BASE_URL}/api/Caja/cuadrar`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ cajaTurnoId, efectivoContado, cerrarCaja, observaciones }),
      });
      if (!res.ok) throw new Error(await mensajeDeError(res, "No se pudo cuadrar la caja"));

      const turno: CajaTurno = await res.json();
      await refrescar();
      return turno;
    },
    [headers, refrescar],
  );

  // Segundo usuario del día: la caja sigue abierta y nadie tiene turno, así que
  // el suyo arranca solo y puede vender sin tocar nada.
  useEffect(() => {
    if (!autoIniciarTurno || !estado?.cajaAbierta) return;
    if (estado.turnoActual || estado.turnoDeOtroUsuario) return;
    if (iniciandoTurno.current) return;

    iniciandoTurno.current = true;
    iniciarTurno()
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo iniciar el turno"))
      .finally(() => { iniciandoTurno.current = false; });
  }, [autoIniciarTurno, estado, iniciarTurno]);

  return { estado, loading, error, refrescar, abrirCaja, iniciarTurno, obtenerCuadre, cuadrar };
}
