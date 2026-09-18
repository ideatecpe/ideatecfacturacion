"use client";

import { Loader2, ShoppingBag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { ConfigTiendaOnline } from "./ConfigTiendaOnline";

/**
 * Tienda online de la sucursal. Antes vivía al final de la pantalla de Empresa,
 * que carga muchísimo más de lo necesario para algo que se toca a diario
 * (cerrar la tienda, cambiar el horario o copiar el enlace).
 */
export default function TiendaOnlinePage() {
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();

  const canEdit = user?.rol === "admin" || user?.rol === "superadmin";
  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;

  if (!config) {
    return (
      <div className="py-20 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  // La tienda entrega sus pedidos en la Caja Autopago: sin ese módulo no hay dónde cobrarlos.
  if (!config.isStock || !config.isCajaAutopago) {
    return (
      <Aviso texto="Para usar la tienda online activa Stock / Proveedores y Caja Autopago en Empresa → Configuración." />
    );
  }

  if (!sucursalId) {
    return <Aviso texto="Tu usuario no tiene una sucursal asignada, y la tienda online es de una sucursal." />;
  }

  return (
    <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white overflow-hidden">
      <ConfigTiendaOnline
        sucursalId={sucursalId}
        entorno={user?.environment ?? null}
        accessToken={accessToken}
        canEdit={canEdit}
      />
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="mx-auto max-w-lg mt-10 rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
      <div className="mx-auto h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
        <ShoppingBag className="w-6 h-6 text-brand-blue" />
      </div>
      <p className="text-sm text-gray-600">{texto}</p>
    </div>
  );
}
