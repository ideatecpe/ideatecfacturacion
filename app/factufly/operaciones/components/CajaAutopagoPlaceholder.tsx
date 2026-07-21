"use client";

import { MonitorSmartphone } from "lucide-react";

export function CajaAutopagoPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
      <div className="bg-brand-blue/10 rounded-full p-5 mb-4">
        <MonitorSmartphone className="w-10 h-10 text-brand-blue" />
      </div>
      <h1 className="text-xl font-bold text-gray-800">Caja Autopago</h1>
      <p className="text-gray-400 text-sm mt-1">
        Esta vista está en construcción para el módulo de autoservicio de pago.
      </p>
    </div>
  );
}
