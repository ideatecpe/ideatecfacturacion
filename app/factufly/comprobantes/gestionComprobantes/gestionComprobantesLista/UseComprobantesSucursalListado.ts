import { useState, useCallback } from "react"
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import { ComprobanteListado } from "../Comprobante"

interface UseComprobantesSucursalListadoParams {
  sucursalId: number
  fechaDesde?: string | null
  fechaHasta?: string | null
  limit?: number
  offset?: number
  usuarioId?: number | null
}

interface UseComprobantesSucursalListadoReturn {
  comprobantes: ComprobanteListado[]
  loading: boolean
  error: string | null
  hasMore: boolean
  fetchComprobantes: (params: UseComprobantesSucursalListadoParams) => Promise<ComprobanteListado[]>
  reset: () => void
}

export const useComprobantesSucursalListado = (): UseComprobantesSucursalListadoReturn => {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [comprobantes, setComprobantes] = useState<ComprobanteListado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const fetchComprobantes = useCallback(async ({
    sucursalId, fechaDesde, fechaHasta, limit = 100, offset = 0, usuarioId
  }: UseComprobantesSucursalListadoParams): Promise<ComprobanteListado[]> => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/listado/sucursal/${sucursalId}`)
      if (fechaDesde) url.searchParams.append("fechaDesde", fechaDesde)
      if (fechaHasta) url.searchParams.append("fechaHasta", fechaHasta)
      if (usuarioId != null) url.searchParams.append("usuarioId", String(usuarioId))
      url.searchParams.append("limit", limit.toString())
      url.searchParams.append("offset", offset.toString())

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`)
      const data: ComprobanteListado[] = await response.json()
      
      setComprobantes(data)
      setHasMore(data.length === limit)
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al obtener comprobantes"
      setError(msg)
      showToast('Error al obtener comprobantes de la sucursal', 'error')
      setComprobantes([])
      setHasMore(false)
      return []
    } finally {
      setLoading(false)
    }
  }, [accessToken, showToast])

  const reset = useCallback(() => {
    setComprobantes([])
    setError(null)
    setLoading(false)
    setHasMore(true)
  }, [])

  return { comprobantes, loading, error, hasMore, fetchComprobantes, reset }
}