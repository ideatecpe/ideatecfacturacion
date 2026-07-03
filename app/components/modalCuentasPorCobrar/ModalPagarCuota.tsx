'use client'
import React, { useState } from 'react'
import { X, CreditCard, Calendar, AlertCircle, Clock, History, ChevronDown, RefreshCw } from 'lucide-react'
import { cn } from '@/app/utils/cn'
import { formatFecha } from '@/app/factufly/comprobantes/gestionComprobantes/helpers'
import { Cuota, CuotaPago, PagarCuotaPayload } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/CuentasPorCobrar'
import { formatMoneda, MEDIO_PAGO_OPTS } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers'
import { useHistorialPagos } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseHistorialPagos'

interface ModalPagarCuotaProps {
  cuota: Cuota
  tipoMoneda: string
  onClose: () => void
  onConfirm: (payload: PagarCuotaPayload) => Promise<void>
  loading: boolean
  usuarioId: number
}

export const ModalPagarCuota = ({
  cuota, tipoMoneda, onClose, onConfirm, loading, usuarioId
}: ModalPagarCuotaProps) => {

  const d = new Date()
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const dVenc = new Date(cuota.fechaVencimiento)
  const venc = `${dVenc.getFullYear()}-${String(dVenc.getMonth() + 1).padStart(2, '0')}-${String(dVenc.getDate()).padStart(2, '0')}`
  const estaVencida = venc < hoy

  const montoPagadoAnterior = cuota.montoPagado ?? 0
  const montoRestante = cuota.monto - montoPagadoAnterior

  const [montoPagado, setMontoPagado]             = useState(montoRestante.toFixed(2))
  const [fechaPago, setFechaPago]                 = useState(hoy)
  const [medioPago, setMedioPago]                 = useState('EFECTIVO')
  const [entidadFinanciera, setEntidadFinanciera] = useState('')
  const [numeroOperacion, setNumeroOperacion]     = useState('')
  const [observaciones, setObservaciones]         = useState('')
  const [errors, setErrors]                       = useState<Record<string, string>>({})

  // Acordeón historial
  const hookHistorial                             = useHistorialPagos()
  const [historialAbierto, setHistorialAbierto]   = useState(false)
  const [historial, setHistorial]                 = useState<CuotaPago[]>([])
  const [historialCargado, setHistorialCargado]   = useState(false)

  const tieneHistorial = montoPagadoAnterior > 0

  const toggleHistorial = async () => {
    if (historialAbierto) {
      setHistorialAbierto(false)
      return
    }
    setHistorialAbierto(true)
    if (!historialCargado) {
      const data = await hookHistorial.fetchHistorial(cuota.cuotaId)
      setHistorial(data)
      setHistorialCargado(true)
    }
  }

  const requiereEntidad = ['TRANSFERENCIA', 'TARJETA', 'CHEQUE'].includes(medioPago)

  const montoPagadoNum = parseFloat(montoPagado) || 0
  const montoTrasEstePago = montoPagadoAnterior + montoPagadoNum
  const quedaria = Math.max(0, cuota.monto - montoTrasEstePago)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    const monto = parseFloat(montoPagado)
    if (!montoPagado || isNaN(monto) || monto <= 0)
      errs.montoPagado = 'Ingrese un monto válido'
    if (monto > montoRestante)
      errs.montoPagado = `El monto no puede superar el restante (${formatMoneda(montoRestante, tipoMoneda)})`
    if (!fechaPago) errs.fechaPago = 'Seleccione una fecha'
    if (!medioPago) errs.medioPago = 'Seleccione un medio de pago'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleConfirm = async () => {
    if (!validate()) return
    const payload: PagarCuotaPayload = {
      cuotaId:             cuota.cuotaId,
      montoPagado:         parseFloat(montoPagado),
      fechaPago:           new Date(fechaPago).toISOString(),
      medioPago,
      entidadFinanciera:   entidadFinanciera || null,
      numeroOperacion:     numeroOperacion || null,
      observaciones:       observaciones || null,
      usuarioRegistroPago: usuarioId,
    }
    await onConfirm(payload)
  }

  return (
    <div className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className={cn("rounded-t-2xl px-6 pt-5 pb-4 flex items-center justify-between shrink-0",
          estaVencida ? "bg-red-600" : "bg-blue-600")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Registrar Pago</h2>
              <p className={cn("text-xs mt-0.5 flex items-center gap-1", estaVencida ? "text-red-200" : "text-blue-200")}>
                {cuota.numeroCuota} · Vence: {formatFecha(cuota.fechaVencimiento)}
                {estaVencida && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    · <AlertCircle size={11} /> VENCIDA
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Alerta vencimiento */}
          {estaVencida && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Esta cuota está vencida. Por favor coordine el pago con el cliente.
              </p>
            </div>
          )}

          {/* Resumen cuota */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Monto Total</p>
              <p className="text-sm font-bold text-gray-900">{formatMoneda(cuota.monto, tipoMoneda)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Pagado</p>
              <p className="text-sm font-bold text-emerald-600">{formatMoneda(montoPagadoAnterior, tipoMoneda)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Restante</p>
              <p className="text-sm font-bold text-blue-700">{formatMoneda(montoRestante, tipoMoneda)}</p>
            </div>
          </div>

          {/* Fecha pago */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={11} /> Fecha de Pago <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={fechaPago}
              max={hoy}
              onChange={e => setFechaPago(e.target.value)}
              className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:border-brand-blue/50 text-sm",
                errors.fechaPago ? "border-rose-400" : "border-gray-200")}
            />
            {errors.fechaPago && <p className="text-xs text-rose-500">{errors.fechaPago}</p>}
          </div>

          {/* Monto a pagar */}
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
              onChange={e => setMontoPagado(e.target.value)}
              className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:border-brand-blue/50 text-sm",
                errors.montoPagado ? "border-rose-400" : "border-gray-200")}
            />
            {errors.montoPagado && <p className="text-xs text-rose-500">{errors.montoPagado}</p>}

            {/* Barra de progreso */}
            {montoPagadoNum > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Progreso tras este pago</span>
                  <span>{Math.min(((montoTrasEstePago / cuota.monto) * 100), 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={cn("h-1.5 rounded-full transition-all",
                      quedaria === 0 ? "bg-emerald-500" : estaVencida ? "bg-red-500" : "bg-blue-500"
                    )}
                    style={{ width: `${Math.min(((montoTrasEstePago / cuota.monto) * 100), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">
                    Quedaría: <span className="font-semibold text-gray-600">{formatMoneda(quedaria, tipoMoneda)}</span>
                  </span>
                  {quedaria === 0 && (
                    <span className="text-emerald-600 font-bold">¡Cuota completada!</span>
                  )}
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
              onChange={e => setMedioPago(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm"
            >
              {MEDIO_PAGO_OPTS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Entidad + N° operación */}
          {requiereEntidad && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Entidad</label>
                <input type="text" value={entidadFinanciera} onChange={e => setEntidadFinanciera(e.target.value)}
                  placeholder="Ej: BCP"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">N° Operación</label>
                <input type="text" value={numeroOperacion} onChange={e => setNumeroOperacion(e.target.value)}
                  placeholder="Ej: 123456"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm" />
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
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas adicionales del pago..."
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm resize-none"
            />
          </div>

          {/* Info último pago */}
          {cuota.fechaPago && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500">
              <Clock size={13} className="shrink-0 text-gray-400" />
              <span>Último pago registrado: <span className="font-semibold">{formatFecha(cuota.fechaPago)}</span></span>
            </div>
          )}

          {/* Acordeón historial de pagos */}
          {tieneHistorial && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Cabecera acordeón */}
              <button
                type="button"
                onClick={toggleHistorial}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <History size={14} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">
                    Historial de pagos
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={cn("text-gray-400 transition-transform duration-200", historialAbierto && "rotate-180")}
                />
              </button>

              {/* Contenido acordeón */}
              {historialAbierto && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  {hookHistorial.loading ? (
                    <div className="flex items-center justify-center gap-2 py-5">
                      <RefreshCw size={14} className="animate-spin text-blue-400" />
                      <span className="text-xs text-gray-400">Cargando historial...</span>
                    </div>
                  ) : historial.length === 0 ? (
                    <div className="py-5 text-center text-xs text-gray-400">
                      Sin registros de pago
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monto</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Medio</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entidad</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">N° Op.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {historial.map(p => (
                          <tr key={p.cuotaPagoId} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{formatFecha(p.fechaPago)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                              {formatMoneda(p.montoPagado, tipoMoneda)}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">{p.medioPago ?? '-'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{p.entidadFinanciera ?? '-'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{p.numeroOperacion ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-gray-100 shrink-0">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors",
              estaVencida ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : <CreditCard size={15} />}
            {loading ? 'Registrando...' : 'Confirmar Pago'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors border border-gray-200 hover:bg-gray-50 text-gray-700"
          >
            <X size={15} /> Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}