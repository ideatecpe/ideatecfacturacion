"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, type LucideIcon } from "lucide-react";
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

function IconoSeccion({ icono, tamano }: { icono?: IconoDeSeccion; tamano: string }) {
  if (!icono) return null;
  const { Icono, clase } = icono;
  return <Icono className={`${tamano} shrink-0 ${clase}`} />;
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
        className={`shrink-0 h-7.5 pl-2.5 pr-2 ${compacto ? "max-sm:h-9 max-sm:rounded-md" : ""} rounded-full border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
          panelAbierto
            ? "bg-slate-900 border-slate-900 text-white"
            : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
        }`}
      >
        <LayoutGrid className="w-3 h-3" />
        <span className="hidden sm:inline">Categorías</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${panelAbierto ? "rotate-180" : ""}`} />
      </button>

      <div className={`relative flex-1 min-w-0 ${compacto ? "max-sm:hidden" : ""}`}>
        <nav
          ref={setNav}
          className="relative flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {secciones.map((s) => (
            <button
              key={s.nombre}
              type="button"
              data-chip={s.nombre}
              onClick={() => elegir(s.nombre)}
              className={`shrink-0 h-7.5 px-3 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1.5 shadow-2xs ${
                activa === s.nombre
                  ? "bg-[#0b1b36] border-[#0b1b36] text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <IconoSeccion icono={iconos[s.nombre]} tamano="w-2.5 h-2.5" />
              <span>{s.nombre}</span>
              <span className={`text-[10px] tabular-nums font-normal ${activa === s.nombre ? "text-white/70" : "text-slate-400"}`}>
                {s.cantidad}
              </span>
            </button>
          ))}
        </nav>

        {puedeIzquierda && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-14 flex items-center bg-linear-to-r from-slate-50 via-slate-50/90 to-transparent">
            <button
              type="button"
              onClick={() => desplazar(-1)}
              aria-label="Ver categorías anteriores"
              className="pointer-events-auto hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-brand-blue"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
        {puedeDerecha && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-14 flex items-center justify-end bg-linear-to-l from-slate-50 via-slate-50/90 to-transparent">
            <button
              type="button"
              onClick={() => desplazar(1)}
              aria-label="Ver más categorías"
              className="pointer-events-auto hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-brand-blue"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {panelAbierto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {secciones.length} secciones
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {secciones.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => elegir(s.nombre)}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  activa === s.nombre ? "bg-brand-blue/10 text-brand-blue font-semibold" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <IconoSeccion icono={iconos[s.nombre]} tamano="w-3.5 h-3.5" />
                  <span className="truncate">{s.nombre}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">{s.cantidad}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
