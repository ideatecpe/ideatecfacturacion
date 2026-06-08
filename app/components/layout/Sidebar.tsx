"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { cn } from "@/app/utils/cn";
import { MenuItem, View } from "@/app/types";

interface SidebarProps {
  isOpen: boolean;
  activeView: View;
  onViewChange: (view: View) => void;
  menuItems: MenuItem[];
}

export const Sidebar = ({
  isOpen,
  activeView,
  onViewChange,
  menuItems,
}: SidebarProps) => {
  const handleLogout = () => signOut({ callbackUrl: "/" });

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
      <div className={cn("flex items-center gap-3 px-4 h-16 shrink-0", !isOpen && "justify-center px-0")}>
        <div
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, background: "rgba(255,255,255,0.1)" }}
        >
          <img src="/logofnsb.png" alt="" className="w-7 h-7 object-contain" />
        </div>
        {isOpen && (
          <h1 className="text-[17px] font-extrabold tracking-tight text-white leading-none">
            FACTU<span style={{ color: "#f15050" }}>FLY</span>
          </h1>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "relative w-full flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors duration-150",
                !isOpen && "justify-center",
                active
                  ? "bg-white/12 text-white"
                  : "text-white/50 hover:text-white/90 hover:bg-white/6",
              )}
            >
              {/* Indicador activo */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: "#f15050" }}
                />
              )}

              <item.icon className={cn("w-4.5 h-4.5 shrink-0", active ? "text-white" : "text-white/50 group-hover:text-white/90")} />

              {isOpen && (
                <span className="text-[13px] font-medium truncate">{item.label}</span>
              )}

              {/* Tooltip */}
              {!isOpen && (
                <span
                  className="pointer-events-none absolute left-[68px] px-2.5 py-1 rounded-md text-[12px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ background: "#0a1f45", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Línea + Logout */}
      <div className="shrink-0 px-3 pb-4">
        <div className="mx-1 mb-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors duration-150",
            "text-white/40 hover:text-red-400 hover:bg-red-500/[0.08]",
            !isOpen && "justify-center",
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          {isOpen && <span className="text-[13px] font-medium">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};
