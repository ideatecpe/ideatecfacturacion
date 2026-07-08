"use client";

import {
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface PagoLocal {
  medioPago: string;
  monto: string;
  numeroOperacion: string;
  entidadFinanciera: string;
  observaciones: string;
}

interface MedioDePagoSelectorProps {
  pagos: PagoLocal[];
  setPagosEditados: React.Dispatch<React.SetStateAction<boolean[]>>;
  mediosUsados: string[];
  todosMedios: string[];
  agregarPago: () => void;
  eliminarPago: (i: number) => void;
  actualizarPago: (i: number, campo: keyof PagoLocal, valor: string) => void;
  totales: { total: number };
  totalPagado: number;
  simbolo: string;
  fmtMonto: (n: number) => string;
  tipoPago: string;
}

const MEDIOS_PAGO_ICONOS: Record<
  string,
  { icon: typeof Banknote; activo: string; inactivo: string }
> = {
  Efectivo: {
    icon: Banknote,
    activo: "border-emerald-500 bg-emerald-50 text-emerald-700",
    inactivo: "border-gray-200 text-gray-500 hover:border-gray-300",
  },
  Tarjeta: {
    icon: CreditCard,
    activo: "border-brand-blue bg-brand-blue/5 text-brand-blue",
    inactivo: "border-gray-200 text-gray-500 hover:border-gray-300",
  },
  Yape: {
    icon: Smartphone,
    activo: "border-violet-500 bg-violet-50 text-violet-700",
    inactivo: "border-gray-200 text-gray-500 hover:border-gray-300",
  },
  Plin: {
    icon: Smartphone,
    activo: "border-sky-500 bg-sky-50 text-sky-700",
    inactivo: "border-gray-200 text-gray-500 hover:border-gray-300",
  },
  Transferencia: {
    icon: Landmark,
    activo: "border-amber-500 bg-amber-50 text-amber-700",
    inactivo: "border-gray-200 text-gray-500 hover:border-gray-300",
  },
};

function ChipMedioPago({
  medio,
  activo,
  disabled,
  size = "md",
  onClick,
}: {
  medio: string;
  activo: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  onClick: () => void;
}) {
  const cfg = MEDIOS_PAGO_ICONOS[medio] ?? {
    icon: CreditCard,
    activo: "border-brand-blue bg-brand-blue/5 text-brand-blue",
    inactivo: "border-gray-200 text-gray-500 hover:border-gray-300",
  };
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 transition-colors ${
        size === "sm" ? "px-2 py-1.5" : "px-3 py-2"
      } ${activo ? cfg.activo : cfg.inactivo} ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <Icon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      <span className={size === "sm" ? "text-[9px] font-medium" : "text-[10px] font-semibold"}>
        {medio}
      </span>
    </button>
  );
}

export default function MedioDePagoSelector({
  pagos,
  setPagosEditados,
  mediosUsados,
  todosMedios,
  agregarPago,
  eliminarPago,
  actualizarPago,
  totales,
  totalPagado,
  simbolo,
  fmtMonto,
  tipoPago,
}: MedioDePagoSelectorProps) {
  return (
    <div>
      {pagos.length === 1 ? (
        /* ── 1 solo medio: chips, sin card ── */
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-brand-blue" />
              </div>
              <h3 className="text-xs font-semibold text-brand-blue">Medio de Pago</h3>
            </div>
            {mediosUsados.length < todosMedios.length && (
              <button
                type="button"
                onClick={agregarPago}
                className="text-xs text-brand-blue hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar otro medio de pago
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {todosMedios.map((m) => (
              <ChipMedioPago
                key={m}
                medio={m}
                activo={pagos[0].medioPago === m}
                onClick={() => actualizarPago(0, "medioPago", m)}
              />
            ))}
          </div>
          {pagos[0].medioPago === "Transferencia" && (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={pagos[0].numeroOperacion}
                onChange={(e) => actualizarPago(0, "numeroOperacion", e.target.value)}
                placeholder="Nº op."
                className="w-24 shrink-0 py-1.5 px-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-xs"
              />
              <input
                type="text"
                value={pagos[0].entidadFinanciera}
                onChange={(e) => actualizarPago(0, "entidadFinanciera", e.target.value)}
                placeholder="Banco/entidad"
                className="flex-1 py-1.5 px-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-xs"
              />
            </div>
          )}
        </div>
      ) : (
        /* ── 2+ medios: cards en fila ── */
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-brand-blue" />
              </div>
              <h3 className="text-xs font-semibold text-brand-blue">Datos de Pago</h3>
            </div>
            {mediosUsados.length < todosMedios.length && (
              <button
                type="button"
                onClick={agregarPago}
                className="text-xs text-brand-blue hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar otro medio de pago
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {pagos.map((pago, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-fit space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">
                    Medio #{i + 1}
                  </span>
                  <button type="button" onClick={() => eliminarPago(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {todosMedios.map((m) => (
                    <ChipMedioPago
                      key={m}
                      medio={m}
                      size="sm"
                      activo={pago.medioPago === m}
                      disabled={mediosUsados.includes(m) && pago.medioPago !== m}
                      onClick={() => actualizarPago(i, "medioPago", m)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="number"
                    min={0}
                    value={pago.monto}
                    placeholder={`${simbolo} 0.00`}
                    onChange={(e) => {
                      actualizarPago(i, "monto", e.target.value);
                      setPagosEditados((prev) => {
                        const n = [...prev];
                        n[i] = e.target.value !== "";
                        if (pagos.length === 2) n[i === 0 ? 1 : 0] = true;
                        return n;
                      });
                    }}
                    onBlur={(e) => {
                      if (!e.target.value || e.target.value === "0") {
                        setPagosEditados((prev) => {
                          const n = [...prev];
                          n[i] = false;
                          return n;
                        });
                        actualizarPago(i, "monto", "");
                      }
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => {
                      if (Number(e.currentTarget.value) === 0) e.currentTarget.select();
                    }}
                    className="w-20 shrink-0 py-1.5 pl-2 pr-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {pago.medioPago === "Transferencia" && (
                    <>
                      <input
                        type="text"
                        value={pago.numeroOperacion}
                        onChange={(e) => actualizarPago(i, "numeroOperacion", e.target.value)}
                        placeholder="Nº op."
                        className="w-16 shrink-0 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-xs"
                      />
                      <input
                        type="text"
                        value={pago.entidadFinanciera}
                        onChange={(e) => actualizarPago(i, "entidadFinanciera", e.target.value)}
                        placeholder="Banco"
                        className="flex-1 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-xs"
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {totales.total > 0 && (
            <div className="flex justify-end">
              <span
                className={`text-xs font-medium flex items-center gap-1 ${
                  Math.abs(totalPagado - totales.total) <= 0.01
                    ? "text-green-600"
                    : totalPagado > totales.total
                      ? "text-red-600"
                      : "text-amber-600"
                }`}
              >
                {Math.abs(totalPagado - totales.total) <= 0.01 ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Cuadra
                  </>
                ) : totalPagado > totales.total ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Sobra {simbolo}
                    {fmtMonto(totalPagado - totales.total)}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Falta {simbolo}
                    {fmtMonto(totales.total - totalPagado)}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {tipoPago === "CreditoInicial" && (
        <div className="flex justify-between text-xs border-t border-gray-100 pt-1 mt-1.5">
          <p className="text-gray-500">
            Total pagado: <span className="font-semibold text-gray-800">{simbolo} {fmtMonto(totalPagado)}</span>
          </p>
          <p className="text-gray-500">
            A crédito:{" "}
            <span className="font-semibold text-brand-blue">
              {simbolo} {fmtMonto(Math.max(0, totales.total - totalPagado))}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
