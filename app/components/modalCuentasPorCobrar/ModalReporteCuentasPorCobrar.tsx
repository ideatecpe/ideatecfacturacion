'use client'
import React, { useState } from 'react'
import { X, FileSpreadsheet, Download, Calendar, Building2 } from 'lucide-react'
import { cn } from '@/app/utils/cn'
import { useReporteCuentasPorCobrar } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseReporteCuentasPorCobrar'
import { useSucursalRuc } from '@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc'
import { useSucursal } from '@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal'

interface ModalReporteCuentasPorCobrarProps {
  empresaRuc: string
  isSuperAdmin: boolean
  onClose: () => void
}

const ESTADO_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'PAGADO', label: 'Pagados' },
  { value: 'PENDIENTE', label: 'Pendientes' },
]

const FECHA_SHORTCUTS = [
  { label: 'Hoy' },
  { label: 'Esta semana' },
  { label: 'Este mes' },
  { label: 'Este año' },
]

export const ModalReporteCuentasPorCobrar = ({
  empresaRuc, isSuperAdmin, onClose
}: ModalReporteCuentasPorCobrarProps) => {

  const { loading, descargarReporte } = useReporteCuentasPorCobrar()
  const { sucursales } = useSucursalRuc(isSuperAdmin)
  const { sucursal } = useSucursal()

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())

  const [sucursalFiltro, setSucursalFiltro] = useState<string>('')
  const [fechaDesde, setFechaDesde]         = useState('')
  const [fechaHasta, setFechaHasta]         = useState('')
  const [clienteNumDoc, setClienteNumDoc]   = useState('')
  const [estado, setEstado]                 = useState('')
  const [tituloReporte, setTituloReporte]   = useState('')
  const [shortcutActivo, setShortcutActivo] = useState<string>('')

  const tituloAuto = () => {
    const partes = [`Cuentas por Cobrar - ${empresaRuc}`]
    if (isSuperAdmin && sucursalFiltro) {
      const suc = sucursales.find(s => s.codEstablecimiento === sucursalFiltro)
      if (suc) partes.push(suc.nombre ?? suc.codEstablecimiento)
    } else if (!isSuperAdmin && sucursal) {
      partes.push(sucursal.nombre ?? sucursal.codEstablecimiento ?? '')
    }
    if (clienteNumDoc) partes.push(clienteNumDoc)
    if (fechaDesde && fechaHasta && fechaDesde === fechaHasta)
      partes.push(fechaDesde)
    else if (fechaDesde && fechaHasta)
      partes.push(`${fechaDesde}_${fechaHasta}`)
    else if (fechaDesde)
      partes.push(fechaDesde)
    if (estado) partes.push(estado.toLowerCase())
    return partes.join('_').replace(/\s+/g, '-').replace(/\//g, '-')
  }

  const getCodEstablecimiento = () => {
    if (isSuperAdmin) return sucursalFiltro || null
    return sucursal?.codEstablecimiento ?? null
  }

  const aplicarShortcut = (label: string) => {
      setShortcutActivo(label)
      const d = new Date()
      if (label === 'Hoy') {
          setFechaDesde(hoy); setFechaHasta(hoy)
      } else if (label === 'Esta semana') {
          const lunes = new Date(d)
          lunes.setDate(d.getDate() - d.getDay() + 1)
          setFechaDesde(lunes.toLocaleDateString('en-CA')); setFechaHasta(hoy)
      } else if (label === 'Este mes') {
          setFechaDesde(new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')); setFechaHasta(hoy)
      } else if (label === 'Este año') {
          setFechaDesde(new Date(d.getFullYear(), 0, 1).toLocaleDateString('en-CA')); setFechaHasta(hoy)
      }
  }

    const handleFechaDesde = (val: string) => {
        setFechaDesde(val)
        setShortcutActivo('')
        if (fechaHasta && val > fechaHasta) setFechaHasta('')
    }

    const handleFechaHasta = (val: string) => {
        setFechaHasta(val)
        setShortcutActivo('')
    }

  const handleDescargar = async () => {
    await descargarReporte({
      empresaRuc,
      establecimientoAnexo: getCodEstablecimiento(),
      clienteNumDoc: clienteNumDoc || null,
      fechaInicio: fechaDesde || null,
      fechaFin: fechaHasta || null,
      estado: estado || null,
      tituloReporte: tituloReporte || tituloAuto(),
    })
  }

  const limpiar = () => {
    setSucursalFiltro(''); setFechaDesde(''); setFechaHasta('')
    setClienteNumDoc(''); setEstado(''); setTituloReporte(''); setShortcutActivo('')
  }

  // Filtros activos para mostrar badges
  const filtrosActivos = [
    sucursalFiltro && (sucursales.find(s => s.codEstablecimiento === sucursalFiltro)?.nombre ?? sucursalFiltro),
    clienteNumDoc,
    estado && ESTADO_OPTS.find(e => e.value === estado)?.label,
    fechaDesde && fechaHasta ? `${fechaDesde} → ${fechaHasta}` : fechaDesde ? `Desde ${fechaDesde}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ height: '100dvh' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Reporte Cuentas por Cobrar</h2>
              <p className="text-xs text-gray-400 mt-0.5">Configura los filtros y descarga el reporte en Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-4">

          {/* Sucursal — solo superadmin */}
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={10} /> Sucursal
              </label>
              <select
                value={sucursalFiltro}
                onChange={e => setSucursalFiltro(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 text-xs text-gray-700"
              >
                <option value="">Todas las sucursales</option>
                {sucursales.map(s => (
                  <option key={s.sucursalId} value={s.codEstablecimiento}>
                    {s.nombre ?? s.codEstablecimiento}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fechas */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={10} /> Rango de fechas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Desde</p>
                <input type="date" value={fechaDesde} max={hoy}
                    onChange={e => handleFechaDesde(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 text-xs" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Hasta</p>
                <input type="date" value={fechaHasta} min={fechaDesde || undefined} max={hoy}
                    onChange={e => handleFechaHasta(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 text-xs" />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap pt-0.5">
                {/* Shortcuts de fecha */}
                {FECHA_SHORTCUTS.map(({ label }) => (
                    <button key={label} onClick={() => aplicarShortcut(label)}
                        className={cn(
                        "px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-colors",
                        shortcutActivo === label
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-white text-gray-500 border-gray-200 hover:border-emerald-200 hover:text-emerald-600"
                        )}>
                        {label}
                    </button>
                ))}
            </div>
          </div>

          {/* Doc cliente + Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nº Doc. Cliente</label>
              <input type="text" value={clienteNumDoc} onChange={e => setClienteNumDoc(e.target.value)}
                placeholder="RUC o DNI"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado</label>
              <div className="flex gap-1.5">
                {/* Estado */}
                {ESTADO_OPTS.map(o => (
                <button key={o.value} onClick={() => setEstado(o.value)}
                    className={cn(
                    "flex-1 py-1.5 text-[10px] font-semibold rounded-md border transition-colors",
                    estado === o.value
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-white text-gray-500 border-gray-200 hover:border-emerald-200 hover:text-emerald-600"
                    )}>
                    {o.label}
                </button>
                ))}
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Nombre del archivo <span className="text-gray-300 font-normal">(auto-generado si no lo completas)</span>
            </label>
            <input type="text" value={tituloReporte} onChange={e => setTituloReporte(e.target.value)}
              placeholder={tituloAuto()}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 text-xs text-gray-600" />
          </div>

          {/* Filtros activos */}
          {filtrosActivos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filtros:</span>
              {filtrosActivos.map((f, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={limpiar}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Limpiar filtros
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cerrar
            </button>
            <button onClick={handleDescargar} disabled={loading}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors",
                loading && "opacity-50 cursor-not-allowed"
              )}>
              {loading
                ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                : <Download size={13} />}
              {loading ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}