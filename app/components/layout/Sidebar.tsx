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
        "bg-brand-dark text-white transition-all duration-300 flex flex-col fixed inset-y-0 z-50 xl:relative h-full overflow-hidden",
        isOpen ? "w-64" : "w-20",
        isOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
      )}
    >
      <div className="px-4 py-6 flex items-center gap-3 shrink-0">
        <div className="w-13 h-11 rounded-xl  flex items-center justify-center shrink-0">
          <img
            src="/logofnsb.png"
            alt=""
            className="w-12 h-12 object-contain"
          />
        </div>
        {isOpen && (
          <div className="overflow-hidden whitespace-nowrap flex flex-col">
            <h1 className="text-2xl font-extrabold text-blue-50 tracking-tight leading-tight">
              FACTU<span className="text-[#f15050]">FLY</span>
            </h1>
            <p className="text-[10px] text-blue-50/70 font-medium tracking-wide">
              Sistema de Facturación
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 custom-scrollbar overflow-y-auto overflow-x-hidden w-full">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative overflow-hidden",
              !isOpen && "justify-center",
              activeView === item.id
                ? "bg-brand-blue text-white shadow-md shadow-blue-900/20"
                : "text-gray-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "w-5 h-5 shrink-0 transition-transform group-hover:scale-110",
                activeView === item.id ? "text-white" : "text-gray-400",
              )}
            />
            {isOpen && (
              <span className="font-medium text-sm truncate">{item.label}</span>
            )}
            {!isOpen && (
              <div className="fixed left-20 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-999">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5 shrink-0">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all group",
            !isOpen && "justify-center",
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isOpen && <span className="font-medium text-sm">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};
