"use client";

import {
  User,
  Building2,
  CalendarRange,
  Hash,
  Mail,
  Phone,
  Car,
  Receipt,
  Tag,
  Split,
  Combine,
} from "lucide-react";
import type { GrupoData } from "./types";
import { PERIODO_CFG } from "./constants";
import { formatFechaEs } from "./helpers";

// ─── Card de un grupo (comprobante agrupado) ──────────────────────────────────

type Props = {
  grupo: GrupoData;
  cfg: (typeof PERIODO_CFG)[string];
  selected?: boolean;
  onToggle?: () => void;
  onSepararItem?: (id: string) => void;
};

export function GrupoCard({ grupo, cfg, selected, onToggle, onSepararItem }: Props) {
  const simbolo  = grupo.moneda === "USD" ? "$" : "S/";
  const esBoleta = grupo.tipoDoc === "B";
  const fechaIni = grupo.items[0]?.fechaini ?? "";
  const fechaFin = grupo.items[grupo.items.length - 1]?.fechafin ?? "";

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden hover:shadow-sm transition-all flex flex-col text-xs">

      {/* ── Cabecera: tipo + período + rango fechas ── */}
      <div className={`px-3 py-2 ${cfg.bgCard} border-b ${cfg.borderClass} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-1.5">
          {onToggle !== undefined && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 accent-brand-blue cursor-pointer shrink-0"
            />
          )}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
              esBoleta
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {esBoleta ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
            {esBoleta ? "Boleta" : "Factura"}
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg.badgeClass}`}>
            <Tag className="w-2 h-2" />
            {cfg.label}
          </span>
        </div>
        {fechaIni && (
          <span className="inline-flex items-center gap-1 text-[9px] text-gray-400 tabular-nums shrink-0">
            <CalendarRange className="w-2.5 h-2.5" />
            {formatFechaEs(fechaIni)}
            <span className="text-gray-300 mx-0.5">→</span>
            {formatFechaEs(fechaFin)}
          </span>
        )}
      </div>

      {/* ── Cliente ── */}
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="font-bold text-gray-900 leading-tight truncate">
          {grupo.razonSocial || <span className="italic text-gray-400">Sin nombre</span>}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Hash className="w-2.5 h-2.5 text-gray-300 shrink-0" />
          <span className="text-[10px] text-gray-400 font-mono">{grupo.numdoc}</span>
        </div>
        {(grupo.correo || grupo.whatsapp) && (
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {grupo.correo && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <Mail className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span className="truncate max-w-[130px]">{grupo.correo}</span>
              </span>
            )}
            {grupo.whatsapp && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <Phone className="w-2.5 h-2.5 text-green-400 shrink-0" />
                {grupo.whatsapp}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Placas / ítems ── */}
      <div className="px-3 py-2 flex-1">
        <div className="flex items-center gap-1 mb-1.5">
          <Car className="w-3 h-3 text-gray-300" />
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
            {grupo.items.length} placa{grupo.items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-1">
          {grupo.items.map((item) => {
            const conceptoCorto = item.concepto
              .replace(/^Servicio de monitoreo /i, "")
              .replace(/, placa [A-Z0-9-]+$/i, "");
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md ${cfg.bgCard} border ${cfg.borderClass}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`px-1.5 py-px rounded text-[10px] font-black font-mono shrink-0 ${cfg.badgeClass}`}>
                    {item.placa || "—"}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate" title={item.concepto}>
                    {conceptoCorto}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-gray-800 tabular-nums">
                    {simbolo}&nbsp;{Number(item.importe).toFixed(2)}
                  </span>
                  {onSepararItem && grupo.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onSepararItem(item.id)}
                      title="Emitir este ítem en un comprobante aparte"
                      className="p-0.5 rounded text-gray-400 hover:text-brand-blue hover:bg-white transition-colors"
                    >
                      <Split className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Aviso: este comprobante fue separado manualmente ── */}
      {onSepararItem && grupo.items.length === 1 && grupo.items[0].separarManual && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => onSepararItem(grupo.items[0].id)}
            title="Volver a agrupar con comprobantes del mismo periodo"
            className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-dashed border-gray-300 text-[10px] font-semibold text-gray-500 hover:text-brand-blue hover:border-brand-blue transition-colors"
          >
            <Combine className="w-3 h-3" />
            Separado manualmente · Unir de nuevo
          </button>
        </div>
      )}

      {/* ── Footer: total ── */}
      <div className={`px-3 py-2 ${cfg.bgCard} border-t ${cfg.borderClass} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Receipt className="w-2.5 h-2.5" />
            {grupo.items.length} ítem{grupo.items.length !== 1 ? "s" : ""}
          </span>
          {grupo.totales.igvTotal > 0 && (
            <span className="text-amber-600 font-medium">
              IGV&nbsp;{simbolo}&nbsp;{grupo.totales.igvTotal.toFixed(2)}
            </span>
          )}
          {grupo.totales.exoneradas > 0 && grupo.totales.gravadas === 0 && (
            <span className="text-emerald-600 font-medium">Exonerado</span>
          )}
        </div>
        <span className="text-sm font-black text-gray-900 tabular-nums shrink-0">
          {simbolo}&nbsp;{grupo.total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
