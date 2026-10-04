"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { esRespuestaSinRed } from "@/lib/offline/senalRed";

// Deben coincidir con PAGES_CACHE_NAME y SESSION_CACHE_NAME de public/sw.js.
const PAGES_CACHE_NAME = "factufly-pages-v4";
const SESSION_CACHE_NAME = "factufly-session-v1";
const CLAVE_DUENO = "factufly_paginas_cache_dueno";
// Se guardan apenas entra el usuario, aunque aún no las haya abierto: son las
// que tienen que poder recargarse si la red se cae a media jornada.
const PAGINAS_CLAVE = [
  "/factufly/dashboard",
  "/factufly/operaciones/boleta-facturaelectronica",
];

function leerDueno(): string | null {
  try {
    return localStorage.getItem(CLAVE_DUENO);
  } catch {
    return null;
  }
}

function guardarDueno(dueno: string | null) {
  try {
    if (dueno) localStorage.setItem(CLAVE_DUENO, dueno);
    else localStorage.removeItem(CLAVE_DUENO);
  } catch {}
}

/**
 * El HTML de cada página trae incrustada la sesión (app/layout.tsx la resuelve en
 * el servidor y se la pasa a SessionProvider), y el service worker guarda ese HTML
 * para poder recargar sin internet. La copia es de quien la descargó: si después
 * entraba otro usuario en el mismo navegador y se caía la red, el SW servía la
 * página del usuario anterior — con su nombre, rol y token — y las ventas offline
 * se registraban a su nombre.
 *
 * Aquí se ata esa caché al usuario con sesión: se vacía al cambiar de usuario o al
 * cerrar sesión, y se guarda una copia fresca (HTML + JS/CSS) de las páginas clave
 * y de cada página que visita el usuario actual (la navegación interna de Next no
 * pasa por el SW, así que sin esto la caché quedaría vacía y no se podría recargar
 * sin conexión).
 */
export function CachePaginasPorUsuario() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const cacheLista = useRef<Promise<void> | null>(null);
  const guardadas = useRef(new Set<string>());
  const [reintento, setReintento] = useState(0);

  const dueno = session?.user
    ? `${session.user.ruc ?? ""}:${session.user.id ?? ""}`
    : null;

  useEffect(() => {
    const alVolverLaRed = () => setReintento((n) => n + 1);
    window.addEventListener("online", alVolverLaRed);
    return () => window.removeEventListener("online", alVolverLaRed);
  }, []);

  // 1. Vaciar las páginas guardadas si no son del usuario actual.
  useEffect(() => {
    if (!("caches" in window) || status === "loading") return;

    if (status === "unauthenticated" || !dueno) {
      // Dentro de /factufly el middleware exige sesión: "sin sesión" ahí es un
      // refetch de NextAuth que falló (p.ej. sin red), no un cierre de sesión.
      // Solo la pantalla de login confirma que ya no hay nadie dentro.
      if (pathname?.startsWith("/factufly")) return;
      guardadas.current.clear();
      guardarDueno(null);
      cacheLista.current = null;
      caches.delete(PAGES_CACHE_NAME).catch(() => {});
      caches.delete(SESSION_CACHE_NAME).catch(() => {});
      return;
    }

    if (leerDueno() === dueno) {
      cacheLista.current = Promise.resolve();
      return;
    }

    guardadas.current.clear();
    cacheLista.current = caches
      .delete(PAGES_CACHE_NAME)
      .then(() => guardarDueno(dueno))
      // Deja en el SW la sesión del usuario que acaba de entrar, para que NextAuth
      // la encuentre si después se pierde la conexión.
      .then(() => fetch("/api/auth/session", { cache: "no-store" }))
      .then(() => {})
      .catch(() => {});
  }, [status, dueno, pathname]);

  // 2. Guardar la página actual (y las clave) con la sesión vigente.
  useEffect(() => {
    if (!("caches" in window) || status !== "authenticated" || !dueno) return;
    if (!cacheLista.current) return;

    const urls = [...PAGINAS_CLAVE];
    if (pathname?.startsWith("/factufly")) {
      urls.push(window.location.pathname + window.location.search);
    }
    for (const url of urls) guardarPagina(url, dueno, cacheLista.current, guardadas.current);
  }, [status, dueno, pathname, reintento]);

  return null;
}

function guardarPagina(
  url: string,
  dueno: string,
  cacheLista: Promise<void>,
  guardadas: Set<string>,
  intento = 1,
) {
  if (guardadas.has(url)) return;
  guardadas.add(url);

  cacheLista
    .then(async () => {
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "text/html" },
      });
      // Sin red (504 del service worker) se reintenta al volver la conexión; un
      // error puntual del servidor, a los pocos segundos. Una redirección (sin
      // permiso o sesión vencida) no se vuelve a pedir.
      if (!res.ok) {
        guardadas.delete(url);
        if (!esRespuestaSinRed(res) && intento < 3) {
          setTimeout(() => guardarPagina(url, dueno, cacheLista, guardadas, intento + 1), 5000);
        }
        return;
      }
      const esHtml = (res.headers.get("content-type") ?? "").includes("text/html");
      if (res.redirected || !esHtml) return;
      // Si cambió el usuario mientras se descargaba, esta copia ya no sirve.
      if (leerDueno() !== dueno) return;
      const html = await res.clone().text();
      const cache = await caches.open(PAGES_CACHE_NAME);
      await cache.put(url, res);
      await guardarRecursos(html);
    })
    .catch(() => {
      // Sin red: se reintenta al volver la conexión o al cambiar de página.
      guardadas.delete(url);
    });
}

/**
 * Sin su JS la página guardada no arranca (ChunkLoadError). El SW guarda todo lo
 * que se pide de /_next/static/, así que basta con pedir lo que falte.
 */
async function guardarRecursos(html: string) {
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s\\)]+?\.(?:js|css)/g) ?? []);
  for (const url of urls) {
    if (await caches.match(url)) continue;
    await fetch(url).catch(() => {});
  }
}
