"use client";
import { useEffect, useState } from "react";
import { X, RefreshCw, FileWarning, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useSireDescargarPropuesta } from "@/app/factufly/sire/gestionSire/useSireDescargarPropuesta";
import { SireComprobanteDto } from "@/app/factufly/sire/gestionSire/types";

const TIPO_COMPROBANTE: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de Crédito",
  "08": "Nota de Débito",
};

function formatMoneda(valor: number, moneda: string | null) {
  const simbolo = moneda === "USD" ? "$" : "S/";
  return `${simbolo} ${valor.toFixed(2)}`;
}

interface Props {
  ruc: string;
  perTributario: string;
  onClose: () => void;
}

export function ModalPropuestaSire({ ruc, perTributario, onClose }: Props) {
  const { loading, descargarPropuesta } = useSireDescargarPropuesta();
  const [comprobantes, setComprobantes] = useState<SireComprobanteDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const data = await descargarPropuesta(ruc, perTributario);
      if (cancelado) return;
      if (data?.success) {
        setComprobantes(data.comprobantes);
      } else {
        setError(data?.mensaje ?? "No se pudo generar la propuesta");
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruc, perTributario]);

  const totales = comprobantes?.reduce(
    (acc, c) => ({
      base: acc.base + (c.activo ? c.baseImponible : 0),
      igv: acc.igv + (c.activo ? c.igv : 0),
      total: acc.total + (c.activo ? c.importeTotal : 0),
    }),
    { base: 0, igv: 0, total: 0 },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 min-h-screen h-full">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col animate-in zoom-in-95 duration-200"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-base font-bold text-gray-900">Propuesta SIRE — Periodo {perTributario}</p>
            <p className="text-xs text-gray-500 mt-0.5">Detalle de comprobantes reportados por SUNAT para este periodo</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              <p className="text-sm text-gray-500">Generando propuesta en SUNAT...</p>
              <p className="text-xs text-gray-400">Esto puede tardar hasta un minuto, SUNAT procesa el reporte de forma asíncrona.</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <FileWarning className="w-8 h-8 text-amber-400" />
              <p className="text-sm text-gray-600 font-medium">{error}</p>
            </div>
          ) : !comprobantes || comprobantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <FileWarning className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-400">SUNAT no reportó comprobantes para este periodo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Base Imp.</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">IGV</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comprobantes.map((c, idx) => (
                    <tr key={`${c.carSunat}-${idx}`} className={cn("hover:bg-gray-50/50 transition-colors", !c.activo && "opacity-50")}>
                      <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">{c.fechaEmision ?? "—"}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <p className="text-xs font-medium text-gray-900">{c.serie}-{c.numero}</p>
                        <p className="text-[10px] text-gray-400">{TIPO_COMPROBANTE[c.tipoComprobante ?? ""] ?? c.tipoComprobante}</p>
                        {c.inconsistencias && (
                          <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                            <FileWarning size={10} /> {c.inconsistencias}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-xs font-medium text-gray-900 truncate max-w-52">{c.razonSocialCliente ?? "—"}</p>
                        <p className="text-[10px] text-gray-400">{c.numDocCliente ?? "—"}</p>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.baseImponible, c.codMoneda)}</td>
                      <td className="px-4 py-2 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoneda(c.igv, c.codMoneda)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-gray-900 text-right whitespace-nowrap">{formatMoneda(c.importeTotal, c.codMoneda)}</td>
                      <td className="px-4 py-2 text-center">
                        {c.activo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-semibold">
                            <CheckCircle2 size={10} /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[10px] font-semibold">
                            <XCircle size={10} /> Anulado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer con totales */}
        {comprobantes && comprobantes.length > 0 && totales && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {comprobantes.length} comprobante{comprobantes.length !== 1 ? "s" : ""} reportado{comprobantes.length !== 1 ? "s" : ""} (solo activos en los totales)
            </p>
            <div className="flex items-center gap-5 text-xs">
              <span className="text-gray-500">Base: <strong className="text-gray-800">{totales.base.toFixed(2)}</strong></span>
              <span className="text-gray-500">IGV: <strong className="text-gray-800">{totales.igv.toFixed(2)}</strong></span>
              <span className="text-gray-500">Total: <strong className="text-gray-900">{totales.total.toFixed(2)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
