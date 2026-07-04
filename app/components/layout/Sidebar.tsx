"use client";
import { LogOut, DollarSign, TrendingUp, ChevronRight } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

import { cn } from "@/app/utils/cn";
import { MenuItem, View } from "@/app/types";

interface SidebarProps {
  isOpen: boolean;
  activeView: View;
  activeSubView?: string;
  onViewChange: (path: string) => void;
  menuItems: MenuItem[];
}

interface TipoCambio {
  compra: string;
  venta: string;
  fecha: string;
}

const TC_CACHE_KEY = "tipoCambio_cache";

function useTipoCambio() {
  const [tc, setTc] = useState<TipoCambio | null>(null);

  useEffect(() => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

    // 1. Intentar leer del cache local
    try {
      const raw = localStorage.getItem(TC_CACHE_KEY);
      if (raw) {
        const cached: TipoCambio = JSON.parse(raw);
        if (cached.fecha === fecha) {
          // Cache válido para hoy → usar sin llamar a la API
          setTc(cached);
          return;
        }
      }
    } catch {
      // localStorage no disponible o dato corrupto, continuar con la API
    }

    // 2. No hay cache de hoy → llamar a la API
    import("@/app/utils/tipoCambioJsonPe")
      .then(({ obtenerTipoCambio }) => obtenerTipoCambio(fecha))
      .then(({ compra, venta }) => {
        const nuevo: TipoCambio = {
          compra: compra.toFixed(3),
          venta:  venta.toFixed(3),
          fecha,
        };
        // Guardar en cache para el resto del día
        try { localStorage.setItem(TC_CACHE_KEY, JSON.stringify(nuevo)); } catch { /* noop */ }
        setTc(nuevo);
      })
      .catch(() => {
        // silencioso — la card muestra "—"
      });
  }, []);

  return tc;
}

export const Sidebar = ({
  isOpen,
  activeView,
  activeSubView = "",
  onViewChange,
  menuItems,
}: SidebarProps) => {
  const handleLogout = () => signOut({ callbackUrl: "/" });
  const tc = useTipoCambio();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Auto-expande el grupo activo cuando se navega directo por URL
  useEffect(() => {
    const activeParentId = menuItems.find(
      (m) => m.children?.length && m.id === activeView,
    )?.id;
    if (activeParentId) {
      setExpandedGroups((prev) =>
        prev[activeParentId] ? prev : { ...prev, [activeParentId]: true },
      );
    }
    // Solo depende de activeView: menuItems se recrea en cada render del
    // layout padre y no debe disparar este efecto por sí solo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const hoy = new Date();
  const fechaLabel = hoy.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <aside
      className={cn(
        "flex flex-col fixed inset-y-0 z-50 xl:relative h-full overflow-hidden transition-all duration-300",
        isOpen ? "w-54" : "w-18",
        isOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
      )}
      style={{ background: "linear-gradient(180deg, #0f2e64 0%, #091a3d 100%)" }}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-0 px-4 h-16 shrink-0", !isOpen && "justify-center px-0")}>
        <img src="/logofnsb.png" alt="" className="w-9 h-9 object-contain" />
        {isOpen && (
          <h1 className="text-[20px] font-extrabold tracking-tight text-white leading-none ml-[-4]">
            actuFly
          </h1>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuItems.map((item) => {
          const hasChildren = !!item.children?.length;
          const groupActive = activeView === item.id;
          const active = groupActive && !hasChildren;
          const isExpanded = hasChildren && (expandedGroups[item.id] ?? false);

          if (!hasChildren) {
            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150",
                    !isOpen && "justify-center",
                    active
                      ? "bg-white/12 text-white"
                      : "text-white/50 hover:text-white/90 hover:bg-white/6",
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full"
                      style={{ background: "#f15050" }}
                    />
                  )}

                  <item.icon className={cn("w-4.5 h-4.5 shrink-0", active ? "text-white" : "text-white/50 group-hover:text-white/90")} />

                  {isOpen && (
                    <span className="text-[13px] font-medium truncate">{item.label}</span>
                  )}
                </button>

                {!isOpen && (
                  <span
                    className="pointer-events-none absolute left-17 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md text-[12px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
                    style={{ background: "#0a1f45", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {item.label}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() =>
                  setExpandedGroups((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                }
                className={cn(
                  "relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150",
                  !isOpen && "justify-center",
                  groupActive
                    ? "text-white bg-white/6"
                    : "text-white/50 hover:text-white/90 hover:bg-white/6",
                )}
              >
                {groupActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full"
                    style={{ background: "#f15050" }}
                  />
                )}

                <item.icon className={cn("w-4.5 h-4.5 shrink-0", groupActive ? "text-white" : "text-white/50 group-hover:text-white/90")} />

                {isOpen && (
                  <>
                    <span className="text-[13px] font-medium truncate flex-1 text-left">
                      {item.label}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform duration-150",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </>
                )}
              </button>

              {isOpen && isExpanded && (
                <div className="mt-0.5 ml-5 pl-3 border-l border-white/10 space-y-0.5">
                  {item.children!.map((child) => {
                    const childActive = groupActive && activeSubView === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onViewChange(`${item.id}/${child.id}`)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150",
                          childActive
                            ? "text-white bg-white/12"
                            : "text-white/45 hover:text-white/85 hover:bg-white/6",
                        )}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {!isOpen && (
                <div
                  className="pointer-events-none group-hover:pointer-events-auto absolute left-17 top-0 rounded-md text-[12px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 overflow-hidden min-w-40"
                  style={{ background: "#0a1f45", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="px-3 py-2 text-white/40 text-[10px] uppercase tracking-wider border-b border-white/10">
                    {item.label}
                  </div>
                  {item.children!.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onViewChange(`${item.id}/${child.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Card tipo de cambio */}
      <div className="shrink-0 px-3 pb-4">
        {isOpen ? (
          <div
            className="relative rounded-xl overflow-hidden p-3"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&q=70')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Overlay */}
            <div className="absolute inset-0 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(5,15,40,0.88) 0%, rgba(10,31,69,0.80) 100%)" }} />

            {/* Contenido sobre el overlay */}
            <div className="relative z-10">

            {/* Header card */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                  <TrendingUp className="w-3 h-3 text-white" />
                </div>
                <span className="text-[11px] font-bold text-white">Tipo de cambio</span>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="w-5 h-5 flex items-center justify-center rounded-md transition-colors hover:bg-red-500/20 text-white/30 hover:text-red-400"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>

            {/* Fecha */}
            <p className="text-[9px] text-white/80 mb-2 uppercase tracking-wide">{fechaLabel} · SUNAT</p>

            {/* Valores */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg px-2 py-1.5" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <p className="text-[8px] uppercase tracking-wide mb-0.5 text-white/90 font-bold">Compra</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[9px]" style={{ color: "rgba(134,239,172,0.6)" }}>S/</span>
                  <span className="text-[14px] font-black tabular-nums" style={{ color: "#86efac" }}>
                    {tc ? tc.compra : "—"}
                  </span>
                </div>
              </div>
              <div className="flex-1 rounded-lg px-2 py-1.5" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <p className="text-[8px] uppercase tracking-wide mb-0.5 text-white/90 font-bold">Venta</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[9px]" style={{ color: "rgba(252,165,165,0.6)" }}>S/</span>
                  <span className="text-[14px] font-black tabular-nums" style={{ color: "#fca5a5" }}>
                    {tc ? tc.venta : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Indicador USD */}
            <div className="mt-2 flex items-center gap-1">
              <DollarSign className="w-2.5 h-2.5 text-white/25" />
              <span className="text-[8px] text-white/75">1 USD · Dólar americano</span>
            </div>

            </div>{/* fin z-10 */}
          </div>
        ) : (
          /* Colapsado: icono logout visible */
          <div className="flex justify-center">
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
