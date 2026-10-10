"use client";

import { useState } from "react";
import { Calculator, ChevronDown, Check } from "lucide-react";

interface Props {
  /** Ganancia por defecto para proponer el precio de venta (sobre lo que se cobra). */
  margenSugerido?: number;
  onUsar: (precios: { costo: number; venta: number | null; stock: number | null }) => void;
}

const leer = (t: string) => {
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const filtrar = (t: string) => t.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 10);
/** Hasta 4 decimales, como se guarda el costo; sin ceros sobrantes. */
const redondear4 = (n: number) => Math.round(n * 10000) / 10000;
/** Precio de venta sugerido: hacia arriba, a los 10 céntimos. */
const redondearPrecio = (n: number) => Math.ceil(Math.round(n * 1000) / 100) / 10;
const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Para productos por kilo que se compran por peso total ("son 10 kg, son S/ 15"):
 * convierte el total en precio por kilo, y propone el de venta.
 */
export default function CalculadoraPorKilo({ margenSugerido = 30, onUsar }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [peso, setPeso] = useState("");
  const [pagado, setPagado] = useState("");
  const [ventaTotal, setVentaTotal] = useState("");
  const [margen, setMargen] = useState(String(margenSugerido));
  const [comoStock, setComoStock] = useState(false);

  const kg = leer(peso);
  const totalPagado = leer(pagado);
  const totalVenta = leer(ventaTotal);
  const m = Number(margen);
  const margenValido = Number.isFinite(m) && m >= 0 && m < 100;

  const costoKg = kg && totalPagado ? totalPagado / kg : null;
  const ventaKgDelTotal = kg && totalVenta ? totalVenta / kg : null;
  const ventaKgSugerida = costoKg && margenValido ? redondearPrecio(costoKg / (1 - m / 100)) : null;
  const ventaKg = ventaKgDelTotal ?? ventaKgSugerida;
  const gananciaPct = costoKg && ventaKg ? ((ventaKg - costoKg) / ventaKg) * 100 : null;

  const usar = () => {
    if (!costoKg) return;
    onUsar({
      costo: redondear4(costoKg),
      venta: ventaKg ? Math.round(ventaKg * 100) / 100 : null,
      stock: comoStock && kg ? kg : null,
    });
    setAbierta(false);
  };

  const campo = (
    etiqueta: string,
    valor: string,
    set: (v: string) => void,
    sufijo: string,
    prefijo?: string,
    placeholder = "0",
  ) => (
    <label className="block">
      <span className="text-[11px] font-medium text-gray-600">{etiqueta}</span>
      <div className="mt-1 flex items-center h-9 rounded-md border border-gray-200 bg-white px-2 focus-within:border-brand-blue">
        {prefijo && <span className="mr-1 text-xs text-gray-400">{prefijo}</span>}
        <input
          value={valor}
          onChange={(e) => set(filtrar(e.target.value))}
          inputMode="decimal"
          placeholder={placeholder}
          className="w-full min-w-0 text-sm outline-none tabular-nums text-right bg-transparent"
        />
        {sufijo && <span className="ml-1 text-xs text-gray-400">{sufijo}</span>}
      </div>
    </label>
  );

  return (
    <div className="rounded-lg border border-dashed border-brand-blue/30 bg-blue-50/30">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Calculator className="w-4 h-4 text-brand-blue shrink-0" />
        <span className="flex-1 text-xs">
          <span className="font-semibold text-brand-blue">¿Te lo venden por peso total?</span>{" "}
          <span className="text-gray-500">Pon cuánto pesó y cuánto pagaste: te sacamos el precio por kilo.</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${abierta ? "rotate-180" : ""}`} />
      </button>

      {abierta && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {campo("¿Cuánto pesó todo?", peso, setPeso, "kg", undefined, "Ej: 10")}
            {campo("¿Cuánto pagaste en total?", pagado, setPagado, "", "S/", "Ej: 15.00")}
            {campo("¿A cuánto lo vendes todo? (opcional)", ventaTotal, setVentaTotal, "", "S/", "Ej: 20.00")}
          </div>

          {!ventaTotal && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Si no sabes a cuánto venderlo, quiero ganar</span>
              <div className="flex items-center h-8 w-20 rounded-md border border-gray-200 bg-white px-2 focus-within:border-brand-blue">
                <input
                  value={margen}
                  onChange={(e) => setMargen(filtrar(e.target.value))}
                  inputMode="decimal"
                  aria-label="Ganancia que quieres"
                  className="w-full min-w-0 text-sm outline-none tabular-nums text-right"
                />
                <span className="ml-1 text-xs text-gray-400">%</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-md bg-white border border-gray-200 p-2.5 text-center">
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-500">Precio de compra</p>
              <p className="text-base font-bold text-gray-900 tabular-nums">
                {costoKg ? `${soles(costoKg)}` : "—"}
                <span className="text-xs font-normal text-gray-400"> el kg</span>
              </p>
              {costoKg && totalPagado && kg && (
                <p className="text-[10px] text-gray-400 tabular-nums">
                  {soles(totalPagado)} ÷ {kg} kg
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-500">Precio de venta</p>
              <p className="text-base font-bold text-gray-900 tabular-nums">
                {ventaKg ? soles(ventaKg) : "—"}
                <span className="text-xs font-normal text-gray-400"> el kg</span>
              </p>
              {ventaKg && gananciaPct != null && (
                <p className={`text-[10px] tabular-nums ${gananciaPct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  ganas {soles(ventaKg - (costoKg ?? 0))} por kg ({Math.round(gananciaPct)} %)
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={comoStock}
                onChange={(e) => setComoStock(e.target.checked)}
                className="w-3.5 h-3.5 accent-brand-blue"
              />
              Ya lo tengo: poner {kg ? `${kg} kg` : "ese peso"} como stock inicial
            </label>
            <button
              type="button"
              onClick={usar}
              disabled={!costoKg}
              className="ml-auto h-8 px-3 rounded-md bg-brand-blue text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0a2050] disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" /> Usar estos precios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
