"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { desplazarConRespaldo } from "./formato";

export interface SeccionResumen {
  nombre: string;
  cantidad: number;
}

interface Props {
  secciones: SeccionResumen[];
  activa: string | null;
  /** Ícono de las secciones destacadas (combos, lo más vendido…); las categorías no llevan. */
  iconos?: Record<string, IconoDeSeccion>;
  /** En celular con el buscador fijo: solo el botón "Categorías", sin la fila de pastillas. */
  compacto?: boolean;
  onElegir: (nombre: string) => void;
}

export interface IconoDeSeccion {
  Icono: LucideIcon;
  clase: string;
}

function IconoSeccion({ icono, tamano, activo }: { icono?: IconoDeSeccion; tamano: string; activo?: boolean }) {
  if (!icono) return null;
  const { Icono, clase } = icono;
  return <Icono className={`${tamano} shrink-0 transition-transform duration-200 ${activo ? "scale-110" : ""} ${clase}`} />;
}

/**
 * Barra de categorías de la tienda. Con muchas categorías no entran en pantalla,
 * así que hay tres formas de llegar a todas: el panel "Categorías" con la lista
 * completa, las flechas laterales (escritorio) y el desplazamiento horizontal
 * (dedo, trackpad o rueda del mouse).
 */
export default function BarraCategorias({ secciones, activa, iconos = {}, compacto = false, onElegir }: Props) {
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [puedeIzquierda, setPuedeIzquierda] = useState(false);
  const [puedeDerecha, setPuedeDerecha] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const medir = useCallback(() => {
    if (!nav) return;
    setPuedeIzquierda(nav.scrollLeft > 4);
    setPuedeDerecha(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4);
  }, [nav]);

  useEffect(() => {
    if (!nav) return;

    // La rueda del mouse solo manda scroll vertical: se traduce a horizontal.
    // Tiene que ser un listener nativo NO pasivo: el onWheel de React es pasivo,
    // el navegador ignora su preventDefault y la página bajaba en vez de la barra.
    const alRueda = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (nav.scrollWidth <= nav.clientWidth) return;
      nav.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    nav.addEventListener("wheel", alRueda, { passive: false });
    nav.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(nav);
    // Temporizador y no requestAnimationFrame: si la pestaña abre en segundo plano
    // el navegador no pinta, los frames no corren y las flechas nunca aparecían.
    const inicial = setTimeout(medir, 0);

    return () => {
      nav.removeEventListener("wheel", alRueda);
      nav.removeEventListener("scroll", medir);
      observador.disconnect();
      clearTimeout(inicial);
    };
  }, [nav, medir]);

  // Al cambiar las categorías (p. ej. al buscar) cambia el ancho total de la barra.
  useEffect(() => {
    const id = setTimeout(medir, 0);
    return () => clearTimeout(id);
  }, [secciones, medir]);

  // Mantiene a la vista la categoría que se está recorriendo en la página.
  useEffect(() => {
    if (!nav || !activa) return;
    const chip = nav.querySelector<HTMLElement>(`[data-chip="${CSS.escape(activa)}"]`);
    if (!chip) return;
    const izquierda = Math.max(0, chip.offsetLeft - nav.clientWidth / 2 + chip.offsetWidth / 2);
    desplazarConRespaldo((behavior) => nav.scrollTo({ left: izquierda, behavior }), () => nav.scrollLeft);
  }, [activa, nav]);

  useEffect(() => {
    if (!panelAbierto) return;
    const alClic = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setPanelAbierto(false);
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTecla);
    };
  }, [panelAbierto]);

  const desplazar = (direccion: 1 | -1) => {
    if (!nav) return;
    const destino = nav.scrollLeft + direccion * nav.clientWidth * 0.7;
    desplazarConRespaldo((behavior) => nav.scrollTo({ left: destino, behavior }), () => nav.scrollLeft);
  };

  const elegir = (nombre: string) => {
    setPanelAbierto(false);
    onElegir(nombre);
  };

  return (
    // En modo compacto el panel se ubica respecto a la tarjeta del buscador (no al
    // botón), para abrirse a todo el ancho de la pantalla.
    <div ref={contenedorRef} className={`relative flex items-center gap-2 ${compacto ? "max-sm:static max-sm:shrink-0" : ""}`}>
      <button
        type="button"
        onClick={() => setPanelAbierto((v) => !v)}
        aria-expanded={panelAbierto}
        aria-label="Ver todas las categorías"
        className={`shrink-0 h-8.5 pl-3 pr-2.5 ${compacto ? "max-sm:h-9 max-sm:rounded-lg" : "rounded-xl"} border text-xs font-bold flex items-center gap-1.5 transition-all duration-200 active:scale-95 ${
          panelAbierto
            ? "bg-[var(--t-pri,#0B1F49)] border-[var(--t-pri,#0B1F49)] text-white shadow-md shadow-[var(--t-pri,#0B1F49)]/20"
            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5 text-[var(--t-pri,#0B1F49)] transition-colors" style={panelAbierto ? { color: "var(--t-sec, #FBBF24)" } : undefined} />
        <span className="hidden sm:inline">Categorías</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${panelAbierto ? "rotate-180" : "opacity-60"}`} />
      </button>

      <div className={`relative flex-1 min-w-0 ${compacto ? "max-sm:hidden" : ""}`}>
        <nav
          ref={setNav}
          className="relative flex items-center gap-1.5 py-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {secciones.map((s) => {
            const esActiva = activa === s.nombre;
            return (
              <button
                key={s.nombre}
                type="button"
                data-chip={s.nombre}
                onClick={() => elegir(s.nombre)}
                className={`relative shrink-0 h-8.5 px-3.5 rounded-xl text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5 group active:scale-95 ${
                  esActiva
                    ? "border-[var(--t-pri,#0B1F49)] text-white shadow-sm"
                    : "bg-white/80 hover:bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {esActiva && (
                  <motion.span
                    layoutId={`pill-cat-${uid}`}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-[11px] bg-[var(--t-pri,#0B1F49)] shadow-sm"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <IconoSeccion icono={iconos[s.nombre]} tamano="w-3.5 h-3.5" activo={esActiva} />
                  <span className="tracking-tight">{s.nombre}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] tabular-nums font-bold leading-none transition-colors ${
                      esActiva
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700"
                    }`}
                  >
                    {s.cantidad}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {puedeIzquierda && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-14 flex items-center bg-linear-to-r from-[var(--t-tarjeta,#ffffff)] via-[var(--t-tarjeta,#ffffff)]/90 to-transparent z-10">
            <button
              type="button"
              onClick={() => desplazar(-1)}
              aria-label="Ver categorías anteriores"
              className="pointer-events-auto hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-sm text-slate-700 shadow-md hover:scale-105 hover:border-[var(--t-pri,#0B1F49)]/30 hover:text-[var(--t-pri,#0B1F49)] active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
        {puedeDerecha && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-14 flex items-center justify-end bg-linear-to-l from-[var(--t-tarjeta,#ffffff)] via-[var(--t-tarjeta,#ffffff)]/90 to-transparent z-10">
            <button
              type="button"
              onClick={() => desplazar(1)}
              aria-label="Ver más categorías"
              className="pointer-events-auto hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-sm text-slate-700 shadow-md hover:scale-105 hover:border-[var(--t-pri,#0B1F49)]/30 hover:text-[var(--t-pri,#0B1F49)] active:scale-95 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {panelAbierto && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full z-40 mt-2.5 max-h-[65vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-xl p-3 shadow-2xl shadow-slate-900/15"
          >
            <div className="flex items-center justify-between px-2.5 pt-1 pb-2.5 mb-1 border-b border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-[var(--t-pri,#0B1F49)]" />
                Explorar todas las secciones ({secciones.length})
              </p>
              <span className="text-[11px] font-medium text-slate-400">
                Selecciona para ir directo
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 pt-1">
              {secciones.map((s) => {
                const esActiva = activa === s.nombre;
                return (
                  <button
                    key={s.nombre}
                    type="button"
                    onClick={() => elegir(s.nombre)}
                    className={`group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs sm:text-sm transition-all ${
                      esActiva
                        ? "bg-[var(--t-pri,#0B1F49)] text-white font-bold shadow-sm"
                        : "text-slate-700 hover:bg-slate-100/90 font-medium"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <IconoSeccion icono={iconos[s.nombre]} tamano="w-4 h-4" activo={esActiva} />
                      <span className="truncate group-hover:translate-x-0.5 transition-transform">{s.nombre}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] tabular-nums font-bold ${
                          esActiva ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"
                        }`}
                      >
                        {s.cantidad}
                      </span>
                      {esActiva && <Check className="w-3.5 h-3.5 text-[var(--t-sec,#FBBF24)]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
