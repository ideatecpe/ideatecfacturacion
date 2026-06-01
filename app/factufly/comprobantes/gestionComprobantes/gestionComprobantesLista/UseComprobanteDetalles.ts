import { useState, useCallback } from "react"
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import { ComprobanteDetalles } from "../Comprobante"

interface UseComprobanteDetallesReturn {
  detalles: ComprobanteDetalles | null
  loading: boolean
  error: string | null
  fetchDetalles: (comprobanteId: number) => Promise<ComprobanteDetalles | null>
  reset: () => void
}

export const useComprobanteDetalles = (): UseComprobanteDetallesReturn => {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [detalles, setDetalles] = useState<ComprobanteDetalles | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetalles = useCallback(async (comprobanteId: number): Promise<ComprobanteDetalles | null> => {
    setLoading(true)
    setError(null)
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`)
      const data: ComprobanteDetalles = await response.json()
      setDetalles(data)
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al obtener detalles"
      setError(msg)
      showToast('Error al cargar los detalles del comprobante', 'error')
      setDetalles(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const reset = useCallback(() => {
    setDetalles(null)
    setError(null)
    setLoading(false)
  }, [])

  return { detalles, loading, error, fetchDetalles, reset }
}