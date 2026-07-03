"use client";
import React from "react";
import { Search } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesde: (v: string) => void;
  onFechaHasta: (v: string) => void;
  onBuscar: () => void;
  loading: boolean;
  children?: React.ReactNode; // slot para filtros extra (ej: selector trabajador)
}

export const FiltroFechas: React.FC<Props> = ({
  fechaDesde,
  fechaHasta,
  onFechaDesde,
  onFechaHasta,
  onBuscar,
  loading,
  children,
}) => {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {children}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 ">Desde</label>
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => onFechaDesde(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 shadow-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 ">Hasta</label>
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => onFechaHasta(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 shadow-sm"
        />
      </div>
      <Button
        onClick={onBuscar}
        disabled={loading}
        className="py-2.5 px-4 text-xs rounded-md h-auto"
      >
        <Search className="w-3.5 h-3.5" />
        {loading ? "Buscando..." : "Buscar"}
      </Button>
    </div>
  );
};