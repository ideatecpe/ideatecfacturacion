'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Wallet, Calendar, AlertTriangle, Check, CheckCircle2, RefreshCw, User, AlertCircle, ListTree, Banknote, ShoppingBasket,
} from 'lucide-react'
import { cn } from '@/app/utils/cn'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import {
  ComprobantePendienteCliente,
  Cuota,
  PagoClienteResultado,
  ResumenClienteCuenta,
} from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/CuentasPorCobrar'
import {
  formatFecha, formatMoneda, getDiasVencida, MEDIO_PAGO_OPTS, tipoComprobanteLabel,
} from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers'
import { useCobroCliente } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseCobroCliente'
import { agruparPorComprobante } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/constanciaPago'
import { useProductosComprobantes } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseProductosComprobantes'
import { useCuotasComprobante } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseCuotasComprobante'
import { ResultadoPago } from './ResultadoPago'
import { BotonVerProductos, DetalleProductosComprobante, productosPendientes } from './DetalleProductosComprobante'

export type ModoCobro = 'monto' | 'productos'

interface ModalCobrarClienteProps {
  cliente: ResumenClienteCuenta
  empresaRuc: string
  establecimientoAnexo: string | null
  /** huboPago: true si se registró algún cobro (hay que refrescar los listados). */
  onClose: (huboPago: boolean) => void
  /** Solo este comprobante (al cobrar desde la vista "Por comprobante"). */
  soloComprobanteId?: number
  modoInicial?: ModoCobro
}

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Cuotas de una nota con su vencimiento y lo que les toca de este pago: se pagan
 * de la que vence primero a la última, igual que en el backend.
 */
const TablaCuotas = ({ cuotas, aplicado, moneda }: { cuotas: Cuota[]; aplicado: number; moneda: string }) => {
  const ordenadas = [...cuotas].sort((a, b) =>
    a.fechaVencimiento.localeCompare(b.fechaVencimiento) || a.numeroCuota.localeCompare(b.numeroCuota))
  // Reparto del pago entre las cuotas, calculado antes de pintar.
  const filas = ordenadas.reduce<{ cu: Cuota; pagada: boolean; debe: number; este: number; restante: number }[]>((acc, cu) => {
    const restante = acc.length ? acc[acc.length - 1].restante : aplicado
    const pagada = (cu.estado ?? '').toUpperCase() === 'PAGADO'
    const debe = pagada ? 0 : redondear(cu.monto - (cu.montoPagado ?? 0))
    const este = redondear(Math.min(debe, Math.max(restante, 0)))
    return [...acc, { cu, pagada, debe, este, restante: redondear(restante - este) }]
  }, [])
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <th className="px-2.5 py-1.5 text-left">Cuota</th>
            <th className="px-2.5 py-1.5 text-left">Vence</th>
            <th className="px-2.5 py-1.5 text-right">Monto</th>
            <th className="px-2.5 py-1.5 text-right">Debe</th>
            <th className="px-2.5 py-1.5 text-right">Este pago</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.map(({ cu, pagada, debe, este }) => {
            const dias = !pagada ? getDiasVencida(cu.fechaVencimiento) : 0
            return (
              <tr key={cu.cuotaId} className={pagada ? 'text-gray-400' : 'text-gray-700'}>
                <td className="px-2.5 py-1.5 font-semibold">{cu.numeroCuota}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  {formatFecha(`${cu.fechaVencimiento.split('T')[0]}T00:00:00`)}
                  {dias > 0 && <span className="ml-1.5 text-[10px] font-bold text-red-600">vencida hace {dias} día(s)</span>}
                </td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{formatMoneda(cu.monto, moneda)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold">
                  {pagada
                    ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={10} /> Pagada</span>
                    : formatMoneda(debe, moneda)}
                </td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                  {este > 0
                    ? <span className={cn('font-semibold', este >= debe - 0.004 ? 'text-emerald-700' : 'text-amber-700')}>{formatMoneda(este, moneda)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

export const ModalCobrarCliente = ({
  cliente, empresaRuc, establecimientoAnexo, onClose, soloComprobanteId, modoInicial = 'monto',
}: ModalCobrarClienteProps) => {
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

  // Comprobantes con el detalle de productos desplegado.
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())
  const detalle = useProductosComprobantes(empresaRuc)

  // "Por monto": paga una cantidad y va primero a lo vencido y a lo que vence antes.
  // "Por productos": marca qué productos paga y quedan registrados como pagados.
  const [modo, setModo] = useState<ModoCobro>(modoInicial)
  const [productosSel, setProductosSel] = useState<Set<number>>(new Set())
  // Cobro de una sola nota: sus cuotas, para ver cuándo vence cada una.
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const { fetchCuotas } = useCuotasComprobante()

  const moneda = cliente.tipoMoneda || 'PEN'
  const nombreCliente = cliente.clienteRznSocial || 'Cliente'

  const cargar = async (refrescarProductos = false) => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const todos = await fetchComprobantesCliente(empresaRuc, establecimientoAnexo, cliente.clienteClave, moneda)
      // En el orden en que se cobran (como el backend): lo vencido y lo que vence antes,
      // primero; a igual vencimiento, la nota más antigua.
      const data = (soloComprobanteId ? todos.filter(c => c.comprobanteId === soloComprobanteId) : todos)
        .slice()
        .sort((a, b) =>
          (a.fechaVencimientoProxima ?? '9999').localeCompare(b.fechaVencimientoProxima ?? '9999')
          || (a.fechaEmision ?? '').localeCompare(b.fechaEmision ?? '')
          || a.comprobanteId - b.comprobanteId)
      setComprobantes(data)
      setSeleccionados(new Set(data.map(c => c.comprobanteId)))
      setProductosSel(new Set())
      if (modo === 'productos' || data.length === 1) setAbiertos(new Set(data.map(c => c.comprobanteId)))
      // Los productos se piden de una vez en segundo plano: al desplegar ya están.
      // Tras un cobro fallido se vuelven a pedir: lo pagado pudo cambiar.
      const ids = data.map(c => c.comprobanteId)
      void (refrescarProductos ? detalle.recargar(ids) : detalle.cargar(ids))
      if (soloComprobanteId) void fetchCuotas(soloComprobanteId).then(setCuotas)
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

  // Vista previa del reparto: en el orden de la lista (por vencimiento), igual que el backend.
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

  // ── Cobro por productos ──────────────────────────────────────────────────
  const pendientesDe = (comprobanteId: number) => productosPendientes(detalle.productos.get(comprobanteId))
  const todosPendientes = comprobantes.flatMap(c => pendientesDe(c.comprobanteId))
  // Por comprobante: lo que falta de los productos marcados.
  const cobroProductos = useMemo(() => {
    const mapa = new Map<number, number>()
    for (const c of comprobantes) {
      const suma = redondear(productosPendientes(detalle.productos.get(c.comprobanteId))
        .filter(p => productosSel.has(p.detalleId))
        .reduce((t, p) => t + p.falta, 0))
      if (suma > 0) mapa.set(c.comprobanteId, Math.min(suma, c.saldo))
    }
    return mapa
  }, [comprobantes, detalle.productos, productosSel])
  const totalProductos = redondear([...cobroProductos.values()].reduce((t, v) => t + v, 0))
  const cargandoProductos = comprobantes.some(c => detalle.cargando.has(c.comprobanteId))
  // La API anterior no manda detalleId: no se puede cobrar por productos hasta actualizarla.
  const apiSinCobroPorProductos = comprobantes.some(c =>
    (detalle.productos.get(c.comprobanteId) ?? []).some(p => !p.detalleId))

  const alternarProducto = (detalleId: number) => {
    setProductosSel(prev => {
      const next = new Set(prev)
      if (next.has(detalleId)) next.delete(detalleId)
      else next.add(detalleId)
      return next
    })
  }
  const estadoProductosDe = (comprobanteId: number) => {
    const pend = pendientesDe(comprobanteId)
    const marcados = pend.filter(p => productosSel.has(p.detalleId)).length
    return { todos: pend.length > 0 && marcados === pend.length, algunos: marcados > 0 && marcados < pend.length, hay: pend.length > 0 }
  }
  const alternarProductosDe = (comprobanteId: number) => {
    const pend = pendientesDe(comprobanteId)
    const { todos } = estadoProductosDe(comprobanteId)
    setProductosSel(prev => {
      const next = new Set(prev)
      pend.forEach(p => (todos ? next.delete(p.detalleId) : next.add(p.detalleId)))
      return next
    })
  }

  // Lo que estaba desplegado antes de pasar a "Por productos", para dejarlo igual al volver.
  const abiertosAntes = useRef<Set<number> | null>(null)
  const cambiarModo = (m: ModoCobro) => {
    if (m === modo) return
    setModo(m)
    setErrorPago(null)
    if (m === 'productos') {
      // Para elegir productos hay que verlos: se despliegan todos.
      abiertosAntes.current = abiertos
      void detalle.cargar(comprobantes.map(c => c.comprobanteId))
      setAbiertos(new Set(comprobantes.map(c => c.comprobanteId)))
    } else {
      // De vuelta a "Un monto": la lista vuelve a quedar como estaba (cerrada).
      setAbiertos(abiertosAntes.current ?? new Set())
      abiertosAntes.current = null
    }
  }

  const porProductos = modo === 'productos'
  const todosSeleccionados = porProductos
    ? todosPendientes.length > 0 && todosPendientes.every(p => productosSel.has(p.detalleId))
    : comprobantes.length > 0 && seleccionados.size === comprobantes.length
  const alternarTodos = () => {
    if (porProductos) {
      setProductosSel(todosSeleccionados ? new Set() : new Set(todosPendientes.map(p => p.detalleId)))
      return
    }
    setSeleccionados(todosSeleccionados ? new Set() : new Set(comprobantes.map(c => c.comprobanteId)))
  }
  const alternar = (id: number) => {
    if (porProductos) {
      alternarProductosDe(id)
      return
    }
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const todosAbiertos = comprobantes.length > 0 && abiertos.size === comprobantes.length
  const alternarDetalle = (id: number) => {
    void detalle.cargar([id])
    setAbiertos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const alternarTodosDetalles = () => {
    if (todosAbiertos) {
      setAbiertos(new Set())
    } else {
      void detalle.cargar(comprobantes.map(c => c.comprobanteId))
      setAbiertos(new Set(comprobantes.map(c => c.comprobanteId)))
    }
  }

  const requiereEntidad = ['TRANSFERENCIA', 'TARJETA', 'CHEQUE'].includes(medioPago)
  const pideOperacion = medioPago !== 'EFECTIVO'

  const errorMonto = porProductos
    ? (productosSel.size === 0 || totalProductos <= 0 ? 'Marque los productos que paga' : null)
    : seleccionados.size === 0 ? 'Seleccione al menos un comprobante'
      : montoNum <= 0 ? 'Ingrese el monto recibido'
        : montoNum > saldoSeleccionado + 0.004 ? `El monto no puede superar ${formatMoneda(saldoSeleccionado, moneda)}`
          : null
  const montoACobrar = porProductos ? totalProductos : montoNum
  const productosMarcados = todosPendientes.filter(p => productosSel.has(p.detalleId))
  const deudaDespues = redondear(Math.max(0, saldoTotal - montoACobrar))
  const vistaPrevia = !resultado && !cargando && !errorMonto && montoACobrar > 0
  // A qué nota va cada parte del pago (de la más antigua a la más nueva, como el backend).
  const repartoLista = comprobantes
    .map(c => {
      const aplicado = porProductos ? (cobroProductos.get(c.comprobanteId) ?? 0) : (reparto.get(c.comprobanteId) ?? 0)
      const queda = redondear(Math.max(0, c.saldo - aplicado))
      return { c, aplicado, queda, saldada: aplicado > 0 && queda <= 0.004 }
    })
    .filter(r => r.aplicado > 0 && (porProductos || seleccionados.has(r.c.comprobanteId)))

  // "Así se reparten los S/ X": a qué nota va cada parte y cómo queda. En "Por productos"
  // también qué productos se pagan de cada nota.
  const notasSinAbono = porProductos
    ? []
    : comprobantes.filter(c => seleccionados.has(c.comprobanteId) && !(reparto.get(c.comprobanteId) ?? 0))
  const desglose = repartoLista.length > 0 && (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <p className="px-3 py-1.5 bg-gray-50 text-[11px] font-semibold text-gray-600">
        Así se reparten los {formatMoneda(montoACobrar, moneda)}
      </p>
      <ul className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
        {repartoLista.map((r, i) => {
          const productosNota = porProductos ? productosMarcados.filter(p => p.comprobanteId === r.c.comprobanteId) : []
          return (
            <li key={r.c.comprobanteId} className="px-3 py-1.5 flex items-start gap-2 text-[11px]">
              <span className={cn('mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold',
                r.saldada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">
                  {r.c.numeroCompleto} <span className="font-normal text-gray-400">· debía {formatMoneda(r.c.saldo, moneda)}</span>
                </p>
                {productosNota.length > 0 && (
                  <ul className="my-0.5 space-y-px">
                    {productosNota.map(p => (
                      <li key={p.detalleId} className="flex justify-between gap-2 text-gray-500">
                        <span className="truncate flex items-center gap-1">
                          <Check size={10} className="text-blue-500 shrink-0" /> {p.descripcion || 'Producto'}
                        </span>
                        <span className="whitespace-nowrap">{formatMoneda(p.falta, moneda)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {r.saldada ? (
                  <p className="text-emerald-700 font-semibold flex items-center gap-1"><CheckCircle2 size={11} /> Queda saldada</p>
                ) : (
                  <p className="text-amber-700 font-semibold">
                    {porProductos ? 'Pago parcial' : 'Abono parcial'} · sigue debiendo {formatMoneda(r.queda, moneda)}
                  </p>
                )}
              </div>
              <span className="font-bold text-gray-900 whitespace-nowrap">{formatMoneda(r.aplicado, moneda)}</span>
            </li>
          )
        })}
        {notasSinAbono.map(c => (
          <li key={c.comprobanteId} className="px-3 py-1.5 flex items-start gap-2 text-[11px] text-gray-400">
            <span className="mt-0.5 w-4 h-4 shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{c.numeroCompleto}</p>
              <p>No alcanza · sigue debiendo {formatMoneda(c.saldo, moneda)}</p>
            </div>
            <span className="whitespace-nowrap">{formatMoneda(0, moneda)}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  const confirmar = async () => {
    if (errorMonto || !fechaPago || enviando || (porProductos && cargandoProductos)) return
    setEnviando(true)
    setErrorPago(null)
    try {
      const res = await pagarCliente({
        empresaRuc,
        establecimientoAnexo,
        clienteClave: cliente.clienteClave,
        tipoMoneda: moneda,
        // Solo los que reciben dinero: si el monto no alcanza, los últimos seleccionados no se tocan.
        comprobanteIds: porProductos
          ? [...cobroProductos.keys()]
          : comprobantes.filter(c => (reparto.get(c.comprobanteId) ?? 0) > 0).map(c => c.comprobanteId),
        detalleIds: porProductos ? productosMarcados.map(p => p.detalleId) : undefined,
        montoPagado: montoACobrar,
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
      cargar(true)
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
            <div className={cn('rounded-xl px-4 py-2 text-center transition-colors', vistaPrevia && deudaDespues <= 0.004 ? 'bg-emerald-50' : 'bg-blue-50')}>
              <p className={cn('text-[10px] font-bold uppercase tracking-wider', vistaPrevia && deudaDespues <= 0.004 ? 'text-emerald-600' : 'text-blue-400')}>
                {soloComprobanteId && !resultado ? 'Saldo' : 'Deuda total'}
              </p>
              {vistaPrevia ? (
                // Mientras arma el cobro: cuánto quedará debiendo si paga lo escrito.
                <>
                  <p className={cn('text-base font-bold', deudaDespues <= 0.004 ? 'text-emerald-700' : 'text-blue-700')}>
                    {formatMoneda(deudaDespues, moneda)}
                  </p>
                  <p className="text-[10px] text-gray-500 whitespace-nowrap">
                    <span className="line-through">{formatMoneda(saldoTotal, moneda)}</span> − {formatMoneda(montoACobrar, moneda)}
                  </p>
                </>
              ) : (
                <p className="text-base font-bold text-blue-700">{formatMoneda(resultado ? resultado.saldoClienteRestante : saldoTotal, moneda)}</p>
              )}
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
              productosPagados={resultado.productosPagados?.length ? resultado.productosPagados : undefined}
              onCerrar={() => onClose(true)}
            />
          </div>
        ) : (
          /* ── Selección y cobro ───────────────────────────────────────────── */
          // flex-auto y no flex-1: con solo max-height en el modal, flex-1 dejaba el
          // cuerpo en 0 px en pantallas angostas (quedaban solo cabecera y pie).
          <div className="flex-auto min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

            {/* Comprobantes pendientes */}
            <div className="flex-1 min-w-0 flex flex-col lg:overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-100">
              {/* Con una sola nota y cobro por monto no hay nada que seleccionar. */}
              <div className={cn('px-6 py-3 flex items-center justify-between shrink-0', soloComprobanteId && !porProductos && 'hidden')}>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={todosSeleccionados} onChange={alternarTodos}
                    disabled={cargando || comprobantes.length === 0 || (porProductos && todosPendientes.length === 0)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  {porProductos ? 'Marcar todos los productos' : 'Seleccionar todos'}
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {porProductos
                      ? `${productosMarcados.length} de ${todosPendientes.length} producto(s) pendientes`
                      : `${seleccionados.size} de ${comprobantes.length} comprobante(s) · los vencidos primero`}
                  </span>
                  {comprobantes.length > 1 && !porProductos && (
                    <button type="button" onClick={alternarTodosDetalles}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline whitespace-nowrap">
                      <ListTree size={12} /> {todosAbiertos ? 'Ocultar productos' : 'Ver todos los productos'}
                    </button>
                  )}
                </div>
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
                    <button onClick={() => cargar()} className="text-xs font-semibold text-blue-600 hover:underline">Reintentar</button>
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
                        const estadoProd = estadoProductosDe(c.comprobanteId)
                        const marcado = porProductos ? estadoProd.todos || estadoProd.algunos : seleccionados.has(c.comprobanteId)
                        const aplicado = porProductos ? (cobroProductos.get(c.comprobanteId) ?? 0) : (reparto.get(c.comprobanteId) ?? 0)
                        const dias = c.fechaVencimientoProxima ? getDiasVencida(c.fechaVencimientoProxima) : 0
                        const completo = aplicado > 0 && aplicado >= c.saldo - 0.004
                        const abierto = abiertos.has(c.comprobanteId)
                        // En "por productos" una nota sin nada marcado no se ve apagada: ahí se eligen.
                        const apagado = !marcado && !porProductos
                        return (
                          <React.Fragment key={c.comprobanteId}>
                          <tr onClick={() => alternar(c.comprobanteId)}
                            className={cn('cursor-pointer transition-colors align-top', apagado ? 'opacity-50 hover:opacity-80' : 'hover:bg-blue-50/40', abierto && 'bg-blue-50/30')}>
                            <td className="px-2 py-2.5">
                              <input type="checkbox" checked={porProductos ? estadoProd.todos : marcado}
                                ref={el => { if (el) el.indeterminate = porProductos && estadoProd.algunos }}
                                disabled={porProductos && !estadoProd.hay}
                                onChange={() => alternar(c.comprobanteId)} onClick={e => e.stopPropagation()}
                                className="w-4 h-4 accent-blue-600 cursor-pointer" />
                            </td>
                            <td className="px-2 py-2.5">
                              <p className="font-semibold text-gray-900">{c.numeroCompleto}</p>
                              <p className="text-[11px] text-gray-400">{tipoComprobanteLabel(c.tipoComprobante)} · {formatFecha(c.fechaEmision)}</p>
                              <BotonVerProductos
                                abierto={abierto}
                                productos={detalle.productos.get(c.comprobanteId)}
                                onClick={() => alternarDetalle(c.comprobanteId)}
                              />
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
                                <span className="inline-flex flex-col items-end">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <Check size={11} /> {formatMoneda(aplicado, moneda)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-emerald-600 mt-0.5">queda saldada</span>
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-end">
                                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Abono {formatMoneda(aplicado, moneda)}
                                  </span>
                                  <span className="text-[10px] text-amber-700 mt-0.5">sigue debiendo {formatMoneda(c.saldo - aplicado, moneda)}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                          {abierto && (
                            <tr className="bg-blue-50/30">
                              <td></td>
                              <td colSpan={5} className="px-2 pb-3 pt-0">
                                <DetalleProductosComprobante
                                  productos={detalle.productos.get(c.comprobanteId)}
                                  cargando={detalle.cargando.has(c.comprobanteId)}
                                  error={detalle.fallidos.has(c.comprobanteId)}
                                  onReintentar={() => void detalle.cargar([c.comprobanteId])}
                                  moneda={moneda}
                                  importeTotal={c.importeTotal}
                                  saldo={c.saldo}
                                  seleccion={porProductos ? productosSel : undefined}
                                  onAlternar={porProductos ? alternarProducto : undefined}
                                />
                              </td>
                            </tr>
                          )}
                          {soloComprobanteId === c.comprobanteId && cuotas.length > 1 && (
                            <tr>
                              <td></td>
                              <td colSpan={5} className="px-2 pb-3 pt-0">
                                <TablaCuotas cuotas={cuotas} aplicado={marcado ? aplicado : 0} moneda={moneda} />
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Panel de cobro */}
            {/* El formulario se desplaza y el botón Cobrar queda siempre a la vista. */}
            <div className="w-full lg:w-96 shrink-0 flex flex-col lg:min-h-0 lg:overflow-hidden">
              <div className="px-6 py-4 space-y-3.5 flex-1 lg:min-h-0 lg:overflow-y-auto">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">¿Cómo paga?</p>
                  <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1">
                    {([
                      ['monto', 'Un monto', Banknote],
                      ['productos', 'Por productos', ShoppingBasket],
                    ] as const).map(([m, etiqueta, Icono]) => (
                      <button key={m} type="button" onClick={() => cambiarModo(m)} disabled={enviando}
                        className={cn('flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors',
                          modo === m ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                        <Icono size={14} /> {etiqueta}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {porProductos
                      ? 'Marca a la izquierda los productos que paga; quedan como pagados.'
                      : 'Escribe cuánto paga; va primero a lo vencido y a lo que vence antes.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Seleccionado</p>
                    <p className="text-sm font-bold text-gray-900">{formatMoneda(porProductos ? totalProductos : saldoSeleccionado, moneda)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Queda debiendo</p>
                    <p className="text-sm font-bold text-blue-700">{formatMoneda(Math.max(0, saldoTotal - montoACobrar), moneda)}</p>
                  </div>
                </div>

                {porProductos ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      A cobrar <span className="text-rose-500">*</span>
                    </label>
                    <div className="w-full px-4 py-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-base font-bold text-gray-900">
                      {formatMoneda(totalProductos, moneda)}
                    </div>
                    {cargandoProductos ? (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Cargando productos...</p>
                    ) : apiSinCobroPorProductos ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                        El servidor aún no tiene el cobro por productos. Hay que actualizar (reiniciar) la API.
                      </p>
                    ) : errorMonto ? (
                      comprobantes.length > 0 && (
                        <p className="text-[11px] text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                          <ShoppingBasket size={13} className="text-gray-400 shrink-0 mt-px" />
                          Marca a la izquierda los productos que el cliente paga.
                        </p>
                      )
                    ) : desglose}
                  </div>
                ) : (
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
                  {!errorMonto && desglose}
                </div>
                )}

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
                <button onClick={confirmar} disabled={!!errorMonto || !fechaPago || enviando || cargando || (porProductos && cargandoProductos)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {enviando
                    ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    : <Wallet size={16} />}
                  {enviando ? 'Registrando...' : `Cobrar ${formatMoneda(montoACobrar, moneda)}`}
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
