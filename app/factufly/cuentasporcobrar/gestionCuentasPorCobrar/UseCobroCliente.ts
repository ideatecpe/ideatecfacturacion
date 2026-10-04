import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  ComprobantePendienteCliente,
  PagarClientePayload,
  PagoClienteResultado,
  ProductoComprobante,
  ResumenClienteCuenta,
} from './CuentasPorCobrar'

const API = `${process.env.NEXT_PUBLIC_API_URL}/api/CuentasPorCobrar`

async function mensajeError(response: Response, porDefecto: string): Promise<string> {
  try {
    const data = await response.json()
    return data?.message ?? porDefecto
  } catch {
    return porDefecto
  }
}

/** Deuda agrupada por cliente: resumen, comprobantes pendientes y cobro en lote. */
export const useCobroCliente = () => {
  const { accessToken } = useAuth()
  const [clientes, setClientes] = useState<ResumenClienteCuenta[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [errorClientes, setErrorClientes] = useState<string | null>(null)

  const fetchClientes = useCallback(async (
    empresaRuc: string,
    establecimientoAnexo: string | null,
  ): Promise<ResumenClienteCuenta[]> => {
    setLoadingClientes(true)
    setErrorClientes(null)
    try {
      const url = new URL(`${API}/clientes`)
      url.searchParams.append('empresaRuc', empresaRuc)
      if (establecimientoAnexo) url.searchParams.append('establecimientoAnexo', establecimientoAnexo)
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error(await mensajeError(response, 'Error al cargar los clientes'))
      const data: ResumenClienteCuenta[] = await response.json()
      setClientes(data)
      return data
    } catch (err) {
      setErrorClientes(err instanceof Error ? err.message : 'Error al cargar los clientes')
      setClientes([])
      return []
    } finally {
      setLoadingClientes(false)
    }
  }, [accessToken])

  const fetchComprobantesCliente = useCallback(async (
    empresaRuc: string,
    establecimientoAnexo: string | null,
    clienteClave: string,
    tipoMoneda: string,
  ): Promise<ComprobantePendienteCliente[]> => {
    const url = new URL(`${API}/clientes/comprobantes`)
    url.searchParams.append('empresaRuc', empresaRuc)
    url.searchParams.append('clienteClave', clienteClave)
    url.searchParams.append('tipoMoneda', tipoMoneda)
    if (establecimientoAnexo) url.searchParams.append('establecimientoAnexo', establecimientoAnexo)
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error(await mensajeError(response, 'Error al cargar los comprobantes del cliente'))
    return response.json()
  }, [accessToken])

  const pagarCliente = useCallback(async (payload: PagarClientePayload): Promise<PagoClienteResultado> => {
    const response = await fetch(`${API}/clientes/pagar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(await mensajeError(response, 'No se pudo registrar el pago'))
    return response.json()
  }, [accessToken])

  const fetchProductos = useCallback(async (
    empresaRuc: string,
    comprobanteIds: number[],
  ): Promise<ProductoComprobante[]> => {
    const url = new URL(`${API}/clientes/productos`)
    url.searchParams.append('empresaRuc', empresaRuc)
    for (const id of comprobanteIds) url.searchParams.append('comprobanteIds', String(id))
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error(await mensajeError(response, 'No se pudo obtener el detalle de productos'))
    return response.json()
  }, [accessToken])

  return {
    fetchProductos,
    clientes,
    loadingClientes,
    errorClientes,
    fetchClientes,
    fetchComprobantesCliente,
    pagarCliente,
  }
}
