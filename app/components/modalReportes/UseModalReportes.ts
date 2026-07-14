import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { FiltrosReporteModal, Periodo } from '@/app/factufly/reportes/gestionReportes/Reportes'

interface UseModalReportesReturn {
  abierto: boolean
  filtros: FiltrosReporteModal
  abrir: () => void
  cerrar: () => void
  setFiltro: <K extends keyof FiltrosReporteModal>(key: K, value: FiltrosReporteModal[K]) => void
  resetFiltros: () => void
  generarTituloAuto: (params: {
    tipoReporte: string
    ruc: string
    periodo: Periodo
    sucursalNombre?: string
    usuarioNombre?: string
    fechaDesde?: string | null
    fechaHasta?: string | null
  }) => string
}

const filtrosIniciales: FiltrosReporteModal = {
  codEstablecimiento: null,
  fechaDesde:         null,
  fechaHasta:         null,
  usuarioCreacion:    null,
  clienteNumDoc:      null,
  limit:              null,
  orderBy:            'monto',
  tituloPersonalizado: null,
  filtroNV:           'excluir',
}

export const useModalReportes = (): UseModalReportesReturn => {
  const { user } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosReporteModal>(filtrosIniciales)

  const abrir = useCallback(() => setAbierto(true), [])
  const cerrar = useCallback(() => setAbierto(false), [])

  const setFiltro = useCallback(<K extends keyof FiltrosReporteModal>(
    key: K,
    value: FiltrosReporteModal[K]
  ) => {
    setFiltros(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetFiltros = useCallback(() => {
    setFiltros(filtrosIniciales)
  }, [])

  // ── Generador de título automático ─────────────────────────────────────────
  const generarTituloAuto = useCallback(({
    tipoReporte,
    ruc,
    periodo,
    sucursalNombre,
    usuarioNombre,
    fechaDesde,
    fechaHasta,
  }: {
    tipoReporte: string
    ruc: string
    periodo: Periodo
    sucursalNombre?: string
    usuarioNombre?: string
    fechaDesde?: string | null
    fechaHasta?: string | null
  }): string => {
    const partes: string[] = [tipoReporte]

    // RUC
    partes.push(ruc)

    // Sucursal
    if (sucursalNombre) partes.push(sucursalNombre)

    // Usuario
    if (usuarioNombre) partes.push(usuarioNombre)

    // Fechas
    if (fechaDesde && fechaHasta) {
      partes.push(`${fechaDesde}_al_${fechaHasta}`)
    } else if (fechaDesde) {
      partes.push(fechaDesde)
    }
    return partes.join('_')
  }, [])

  return { abierto, filtros, abrir, cerrar, setFiltro, resetFiltros, generarTituloAuto }
}
