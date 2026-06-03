import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'

interface ReporteFiltros {
  empresaRuc: string
  establecimientoAnexo?: string | null
  clienteNumDoc?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
  estado?: string | null
  tituloReporte?: string | null
}

interface UseReporteCuentasPorCobrarReturn {
  loading: boolean
  descargarReporte: (filtros: ReporteFiltros) => Promise<void>
}

export const useReporteCuentasPorCobrar = (): UseReporteCuentasPorCobrarReturn => {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  const descargarReporte = useCallback(async (filtros: ReporteFiltros) => {
    setLoading(true)
    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/CuentasPorCobrar/excel`)
      url.searchParams.append('empresaRuc', filtros.empresaRuc)
      if (filtros.establecimientoAnexo) url.searchParams.append('establecimientoAnexo', filtros.establecimientoAnexo)
      if (filtros.clienteNumDoc) url.searchParams.append('clienteNumDoc', filtros.clienteNumDoc)
      if (filtros.fechaInicio) url.searchParams.append('fechaInicio', filtros.fechaInicio)
      if (filtros.fechaFin) url.searchParams.append('fechaFin', filtros.fechaFin)
      if (filtros.estado) url.searchParams.append('estado', filtros.estado)
      if (filtros.tituloReporte) url.searchParams.append('tituloReporte', filtros.tituloReporte)

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`)

      const blob = await response.blob()
      const urlBlob = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlBlob
      a.download = `CuentasPorCobrar_${filtros.empresaRuc}_${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(urlBlob)
      showToast('Reporte descargado correctamente', 'success')
    } catch (err) {
      showToast('Error al descargar el reporte', 'error')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  return { loading, descargarReporte }
}