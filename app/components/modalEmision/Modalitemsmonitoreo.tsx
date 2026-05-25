"use client";
import { useState, useCallback } from "react";
import { X, Plus, Trash2, Car, Save, AlertCircle } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────
type Periodo = "mensual" | "trimestral" | "semestral" | "anual";

interface FilaMonitoreo {
  id: string;
  periodo: Periodo;
  desde: string;
  hasta: string;
  placa: string;
  precio: number;
}

interface ItemGenerado {
  descripcion: string;
  precio: number;
}

interface Props {
  igvPorcentaje?: number;
  onGuardar: (items: ItemGenerado[]) => void;
  onCerrar: () => void;
}

// ── Helpers de fecha ───────────────────────────────────────────
const toInputDate = (d: Date) => d.toISOString().split("T")[0];

const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const calcHasta = (desde: string, periodo: Periodo): string => {
  const d = new Date(desde + "T00:00:00");
  switch (periodo) {
    case "mensual":
      d.setMonth(d.getMonth() + 1);
      break;
    case "trimestral":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semestral":
      d.setMonth(d.getMonth() + 6);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  d.setDate(d.getDate() - 1);
  return toInputDate(d);
};

const formatFechaDisplay = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const PERIODO_LABEL: Record<Periodo, string> = {
  mensual: "mensual",
  trimestral: "trimestral",
  semestral: "semestral",
  anual: "anual",
};

const nuevaFila = (): FilaMonitoreo => {
  const desdeStr = toInputDate(hoy());
  return {
    id: crypto.randomUUID(),
    periodo: "mensual",
    desde: desdeStr,
    hasta: calcHasta(desdeStr, "mensual"),
    placa: "",
    precio: 0,
  };
};

// ── Componente ─────────────────────────────────────────────────
export function ModalItemsMonitoreo({ igvPorcentaje = 18, onGuardar, onCerrar }: Props) {
  const [filas, setFilas] = useState<FilaMonitoreo[]>([nuevaFila()]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // ── Actualizar campo ───────────────────────────────────────
  const actualizar = useCallback(
    (id: string, campo: keyof FilaMonitoreo, valor: any) => {
      setFilas((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const actualizada = { ...f, [campo]: valor };

          // Recalcular "hasta" si cambia periodo o desde
          if (campo === "periodo" || campo === "desde") {
            actualizada.hasta = calcHasta(
              campo === "desde" ? valor : f.desde,
              campo === "periodo" ? (valor as Periodo) : f.periodo,
            );
          }
          return actualizada;
        }),
      );
      // Limpiar error del campo
      setErrores((prev) => {
        const n = { ...prev };
        delete n[`${id}-${campo}`];
        return n;
      });
    },
    [],
  );

  const agregarFila = () => setFilas((prev) => [...prev, nuevaFila()]);

  const eliminarFila = (id: string) =>
    setFilas((prev) => prev.filter((f) => f.id !== id));

  // ── Totales ────────────────────────────────────────────────
  const total = filas.reduce((s, f) => s + (f.precio || 0), 0);

  // ── Validar y guardar ──────────────────────────────────────
  const handleGuardar = () => {
    const nuevosErrores: Record<string, string> = {};
    filas.forEach((f) => {
      if (!f.placa.trim()) nuevosErrores[`${f.id}-placa`] = "Requerido";
      if (!f.precio || f.precio <= 0) nuevosErrores[`${f.id}-precio`] = "Requerido";
    });
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    const items: ItemGenerado[] = filas.map((f) => ({
      descripcion: `Servicio de monitoreo ${PERIODO_LABEL[f.periodo]}, desde ${formatFechaDisplay(f.desde)} al ${formatFechaDisplay(f.hasta)}, placa: ${f.placa.trim().toUpperCase()}`,
      precio: f.precio,
    }));
    onGuardar(items);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-gray-100 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-blue-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Ítems por Monitoreo</h2>
              <p className="text-[10px] text-gray-400">Agrega un ítem por cada vehículo a monitorear</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabla ── */}
        <div className="overflow-auto flex-1 px-4 py-4">
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs" style={{ minWidth: "800px" }}>
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left text-gray-400 font-semibold w-8">#</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-semibold w-48">Servicio</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-semibold w-36">Periodo</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-semibold w-36">Desde</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-semibold w-36">Hasta</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-semibold w-36">Placa</th>
                  <th className="px-2 py-2 text-left text-gray-400 font-semibold w-32">Precio (S/)</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filas.map((fila, i) => (
                  <tr key={fila.id} className="hover:bg-blue-50/30 transition-colors group">

                    {/* # */}
                    <td className="px-3 py-3 text-gray-300 font-mono text-[10px]">
                      {String(i + 1).padStart(2, "0")}
                    </td>

                    {/* Servicio — texto fijo */}
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 font-medium text-[10px] leading-tight">
                        <Car className="w-3 h-3 shrink-0" />
                        Servicio de monitoreo
                      </span>
                    </td>

                    {/* Periodo */}
                    <td className="px-3 py-3">
                      <select
                        value={fila.periodo}
                        onChange={(e) => actualizar(fila.id, "periodo", e.target.value as Periodo)}
                        className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                      >
                        <option value="mensual">Mensual</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                      </select>
                    </td>

                    {/* Desde */}
                    <td className="px-3 py-3">
                      <input
                        type="date"
                        value={fila.desde}
                        onChange={(e) => actualizar(fila.id, "desde", e.target.value)}
                        className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                      />
                    </td>

                    {/* Hasta — solo lectura */}
                    <td className="px-3 py-3">
                    <input
                        type="date"
                        value={fila.hasta}
                        onChange={(e) => actualizar(fila.id, "hasta", e.target.value)}
                        className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                    />
                    </td>

                    {/* Placa */}
                      <td className="px-2 py-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={fila.placa}
                            onChange={(e) => actualizar(fila.id, "placa", e.target.value)}
                            placeholder="ABC-123"
                            className={`w-full py-1.5 px-2 bg-gray-50 border rounded-lg text-xs outline-none focus:ring-1 transition-all uppercase placeholder:normal-case
                              ${errores[`${fila.id}-placa`]
                                ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                                : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                              }`}
                          />
                          {errores[`${fila.id}-placa`] && (
                            <div className="absolute -bottom-3.5 left-0 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                              <span className="text-[9px] text-red-400">Requerido</span>
                            </div>
                          )}
                        </div>
                      </td>

                    {/* Precio */}
                    <td className="px-3 py-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-mono">S/</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={fila.precio === 0 ? "" : fila.precio}
                          onChange={(e) => actualizar(fila.id, "precio", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className={`w-full py-1.5 pl-7 pr-2 bg-gray-50 border rounded-lg text-xs text-right outline-none focus:ring-1 transition-all font-mono
                            ${errores[`${fila.id}-precio`]
                              ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                              : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                            }`}
                        />
                        {errores[`${fila.id}-precio`] && (
                          <div className="absolute -bottom-4 right-0 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                            <span className="text-[9px] text-red-400">Requerido</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Eliminar */}
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => filas.length > 1 && eliminarFila(fila.id)}
                        disabled={filas.length === 1}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* ── Fila totales ── */}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-3 py-3">
                    <button
                      type="button"
                      onClick={agregarFila}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar vehículo
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Total</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-bold text-blue-700 font-mono">
                      S/ {total.toFixed(2)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Info IGV */}
          {total > 0 && (
            <div className="mt-3 flex justify-end">
              <div className="flex items-center gap-4 text-[10px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
                <span>Valor venta: <span className="text-gray-600 font-mono font-medium">S/ {(total / (1 + igvPorcentaje / 100)).toFixed(2)}</span></span>
                <span className="text-gray-200">|</span>
                <span>IGV ({igvPorcentaje}%): <span className="text-gray-600 font-mono font-medium">S/ {(total - total / (1 + igvPorcentaje / 100)).toFixed(2)}</span></span>
                <span className="text-gray-200">|</span>
                <span className="font-bold text-blue-600">Total: S/ {total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <p className="text-[10px] text-gray-400">
            {filas.length} vehículo{filas.length !== 1 ? "s" : ""} · Cada fila se agrega como un ítem independiente
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={filas.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar {filas.length} ítem{filas.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}