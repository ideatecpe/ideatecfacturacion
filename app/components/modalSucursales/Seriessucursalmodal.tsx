"use client";
import React, { useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { Sucursal } from "./types";

export function SeriesSucursalModal({
  sucursal,
  onClose,
  onSave,
}: {
  sucursal: Sucursal;
  onClose: () => void;
  onSave: (id: string, data: any) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    serieFactura:                   sucursal.serieFactura,
    correlativoFactura:             sucursal.correlativoFactura,
    serieBoleta:                    sucursal.serieBoleta,
    correlativoBoleta:              sucursal.correlativoBoleta,
    serieNotaCreditoFactura:        sucursal.serieNotaCreditoFactura,
    correlativoNotaCreditoFactura:  sucursal.correlativoNotaCreditoFactura,
    serieNotaCreditoBoleta:         sucursal.serieNotaCreditoBoleta,
    correlativoNotaCreditoBoleta:   sucursal.correlativoNotaCreditoBoleta,
    serieNotaDebitoFactura:         sucursal.serieNotaDebitoFactura,
    correlativoNotaDebitoFactura:   sucursal.correlativoNotaDebitoFactura,
    serieNotaDebitoBoleta:          sucursal.serieNotaDebitoBoleta,
    correlativoNotaDebitoBoleta:    sucursal.correlativoNotaDebitoBoleta,
    serieGuiaRemision:              sucursal.serieGuiaRemision,
    correlativoGuiaRemision:        sucursal.correlativoGuiaRemision,
    serieGuiaTransportista:         sucursal.serieGuiaTransportista,
    correlativoGuiaTransportista:   sucursal.correlativoGuiaTransportista,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(sucursal.id, form);
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { label: "Factura",              serieKey: "serieFactura",               corrKey: "correlativoFactura" },
    { label: "Boleta",               serieKey: "serieBoleta",                corrKey: "correlativoBoleta" },
    { label: "Nota Crédito Factura", serieKey: "serieNotaCreditoFactura",    corrKey: "correlativoNotaCreditoFactura" },
    { label: "Nota Crédito Boleta",  serieKey: "serieNotaCreditoBoleta",     corrKey: "correlativoNotaCreditoBoleta" },
    { label: "Nota Débito Factura",  serieKey: "serieNotaDebitoFactura",     corrKey: "correlativoNotaDebitoFactura" },
    { label: "Nota Débito Boleta",   serieKey: "serieNotaDebitoBoleta",      corrKey: "correlativoNotaDebitoBoleta" },
    { label: "Guía de Remisión",     serieKey: "serieGuiaRemision",          corrKey: "correlativoGuiaRemision" },
    { label: "Guía Transportista",   serieKey: "serieGuiaTransportista",     corrKey: "correlativoGuiaTransportista" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-50 border border-green-100">
              <FileText className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Series — {sucursal.nombre}</p>
              <p className="text-xs text-gray-500">Código: {sucursal.codigo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Documento</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Serie</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Correlativo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-4 py-3 text-gray-700 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          {(form as any)[row.serieKey]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center font-mono text-gray-600 outline-none focus:border-brand-blue/50"
                          value={(form as any)[row.corrKey]}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              [row.corrKey]: Math.max(1, parseInt(e.target.value) || 1),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando..." : "Guardar Series"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}