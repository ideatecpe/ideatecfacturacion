import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import { ReportesData, ClienteExport, ReportesSucursalParams } from './Reportes'

interface UseReportesSucursalReturn {
  reportes: ReportesData | null
  loading: boolean
  loadingExport: boolean
  error: string | null
  fetchReportes: (params: ReportesSucursalParams) => Promise<ReportesData | null>
  fetchExport: (params: Omit<ReportesSucursalParams, 'limite'>) => Promise<ClienteExport[]>
  reset: () => void
}

export const useReportesSucursal = (): UseReportesSucursalReturn => {
  const { accessToken } = useAuth()
  const { showToast } = useToast()

  const [reportes, setReportes] = useState<ReportesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildUrl = (path: string, params: Record<string, string | number | null | undefined>) => {
    const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}${path}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '')
        url.searchParams.append(key, String(value))
    })
    return url.toString()
  }

  const fetchReportes = useCallback(async ({
    sucursalId, periodo, desde, hasta, limite = 10, usuarioId
  }: ReportesSucursalParams): Promise<ReportesData | null> => {
    setLoading(true)
    setError(null)
    try {
      const url = buildUrl(`/api/Reportes/sucursal/${sucursalId}`, {
        periodo, desde, hasta, limite, usuarioId
      })
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`)
      const data: ReportesData = await response.json()
      setReportes(data)
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al obtener los reportes'
      setError(msg)
      showToast('Error al obtener los reportes de sucursal', 'error')
      setReportes(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const fetchExport = useCallback(async ({
    sucursalId, periodo, desde, hasta, usuarioId
  }: Omit<ReportesSucursalParams, 'limite'>): Promise<ClienteExport[]> => {
    setLoadingExport(true)
    try {
      const url = buildUrl(`/api/Reportes/sucursal/${sucursalId}/export`, {
        periodo, desde, hasta, usuarioId
      })
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`)
      return await response.json()
    } catch (err) {
      showToast('Error al exportar los datos', 'error')
      return []
    } finally {
      setLoadingExport(false)
    }
  }, [accessToken])

  const reset = useCallback(() => {
    setReportes(null)
    setError(null)
    setLoading(false)
    setLoadingExport(false)
  }, [])

  return { reportes, loading, loadingExport, error, fetchReportes, fetchExport, reset }
}