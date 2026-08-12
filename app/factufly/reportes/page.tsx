"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingUp, Calendar, Download,
  PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Loader2,
  ChevronLeft, ChevronRight, FileSpreadsheet, Receipt, CreditCard
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { cn } from '@/app/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useReportesEmpresa } from './gestionReportes/UseReportesEmpresa';
import { useReportesSucursal } from './gestionReportes/UseReportesSucursal';
import { useReportesAvanzados } from './gestionReportes/UseReportesAvanzados';
import { Periodo, GraficoBarra } from './gestionReportes/Reportes';
import { useUsuariosReporte } from './gestionReportes/UseUsuariosReporte';
import { useSucursalRuc } from '../operaciones/boleta/gestionBoletas/useSucursalRuc';
import { DropdownSucursal } from '@/app/components/ui/DropdownSucursal';
import { DropdownUsuario } from '@/app/components/ui/DropdownUsuario';
import { ModalReportes } from '@/app/components/modalReportes/Modalreportes';
import { useModalReportes } from '@/app/components/modalReportes/UseModalReportes';
import { FormatoReporte } from './gestionReportes/UseReportesAvanzados';

// ─── Colores donut ────────────────────────────────────────────────────────────
const DOC_COLORS = {
  facturas:     '#0052CC',
  boletas:      '#FF6321',
  notasCredito: '#6366f1',
  notasDebito:  '#f59e0b',
  notasVenta:   '#d97706',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatNum(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function calcTrend(current: number, prev: number) {
  if (prev === 0 && current === 0) return { pct: '—', isUp: true };
  if (prev === 0 && current > 0)  return { pct: '+100%', isUp: true };
  const diff = ((current - prev) / prev) * 100;
  return { pct: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, isUp: diff >= 0 };
}

function getTituloGrafico(periodo: Periodo): string {
  const map: Record<Periodo, string> = {
    hoy:           'Ventas de Hoy',
    semana:        'Ventas de Esta Semana',
    mes:           'Ventas de Este Mes',
    año:           'Ventas de Este Año',
    personalizado: 'Ventas del Período Seleccionado',
  };
  return map[periodo];
}

function getSubtituloGrafico(periodo: Periodo): string {
  const map: Record<Periodo, string> = {
    hoy:           'Comparativa de ventas e IGV del día',
    semana:        'Comparativa de ventas e IGV por día',
    mes:           'Comparativa de ventas e IGV por día',
    año:           'Comparativa de ventas e IGV por mes',
    personalizado: 'Comparativa de ventas e IGV generado',
  };
  return map[periodo];
}

const DIAS_POR_PAGINA = 10;
type DateRange = 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado';

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ReportesPage() {
  const { user } = useAuth();
  const isSuperAdmin     = user?.rol === 'superadmin';
  const isAdmin          = user?.rol === 'admin';
  const puedeVerUsuarios = isSuperAdmin || isAdmin;

  const hookEmpresa  = useReportesEmpresa();
  const hookSucursal = useReportesSucursal();
  const avanzados    = useReportesAvanzados();
  const modal        = useModalReportes();

  // Sucursales
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number | null>(null);
  const { sucursales, loadingSucursales } = useSucursalRuc(true);

  const activeHook = isSuperAdmin && !sucursalSeleccionada ? hookEmpresa : hookSucursal;
  const { reportes, loading, loadingExport, fetchExport } = activeHook;

  const [periodo, setPeriodo]             = useState<DateRange>('hoy');
  const [showCustom, setShowCustom]       = useState(false);
  const [customStart, setCustomStart]     = useState('');
  const [customEnd, setCustomEnd]         = useState('');
  const [usuarioId, setUsuarioId]         = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf]       = useState(false);
  const [paginaGrafico, setPaginaGrafico] = useState(0);

  // Usuarios
  const { usuarios, fetchUsuarios } = useUsuariosReporte();

  useEffect(() => {
    if (user) {
      if (puedeVerUsuarios) fetchUsuarios();
      doFetch('hoy');
    }
  }, [user, puedeVerUsuarios]);

  // ── codEstablecimiento según rol ──────────────────────────────────────────
  const getCodEstablecimiento = (sId: number | null = sucursalSeleccionada): string | null => {
    if (!isSuperAdmin) {
      return sucursales.find(s => s.sucursalId === Number(user?.sucursalID))?.codEstablecimiento ?? null
    }
    if (sId) return sucursales.find(s => s.sucursalId === sId)?.codEstablecimiento ?? null
    return null
  }

  // ── Fetch reportes dashboard ──────────────────────────────────────────────
  const doFetch = (
    p: DateRange,
    uId: number | null = usuarioId,
    sId: number | null = sucursalSeleccionada,
    desde?: string,
    hasta?: string
  ) => {
    if (!user) return;

    // Forzar fecha local peruana cuando el periodo es 'hoy'
    const fechaHoy = new Date().toLocaleDateString('en-CA');
    const desdeLocal = p === 'hoy' ? fechaHoy : desde;
    const hastaLocal = p === 'hoy' ? fechaHoy : hasta;

    const params = {
      periodo: p as Periodo,
      limite: 10,
      usuarioId: uId ?? undefined,
      desde: desdeLocal || undefined,
      hasta: hastaLocal || undefined,
    };

    if (isSuperAdmin && sId) {
      hookSucursal.fetchReportes({ ...params, sucursalId: sId });
    } else if (isSuperAdmin) {
      hookEmpresa.fetchReportes({ ...params, ruc: user.ruc });
    } else {
      hookSucursal.fetchReportes({ ...params, sucursalId: Number(user.sucursalID) });
    }
  };

  const handlePeriodo = (p: DateRange) => {
    setPeriodo(p);
    setShowCustom(false);
    setCustomStart('');
    setCustomEnd('');
    doFetch(p);
  };

  const handleUsuario = (id: number | null) => {
    setUsuarioId(id);
    if (periodo === 'personalizado' && customStart) {
      doFetch(periodo, id, sucursalSeleccionada, customStart, customEnd || customStart);
    } else {
      doFetch(periodo, id);
    }
  };

  const handlePersonalizar = () => {
    if (!customStart) return;
    const desde = customStart;
    const hasta = customEnd || customStart;
    setPeriodo('personalizado');
    setShowCustom(true);
    doFetch('personalizado', usuarioId, sucursalSeleccionada, desde, hasta);
  };

  const handleSucursal = (id: number | null) => {
    setSucursalSeleccionada(id)
    setUsuarioId(null) // 👈 resetear usuario al cambiar sucursal
    if (periodo === 'personalizado' && customStart) {
      doFetch(periodo, null, id, customStart, customEnd || customStart)
    } else {
      doFetch(periodo, null, id)
    }
  }

  // ── Gráfico paginado ──────────────────────────────────────────────────────
  const graficoCompleto: GraficoBarra[] = reportes?.grafico ?? [];
  const necesitaPaginacion = (periodo === 'mes' || periodo === 'personalizado') && graficoCompleto.length > DIAS_POR_PAGINA;
  const totalPaginas = Math.ceil(graficoCompleto.length / DIAS_POR_PAGINA);
  const graficoPaginado = necesitaPaginacion
    ? graficoCompleto.slice(paginaGrafico * DIAS_POR_PAGINA, (paginaGrafico + 1) * DIAS_POR_PAGINA)
    : graficoCompleto;

  useEffect(() => {
    if (graficoCompleto.length > DIAS_POR_PAGINA) {
      setPaginaGrafico(Math.ceil(graficoCompleto.length / DIAS_POR_PAGINA) - 1);
    } else {
      setPaginaGrafico(0);
    }
  }, [graficoCompleto.length]);

  // ── Donut ─────────────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    const d = reportes?.distribucion;
    if (!d) return [];
    return [
      { name: 'Facturas',         value: d.facturas,     color: DOC_COLORS.facturas },
      { name: 'Boletas',          value: d.boletas,       color: DOC_COLORS.boletas },
      { name: 'Notas de Crédito', value: d.notasCredito,  color: DOC_COLORS.notasCredito },
      { name: 'Notas de Débito',  value: d.notasDebito,   color: DOC_COLORS.notasDebito },
      { name: 'N. de Venta', value: d.notasVenta ?? 0, color: DOC_COLORS.notasVenta },
    ].filter(i => i.value > 0);
  }, [reportes?.distribucion]);

  // ── KPI ───────────────────────────────────────────────────────────────────
  const kpi = reportes?.kpi;
  const totalNV = reportes?.distribucion?.totalNotasVenta ?? 0;
  const countNV = reportes?.distribucion?.notasVenta ?? 0;
  const totalComisionTarjeta = reportes?.kpi?.totalComisionTarjeta ?? 0;
  const stats = useMemo(() => [
    {
      label: 'Total Ventas (Inc. IGV)',
      value: kpi ? formatNum(kpi.totalVentas) : '—',
      trend: kpi ? calcTrend(kpi.totalVentas, kpi.totalVentasAnterior) : { pct: '—', isUp: true },
      icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50',
    },
    {
      label: 'IGV por Pagar',
      value: kpi ? formatNum(kpi.totalIGV) : '—',
      trend: kpi ? calcTrend(kpi.totalIGV, kpi.totalIGVAnterior) : { pct: '—', isUp: true },
      icon: BarChart3, color: 'text-brand-blue', bg: 'bg-blue-50',
    },
    {
      label: 'Documentos Emitidos',
      value: kpi ? kpi.totalDocumentos.toLocaleString('es-PE') : '—',
      trend: kpi ? calcTrend(kpi.totalDocumentos, kpi.totalDocumentosAnterior) : { pct: '—', isUp: true },
      icon: PieChartIcon, color: 'text-brand-red', bg: 'bg-red-50',
    },
    ...(totalNV > 0 ? [{
      label: 'N. de Venta',
      value: kpi ? formatNum(totalNV) : '—',
      trend: { pct: `${countNV} doc${countNV !== 1 ? 's' : ''}`, isUp: true },
      icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50',
    }] : []),
    ...(totalComisionTarjeta > 0 ? [{
      label: 'Comisión POS',
      value: kpi ? formatNum(totalComisionTarjeta) : '—',
      trend: { pct: 'Informativo', isUp: true },
      icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50',
    }] : []),
  ], [kpi, totalNV, countNV, totalComisionTarjeta]);

  // ── Export Excel desde modal ──────────────────────────────────────────────
  const getParamsBase = (sId: number | null = sucursalSeleccionada) => ({
    ruc: user!.ruc,
    codEstablecimiento: getCodEstablecimiento(sId),
  });

  // Obtener nombre de sucursal para el título automático
  const getNombreSucursal = (cod: string | null): string | undefined => {
    if (!cod) return undefined;
    return sucursales.find(s => s.codEstablecimiento === cod)?.nombre;
  };

  const getNombreUsuario = (uid: number | null): string | undefined => {
    if (!uid) return undefined;
    return usuarios.find(u => u.usuarioID === uid)?.username;
  };

  const resolverTitulo = (tipoReporte: string): string => {  
    return modal.filtros.tituloPersonalizado || modal.generarTituloAuto({
      tipoReporte,
      ruc: user!.ruc,
      periodo: periodo as Periodo,
      sucursalNombre: getNombreSucursal(modal.filtros.codEstablecimiento ?? null),
      usuarioNombre:  getNombreUsuario(modal.filtros.usuarioCreacion ?? null),
      fechaDesde:     modal.filtros.fechaDesde,
      fechaHasta:     modal.filtros.fechaHasta,
    });
  };

  const getParamsModal = () => {
    const codEst = isSuperAdmin
      ? (modal.filtros.codEstablecimiento ?? null)
      : getCodEstablecimiento();
    const filtros = { ...getParamsBase(), ...modal.filtros, codEstablecimiento: codEst };
    // Facturador siempre filtra por su propio usuarioCreacion — no puede ver datos de otros
    if (!puedeVerUsuarios && user?.id) {
      filtros.usuarioCreacion = Number(user.id);
    }
    return filtros;
  };

  const handleDescargarListado = async (_filtros: typeof modal.filtros, formato: FormatoReporte) => {
    await avanzados.descargarExcelListado(getParamsModal(), resolverTitulo('Libro Contable'), formato);
  };

  const handleDescargarProductos = async (_filtros: typeof modal.filtros, formato: FormatoReporte) => {
    await avanzados.descargarExcelProductos(getParamsModal(), resolverTitulo('Top Productos'), formato);
  };

  const handleDescargarControlCaja = async (_filtros: typeof modal.filtros, formato: FormatoReporte) => {
    await avanzados.descargarExcelControlCaja(getParamsModal(), resolverTitulo('control-caja'), formato);
  };

  const handleDescargarMedios = async (_filtros: typeof modal.filtros, formato: FormatoReporte) => {
    await avanzados.descargarExcelMedios(getParamsModal(), resolverTitulo('Medios de Pago mas usados'), formato);
  };

  const handleDescargarTicket = async () => {
    const params = getParamsModal();
    await avanzados.descargarTicketControlCaja(
      params,
      user?.username ?? 'Responsable',
      getNombreUsuario(params.usuarioCreacion ?? null),
    );
  };

  const handleDescargarPdfTicket = async () => {
    const params = getParamsModal();
    await avanzados.descargarPdfTicketControlCaja(
      params,
      user?.username ?? 'Responsable',
      getNombreUsuario(params.usuarioCreacion ?? null),
    );
  };

  // ── Export CSV clientes (funcionalidad existente) ─────────────────────────
  const handleExportExcel = async () => {
    if (!user) return;
    const params = {
      periodo: (showCustom ? 'personalizado' : periodo) as Periodo,
      desde: showCustom ? customStart : undefined,
      hasta: showCustom ? customEnd : undefined,
      usuarioId: usuarioId ?? undefined,
    };
    let data;
    if (isSuperAdmin && !sucursalSeleccionada) {
      data = await hookEmpresa.fetchExport({ ...params, ruc: user.ruc });
    } else if (isSuperAdmin && sucursalSeleccionada) {
      data = await hookSucursal.fetchExport({ ...params, sucursalId: sucursalSeleccionada });
    } else {
      data = await hookSucursal.fetchExport({ ...params, sucursalId: Number(user.sucursalID) });
    }
    if (!data?.length) return;
    const headers = ['Cliente', 'Nº Doc', 'Nº Docs', 'Subtotal', 'IGV', 'Total'];
    const rows = data.map(c => [c.clienteRznSocial, c.clienteNumDoc, c.numDocs, c.subtotal, c.igv, c.total]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `reporte_clientes_${periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getHoyString = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  };

  const periodoActivo = showCustom ? null : periodo;

  // ── Sucursales para el modal (solo superadmin) ────────────────────────────
  const sucursalesModal = isSuperAdmin
    ? sucursales.map(s => ({
        sucursalId: s.sucursalId,
        nombre: s.nombre,
        codEstablecimiento: s.codEstablecimiento,
      }))
    : [];
  const handleCerrarModal = () => {
    modal.cerrar()
    modal.resetFiltros()
  }
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* ── Header / Filtros ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Períodos */}
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
              {(['hoy', 'semana', 'mes', 'año'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handlePeriodo(range)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize",
                    periodoActivo === range
                      ? "bg-brand-blue text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {range === 'hoy' ? 'Hoy' : range === 'semana' ? 'Esta Semana' : range === 'mes' ? 'Este Mes' : 'Este Año'}
                </button>
              ))}
            </div>

            {isSuperAdmin && (
              <DropdownSucursal
                sucursales={sucursales}
                seleccionada={sucursalSeleccionada}
                onSelect={handleSucursal}
              />
            )}

            {puedeVerUsuarios && (
              <DropdownUsuario
                usuarios={isSuperAdmin && sucursalSeleccionada
                  ? usuarios.filter(u =>
                      String(u.sucursalID) === String(sucursalSeleccionada) || u.rol === 'superadmin'
                    )
                  : usuarios
                }
                seleccionado={usuarioId}
                onSelect={handleUsuario}
              />
            )}
          </div>

          {/* Personalizar fechas */}
          {showCustom && (
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-brand-blue/30 shadow-sm w-fit animate-in fade-in duration-200">
              <input
                type="date"
                value={customStart}
                max={getHoyString()}
                onChange={e => {
                  setCustomStart(e.target.value);
                  if (customEnd && e.target.value > customEnd) setCustomEnd('');
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-blue/50"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={getHoyString()}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-blue/50"
              />
              <button
                onClick={handlePersonalizar}
                disabled={loading || !customStart}
                className="text-xs font-bold px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Aplicar'}
              </button>
            </div>
          )}
        </div>

        {/* Botones derecha */}
        <div className="flex gap-2">
          {/* Botón Reportes — abre el modal */}
          <Button
            variant="outline"
            onClick={modal.abrir}
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Reportes Excel
          </Button>

          <Button variant="outline" onClick={() => setShowCustom(v => !v)}>
            <Calendar className="w-4 h-4" /> Personalizar
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 md:grid-cols-${stats.length} gap-6`}>
        {stats.map((stat, i) => (
          <Card key={i} className="p-0">
            <div className="p-0">
              <div className="flex justify-between items-start">
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <stat.icon className={cn("w-6 h-6", stat.color)} />
                </div>
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
                  stat.trend.isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {stat.trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.trend.pct}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                <p className="text-[14px] font-black text-gray-900 mt-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Gráficas ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="lg:col-span-2"
          title={getTituloGrafico((showCustom ? 'personalizado' : periodo) as Periodo)}
          subtitle={getSubtituloGrafico((showCustom ? 'personalizado' : periodo) as Periodo)}
        >
          {necesitaPaginacion && (
            <div className="flex items-center justify-end gap-2 mt-2">
              <span className="text-xs text-gray-400">
                Días {paginaGrafico * DIAS_POR_PAGINA + 1}–{Math.min((paginaGrafico + 1) * DIAS_POR_PAGINA, graficoCompleto.length)} de {graficoCompleto.length}
              </span>
              <button
                onClick={() => setPaginaGrafico(p => Math.max(0, p - 1))}
                disabled={paginaGrafico === 0}
                className="p-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPaginaGrafico(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaGrafico >= totalPaginas - 1}
                className="p-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <div className="h-87.5 w-full mt-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando datos...
              </div>
            ) : graficoPaginado.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Sin datos en el período seleccionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoPaginado}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number | undefined) => value !== undefined ? `S/ ${value.toLocaleString('es-PE')}` : '—'}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  <Bar dataKey="ventas"   name="Ventas Totales"  fill="#0052CC" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="igv"      name="IGV Generado"    fill="#FF6321" radius={[4, 4, 0, 0]} barSize={16} />
                  {totalNV > 0 && <Bar dataKey="ventasNV" name="N. de Venta" fill="#d97706" radius={[4, 4, 0, 0]} barSize={16} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Distribución de Documentos" subtitle="Porcentaje por tipo de comprobante">
          <div className="h-75 w-full mt-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-3 mt-4">
            {loading ? null : donutData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Tabla Clientes ─────────────────────────────────────────────────── */}
      <Card
        title="Resumen Detallado por Cliente"
        action={
          <Button variant="ghost" className="text-brand-blue" onClick={handleExportExcel} disabled={loadingExport}>
            {loadingExport
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
              : <><Download className="w-4 h-4" /> Exportar CSV</>
            }
          </Button>
        }
      >
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">N° Docs</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Subtotal</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">IGV</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando...</td></tr>
              ) : (reportes?.topClientes ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">Sin datos en el período seleccionado</td></tr>
              ) : (
                <>
                  {(reportes?.topClientes ?? []).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.clienteRznSocial}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-center">{row.numDocs}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNum(row.subtotal)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNum(row.igv)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-brand-blue text-right">{formatNum(row.total)}</td>
                    </tr>
                  ))}
                  {reportes?.totalesClientes && (
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-6 py-4 text-sm font-black text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-700 text-center">{reportes.totalesClientes.totalDocs}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{formatNum(reportes.totalesClientes.totalSubtotal)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-orange-500 text-right">{formatNum(reportes.totalesClientes.totalIgv)}</td>
                      <td className="px-6 py-4 text-sm font-black text-brand-blue text-right">{formatNum(reportes.totalesClientes.totalGeneral)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal Reportes Excel ───────────────────────────────────────────── */}
      <ModalReportes
        abierto={modal.abierto}
        onCerrar={handleCerrarModal}
        filtros={modal.filtros}
        onSetFiltro={modal.setFiltro}
        onResetFiltros={modal.resetFiltros}
        usuarios={usuarios}
        sucursales={sucursalesModal}
        isSuperAdmin={isSuperAdmin}
        puedeVerUsuarios={puedeVerUsuarios}
        loadingExcelListado={avanzados.loadingExcelListado}
        loadingExcelProductos={avanzados.loadingExcelProductos}
        loadingExcelMedios={avanzados.loadingExcelMedios}
        loadingExcelControlCaja={avanzados.loadingExcelControlCaja}
        loadingTicketControlCaja={avanzados.loadingTicketControlCaja}
        loadingPdfTicketControlCaja={avanzados.loadingPdfTicketControlCaja}
        onDescargarListado={handleDescargarListado}
        onDescargarProductos={handleDescargarProductos}
        onDescargarMedios={handleDescargarMedios}
        onDescargarControlCaja={handleDescargarControlCaja}
        onDescargarTicket={handleDescargarTicket}
        onDescargarPdfTicket={handleDescargarPdfTicket}
      />
    </div>
  );
}