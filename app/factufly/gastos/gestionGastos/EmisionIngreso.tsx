"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, CheckCircle2, FileCheck } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import BoletaPage from "@/app/factufly/operaciones/boleta/page";
import FacturaPage from "@/app/factufly/operaciones/factura/page";
import NotaVentaPage from "@/app/factufly/operaciones/nota-venta/page";
import { EmisionEmbebida } from "@/app/factufly/operaciones/emisionEmbebida";
import { ControlCaja } from "@/app/components/caja/ControlCaja";
import {
  cerrarEmisionIngreso, leerEmision, leerEmisionServidor, suscribirEmision, type ComprobanteIngreso,
} from "./ingresoPorEmitir";
import { formatSoles } from "./tipos";

const PESTANAS: { codigo: ComprobanteIngreso; nombre: string }[] = [
  { codigo: "03", nombre: "Boleta" },
  { codigo: "01", nombre: "Factura" },
  { codigo: "NV", nombre: "Nota de venta" },
];

/**
 * Emisión del comprobante de un ingreso, dentro de Movimientos: el mismo formulario clásico
 * de Boleta / Factura / Nota de venta (cliente, detalle, emitir), con el ítem ya cargado.
 * Siempre es el formulario clásico, aunque la empresa use Caja Autopago.
 */
export function EmisionIngreso({ onVolver }: { onVolver: () => void }) {
  const { config } = useConfiguracion();
  const { ingreso, registrado } = useSyncExternalStore(suscribirEmision, leerEmision, leerEmisionServidor);
  const [comprobante, setComprobante] = useState<ComprobanteIngreso>(ingreso?.tipoComprobante ?? "03");

  const volver = () => {
    cerrarEmisionIngreso();
    onVolver();
  };

  if (!ingreso) return null;

  const formulario = (
    <EmisionEmbebida>
      {comprobante === "01" && <FacturaPage />}
      {comprobante === "03" && <BoletaPage />}
      {comprobante === "NV" && <NotaVentaPage />}
    </EmisionEmbebida>
  );

  return (
    <div className="space-y-2">
      {/* Cabecera: qué se factura y con qué comprobante */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={volver}
            title="Volver a Movimientos"
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 bg-[#0f2e64]/8 hover:bg-[#0f2e64]/15 text-[#0f2e64]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#0f2e64] leading-tight">Emitir comprobante del ingreso</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {ingreso.categoriaNombre} · {ingreso.datos.descripcion} · {formatSoles(ingreso.datos.monto)}
            </p>
          </div>
        </div>
        {!registrado && (
          <div className="flex p-0.5 rounded-lg w-full sm:w-auto bg-[#0f2e64]/7 border border-[#0f2e64]/10">
            {PESTANAS.filter((p) => p.codigo !== "NV" || config?.useNotaVenta).map((p) => (
              <button
                key={p.codigo}
                type="button"
                onClick={() => setComprobante(p.codigo)}
                className={cn(
                  "flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  comprobante === p.codigo ? "bg-[#0f2e64] text-white shadow-sm" : "text-[#0f2e64]/60",
                )}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {registrado ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="flex-1 min-w-0 text-xs font-semibold text-emerald-900">
            Ingreso &quot;{ingreso.categoriaNombre}&quot; registrado con su comprobante.
          </p>
          <button
            type="button"
            onClick={volver}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Volver a Movimientos
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs text-sky-900">
          <FileCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
          Elige al cliente y emite. Al emitir, el ingreso se registra solo con este comprobante y cuenta como venta del mes.
        </div>
      )}

      {/* Con control de caja, la venta necesita el turno abierto (igual que en Nueva Venta). */}
      {config?.administraCaja ? <ControlCaja>{formulario}</ControlCaja> : formulario}
    </div>
  );
}
