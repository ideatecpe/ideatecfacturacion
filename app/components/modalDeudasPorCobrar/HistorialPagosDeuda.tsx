"use client";
import { useState } from "react";
import {
  Pencil, Trash2, Check, X, RefreshCw, AlertTriangle,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import {
  PagoDeudaContado,
  EditarPagoDeudaPayload,
} from "@/app/factufly/deudasporcobrar/gestionDeudasPorCobrar/DeudaContado";
import {
  formatFecha,
  formatMoneda,
  MEDIO_PAGO_OPTS,
} from "@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers";
import { useGestionHistorialDeuda } from "@/app/factufly/deudasporcobrar/gestionDeudasPorCobrar/Usegestionhistorialdeuda";

interface HistorialPagosDeudaProps {
  pagoId: number;
  tipoMoneda: string;
  montoTotal: number;
  historial: PagoDeudaContado[];
  loadingHistorial: boolean;
  onHistorialActualizado: () => void;
  usuarioId: number;
}

interface FilaEditandoState {
  deudaPagoId: number;
  montoPagado: string;
  fechaPago: string;
  medioPago: string;
  entidadFinanciera: string;
  numeroOperacion: string;
  observaciones: string;
}

interface ConfirmEliminar {
  deudaPagoId: number;
  montoPagado: number;
}

export const HistorialPagosDeuda = ({
  pagoId,
  tipoMoneda,
  montoTotal,
  historial,
  loadingHistorial,
  onHistorialActualizado,
  usuarioId,
}: HistorialPagosDeudaProps) => {
  const { loadingEditar, loadingEliminar, editarPago, eliminarPago } =
    useGestionHistorialDeuda();

  const [filaEditando, setFilaEditando] = useState<FilaEditandoState | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<ConfirmEliminar | null>(null);
  const [errorEditar, setErrorEditar] = useState<string | null>(null);

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

  // ── Abrir edición ──────────────────────────────────────────────
  const abrirEdicion = (p: PagoDeudaContado) => {
    setErrorEditar(null);
    setConfirmEliminar(null);
    const fecha = p.fechaPago
      ? new Date(p.fechaPago).toLocaleDateString("en-CA")
      : hoy;
    setFilaEditando({
      deudaPagoId: p.deudaPagoID,
      montoPagado: p.montoPagado.toFixed(2),
      fechaPago: fecha,
      medioPago: p.medioPago ?? "EFECTIVO",
      entidadFinanciera: p.entidadFinanciera ?? "",
      numeroOperacion: p.numeroOperacion ?? "",
      observaciones: p.observaciones ?? "",
    });
  };

  const cancelarEdicion = () => {
    setFilaEditando(null);
    setErrorEditar(null);
  };

  // ── Guardar edición ────────────────────────────────────────────
  const guardarEdicion = async () => {
    if (!filaEditando) return;
    setErrorEditar(null);

    const monto = parseFloat(filaEditando.montoPagado);
    if (isNaN(monto) || monto <= 0) {
      setErrorEditar("Ingrese un monto válido mayor a 0");
      return;
    }

    // Validar que el monto editado no exceda el total considerando los otros pagos
    const montoOtrosPagos = historial
      .filter((h) => h.deudaPagoID !== filaEditando.deudaPagoId)
      .reduce((acc, h) => acc + h.montoPagado, 0);

    if (montoOtrosPagos + monto > montoTotal) {
      setErrorEditar(
        `Monto excede el saldo disponible. Máx: ${formatMoneda(montoTotal - montoOtrosPagos, tipoMoneda)}`
      );
      return;
    }

    const payload: EditarPagoDeudaPayload = {
      deudaPagoId: filaEditando.deudaPagoId,
      pagoId,
      montoPagado: monto,
      fechaPago: new Date(filaEditando.fechaPago).toISOString(),
      medioPago: filaEditando.medioPago,
      tipoMoneda,
      entidadFinanciera: filaEditando.entidadFinanciera || null,
      numeroOperacion: filaEditando.numeroOperacion || null,
      observaciones: filaEditando.observaciones || null,
      usuarioRegistroPago: usuarioId,
    };

    const ok = await editarPago(pagoId, filaEditando.deudaPagoId, payload);
    if (ok) {
      setFilaEditando(null);
      onHistorialActualizado();
    }
  };

  // ── Eliminar ───────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!confirmEliminar) return;
    const ok = await eliminarPago(pagoId, confirmEliminar.deudaPagoId);
    if (ok) {
      setConfirmEliminar(null);
      onHistorialActualizado();
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  if (loadingHistorial) {
    return (
      <div className="flex items-center justify-center gap-2 py-5">
        <RefreshCw size={14} className="animate-spin text-blue-400" />
        <span className="text-xs text-gray-400">Cargando historial...</span>
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="py-5 text-center text-xs text-gray-400">
        Sin registros de pago
      </div>
    );
  }

  const requiereEntidad = (medio: string) =>
    ["TRANSFERENCIA", "TARJETA", "CHEQUE"].includes(medio);
  const requiereNumOp = (medio: string) =>
    ["TRANSFERENCIA", "TARJETA", "CHEQUE", "YAPE", "PLIN"].includes(medio);

  return (
    <div className="text-xs">
      {/* Error edición */}
      {errorEditar && (
        <div className="mx-3 mb-2 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-rose-600">
          <AlertTriangle size={12} />
          <span>{errorEditar}</span>
        </div>
      )}

      {/* Confirmación eliminar */}
      {confirmEliminar && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertTriangle size={12} />
            <span className="font-medium">
              ¿Eliminar pago de{" "}
              {formatMoneda(confirmEliminar.montoPagado, tipoMoneda)}?
            </span>
            <span className="text-orange-500 font-normal">
              La deuda recuperará ese monto.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={confirmarEliminar}
              disabled={loadingEliminar}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold transition-colors disabled:opacity-50"
            >
              {loadingEliminar ? (
                <RefreshCw size={11} className="animate-spin" />
              ) : (
                <Trash2 size={11} />
              )}
              Eliminar
            </button>
            <button
              onClick={() => setConfirmEliminar(null)}
              disabled={loadingEliminar}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md font-medium transition-colors"
            >
              <X size={11} /> Cancelar
            </button>
          </div>
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monto</th>
            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Medio</th>
            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entidad</th>
            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">N° Op.</th>
            <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16">Acc.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {historial.map((p) => {
            const editando =
              filaEditando?.deudaPagoId === p.deudaPagoID;

            if (editando && filaEditando) {
              // ── Fila en modo edición ───────────────────────────
              return (
                <tr key={p.deudaPagoID} className="bg-blue-50/60">
                  {/* Fecha */}
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={filaEditando.fechaPago}
                      max={hoy}
                      onChange={(e) =>
                        setFilaEditando((f) => f && ({ ...f, fechaPago: e.target.value }))
                      }
                      className="w-28 px-2 py-1 bg-white border border-blue-300 rounded-md outline-none focus:border-brand-blue/50 text-xs"
                    />
                  </td>
                  {/* Monto */}
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={filaEditando.montoPagado}
                      min={0.01}
                      step="0.01"
                      onChange={(e) =>
                        setFilaEditando((f) => f && ({ ...f, montoPagado: e.target.value }))
                      }
                      className="w-24 px-2 py-1 bg-white border border-blue-300 rounded-md outline-none focus:border-brand-blue/50 text-xs text-right"
                    />
                  </td>
                  {/* Medio */}
                  <td className="px-2 py-2">
                    <select
                      value={filaEditando.medioPago}
                      onChange={(e) =>
                        setFilaEditando((f) => f && ({ ...f, medioPago: e.target.value }))
                      }
                      className="w-28 px-2 py-1 bg-white border border-blue-300 rounded-md outline-none focus:border-brand-blue/50 text-xs"
                    >
                      {MEDIO_PAGO_OPTS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  {/* Entidad */}
                  <td className="px-2 py-2">
                    {requiereEntidad(filaEditando.medioPago) ? (
                      <input
                        type="text"
                        value={filaEditando.entidadFinanciera}
                        onChange={(e) =>
                          setFilaEditando((f) => f && ({ ...f, entidadFinanciera: e.target.value }))
                        }
                        placeholder="Entidad"
                        className="w-24 px-2 py-1 bg-white border border-blue-300 rounded-md outline-none focus:border-brand-blue/50 text-xs"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  {/* N° Operación */}
                  <td className="px-2 py-2">
                    {requiereNumOp(filaEditando.medioPago) ? (
                      <input
                        type="text"
                        value={filaEditando.numeroOperacion}
                        onChange={(e) =>
                          setFilaEditando((f) => f && ({ ...f, numeroOperacion: e.target.value }))
                        }
                        placeholder="N° Op."
                        className="w-24 px-2 py-1 bg-white border border-blue-300 rounded-md outline-none focus:border-brand-blue/50 text-xs"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  {/* Acciones edición */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={guardarEdicion}
                        disabled={loadingEditar}
                        title="Guardar"
                        className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors disabled:opacity-50"
                      >
                        {loadingEditar ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <Check size={11} />
                        )}
                      </button>
                      <button
                        onClick={cancelarEdicion}
                        disabled={loadingEditar}
                        title="Cancelar"
                        className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-md transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }

            // ── Fila normal ────────────────────────────────────
            const esEliminando = confirmEliminar?.deudaPagoId === p.deudaPagoID;
            return (
              <tr
                key={p.deudaPagoID}
                className={cn(
                  "transition-colors",
                  esEliminando
                    ? "bg-orange-50"
                    : "hover:bg-gray-50/50"
                )}
              >
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                  {formatFecha(p.fechaPago)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                  {formatMoneda(p.montoPagado, tipoMoneda)}
                </td>
                <td className="px-3 py-2.5 text-gray-500">{p.medioPago ?? "—"}</td>
                <td className="px-3 py-2.5 text-gray-500">{p.entidadFinanciera ?? "—"}</td>
                <td className="px-3 py-2.5 text-gray-500">{p.numeroOperacion ?? "—"}</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => abrirEdicion(p)}
                      disabled={!!filaEditando || !!confirmEliminar}
                      title="Editar"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-30"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmEliminar({
                          deudaPagoId: p.deudaPagoID,
                          montoPagado: p.montoPagado,
                        })
                      }
                      disabled={!!filaEditando || !!confirmEliminar}
                      title="Eliminar"
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};