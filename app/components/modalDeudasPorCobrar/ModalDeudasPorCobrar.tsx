"use client";
import { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Calendar,
  Clock,
  History,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import {
  DeudaContado,
  PagoDeudaContado,
  RegistrarPagoDeudaPayload,
} from "@/app/factufly/deudasporcobrar/gestionDeudasPorCobrar/DeudaContado";
import {
  formatFecha,
  formatMoneda,
  tipoComprobanteLabel,
  MEDIO_PAGO_OPTS,
} from "@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers";
import { useHistorialDeudaContado } from "@/app/factufly/deudasporcobrar/gestionDeudasPorCobrar/UseHistorialDeudaContado";
import { useAuth } from "@/context/AuthContext";
import { HistorialPagosDeuda } from "./HistorialPagosDeuda";

interface ModalDeudasPorCobrarProps {
  deuda: DeudaContado;
  onClose: () => void;
  onConfirm: (payload: RegistrarPagoDeudaPayload) => Promise<void>;
  loading: boolean;
  usuarioId: number;
  onRefrescar: () => Promise<void>
}

export const ModalDeudasPorCobrar = ({
  deuda,
  onClose,
  onConfirm,
  loading,
  usuarioId,
  onRefrescar,
}: ModalDeudasPorCobrarProps) => {
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { user } = useAuth();

  const RUC_ESPECIAL = "20512134832";
  const esEmisorEspecial = user?.ruc === RUC_ESPECIAL;

  const [montoPagadoActual, setMontoPagadoActual] = useState(deuda.montoPagado)
  const [huboCambios, setHuboCambios] = useState(false)

  const montoBase = deuda.saldoReal ?? deuda.montoTotal
  const montoRestante = montoBase - montoPagadoActual
  const [montoPagado, setMontoPagado] = useState(montoRestante.toFixed(2));
  const [fechaPago, setFechaPago] = useState(hoy);
  const [medioPago, setMedioPago] = useState(
    esEmisorEspecial ? "TRANSFERENCIA" : "EFECTIVO",
  );
  const [entidadFinanciera, setEntidadFinanciera] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Acordeón historial
  const hookHistorial = useHistorialDeudaContado();
  const yaEstaCompleto = montoRestante <= 0;
  const [historialAbierto, setHistorialAbierto] = useState(yaEstaCompleto);
  const [historial, setHistorial] = useState<PagoDeudaContado[]>([]);
  const [historialCargado, setHistorialCargado] = useState(false);

  const tieneHistorial = montoPagadoActual > 0;
  const requiereEntidad = ["TRANSFERENCIA", "TARJETA", "CHEQUE"].includes(
    medioPago,
  );
  const requiereNumOp = [
    "TRANSFERENCIA",
    "TARJETA",
    "CHEQUE",
    "YAPE",
    "PLIN",
  ].includes(medioPago);
  const montoPagadoNum = parseFloat(montoPagado) || 0;
  const montoTrasEstePago = montoPagadoActual + montoPagadoNum;
  const quedaria = Math.max(0, montoBase - montoTrasEstePago);

  const toggleHistorial = async () => {
    if (historialAbierto) {
      setHistorialAbierto(false);
      return;
    }
    setHistorialAbierto(true);
    if (!historialCargado) {
      const data = await hookHistorial.fetchHistorial(deuda.pagoId);
      setHistorial(data);
      setHistorialCargado(true);
    }
  };

  // Carga automática del historial si el doc ya está pagado
  useEffect(() => {
    if (yaEstaCompleto && !historialCargado) {
      hookHistorial.fetchHistorial(deuda.pagoId).then(data => {
        setHistorial(data);
        setHistorialCargado(true);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const monto = parseFloat(montoPagado);
    if (!montoPagado || isNaN(monto) || monto <= 0)
      errs.montoPagado = "Ingrese un monto válido";
    if (monto > montoRestante)
      errs.montoPagado = `El monto no puede superar el restante (${formatMoneda(montoRestante, deuda.tipoMoneda)})`;
    if (!fechaPago) errs.fechaPago = "Seleccione una fecha";
    if (!medioPago) errs.medioPago = "Seleccione un medio de pago";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    const payload: RegistrarPagoDeudaPayload = {
      pagoId: deuda.pagoId,
      montoPagado: parseFloat(montoPagado),
      fechaPago: new Date(fechaPago).toISOString(),
      medioPago,
      tipoMoneda: deuda.tipoMoneda,
      entidadFinanciera: entidadFinanciera || null,
      numeroOperacion: numeroOperacion || null,
      observaciones: observaciones || null,
      usuarioRegistroPago: usuarioId,
    };
    await onConfirm(payload);
  };

  const handleClose = async () => {
    if (huboCambios) await onRefrescar()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col animate-in zoom-in-95 duration-200"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="rounded-t-2xl px-6 pt-5 pb-4 flex items-center justify-between shrink-0 bg-blue-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Registrar Pago</h2>
              <p className="text-xs mt-0.5 text-blue-200">
                {deuda.numeroCompleto} ·{" "}
                {tipoComprobanteLabel(deuda.tipoComprobante)} ·{" "}
                {formatFecha(deuda.fechaEmision)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Info cliente */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-0.5">
            <p className="text-xs font-bold text-gray-900">
              {deuda.clienteRznSocial}
            </p>
            <p className="text-xs text-gray-500">
              {deuda.clienteNumDoc.length === 11 ? "RUC" : "DNI"}:{" "}
              {deuda.clienteNumDoc}
            </p>
          </div>

          {/* Resumen montos */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Total
              </p>
              <p className="text-sm font-bold text-gray-900">
                {formatMoneda(deuda.montoTotal, deuda.tipoMoneda)}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                Pagado
              </p>
              <p className="text-sm font-bold text-emerald-600">
                {formatMoneda(montoPagadoActual, deuda.tipoMoneda)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                Restante
              </p>
              <p className="text-sm font-bold text-blue-700">
                {formatMoneda(montoRestante, deuda.tipoMoneda)}
              </p>
            </div>
          </div>

          {/* Formulario nuevo pago — solo si aún tiene saldo */}
          {!yaEstaCompleto && (
            <>
              {/* Fecha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar size={11} /> Fecha de Pago{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaPago}
                  max={hoy}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className={cn(
                    "w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:border-blue-400 text-sm",
                    errors.fechaPago ? "border-rose-400" : "border-gray-200",
                  )}
                />
                {errors.fechaPago && (
                  <p className="text-xs text-rose-500">{errors.fechaPago}</p>
                )}
              </div>

              {/* Monto */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Monto a Pagar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={montoPagado}
                  min={0.01}
                  max={montoRestante}
                  step="0.01"
                  onChange={(e) => setMontoPagado(e.target.value)}
                  className={cn(
                    "w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:border-blue-400 text-sm",
                    errors.montoPagado ? "border-rose-400" : "border-gray-200",
                  )}
                />
                {errors.montoPagado && (
                  <p className="text-xs text-rose-500">{errors.montoPagado}</p>
                )}
                {montoPagadoNum > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Progreso tras este pago</span>
                      <span>{Math.min((montoTrasEstePago / montoBase) * 100, 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={cn("h-1.5 rounded-full transition-all", quedaria === 0 ? "bg-emerald-500" : "bg-blue-500")}
                        style={{ width: `${Math.min((montoTrasEstePago / montoBase) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">
                        Quedaría:{" "}
                        <span className="font-semibold text-gray-600">{formatMoneda(quedaria, deuda.tipoMoneda)}</span>
                      </span>
                      {quedaria === 0 && <span className="text-emerald-600 font-bold">¡Pago completado!</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Medio de pago */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Medio de Pago <span className="text-rose-500">*</span>
                </label>
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-sm"
                >
                  {MEDIO_PAGO_OPTS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Entidad + N° operación */}
              {(requiereEntidad || requiereNumOp) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-200">
                  {requiereEntidad && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Entidad</label>
                      {esEmisorEspecial ? (
                        <select
                          value={entidadFinanciera}
                          onChange={(e) => setEntidadFinanciera(e.target.value)}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-sm"
                        >
                          <option value="">Seleccionar...</option>
                          {["BCP SOLES","BCP DÓLARES","BCP RECAUDO","BBVA SOLES","BN DETRACCIONES"].map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={entidadFinanciera}
                          onChange={(e) => setEntidadFinanciera(e.target.value)}
                          placeholder="Ej: BCP"
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-sm"
                        />
                      )}
                    </div>
                  )}
                  <div className={cn("space-y-1.5", !requiereEntidad && "col-span-2")}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">N° Operación</label>
                    <input
                      type="text"
                      value={numeroOperacion}
                      onChange={(e) => setNumeroOperacion(e.target.value)}
                      placeholder="Ej: 123456"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales del pago..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-sm resize-none"
                />
              </div>
            </>
          )}

          {/* Acordeón historial */}
          {tieneHistorial && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={toggleHistorial}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <History
                    size={14}
                    className="text-gray-400 group-hover:text-blue-500 transition-colors"
                  />
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">
                    Historial de pagos
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-gray-400 transition-transform duration-200",
                    historialAbierto && "rotate-180",
                  )}
                />
              </button>

              {historialAbierto && (
                <HistorialPagosDeuda
                  pagoId={deuda.pagoId}
                  tipoMoneda={deuda.tipoMoneda}
                  montoTotal={deuda.montoTotal}
                  historial={historial}
                  loadingHistorial={hookHistorial.loading}
                  onHistorialActualizado={async () => {
                    const data = await hookHistorial.fetchHistorial(deuda.pagoId)
                    setHistorial(data)
                    const nuevoMontoPagado = data.reduce((acc, p) => acc + p.montoPagado, 0)
                    setMontoPagadoActual(nuevoMontoPagado)
                    setMontoPagado((montoBase - nuevoMontoPagado).toFixed(2))
                    setHuboCambios(true)
                  }}
                  usuarioId={usuarioId}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-gray-100 shrink-0">
          {!yaEstaCompleto && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors bg-blue-600 hover:bg-blue-700",
                loading && "opacity-50 cursor-not-allowed",
              )}
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <CreditCard size={15} />
              )}
              {loading ? "Registrando..." : "Confirmar Pago"}
            </button>
          )}
          <button
            onClick={handleClose}
            disabled={loading}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors border border-gray-200 hover:bg-gray-50 text-gray-700",
              yaEstaCompleto && "flex-1"
            )}
          >
            <X size={15} /> Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
