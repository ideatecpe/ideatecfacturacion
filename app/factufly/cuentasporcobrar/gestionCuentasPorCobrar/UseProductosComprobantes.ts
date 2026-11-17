import { useCallback, useRef, useState } from 'react'
import { ProductoComprobante } from './CuentasPorCobrar'
import { useCobroCliente } from './UseCobroCliente'

// El backend acepta hasta 500 comprobantes por consulta.
const MAX_POR_CONSULTA = 500

/**
 * Productos de cada comprobante a crédito, para que el cajero vea qué compró el
 * cliente en cada nota. Se piden en una sola consulta por lote (la BD está lejos:
 * una por comprobante se notaría) y quedan guardados mientras viva el componente.
 */
export const useProductosComprobantes = (empresaRuc: string) => {
  const { fetchProductos } = useCobroCliente()
  const [productos, setProductos] = useState<Map<number, ProductoComprobante[]>>(new Map())
  const [cargando, setCargando] = useState<Set<number>>(new Set())
  const [fallidos, setFallidos] = useState<Set<number>>(new Set())
  // Pedidos en curso o ya resueltos: evita repetir la consulta al abrir y cerrar.
  const pedidos = useRef(new Set<number>())

  const cargar = useCallback(async (ids: number[]) => {
    const faltan = [...new Set(ids)].filter(id => id > 0 && !pedidos.current.has(id))
    if (faltan.length === 0 || !empresaRuc) return
    faltan.forEach(id => pedidos.current.add(id))
    setCargando(prev => new Set([...prev, ...faltan]))
    setFallidos(prev => {
      if (!faltan.some(id => prev.has(id))) return prev
      const next = new Set(prev)
      faltan.forEach(id => next.delete(id))
      return next
    })

    try {
      const lotes: number[][] = []
      for (let i = 0; i < faltan.length; i += MAX_POR_CONSULTA) lotes.push(faltan.slice(i, i + MAX_POR_CONSULTA))
      const respuestas = await Promise.all(lotes.map(lote => fetchProductos(empresaRuc, lote)))

      // Cada id pedido queda con su lista, aunque venga vacía: así no se pide otra vez.
      const nuevos = new Map<number, ProductoComprobante[]>(faltan.map(id => [id, []]))
      for (const p of respuestas.flat()) {
        // Una API sin el cobro por productos no manda el estado: sin esto todo se
        // vería "Pagado". Así se ve pendiente y, sin detalleId, no se puede elegir.
        const normalizado = p.falta === undefined ? { ...p, falta: p.total, pagado: false, pagadoPorProducto: false } : p
        nuevos.get(p.comprobanteId)?.push(normalizado)
      }
      setProductos(prev => new Map([...prev, ...nuevos]))
    } catch {
      faltan.forEach(id => pedidos.current.delete(id))
      setFallidos(prev => new Set([...prev, ...faltan]))
    } finally {
      setCargando(prev => {
        const next = new Set(prev)
        faltan.forEach(id => next.delete(id))
        return next
      })
    }
  }, [empresaRuc, fetchProductos])

  /** Después de un cobro: vuelve a pedir esos comprobantes (o todos los ya pedidos). */
  const recargar = useCallback(async (ids?: number[]) => {
    const lista = ids ?? [...pedidos.current]
    lista.forEach(id => pedidos.current.delete(id))
    await cargar(lista)
  }, [cargar])

  return { productos, cargando, fallidos, cargar, recargar }
}
