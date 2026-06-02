import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import {
  MedioPagoTop,
  ProductoTop,
  ListadoReporte,
  ReportesAvanzadosParams,
  Periodo
} from './Reportes'

export type FormatoReporte = 'excel' | 'pdf'

interface UseReportesAvanzadosReturn {
  listado: ListadoReporte[]
  productosTop: ProductoTop[]
  mediosPago: MedioPagoTop[]
  loadingListado: boolean
  loadingProductos: boolean
  loadingMedios: boolean
  loadingExcelListado: boolean
  loadingExcelProductos: boolean
  loadingExcelMedios: boolean
  loadingExcelControlCaja: boolean
  loadingTicketControlCaja: boolean
  loadingPdfTicketControlCaja: boolean
  fetchListado: (params: ReportesAvanzadosParams) => Promise<void>
  fetchProductosTop: (params: ReportesAvanzadosParams) => Promise<void>
  fetchMediosPago: (params: ReportesAvanzadosParams) => Promise<void>
  descargarExcelListado: (params: ReportesAvanzadosParams, titulo: string, formato?: FormatoReporte) => Promise<void>
  descargarExcelProductos: (params: ReportesAvanzadosParams, titulo: string, formato?: FormatoReporte) => Promise<void>
  descargarExcelMedios: (params: ReportesAvanzadosParams, titulo: string, formato?: FormatoReporte) => Promise<void>
  descargarExcelControlCaja: (params: ReportesAvanzadosParams, titulo: string, formato?: FormatoReporte) => Promise<void>
  descargarTicketControlCaja: (params: ReportesAvanzadosParams, nombreResponsable: string, nombreUsuario?: string) => Promise<void>
  descargarPdfTicketControlCaja: (params: ReportesAvanzadosParams, nombreResponsable: string, nombreUsuario?: string) => Promise<void>
}

export const useReportesAvanzados = (): UseReportesAvanzadosReturn => {
  const { accessToken } = useAuth()
  const { showToast } = useToast()

  const [listado, setListado] = useState<ListadoReporte[]>([])
  const [productosTop, setProductosTop] = useState<ProductoTop[]>([])
  const [mediosPago, setMediosPago] = useState<MedioPagoTop[]>([])

  const [loadingListado, setLoadingListado] = useState(false)
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [loadingMedios, setLoadingMedios] = useState(false)
  const [loadingExcelListado, setLoadingExcelListado] = useState(false)
  const [loadingExcelProductos, setLoadingExcelProductos] = useState(false)
  const [loadingExcelMedios, setLoadingExcelMedios] = useState(false)
  const [loadingExcelControlCaja, setLoadingExcelControlCaja] = useState(false)
  const [loadingTicketControlCaja, setLoadingTicketControlCaja] = useState(false)
  const [loadingPdfTicketControlCaja, setLoadingPdfTicketControlCaja] = useState(false)

  const buildUrl = (path: string, params: Record<string, string | number | null | undefined>) => {
    const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}${path}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '')
        url.searchParams.append(key, String(value))
    })
    return url.toString()
  }

  const headers = { Authorization: `Bearer ${accessToken}` }

  // ── Descarga genérica — detecta formato y extensión ───────────────────────────
  const descargarBlob = async (url: string, nombreArchivo: string, formato: FormatoReporte = 'excel') => {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const blob = await res.blob()
    const ext = formato === 'pdf' ? 'pdf' : 'xlsx'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${nombreArchivo}.${ext}`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // ── Listado comprobantes ───────────────────────────────────────────────────
  const fetchListado = useCallback(async (params: ReportesAvanzadosParams) => {
    setLoadingListado(true)
    try {
      const url = buildUrl(`/api/Reportes/listado/${params.ruc}`, {
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
      })
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setListado(await res.json())
    } catch {
      showToast('Error al obtener listado de comprobantes', 'error')
      setListado([])
    } finally {
      setLoadingListado(false)
    }
  }, [accessToken])

  // ── Productos top ──────────────────────────────────────────────────────────
  const fetchProductosTop = useCallback(async (params: ReportesAvanzadosParams) => {
    setLoadingProductos(true)
    try {
      const url = buildUrl(`/api/Reportes/productos-top/${params.ruc}`, {
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
        orderBy:            params.orderBy,
      })
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setProductosTop(await res.json())
    } catch {
      showToast('Error al obtener productos top', 'error')
      setProductosTop([])
    } finally {
      setLoadingProductos(false)
    }
  }, [accessToken])

  // ── Medios de pago ─────────────────────────────────────────────────────────
  const fetchMediosPago = useCallback(async (params: ReportesAvanzadosParams) => {
    setLoadingMedios(true)
    try {
      const url = buildUrl(`/api/Reportes/medios-pago/${params.ruc}`, {
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
      })
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setMediosPago(await res.json())
    } catch {
      showToast('Error al obtener medios de pago', 'error')
      setMediosPago([])
    } finally {
      setLoadingMedios(false)
    }
  }, [accessToken])

  // ── Excel/PDF listado ──────────────────────────────────────────────────────
  const descargarExcelListado = useCallback(async (
    params: ReportesAvanzadosParams,
    titulo: string,
    formato: FormatoReporte = 'excel'
  ) => {
    setLoadingExcelListado(true)
    try {
      const url = buildUrl(`/api/Reportes/listado/${params.ruc}/excel`, {
        titulo,
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
        formato,
      })
      await descargarBlob(url, titulo, formato)
      showToast(`${formato === 'pdf' ? 'PDF' : 'Excel'} descargado correctamente`, 'success')
    } catch {
      showToast('Error al generar el reporte', 'error')
    } finally {
      setLoadingExcelListado(false)
    }
  }, [accessToken])

  // ── Excel/PDF productos top ────────────────────────────────────────────────
  const descargarExcelProductos = useCallback(async (
    params: ReportesAvanzadosParams,
    titulo: string,
    formato: FormatoReporte = 'excel'
  ) => {
    setLoadingExcelProductos(true)
    try {
      const url = buildUrl(`/api/Reportes/productos-top/${params.ruc}/excel`, {
        titulo,
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
        orderBy:            params.orderBy,
        formato,
      })
      await descargarBlob(url, titulo, formato)
      showToast(`${formato === 'pdf' ? 'PDF' : 'Excel'} descargado correctamente`, 'success')
    } catch {
      showToast('Error al generar el reporte', 'error')
    } finally {
      setLoadingExcelProductos(false)
    }
  }, [accessToken])

  // ── Excel/PDF medios pago ──────────────────────────────────────────────────
  const descargarExcelMedios = useCallback(async (
    params: ReportesAvanzadosParams,
    titulo: string,
    formato: FormatoReporte = 'excel'
  ) => {
    setLoadingExcelMedios(true)
    try {
      const url = buildUrl(`/api/Reportes/medios-pago/${params.ruc}/excel`, {
        titulo,
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
        formato,
      })
      await descargarBlob(url, titulo, formato)
      showToast(`${formato === 'pdf' ? 'PDF' : 'Excel'} descargado correctamente`, 'success')
    } catch {
      showToast('Error al generar el reporte', 'error')
    } finally {
      setLoadingExcelMedios(false)
    }
  }, [accessToken])

  // ── Excel/PDF control de caja ──────────────────────────────────────────────
  const descargarExcelControlCaja = useCallback(async (
    params: ReportesAvanzadosParams,
    titulo: string,
    formato: FormatoReporte = 'excel'
  ) => {
    setLoadingExcelControlCaja(true)
    try {
      const url = buildUrl(`/api/Reportes/control-caja/${params.ruc}/excel`, {
        titulo,
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
        formato,
      })
      await descargarBlob(url, titulo, formato)
      showToast(`${formato === 'pdf' ? 'PDF' : 'Excel'} descargado correctamente`, 'success')
    } catch {
      showToast('Error al generar el reporte', 'error')
    } finally {
      setLoadingExcelControlCaja(false)
    }
  }, [accessToken])

  // ── Ticket HTML control de caja — imprime en térmica sin borrosidad ─────────
  const descargarTicketControlCaja = useCallback(async (
    params: ReportesAvanzadosParams,
    nombreResponsable: string,
    nombreUsuario?: string
  ) => {
    setLoadingTicketControlCaja(true)
    try {
      const url = buildUrl(`/api/Reportes/control-caja/${params.ruc}/ticket-html`, {
        nombreResponsable,
        nombreUsuario,
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
      })
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;'
      iframe.src = blobUrl
      document.body.appendChild(iframe)
      iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(blobUrl)
        }, 2000)
      }
      showToast('Ticket generado correctamente', 'success')
    } catch {
      showToast('Error al generar el ticket', 'error')
    } finally {
      setLoadingTicketControlCaja(false)
    }
  }, [accessToken])

  // ── Ticket PDF A4 control de caja — descarga directa ─────────────────────
  const descargarPdfTicketControlCaja = useCallback(async (
    params: ReportesAvanzadosParams,
    nombreResponsable: string,
    nombreUsuario?: string
  ) => {
    setLoadingPdfTicketControlCaja(true)
    try {
      const url = buildUrl(`/api/Reportes/control-caja/${params.ruc}/ticket-pdf`, {
        nombreResponsable,
        nombreUsuario,
        codEstablecimiento: params.codEstablecimiento,
        fechaDesde:         params.fechaDesde,
        fechaHasta:         params.fechaHasta,
        usuarioCreacion:    params.usuarioCreacion,
        clienteNumDoc:      params.clienteNumDoc,
        limit:              params.limit,
      })
      await descargarBlob(url, `caja-ticket-${params.fechaDesde ?? 'hoy'}`, 'pdf')
      showToast('PDF descargado correctamente', 'success')
    } catch {
      showToast('Error al generar el PDF', 'error')
    } finally {
      setLoadingPdfTicketControlCaja(false)
    }
  }, [accessToken])

  return {
    listado, productosTop, mediosPago,
    loadingListado, loadingProductos, loadingMedios,
    loadingExcelListado, loadingExcelProductos, loadingExcelMedios,
    loadingExcelControlCaja, loadingTicketControlCaja, loadingPdfTicketControlCaja,
    fetchListado, fetchProductosTop, fetchMediosPago,
    descargarExcelListado, descargarExcelProductos,
    descargarExcelMedios, descargarExcelControlCaja,
    descargarTicketControlCaja, descargarPdfTicketControlCaja,
  }
}
