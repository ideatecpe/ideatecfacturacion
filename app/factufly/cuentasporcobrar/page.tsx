"use client";
import { Fragment, useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Search, X, Filter, ChevronDown, RefreshCw,
  Calendar, Check, CreditCard,
  AlertTriangle,
  FileSpreadsheet, Users, FileText, Wallet
} from 'lucide-react';
import { cn } from '@/app/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { useCuentasPorCobrar } from './gestionCuentasPorCobrar/UseCuentasPorCobrar';
import { CuentaPorCobrar, ResumenClienteCuenta } from './gestionCuentasPorCobrar/CuentasPorCobrar';
import { useCobroCliente } from './gestionCuentasPorCobrar/UseCobroCliente';
import { ModalCobrarCliente, type ModoCobro } from '@/app/components/modalCuentasPorCobrar/ModalCobrarCliente';
import { formatFecha, formatMoneda, tipoComprobanteLabel, getDiasVencida } from './gestionCuentasPorCobrar/helpers';
import { useSucursalRuc } from '../operaciones/boleta/gestionBoletas/useSucursalRuc';
import { useSucursal } from '../operaciones/boleta/gestionBoletas/useSucursal';
import { ModalReporteCuentasPorCobrar } from '@/app/components/modalCuentasPorCobrar/ModalReporteCuentasPorCobrar';
import { BotonVerProductos, DetalleProductosComprobante } from '@/app/components/modalCuentasPorCobrar/DetalleProductosComprobante';
import { useProductosComprobantes } from './gestionCuentasPorCobrar/UseProductosComprobantes';

const TIPO_BASE = ['Todos', 'Factura', 'Boleta'];

type Vista = 'clientes' | 'comprobantes';
const CLAVE_VISTA = 'cuentasPorCobrar_vista';

// La vista elegida se recuerda en localStorage, que no existe en el servidor:
// leerla al crear el estado hacía que el HTML del servidor ("Por cliente") no
// coincidiera con el del navegador. useSyncExternalStore hidrata con la vista
// por defecto y recién después aplica la guardada.
let vistaActual: Vista | null = null;
const oyentesVista = new Set<() => void>();
const leerVista = (): Vista => {
  if (vistaActual === null) {
    try {
      vistaActual = localStorage.getItem(CLAVE_VISTA) === 'comprobantes' ? 'comprobantes' : 'clientes';
    } catch {
      vistaActual = 'clientes';
    }
  }
  return vistaActual;
};
const guardarVista = (v: Vista) => {
  vistaActual = v;
  try { localStorage.setItem(CLAVE_VISTA, v); } catch {}
  oyentesVista.forEach(f => f());
};
const suscribirVista = (f: () => void) => {
  oyentesVista.add(f);
  return () => { oyentesVista.delete(f); };
};

// Misma regla que el backend: sin documento ("Clientes Varios", "0") se separa por nombre.
const DOCS_GENERICOS = ['', '0', '-', '00000000', '99999999'];
const claveCliente = (numDoc: string | null, nombre: string | null) => {
  const doc = (numDoc ?? '').trim();
  return DOCS_GENERICOS.includes(doc) ? `SD|${(nombre ?? '').trim().toUpperCase()}` : doc;
};

const saldoComprobante = (c: CuentaPorCobrar) =>
  c.saldoPendiente ?? ((!c.montoCredito || c.montoCredito === 0) ? c.importeTotal : c.montoCredito);

// La cuota pendiente más próxima; con una API sin ese dato, la del comprobante.
const vencimientoDe = (c: CuentaPorCobrar) => c.fechaVencimientoProxima ?? c.fechaVencimiento;

const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

/** Fecha de vencimiento y, debajo, si ya venció o cuánto falta. */
const CeldaVencimiento = ({ fecha }: { fecha: string | null | undefined }) => {
  if (!fecha) return <span className="text-xs text-gray-300">—</span>;
  const vence = fecha.split('T')[0];
  const dias = Math.round((new Date(vence).getTime() - new Date(hoyLima()).getTime()) / 86_400_000);
  return (
    <div>
      <p className="text-xs text-gray-700 flex items-center gap-1 whitespace-nowrap">
        <Calendar size={11} className="text-gray-400" /> {formatFecha(`${vence}T00:00:00`)}
      </p>
      {dias < 0 ? (
        <p className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-0.5 whitespace-nowrap">
          <AlertTriangle size={10} /> Vencida hace {-dias} día{dias === -1 ? '' : 's'}
        </p>
      ) : dias === 0 ? (
        <p className="text-[10px] font-bold text-amber-600 mt-0.5 whitespace-nowrap">Vence hoy</p>
      ) : (
        <p className={cn('text-[10px] mt-0.5 whitespace-nowrap', dias <= 3 ? 'font-semibold text-amber-600' : 'text-gray-400')}>
          Faltan {dias} día{dias === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
};

export default function CuentasPorCobrarPage() {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();
  const rucEmpresa = user?.ruc ?? '';
  const isBeta = user?.environment === 'beta';


  const isSuperAdmin = user?.rol === 'superadmin'

  // Solo carga sucursales si es superadmin
  const { sucursales, loadingSucursales } = useSucursalRuc(isSuperAdmin)

  // Solo carga su sucursal si NO es superadmin
  const { sucursal } = useSucursal()

  const [sucursalFiltro, setSucursalFiltro] = useState<string | null>(null)

  const getCodEstablecimiento = () => {
    if (isSuperAdmin) return sucursalFiltro
    return sucursal?.codEstablecimiento ?? null
  }

  const hookCuentas = useCuentasPorCobrar();
  const hookClientes = useCobroCliente();
  const detalle = useProductosComprobantes(rucEmpresa);
  // Comprobantes con los productos desplegados en la tabla "Por comprobante".
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const alternarDetalle = (id: number) => {
    void detalle.cargar([id]);
    setAbiertos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const vista = useSyncExternalStore(suscribirVista, leerVista, (): Vista => 'clientes');
  const cambiarVista = guardarVista;
  // Cobro por cliente; desde "Por comprobante" se abre el mismo modal con solo esa nota
  // (ahí se elige si paga un monto o por productos).
  const [clienteCobrar, setClienteCobrar] = useState<{
    cliente: ResumenClienteCuenta; soloComprobanteId?: number; modo?: ModoCobro;
  } | null>(null);

  const [cuentas, setCuentas]                           = useState<CuentaPorCobrar[]>([]);
  const [search, setSearch]                             = useState('');
  const [filtroTipo, setFiltroTipo]                     = useState('Todos');
  const [showAvanzado, setShowAvanzado]                 = useState(false);
  const [avFechaDesde, setAvFechaDesde]                 = useState('');
  const [avFechaHasta, setAvFechaHasta]                 = useState('');
  const [avClienteDoc, setAvClienteDoc]                 = useState('');
  const [showModalReporte, setShowModalReporte] = useState(false)
  const [huboIntentoInicial, setHuboIntentoInicial] = useState(false)
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

  const cargar = async () => {
    const establecimientoAnexo = isSuperAdmin ? sucursalFiltro : (getCodEstablecimiento() ?? null);
    const [data] = await Promise.all([
      hookCuentas.fetchCuentas({ empresaRuc: rucEmpresa, establecimientoAnexo }),
      hookClientes.fetchClientes(rucEmpresa, establecimientoAnexo),
    ]);
    setCuentas(data);
  };

  const cerrarCobroCliente = (huboPago: boolean) => {
    setClienteCobrar(null);
    if (huboPago) {
      cargar();
      // Lo pagado de cada producto cambió.
      void detalle.recargar();
    }
  };

  // Abre el cobro de una sola nota: dentro elige si paga un monto o por productos.
  const cobrarComprobante = (c: CuentaPorCobrar) => {
    const clave = claveCliente(c.clienteNumDoc, c.clienteRznSocial);
    setClienteCobrar({
      cliente: {
        clienteClave: clave,
        clienteNumDoc: c.clienteNumDoc,
        clienteRznSocial: c.clienteRznSocial,
        clienteWhatsApp: c.clienteWhatsApp || null,
        tipoMoneda: c.tipoMoneda,
        cantidadComprobantes: 1,
        saldoPendiente: saldoComprobante(c),
        fechaEmisionMasAntigua: c.fechaEmision,
        fechaVencimientoMasAntigua: vencimientoDe(c),
        sinDocumento: clave.startsWith('SD|'),
      },
      soloComprobanteId: c.comprobanteId,
      modo: 'monto',
    });
  };

  useEffect(() => {
    if (!user || !accessToken) return
    // Superadmin no necesita esperar sucursal
    if (!isSuperAdmin && !sucursal) return
    setHuboIntentoInicial(true)
    cargar()
  }, [user, accessToken, sucursalFiltro, sucursal?.codEstablecimiento])

  const buscarAvanzado = async () => {
    if (!avClienteDoc && !avFechaDesde && !avFechaHasta) {
      showToast('Ingrese al menos un criterio de búsqueda', 'error');
      return;
    }
    const data = await hookCuentas.fetchCuentas({
      empresaRuc: rucEmpresa,
      fechaInicio: avFechaDesde || null,
      fechaFin: avFechaHasta || null,
      clienteNumDoc: avClienteDoc || null,
    });
    setCuentas(data);
  };

  const limpiarAvanzado = () => {
    setAvFechaDesde('');
    setAvFechaHasta('');
    setAvClienteDoc('');
    cargar();
  };

  const tipoOpts = useMemo(() => {
    const tieneNV = cuentas.some(c => c.tipoComprobante === 'NV');
    return tieneNV ? [...TIPO_BASE, 'Nota de Venta'] : TIPO_BASE;
  }, [cuentas]);

  const filtered = useMemo(() => {
    return cuentas.filter(c => {
      const matchSearch =
        c.clienteRznSocial.toLowerCase().includes(search.toLowerCase()) ||
        c.clienteNumDoc.includes(search) ||
        c.numeroCompleto.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filtroTipo === 'Todos' || tipoComprobanteLabel(c.tipoComprobante) === filtroTipo;
      return matchSearch && matchTipo;
    });
  }, [cuentas, search, filtroTipo]);

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hookClientes.clientes;
    return hookClientes.clientes.filter(c =>
      (c.clienteRznSocial ?? '').toLowerCase().includes(q) ||
      (c.clienteNumDoc ?? '').includes(q));
  }, [hookClientes.clientes, search]);

  const totalesPorMoneda = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of clientesFiltrados) t[c.tipoMoneda] = (t[c.tipoMoneda] ?? 0) + c.saldoPendiente;
    return t;
  }, [clientesFiltrados]);

  const loading = hookCuentas.loading || !huboIntentoInicial;
  const loadingClientes = hookClientes.loadingClientes || !huboIntentoInicial;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {showModalReporte && (
        <ModalReporteCuentasPorCobrar
          empresaRuc={rucEmpresa}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowModalReporte(false)}
        />
      )}
      
      {clienteCobrar && (
        <ModalCobrarCliente
          cliente={clienteCobrar.cliente}
          soloComprobanteId={clienteCobrar.soloComprobanteId}
          modoInicial={clienteCobrar.modo}
          empresaRuc={rucEmpresa}
          establecimientoAnexo={isSuperAdmin ? sucursalFiltro : (getCodEstablecimiento() ?? null)}
          onClose={cerrarCobroCliente}
        />
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center bg-white border border-gray-200 rounded-md p-0.5 shrink-0">
            <button
              onClick={() => cambiarVista('clientes')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap",
                vista === 'clientes' ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Users size={14} /> Por cliente
            </button>
            <button
              onClick={() => cambiarVista('comprobantes')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap",
                vista === 'comprobantes' ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <FileText size={14} /> Por comprobante
            </button>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={vista === 'clientes' ? "Buscar cliente por nombre, RUC o DNI..." : "Buscar por cliente, RUC/DNI o N° comprobante..."}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all  text-xs"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setShowModalReporte(true)}
              className="flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border border-gray-200 rounded-md transition-all bg-white text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              <FileSpreadsheet size={14} /> Reporte Excel
            </button>
              {/* Select sucursal — solo superadmin */}
              {isSuperAdmin && (
                <div className="relative">
                  <select
                    value={sucursalFiltro ?? ''}
                    onChange={e => setSucursalFiltro(e.target.value || null)}
                    className={cn(
                      "appearance-none pl-3 pr-8 py-2.5 text-xs font-medium border rounded-md outline-none cursor-pointer transition-all ",
                      sucursalFiltro
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600"
                    )}
                  >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map(s => (
                      <option key={s.sucursalId} value={s.codEstablecimiento}>
                        {s.nombre ?? s.codEstablecimiento}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}
            {vista === 'comprobantes' && (<>
            <DropdownFiltro label="Tipo" value={filtroTipo} options={tipoOpts} onChange={setFiltroTipo} />
            <button
              onClick={() => setShowAvanzado(o => !o)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border rounded-md transition-all ",
                showAvanzado ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              <Filter size={14} /> Filtros
              <ChevronDown size={13} className={cn("transition-transform", showAvanzado && "rotate-180")} />
            </button>
            {filtroTipo !== 'Todos' && (
              <button onClick={() => setFiltroTipo('Todos')} className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors">
                Limpiar
              </button>
            )}
            </>)}
          </div>
        </div>

        {vista === 'comprobantes' && showAvanzado && (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase ">Nº Doc. Cliente</label>
                  <input type="text" value={avClienteDoc} onChange={e => setAvClienteDoc(e.target.value)}
                    placeholder="RUC o DNI"
                    className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all w-44" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase ">Fecha desde</label>
                  <input type="date" value={avFechaDesde} max={hoy}
                    onChange={e => { setAvFechaDesde(e.target.value); if (avFechaHasta && e.target.value > avFechaHasta) setAvFechaHasta(''); }}
                    className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase ">Fecha hasta</label>
                  <input type="date" value={avFechaHasta} min={avFechaDesde || undefined} max={hoy}
                    onChange={e => setAvFechaHasta(e.target.value)}
                    className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all" />
                </div>
                <div className="flex items-center gap-2 self-end">
                  <button onClick={buscarAvanzado} disabled={loading}
                    className="h-8 flex items-center gap-1.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm">
                    <Search size={13} /> Buscar
                  </button>
                  <button onClick={limpiarAvanzado}
                    className="h-8 flex items-center gap-1.5 px-3 text-xs font-medium text-gray-500 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-lg transition-all">
                    <X size={12} /> Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between">
        {vista === 'clientes' ? (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{clientesFiltrados.length}</span> cliente(s) con deuda
            {Object.entries(totalesPorMoneda).map(([mon, total]) => (
              <span key={mon}> · Por cobrar <span className="font-semibold text-blue-700">{formatMoneda(total, mon)}</span></span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Total <span className="font-semibold text-gray-900">{filtered.length}</span> comprobantes a crédito
          </p>
        )}
      </div>

      {vista === 'clientes' && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E2EAF6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse cpc-table">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-28 text-center">Pendientes</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-44">Deuda más antigua</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-36 text-right">Saldo por cobrar</th>
                  <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-36 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingClientes ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-blue-400" />
                      <span className="text-sm text-gray-400">Cargando clientes...</span>
                    </div>
                  </td></tr>
                ) : hookClientes.errorClientes ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-red-500">
                    {hookClientes.errorClientes}{' '}
                    <button onClick={cargar} className="text-blue-600 font-semibold hover:underline">Reintentar</button>
                  </td></tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-gray-400">
                    No hay clientes con deuda pendiente.
                  </td></tr>
                ) : clientesFiltrados.map(c => {
                  const dias = c.fechaVencimientoMasAntigua ? getDiasVencida(c.fechaVencimientoMasAntigua) : 0;
                  return (
                    <tr key={`${c.clienteClave}|${c.tipoMoneda}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3">
                        <p className="text-xs font-semibold text-gray-900">{c.clienteRznSocial || 'Cliente'}</p>
                        <p className="text-[11px] text-gray-400">
                          {c.sinDocumento ? (
                            <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle size={10} /> Sin documento</span>
                          ) : c.clienteNumDoc}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center w-28">
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">{c.cantidadComprobantes}</span>
                      </td>
                      <td className="px-3 py-3 w-44">
                        <p className="text-xs text-gray-700">Desde {formatFecha(c.fechaEmisionMasAntigua)}</p>
                        {dias > 0 ? (
                          <p className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={10} /> Vencida hace {dias} día(s)
                          </p>
                        ) : c.fechaVencimientoMasAntigua && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> Vence {formatFecha(c.fechaVencimientoMasAntigua)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right whitespace-nowrap w-36">
                        {formatMoneda(c.saldoPendiente, c.tipoMoneda)}
                      </td>
                      <td className="px-3 py-3 text-center w-36">
                        <button
                          onClick={() => setClienteCobrar({ cliente: c })}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Wallet size={13} /> Cobrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla */}
      <style>{`
        .cpc-table tbody { display: block; overflow-y: auto; max-height: calc(100vh - ${showAvanzado ? (isBeta ? 365 : 305) : (isBeta ? 280 : 220)}px); scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
        .cpc-table thead tr, .cpc-table tbody tr { display: table; width: 100%; table-layout: fixed; }
        .cpc-table thead { width: 100%; }
      `}</style>

      {vista === 'comprobantes' && (
      <div className="bg-white rounded-xl shadow-sm border border-[#E2EAF6] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse cpc-table">
            <thead>
              <tr className="bg-gray-100" style={{borderTopLeftRadius: '12px', borderTopRightRadius: '12px', overflow: 'hidden'}}>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-32">Fecha</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-44">Comprobante</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">Importe</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">Crédito</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">Saldo</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-36">Vencimiento</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-40 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={24} className="animate-spin text-blue-400" />
                    <span className="text-sm text-gray-400">Cargando cuentas por cobrar...</span>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-sm text-gray-400">
                  No se encontraron comprobantes a crédito.
                </td></tr>
              ) : filtered.map(c => {
                const abierto = abiertos.has(c.comprobanteId);
                return (
                <Fragment key={c.comprobanteId}>
                <tr className={cn("transition-colors", abierto ? "bg-blue-50/30" : "hover:bg-gray-50/50")}>
                  <td className="px-3 py-2 text-xs text-gray-900 font-medium whitespace-nowrap w-32">{formatFecha(c.fechaEmision)}</td>
                  <td className="px-3 py-2 whitespace-nowrap w-44">
                    <p className="text-xs font-medium text-gray-900">{c.numeroCompleto}</p>
                    <p className="text-[11px] text-gray-400">{tipoComprobanteLabel(c.tipoComprobante)}</p>
                    <BotonVerProductos
                      abierto={abierto}
                      productos={detalle.productos.get(c.comprobanteId)}
                      onClick={() => alternarDetalle(c.comprobanteId)}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <p className="text-xs font-semibold text-gray-900">{c.clienteRznSocial}</p>
                    <p className="text-[11px] text-gray-400">{c.clienteNumDoc}</p>
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-900 text-right whitespace-nowrap w-32">{formatMoneda(c.importeTotal, c.tipoMoneda)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-blue-700 text-right whitespace-nowrap w-32">
                    {formatMoneda((!c.montoCredito || c.montoCredito === 0) ? c.importeTotal : c.montoCredito, c.tipoMoneda)}
                  </td>
                  <td className="px-3 py-2 text-xs font-bold text-gray-900 text-right whitespace-nowrap w-32">
                    {formatMoneda(saldoComprobante(c), c.tipoMoneda)}
                  </td>
                  <td className="px-3 py-2 w-36">
                    <CeldaVencimiento fecha={vencimientoDe(c)} />
                  </td>
                  <td className="px-3 py-2 text-center w-40">
                    <button
                      onClick={() => cobrarComprobante(c)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <CreditCard size={13} /> Pagar cuota
                    </button>
                  </td>
                </tr>
                {abierto && (
                  <tr className="bg-blue-50/30">
                    <td colSpan={8} className="px-3 pb-3 pt-0">
                      <div className="max-w-3xl sm:ml-32">
                        <DetalleProductosComprobante
                          productos={detalle.productos.get(c.comprobanteId)}
                          cargando={detalle.cargando.has(c.comprobanteId)}
                          error={detalle.fallidos.has(c.comprobanteId)}
                          onReintentar={() => void detalle.cargar([c.comprobanteId])}
                          moneda={c.tipoMoneda}
                          importeTotal={c.importeTotal}
                          saldo={saldoComprobante(c)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

// DropdownFiltro
interface DropdownFiltroProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

const DropdownFiltro = ({ label, value, options, onChange }: DropdownFiltroProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const active = value !== 'Todos';
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border rounded-md outline-none transition-all whitespace-nowrap",
          active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
        )}
      >
        {active ? value : label}
        {active
          ? <X size={13} className="text-white/80" onClick={e => { e.stopPropagation(); onChange('Todos'); }} />
          : <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />}
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-40 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden min-w-36">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left",
                value === opt ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50"
              )}
            >
              {opt}
              {value === opt && <Check size={13} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};