'use client'
import React from 'react'
import { Check, ChevronDown, Package, RefreshCw } from 'lucide-react'
import { cn } from '@/app/utils/cn'
import { ProductoComprobante } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/CuentasPorCobrar'
import { formatMoneda } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers'

const r2 = (n: number) => Math.round(n * 100) / 100
const cantidadTexto = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

/** Productos que aún deben algo y se pueden cobrar uno por uno. */
export const productosPendientes = (productos: ProductoComprobante[] | undefined) =>
  (productos ?? []).filter(p => !p.pagado && p.falta > 0.004 && !!p.detalleId)

interface BotonVerProductosProps {
  abierto: boolean
  onClick: () => void
  productos?: ProductoComprobante[]
}

/** "Ver productos" bajo el número del comprobante; no marca ni desmarca la fila. */
export const BotonVerProductos = ({ abierto, onClick, productos }: BotonVerProductosProps) => {
  const pagados = productos?.filter(p => p.pagado).length ?? 0
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
    >
      <ChevronDown size={12} className={cn('transition-transform', !abierto && '-rotate-90')} />
      {abierto ? 'Ocultar productos' : productos ? `Ver productos (${productos.length})` : 'Ver productos'}
      {!abierto && pagados > 0 && (
        <span className="text-emerald-600 font-semibold">· {pagados} pagado{pagados === 1 ? '' : 's'}</span>
      )}
    </button>
  )
}

interface DetalleProductosComprobanteProps {
  productos: ProductoComprobante[] | undefined
  cargando: boolean
  error: boolean
  onReintentar: () => void
  moneda: string
  importeTotal: number
  /** Lo que aún se debe del comprobante; con él se muestra lo pagado y lo que falta. */
  saldo?: number
  /** Cobro por productos: casillas para elegir los que el cliente paga. */
  seleccion?: Set<number>
  onAlternar?: (detalleId: number) => void
}

/** Lo que el cliente compró en un comprobante y qué de eso ya pagó. */
export const DetalleProductosComprobante = ({
  productos, cargando, error, onReintentar, moneda, importeTotal, saldo, seleccion, onAlternar,
}: DetalleProductosComprobanteProps) => {
  if (error) {
    return (
      <p className="text-[11px] text-red-500 py-2 px-1">
        No se pudo cargar el detalle.{' '}
        <button type="button" onClick={onReintentar} className="font-semibold text-blue-600 hover:underline">Reintentar</button>
      </p>
    )
  }
  if (cargando || !productos) {
    return (
      <p className="flex items-center gap-2 text-[11px] text-gray-400 py-2 px-1">
        <RefreshCw size={12} className="animate-spin" /> Cargando productos...
      </p>
    )
  }
  if (productos.length === 0) {
    return <p className="text-[11px] text-gray-400 py-2 px-1">Este comprobante no tiene productos registrados.</p>
  }

  const elegible = !!seleccion && !!onAlternar
  const suma = r2(productos.reduce((t, p) => t + p.total, 0))
  // Descuento global, bolsas (ICBPER) u otros cargos que no van en una línea.
  const ajuste = r2(importeTotal - suma)
  const faltaProductos = r2(productos.reduce((t, p) => t + (p.pagado ? 0 : p.falta), 0))
  // Lo que se debe y no es de ningún producto (p. ej. el impuesto a las bolsas).
  const faltaOtros = saldo != null ? r2(saldo - faltaProductos) : 0
  const pagado = saldo != null ? r2(Math.max(0, importeTotal - saldo)) : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {elegible && <th className="w-8"></th>}
            <th className="px-2.5 py-1.5 text-center w-12">Cant.</th>
            <th className="px-2.5 py-1.5 text-left">Producto</th>
            <th className="px-2.5 py-1.5 text-right w-20">P. Unit.</th>
            <th className="px-2.5 py-1.5 text-right w-20">Importe</th>
            <th className="px-2.5 py-1.5 text-right w-28">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {productos.map(p => {
            const pendiente = !p.pagado && p.falta > 0.004
            // Sin detalleId (API anterior al cobro por productos) no se puede elegir.
            const elegibleFila = elegible && pendiente && !!p.detalleId
            const marcado = elegibleFila && seleccion!.has(p.detalleId)
            const parcial = pendiente && p.falta < p.total - 0.004
            return (
              <tr
                key={p.detalleId || `${p.comprobanteId}-${p.item}`}
                onClick={elegibleFila ? () => onAlternar!(p.detalleId) : undefined}
                className={cn(
                  elegibleFila && 'cursor-pointer hover:bg-blue-50/50',
                  marcado && 'bg-blue-50',
                  !pendiente && 'text-gray-400',
                )}
              >
                {elegible && (
                  <td className="pl-2.5 py-1.5">
                    {elegibleFila ? (
                      <input type="checkbox" checked={marcado} onChange={() => onAlternar!(p.detalleId)} onClick={e => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" />
                    ) : pendiente ? (
                      <input type="checkbox" disabled className="w-3.5 h-3.5 opacity-40" />
                    ) : (
                      <Check size={13} className="text-emerald-500" />
                    )}
                  </td>
                )}
                <td className={cn('px-2.5 py-1.5 text-center font-semibold', pendiente ? 'text-gray-700' : 'text-gray-400')}>{cantidadTexto(p.cantidad)}</td>
                <td className={cn('px-2.5 py-1.5', pendiente ? 'text-gray-800' : 'text-gray-400')}>
                  <span className="inline-flex items-start gap-1.5">
                    <Package size={11} className="text-gray-300 mt-0.5 shrink-0" />
                    <span>{p.descripcion || 'Producto'}</span>
                  </span>
                </td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-gray-500">{formatMoneda(p.precioVenta, moneda)}</td>
                <td className={cn('px-2.5 py-1.5 text-right font-semibold whitespace-nowrap', pendiente ? 'text-gray-900' : 'text-gray-400')}>{formatMoneda(p.total, moneda)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                  {!pendiente ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      <Check size={10} /> Pagado
                    </span>
                  ) : parcial ? (
                    <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      Falta {formatMoneda(p.falta, moneda)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-500">Pendiente</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="border-t border-gray-200 bg-gray-50/60">
          {Math.abs(ajuste) >= 0.01 && (
            <tr>
              <td colSpan={elegible ? 5 : 4} className="px-2.5 py-1 text-right text-gray-500">
                {ajuste < 0 ? 'Descuento' : 'Otros cargos'}
              </td>
              <td className="px-2.5 py-1 text-right text-gray-600 whitespace-nowrap">
                {formatMoneda(ajuste, moneda)}
                {ajuste > 0 && faltaOtros > 0.004 && <span className="block text-[10px] text-amber-700">falta {formatMoneda(faltaOtros, moneda)}</span>}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={elegible ? 5 : 4} className="px-2.5 py-1 text-right font-bold text-gray-600">Total de la venta</td>
            <td className="px-2.5 py-1 text-right font-bold text-gray-900 whitespace-nowrap">{formatMoneda(importeTotal, moneda)}</td>
          </tr>
          {pagado != null && pagado > 0.004 && (
            <tr>
              <td colSpan={elegible ? 5 : 4} className="px-2.5 py-1 text-right text-emerald-700">Pagado</td>
              <td className="px-2.5 py-1 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatMoneda(pagado, moneda)}</td>
            </tr>
          )}
          {saldo != null && (
            <tr>
              <td colSpan={elegible ? 5 : 4} className="px-2.5 py-1.5 text-right font-bold text-blue-700">Debe</td>
              <td className="px-2.5 py-1.5 text-right font-bold text-blue-700 whitespace-nowrap">{formatMoneda(saldo, moneda)}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}
