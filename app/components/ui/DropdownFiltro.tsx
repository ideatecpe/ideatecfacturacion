"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X, Check, Search } from "lucide-react";
import { cn } from "@/app/utils/cn";

interface DropdownFiltroProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  colorMap?: Record<string, string>;
  className?: string;
  searchable?: boolean;
  footer?: React.ReactNode;
}

export const DropdownFiltro = ({
  label,
  value,
  options,
  onChange,
  colorMap,
  className,
  searchable = false,
  footer,
}: DropdownFiltroProps) => {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setBusqueda("");
    } else if (searchable) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  // Dos productos/categorías distintos pueden compartir el mismo nombre visible;
  // se deduplica aquí porque el texto se usa como key de React en la lista.
  const opcionesUnicas = useMemo(() => Array.from(new Set(options)), [options]);

  const opcionesFiltradas = useMemo(() => {
    if (!searchable || !busqueda.trim()) return opcionesUnicas;
    const termino = busqueda.trim().toLowerCase();
    return opcionesUnicas.filter((opt) => opt.toLowerCase().includes(termino));
  }, [opcionesUnicas, busqueda, searchable]);

  const active = value !== "Todos" && value !== "";

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border rounded-md outline-none transition-all whitespace-nowrap",
          active
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
        )}
      >
        <span className="truncate max-w-[150px]">
          {active ? value : label}
        </span>
        {active ? (
          <X 
            size={11} 
            className="text-white/80 hover:text-white shrink-0" 
            onClick={(e) => { e.stopPropagation(); onChange("Todos"); }} 
          />
        ) : (
          <ChevronDown size={12} className={cn("text-gray-400 shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden min-w-[200px]">
          {searchable && (
            <div className="relative border-b border-gray-100 p-1.5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Buscar..."
                className="w-full text-xs pl-7 pr-2 py-1.5 rounded outline-none border border-gray-200 focus:border-blue-300"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
            {opcionesFiltradas.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</div>
            )}
            {opcionesFiltradas.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left",
                  value === opt ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {colorMap && opt !== "Todos" && <span className={cn("w-1.5 h-1.5 rounded-full", colorMap[opt])} />}
                  {opt}
                </span>
                {value === opt && <Check size={11} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
          {footer && (
            <div className="border-t border-gray-100">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
