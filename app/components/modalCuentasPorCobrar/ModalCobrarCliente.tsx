'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Wallet, Calendar, AlertTriangle, Check, RefreshCw, User, AlertCircle,
} from 'lucide-react'
import { cn } from '@/app/utils/cn'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import {
  ComprobantePendienteCliente,
  PagoClienteResultado,
  ResumenClienteCuenta,
} from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/CuentasPorCobrar'
import {
  formatFecha, formatMoneda, getDiasVencida, MEDIO_PAGO_OPTS, tipoComprobanteLabel,
} from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers'
import { useCobroCliente } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseCobroCliente'
import { agruparPorComprobante } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/constanciaPago'
import { ResultadoPago } from './ResultadoPago'

interface ModalCobrarClienteProps {
  cliente: ResumenClienteCuenta
  empresaRuc: string
  establecimientoAnexo: string | null
  /** huboPago: true si se registró algún cobro (hay que refrescar los listados). */
  onClose: (huboPago: boolean) => void
}

const redondear = (n: number) => Math.round(n * 100) / 100

const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

export const ModalCobrarCliente = ({ cliente, empresaRuc, establecimientoAnexo, onClose }: ModalCobrarClienteProps) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { fetchComprobantesCliente, pagarCliente } = useCobroCliente()

  const [comprobantes, setComprobantes] = useState<ComprobantePendienteCliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())

  const hoy = hoyLima()
  const [monto, setMonto] = useState('')
  const [montoEditado, setMontoEditado] = useState(false)
  const [fechaPago, setFechaPago] = useState(hoy)
  const [medioPago, setMedioPago] = useState('EFECTIVO')
  const [entidadFinanciera, setEntidadFinanciera] = useState('')
  const [numeroOperacion, setNumeroOperacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorPago, setErrorPago] = useState<string | null>(null)
  const [resultado, setResultado] = useState<PagoClienteResultado | null>(null)

  const moneda = cliente.tipoMoneda || 'PEN'
  const nombreCliente = cliente.clienteRznSocial || 'Cliente'

  const cargar = async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const data = await fetchComprobantesCliente(empresaRuc, establecimientoAnexo, cliente.clienteClave, moneda)
      setComprobantes(data)
      setSeleccionados(new Set(data.map(c => c.comprobanteId)))
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'Error al cargar los comprobantes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.clienteClave, moneda])

  const saldoTotal = useMemo(() => redondear(comprobantes.reduce((t, c) => t + c.saldo, 0)), [comprobantes])
  const saldoSeleccionado = useMemo(
    () => redondear(comprobantes.filter(c => seleccionados.has(c.comprobanteId)).reduce((t, c) => t + c.saldo, 0)),
    [comprobantes, seleccionados],
  )

  // Mientras el cajero no escriba otro monto, se cobra todo lo seleccionado.
  useEffect(() => {
    if (!montoEditado) setMonto(saldoSeleccionado > 0 ? saldoSeleccionado.toFixed(2) : '')
  }, [saldoSeleccionado, montoEditado])

  const montoNum = redondear(parseFloat(monto) || 0)

  // Vista previa del reparto: del comprobante más antiguo al más nuevo, igual que el backend.
  const reparto = useMemo(() => {
    const mapa = new Map<number, number>()
    let restante = montoNum
    for (const c of comprobantes) {
      if (!seleccionados.has(c.comprobanteId)) continue
      const aplicado = redondear(Math.min(c.saldo, Math.max(restante, 0)))
      mapa.set(c.comprobanteId, aplicado)
      restante = redondear(restante - aplicado)
    }
    return mapa
  }, [comprobantes, seleccionados, montoNum])

  const cantidadCompletos = comprobantes.filter(c => (reparto.get(c.comprobanteId) ?? 0) >= c.saldo - 0.004 && (reparto.get(c.comprobanteId) ?? 0) > 0).length
  const parcial = comprobantes.find(c => {
    const a = reparto.get(c.comprobanteId) ?? 0
    return a > 0 && a < c.saldo - 0.004
  })

  const todosSeleccionados = comprobantes.length > 0 && seleccionados.size === comprobantes.length
  const alternarTodos = () => {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(comprobantes.map(c => c.comprobanteId)))
  }
  const alternar = (id: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const requiereEntidad = ['TRANSFERENCIA', 'TARJETA', 'CHEQUE'].includes(medioPago)
  const pideOperacion = medioPago !== 'EFECTIVO'

  const errorMonto =
    seleccionados.size === 0 ? 'Seleccione al menos un comprobante'
      : montoNum <= 0 ? 'Ingrese el monto recibido'
        : montoNum > saldoSeleccionado + 0.004 ? `El monto no puede superar ${formatMoneda(saldoSeleccionado, moneda)}`
          : null

  const confirmar = async () => {
    if (errorMonto || !fechaPago || enviando) return
    setEnviando(true)
    setErrorPago(null)
    try {
      const res = await pagarCliente({
        empresaRuc,
        establecimientoAnexo,
        clienteClave: cliente.clienteClave,
        tipoMoneda: moneda,
        // Solo los que reciben dinero: si el monto no alcanza, los últimos seleccionados no se tocan.
        comprobanteIds: comprobantes.filter(c => (reparto.get(c.comprobanteId) ?? 0) > 0).map(c => c.comprobanteId),
        montoPagado: montoNum,
        fechaPago: new Date(fechaPago).toISOString(),
        medioPago,
        entidadFinanciera: requiereEntidad ? (entidadFinanciera.trim() || null) : null,
        numeroOperacion: pideOperacion ? (numeroOperacion.trim() || null) : null,
        observaciones: observaciones.trim() || null,
        usuarioRegistroPago: Number(user?.id ?? 0),
      })
      setResultado(res)
      showToast(`Pago de ${formatMoneda(res.montoAplicado, moneda)} registrado`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el pago'
      setErrorPago(msg)
      showToast(msg, 'error')
      // Puede que otro cajero haya cobrado algo mientras tanto: se recargan los saldos.
      cargar()
    } finally {
      setEnviando(false)
    }
  }

  // `comprobantes` sigue siendo la foto de antes del cobro: da el importe y lo ya pagado.
  const pagosResultado = useMemo(
    () => (resultado ? agruparPorComprobante(resultado.detalle, comprobantes) : []),
    [resultado, comprobantes],
  )

  const cerrar = () => {
    if (enviando) return
    onClose(!!resultado)
  }

  // Portal a <body>: dentro de la página heredaba márgenes (space-y) y
  // transforms que recortaban el fondo oscuro.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="border-b border-gray-100 rounded-t-2xl px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#EEF3FB] border border-[#D0E0F7] rounded-xl flex items-center justify-center shrink-0">
              <User size={18} className="text-brand-blue" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{nombreCliente}</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                {cliente.sinDocumento
                  ? 'Sin documento'
                  : `${(cliente.clienteNumDoc ?? '').length === 11 ? 'RUC' : 'DNI'}: ${cliente.clienteNumDoc}`}
                {cliente.clienteWhatsApp && <> · Tel: {cliente.clienteWhatsApp}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-blue-50 rounded-xl px-4 py-2 text-center">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Deuda total</p>
              <p className="text-base font-bold text-blue-700">{formatMoneda(resultado ? resultado.saldoClienteRestante : saldoTotal, moneda)}</p>
            </div>
            <button onClick={cerrar} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer">
              <X size={17} />
            </button>
          </div>
        </div>

        {resultado ? (
          /* ── Resultado del cobro ─────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <ResultadoPago
              empresaRuc={empresaRuc}
              clienteNombre={nombreCliente}
              clienteDoc={cliente.sinDocumento ? null : cliente.clienteNumDoc}
              telefonoInicial={cliente.clienteWhatsApp}
              moneda={moneda}
              fechaPago={fechaPago}
              medioPago={medioPago}
              numeroOperacion={pideOperacion ? (numeroOperacion.trim() || null) : null}
              montoTotal={resultado.montoAplicado}
              saldoClienteRestante={resultado.saldoClienteRestante}
              pagos={pagosResultado}
            />
          </div>
        ) : (
          /* ── Selección y cobro ───────────────────────────────────────────── */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

            {/* Comprobantes pendientes */}
            <div className="flex-1 min-w-0 flex flex-col lg:overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-100">
              <div className="px-6 py-3 flex items-center justify-between shrink-0">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={todosSeleccionados} onChange={alternarTodos} disabled={cargando || comprobantes.length === 0}
                    className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  Seleccionar todos
                </label>
                <span className="text-xs text-gray-400">
                  {seleccionados.size} de {comprobantes.length} comprobante(s) · más antiguos primero
                </span>
              </div>

              <div className="lg:flex-1 lg:overflow-y-auto px-3 pb-3">
                {cargando ? (
                  <div className="flex flex-col items-center gap-3 py-16">
                    <RefreshCw size={24} className="animate-spin text-blue-400" />
                    <span className="text-sm text-gray-400">Cargando comprobantes...</span>
                  </div>
                ) : errorCarga ? (
                  <div className="py-16 text-center space-y-3">
                    <p className="text-sm text-red-500">{errorCarga}</p>
                    <button onClick={cargar} className="text-xs font-semibold text-blue-600 hover:underline">Reintentar</button>
                  </div>
                ) : comprobantes.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-400">Este cliente no tiene comprobantes pendientes.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="w-8"></th>
                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comprobante</th>
                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vence</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Crédito</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saldo</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Este pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {comprobantes.map(c => {
                        const marcado = seleccionados.has(c.comprobanteId)
                        const aplicado = reparto.get(c.comprobanteId) ?? 0
                        const dias = c.fechaVencimientoProxima ? getDiasVencida(c.fechaVencimientoProxima) : 0
                        const completo = aplicado > 0 && aplicado >= c.saldo - 0.004
                        return (
                          <tr key={c.comprobanteId} onClick={() => alternar(c.comprobanteId)}
                            className={cn('cursor-pointer transition-colors', marcado ? 'hover:bg-blue-50/40' : 'opacity-50 hover:opacity-80')}>
                            <td className="px-2 py-2.5">
                              <input type="checkbox" checked={marcado} onChange={() => alternar(c.comprobanteId)} onClick={e => e.stopPropagation()}
                                className="w-4 h-4 accent-blue-600 cursor-pointer" />
                            </td>
                            <td className="px-2 py-2.5">
                              <p className="font-semibold text-gray-900">{c.numeroCompleto}</p>
                              <p className="text-[11px] text-gray-400">{tipoComprobanteLabel(c.tipoComprobante)} · {formatFecha(c.fechaEmision)}</p>
                            </td>
                            <td className="px-2 py-2.5 whitespace-nowrap">
                              <p className="text-gray-600 flex items-center gap-1"><Calendar size={11} className="text-gray-400" /> {formatFecha(c.fechaVencimientoProxima)}</p>
                              {dias > 0 && (
                                <p className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle size={10} /> Vencida hace {dias} día(s)
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-right text-gray-500 whitespace-nowrap">
                              {formatMoneda(c.montoCredito, moneda)}
                              {c.montoPagado > 0 && <p className="text-[10px] text-emerald-600">Abonado {formatMoneda(c.montoPagado, moneda)}</p>}
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">{formatMoneda(c.saldo, moneda)}</td>
                            <td className="px-2 py-2.5 text-right whitespace-nowrap">
                              {!marcado || aplicado <= 0 ? (
                                <span className="text-gray-300">—</span>
                              ) : completo ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <Check size={11} /> {formatMoneda(aplicado, moneda)}
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-end">
                                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Abono {formatMoneda(aplicado, moneda)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">queda {formatMoneda(c.saldo - aplicado, moneda)}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Panel de cobro */}
            <div className="w-full lg:w-96 shrink-0 flex flex-col lg:overflow-y-auto">
              <div className="px-6 py-4 space-y-3.5 flex-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Seleccionado</p>
                    <p className="text-sm font-bold text-gray-900">{formatMoneda(saldoSeleccionado, moneda)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Queda debiendo</p>
                    <p className="text-sm font-bold text-blue-700">{formatMoneda(Math.max(0, saldoTotal - montoNum), moneda)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Monto recibido <span className="text-rose-500">*</span>
                    </label>
                    <button type="button" onClick={() => { setMontoEditado(false); setMonto(saldoSeleccionado.toFixed(2)) }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline">
                      Cobrar todo
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{moneda === 'USD' ? '$' : 'S/'}</span>
                    <input type="number" inputMode="decimal" min={0} step="0.01" value={monto}
                      onChange={e => { setMontoEditado(true); setMonto(e.target.value) }}
                      className={cn('w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:border-brand-blue/50 text-base font-bold',
                        errorMonto && monto !== '' ? 'border-rose-400' : 'border-gray-200')} />
                  </div>
                  {errorMonto && (comprobantes.length > 0) && <p className="text-xs text-rose-500">{errorMonto}</p>}
                  {!errorMonto && (
                    <p className="text-[11px] text-gray-500">
                      {cantidadCompletos > 0 && <>Quedan pagados <b>{cantidadCompletos}</b> comprobante(s)</>}
                      {cantidadCompletos > 0 && parcial && ' y '}
                      {parcial && <>abono parcial a <b>{parcial.numeroCompleto}</b></>}
                      .
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Medio <span className="text-rose-500">*</span></label>
                    <select value={medioPago} onChange={e => setMedioPago(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm">
                      {MEDIO_PAGO_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha <span className="text-rose-500">*</span></label>
                    <input type="date" value={fechaPago} max={hoy} onChange={e => setFechaPago(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm" />
                  </div>
                </div>

                {pideOperacion && (
                  <div className={cn('grid gap-2.5 animate-in slide-in-from-top-1 duration-200', requiereEntidad ? 'grid-cols-2' : 'grid-cols-1')}>
                    {requiereEntidad && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Entidad</label>
                        <input value={entidadFinanciera} onChange={e => setEntidadFinanciera(e.target.value)} placeholder="Ej: BCP"
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">N° Operación</label>
                      <input value={numeroOperacion} onChange={e => setNumeroOperacion(e.target.value)} placeholder="Opcional"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} maxLength={200}
                    placeholder="Notas del pago..."
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm resize-none" />
                </div>

                {errorPago && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">{errorPago}</p>
                  </div>
                )}
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button onClick={confirmar} disabled={!!errorMonto || !fechaPago || enviando || cargando}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {enviando
                    ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    : <Wallet size={16} />}
                  {enviando ? 'Registrando...' : `Cobrar ${formatMoneda(montoNum, moneda)}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end shrink-0 bg-gray-50/40 rounded-b-2xl">
          <button onClick={cerrar} disabled={enviando}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50">
            <X size={14} /> {resultado ? 'Listo' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
