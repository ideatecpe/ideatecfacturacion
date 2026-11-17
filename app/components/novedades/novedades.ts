"use client";

// Novedades del sistema (p. ej. "Nuevo: Gastos e ingresos"): una tarjeta en el Dashboard para
// que los clientes se enteren de un módulo nuevo y lo activen ellos mismos. Todo vive en el
// front, sin tablas: la lista de avisos está aquí abajo y lo que vio cada usuario se guarda en
// el navegador (localStorage).
//
// Cada vez que el usuario vuelve al sistema (una "sesión": pasaron al menos HORAS_ENTRE_SESIONES
// desde la anterior) la tarjeta se ve MINUTOS_POR_SESION minutos; después de MAX_SESIONES ya no
// sale más. Deja de salir apenas la empresa activa el módulo. Como se guarda en el navegador,
// cuenta por equipo: en otra computadora vuelve a tener sus propias sesiones.
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { notificarConfiguracionActualizada, useConfiguracion, type Configuracion } from "@/hooks/useConfiguracion";

export interface Novedad {
  /** Identifica el aviso en el navegador: cambiarla vuelve a mostrarlo a todos. */
  clave: string;
  /** Módulo que activa "Activar ahora". */
  modulo: "gastos";
  titulo: string;
  texto: string;
  /** "Ver cómo funciona". */
  ruta: string;
  /** Último día en que sale (inclusive, YYYY-MM-DD). Después ya no aparece en ningún navegador. */
  hasta: string;
}

const MAX_SESIONES = 6;
const MINUTOS_POR_SESION = 15;
const HORAS_ENTRE_SESIONES = 4;

const NOVEDADES: Novedad[] = [
  {
    clave: "modulo-gastos-ingresos",
    modulo: "gastos",
    titulo: "Gastos e ingresos",
    texto: "Anota tus gastos (luz, alquiler, sueldos), tus ingresos extra (polladas, alquiler del local) y programa los que se repiten cada mes. Mira cuánto te quedó realmente.",
    ruta: "/factufly/gastos/todos",
    hasta: "2026-11-30",
  },
];

/** El módulo ya está encendido en la empresa: su aviso no sale. */
const moduloActivo = (n: Novedad, config: Configuracion) => (n.modulo === "gastos" ? !!config.usaGastos : false);

// ── Estado compartido (tarjeta visible ahora) ───────────────────────────────

let tarjeta: Novedad | null = null;
let temporizador: number | undefined;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
};

/** La novedad cuya tarjeta toca mostrar ahora en el Dashboard, o null. */
export function useTarjetaNovedad() {
  return useSyncExternalStore(suscribir, () => tarjeta, () => null);
}

// ── Lo que vio el usuario, en este navegador ────────────────────────────────

interface Registro {
  /** Sesiones en que ya se mostró. */
  sesiones: number;
  /** Cuándo empezó a verse en la sesión actual (ms). */
  inicio: number;
  /** "Ahora no": no se ve el resto de esta sesión. */
  oculta?: boolean;
}

const claveRegistro = (n: Novedad, ruc: string, usuarioId: string) => `factufly:novedad:${n.clave}:${ruc}:${usuarioId}`;

function leer(clave: string): Registro | null {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? "null");
    return v && typeof v.inicio === "number" && typeof v.sesiones === "number" ? v : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, r: Registro) {
  try { localStorage.setItem(clave, JSON.stringify(r)); } catch { /* sin almacenamiento: no se muestra de nuevo */ }
}

let claveActual = "";

/**
 * Decide qué tarjeta se ve: la que sigue dentro de los minutos de su sesión, o una que puede
 * empezar una sesión nueva (le quedan sesiones y pasaron las horas mínimas). Programa cuándo
 * se esconde.
 */
function evaluar(config: Configuracion, ruc: string, usuarioId: string) {
  const ahora = Date.now();
  const ventana = MINUTOS_POR_SESION * 60_000;
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let elegida: { n: Novedad; clave: string; hasta: number } | null = null;

  for (const n of NOVEDADES) {
    if (moduloActivo(n, config) || hoy > n.hasta) continue;
    const clave = claveRegistro(n, ruc, usuarioId);
    const r = leer(clave);
    if (r && ahora - r.inicio < ventana) {
      if (!r.oculta) { elegida = { n, clave, hasta: r.inicio + ventana }; break; }
      continue;
    }
    const sesiones = r?.sesiones ?? 0;
    if (sesiones < MAX_SESIONES && (!r || ahora - r.inicio >= HORAS_ENTRE_SESIONES * 3_600_000)) {
      guardar(clave, { sesiones: sesiones + 1, inicio: ahora });
      elegida = { n, clave, hasta: ahora + ventana };
      break;
    }
  }

  window.clearTimeout(temporizador);
  tarjeta = elegida?.n ?? null;
  claveActual = elegida?.clave ?? "";
  if (elegida) {
    temporizador = window.setTimeout(() => {
      tarjeta = null;
      emitir();
    }, Math.max(0, elegida.hasta - ahora));
  }
  emitir();
}

/**
 * Lo usa la tarjeta del Dashboard: la sesión (y sus minutos) empieza recién cuando el usuario
 * está en el Dashboard, no mientras trabaja en otra pantalla. Solo para administradores
 * (quienes pueden activar módulos) y cuando ya llegó la configuración, para no gastar una
 * sesión en un módulo ya activo.
 */
export function useEvaluarNovedades() {
  const { user } = useAuth();
  const { config } = useConfiguracion();
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";
  const ruc = user?.ruc ?? "";
  const usuarioId = user?.id ?? "";

  useEffect(() => {
    if (!esAdmin || !config || !ruc || !usuarioId) {
      if (tarjeta) { tarjeta = null; emitir(); }
      return;
    }
    evaluar(config, ruc, usuarioId);
    return () => {
      // Al salir del Dashboard la tarjeta se desmonta; al volver se evalúa de nuevo
      // (sigue si aún está dentro de sus minutos).
      window.clearTimeout(temporizador);
      tarjeta = null;
    };
  }, [esAdmin, config, ruc, usuarioId]);
}

/** "Ahora no": la tarjeta no se ve el resto de esta sesión (la sesión ya contó). */
export function ocultarTarjeta() {
  const r = claveActual ? leer(claveActual) : null;
  if (r) guardar(claveActual, { ...r, oculta: true });
  window.clearTimeout(temporizador);
  tarjeta = null;
  emitir();
}

/**
 * Enciende Gastos e ingresos en la configuración de la empresa (el mismo guardado de
 * Configuración → Empresa) y avisa al resto de la app para que aparezca en el menú.
 */
export async function activarModuloGastos(accessToken: string | null, ruc: string | undefined) {
  if (!accessToken || !ruc) throw new Error("Vuelve a iniciar sesión");
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/Configuracion/${encodeURIComponent(ruc)}`;
  const actual = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!actual.ok) throw new Error("No se pudo leer la configuración");
  const config = await actual.json();
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, usaGastos: true }),
  });
  if (!res.ok) throw new Error("No se pudo activar el módulo");
  window.clearTimeout(temporizador);
  tarjeta = null;
  emitir();
  notificarConfiguracionActualizada();
}
