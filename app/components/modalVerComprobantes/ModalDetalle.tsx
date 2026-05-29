"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, FileText, X, CheckCircle2, Eye, Download, ChevronDown, Building2, Calendar, Hash, AlertCircle, Ban } from 'lucide-react';
import { cn } from '@/app/utils/cn';
import { Comprobante } from '@/app/factufly/comprobantes/gestionComprobantes/Comprobante';
import { padCorrelativo, COLORS, TIPO_PAGO_MAP, tipoLabel, formatFecha, TIPO_GUIA_MAP, limpiarMensajeSunat, PDF_SIZES } from '@/app/factufly/comprobantes/gestionComprobantes/helpers';
import { useTrabajadoresSucursal } from '@/app/factufly/trabajadores/gestionTrabajadores/useTrabajadoresSucursal';

// ─── DataCard ─────────────────────────────────────────────────────────────────
const DataCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-1.5">{icon}<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p></div>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{value}</p>
    </div>
);

export interface ModalDetalleProps {
    comprobante: Comprobante;
    ruc: string;
    accessToken: string;
    loadingDetalles?: boolean;
    nombreSucursal?: string;
    sucursalId?: number;
    onClose: () => void;
}

const RUC_SALON = "10073587382";

export const ModalDetalle = ({ comprobante, ruc, accessToken, loadingDetalles, nombreSucursal, sucursalId, onClose }: ModalDetalleProps) => {
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    const simboloMoneda = comprobante.tipoMoneda === 'USD' ? '$' : 'S/'

    const mostrarTrabajador = ruc === RUC_SALON;
    const { trabajadores } = useTrabajadoresSucursal(
        mostrarTrabajador ? (sucursalId ?? 0) : undefined,
        mostrarTrabajador,
    );
    const getNombreTrabajador = (trabajadorId: number | null | undefined) => {
        if (!trabajadorId) return null;
        return trabajadores.find(t => t.id === trabajadorId)?.nombreCompleto ?? null;
    };


    useEffect(() => {
        const handler = (e: MouseEvent) => { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setShowSizeMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const obtenerPdf = useCallback(async (tamano: string, abrir: boolean) => {
        setLoadingPdf(true);
        let ventana: Window | null = null;
        try {
            if (abrir) {
                ventana = window.open('', '_blank');
                if (ventana) {
                    ventana.document.write(`
                        <html><head><title>Cargando PDF...</title></head>
                        <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;flex-direction:column;gap:16px;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
                            <p style="color:#64748b;font-size:14px;margin:0">Cargando PDF, por favor espere...</p>
                        </body></html>
                    `);
                }
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobante.comprobanteId}/pdf?tamano=${tamano}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!res.ok) {
                throw new Error('Error al generar PDF');
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

            if (abrir && ventana) {
                ventana.location.href = url;
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${ruc}-${comprobante.serie}-${padCorrelativo(comprobante.correlativo)}.pdf`;
                a.click();
            }
        } catch (error) {
            if (ventana) ventana.close();
            console.error('Error obteniendo PDF:', error);
        } finally {
            setLoadingPdf(false);
        }
    }, [comprobante, ruc, accessToken]);

    const colorEstado = COLORS.sunat[comprobante.estadoSunat as keyof typeof COLORS.sunat]?.badge ?? COLORS.sunat.PENDIENTE.badge;
    const iconoEstado = 
        comprobante.estadoSunat === 'ACEPTADO' ? <CheckCircle2 size={15} /> :
        comprobante.estadoSunat === 'RECHAZADO' ? <X size={15} /> :
        comprobante.estadoSunat === 'ANULADO' ? <Ban size={15} /> :
        <RefreshCw size={15} />;
    const tieneDetraccion = comprobante.detracciones?.length > 0;
    const tieneCuotas = comprobante.cuotas?.length > 0;
    const tienePagos = comprobante.pagos?.length > 0;
    const tieneGuias = comprobante.guias?.length > 0;
    const tieneDetalles = comprobante.details?.length > 0;
    const tipoPagoLabel = TIPO_PAGO_MAP[comprobante.tipoPago] ?? comprobante.tipoPago;
    const porcentajeIgv = comprobante.details?.find(d => d.tipoAfectacionIGV === '10')?.porcentajeIGV ?? 18;
    const detallesFiltrados = comprobante.details ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 min-h-screen h-full">

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: '90vh' }}>

                {/* Header */}
                <div className="bg-blue-600 rounded-t-2xl px-6 pt-6 pb-5 flex items-start justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                            <FileText size={22} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-white leading-tight">{comprobante.numeroCompleto}</h2>
                                {loadingDetalles && <RefreshCw size={14} className="animate-spin text-white/70" />}
                            </div>
                            <p className="text-blue-200 text-sm mt-0.5">{tipoLabel(comprobante.tipoComprobante)} · {formatFecha(comprobante.fechaEmision)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors mt-0.5">
                        <X size={17} className="text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

                    {loadingDetalles ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <RefreshCw size={24} className="animate-spin text-blue-500" />
                            <span className="text-sm text-blue-600 font-medium">Cargando detalles...</span>
                        </div>
                    ) : (
                        <>
                            {/* Estado SUNAT */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold", colorEstado)}>
                                    {iconoEstado} Estado SUNAT: {
                                        comprobante.estadoSunat === 'ACEPTADO' ? 'Aceptado' :
                                        comprobante.estadoSunat === 'RECHAZADO' ? 'Rechazado' :
                                        comprobante.estadoSunat === 'ANULADO' ? 'Anulado' :
                                        'Pendiente'
                                    }
                                </div>
                                {nombreSucursal && (
                                    <div className="inline-flex items-center gap-1.5 px-3 rounded-full border text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                                        <Building2 size={11} /> Sucursal: {nombreSucursal}
                                    </div>
                                )}
                            </div>

                            {comprobante.mensajeRespuestaSunat && (
                                <p className={cn("text-xs rounded-xl px-3 py-1.5", comprobante.estadoSunat === 'ACEPTADO' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                                    {limpiarMensajeSunat(comprobante.mensajeRespuestaSunat)}
                                </p>
                            )}

                            {/* Info básica */}
                            <div className="grid grid-cols-2 gap-3">
                                <DataCard icon={<Building2 size={14} className="text-gray-400" />} label="CLIENTE / RECEPTOR" value={comprobante.cliente.razonSocial} />
                                <DataCard icon={<Hash size={14} className="text-gray-400" />} label="RUC / DNI" value={comprobante.cliente.numeroDocumento} />
                                <DataCard icon={<Calendar size={14} className="text-gray-400" />} label="FECHA DE EMISIÓN" value={formatFecha(comprobante.fechaEmision)} />
                                <DataCard icon={<FileText size={14} className="text-gray-400" />} label="TIPO DE COMPROBANTE" value={tipoLabel(comprobante.tipoComprobante)} />
                                <DataCard icon={<Hash size={14} className="text-gray-400" />} label="SERIE" value={comprobante.serie} />
                                <DataCard icon={<Hash size={14} className="text-gray-400" />} label="CORRELATIVO" value={padCorrelativo(comprobante.correlativo)} />
                                {comprobante.tipDocAfectado && (
                                    <DataCard icon={<FileText size={14} className="text-gray-400" />} label="DOC. AFECTADO" value={comprobante.numDocAfectado ?? '—'} />
                                )}
                                {comprobante.motivoNota && (
                                    <DataCard icon={<AlertCircle size={14} className="text-gray-400" />} label="MOTIVO" value={comprobante.motivoNota} />
                                )}
                            </div>

                            {/* Detalle de productos */}
                            {tieneDetalles && (
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Detalle de productos</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50/80 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-gray-400 font-semibold w-20">Código</th>
                                                    <th className="px-3 py-2 text-left text-gray-400 font-semibold">Producto</th>
                                                    {mostrarTrabajador && (
                                                        <th className="px-3 py-2 text-left text-gray-400 font-semibold">Trabajador</th>
                                                    )}
                                                    <th className="px-3 py-2 text-left text-gray-400 font-semibold">P. Base</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 font-semibold w-24">Valor Venta</th>
                                                    <th className="px-3 py-2 text-left text-gray-400 font-semibold">IGV({porcentajeIgv}%)</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 font-semibold w-24">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {detallesFiltrados.map((d, i) => (
                                                    <tr key={i} className="hover:bg-gray-50/50">
                                                        <td className="px-3 py-2.5 text-gray-500 align-top">{d.codigo}</td>
                                                        <td className="px-3 py-2.5 align-top">
                                                            <p className="font-medium text-gray-800 max-w-50 leading-tight wrap-break-word">{d.descripcion}</p>
                                                            <p className="text-gray-400 mt-0.5">{d.cantidad} × {simboloMoneda} {d.precioVenta.toFixed(2)}</p>
                                                            {d.icbper > 0 && <p className="text-gray-400 mt-0.5">{d.cantidad} × {simboloMoneda} {d.factorIcbper.toFixed(2)}</p>}
                                                        </td>
                                                        {mostrarTrabajador && (
                                                            <td className="px-3 py-2.5 align-top text-xs text-gray-700">
                                                                {getNombreTrabajador(d.trabajadorId) ?? <span className="text-gray-300">—</span>}
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-2.5 align-top">
                                                            <p className="font-medium text-gray-800">{d.precioUnitario.toFixed(2)}</p>
                                                            {d.descuentoTotal > 0 && <p className="text-red-400">- {d.descuentoUnitario.toFixed(2)}</p>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-gray-700 align-top font-mono">{simboloMoneda} {d.valorVenta.toFixed(2)}</td>
                                                        <td className="px-3 py-2.5 text-right text-gray-700 align-top font-mono">
                                                            {d.tipoAfectacionIGV === '10'
                                                                ? <p className="text-gray-400 mt-0.5">{simboloMoneda} {d.montoIGV.toFixed(2)}</p>
                                                                : <p className="text-gray-400 mt-0.5">NA</p>
                                                            }
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800 align-top font-mono">{simboloMoneda} {d.totalVentaItem.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Totales */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Resumen de importes</p>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {comprobante.totalOperacionesGravadas > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Op. Gravadas</span>
                                            <span className="text-sm text-gray-900 font-medium">{simboloMoneda} {comprobante.totalOperacionesGravadas.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.totalOperacionesExoneradas > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Op. Exoneradas</span>
                                            <span className="text-sm text-gray-900 font-medium">{simboloMoneda} {comprobante.totalOperacionesExoneradas.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.totalOperacionesInafectas > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Op. Inafectas</span>
                                            <span className="text-sm text-gray-900 font-medium">{simboloMoneda} {comprobante.totalOperacionesInafectas.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.totalOperacionesGratuitas > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Op. Gratuitas</span>
                                            <span className="text-sm text-gray-900 font-medium">{simboloMoneda} {comprobante.totalOperacionesGratuitas.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.totalOtrosCargos > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Otros Cargos</span>
                                            <span className="text-sm text-gray-900 font-medium">{simboloMoneda} {comprobante.totalOtrosCargos.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.totalIGV > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">IGV ({porcentajeIgv}%)</span>
                                            <span className="text-sm text-gray-900 font-medium">{simboloMoneda} {comprobante.totalIGV.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.totalIcbper > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">ICBPER</span>
                                            <span className="text-sm text-amber-600 font-medium">{simboloMoneda} {comprobante.totalIcbper.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {comprobante.descuentoGlobal > 0 && (
                                        <div className="px-4 py-2.5 flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Descuento Global</span>
                                            <span className="text-sm text-red-600 font-medium">- {simboloMoneda} {comprobante.descuentoGlobal.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="px-4 py-3 flex justify-between items-center bg-blue-50/60">
                                        <span className="text-sm font-bold text-gray-900">TOTAL</span>
                                        <span className="text-sm font-bold text-blue-700">{simboloMoneda} {comprobante.importeTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Leyendas */}
                            {comprobante.legends?.length > 0 && (
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Leyendas</p>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {comprobante.legends.map((l, i) => (
                                            <div key={i} className="px-4 py-2.5">
                                                <p className="text-xs text-gray-700 italic">{l.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pagos y Cuotas */}
                            {(tienePagos || tieneCuotas) && (
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Pagos{' '}
                                            <span className="text-gray-400 font-normal normal-case">
                                                ({comprobante.tipoMoneda}
                                                {comprobante.tipoMoneda === 'USD' && ` · T.C. ${comprobante.tipoCambio.toFixed(2)}`})
                                            </span>
                                        </p>
                                        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border",
                                            tieneCuotas ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                                            {tipoPagoLabel}
                                        </span>
                                    </div>
                                    <div className={cn("grid divide-gray-100", tieneCuotas ? "grid-cols-2 divide-x" : "grid-cols-1")}>
                                        {tienePagos && (
                                            <div className="divide-y divide-gray-100">
                                                <div className="px-4 py-2 bg-gray-50/50">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Medios de pago</p>
                                                </div>
                                                {comprobante.pagos.map((p, i) => (
                                                    <div key={i} className="px-4 py-2.5 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-800">{p.medioPago}</p>
                                                            {p.entidadFinanciera && <p className="text-[10px] text-gray-400">{p.entidadFinanciera}</p>}
                                                            {p.observaciones && <p className="text-[10px] text-gray-400">{p.observaciones}</p>}
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-800 font-mono">{simboloMoneda} {p.monto.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {tieneCuotas && (
                                            <div className="divide-y divide-gray-100">
                                                <div className="px-4 py-2 bg-gray-50/50">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cuotas</p>
                                                </div>
                                                {comprobante.cuotas.map((c, i) => (
                                                    <div key={i} className="px-4 py-2.5 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-800">{c.numeroCuota}</p>
                                                            <p className="text-[10px] text-gray-400">Vence: {formatFecha(c.fechaVencimiento)}</p>
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-800 font-mono">{simboloMoneda} {c.monto.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Detracción y Guías */}
                            {(tieneDetraccion || tieneGuias) && (
                                <div className={cn("grid gap-4", tieneDetraccion && tieneGuias ? "grid-cols-2" : "grid-cols-1")}>
                                    {tieneDetraccion && (
                                        <div className="border border-amber-100 rounded-xl overflow-hidden">
                                            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                                                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Detracción</p>
                                            </div>
                                            {comprobante.detracciones.map((d, i) => (
                                                <div key={i} className="px-4 py-3 space-y-1.5">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-500">Cuenta</span>
                                                        <span className="font-medium text-gray-800">{d.cuentaBancoDetraccion}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-500">Porcentaje</span>
                                                        <span className="font-medium text-gray-800">{d.porcentajeDetraccion}%</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-500">Monto</span>
                                                        <span className="font-semibold text-amber-700">{simboloMoneda} {d.montoDetraccion.toFixed(2)}</span>
                                                    </div>
                                                    {d.observacion && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">Obs.</span>
                                                            <span className="text-gray-600">{d.observacion}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {tieneGuias && (
                                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Guías de Remisión</p>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {comprobante.guias.map((g: any, i: number) => (
                                                    <div key={i} className="px-4 py-2.5">
                                                        <p className="text-xs font-medium text-gray-800">{g.guiaNumeroCompleto}</p>
                                                        <p className="text-[10px] text-gray-400">{TIPO_GUIA_MAP[g.guiaTipoDoc] ?? g.guiaTipoDoc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-gray-100 shrink-0">
                    <button onClick={() => obtenerPdf('A4', true)} disabled={loadingPdf}
                        className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors", COLORS.btnPrimary, loadingPdf && COLORS.btnDisabled)}>
                        {loadingPdf ? <RefreshCw size={15} className="animate-spin" /> : <Eye size={15} />} Ver PDF
                    </button>
                    <div className="relative flex-1" ref={sizeRef}>
                        <button onClick={() => setShowSizeMenu(o => !o)}
                            className={cn("w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors", COLORS.btnSecondary)}>
                            <Download size={15} /> Descargar <ChevronDown size={12} className={cn("transition-transform", showSizeMenu && "rotate-180")} />
                        </button>
                        {showSizeMenu && (
                            <div className="absolute bottom-full mb-1.5 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                {PDF_SIZES.map(size => (
                                    <button key={size} onClick={() => { obtenerPdf(size, false); setShowSizeMenu(false); }}
                                        className="w-full px-3.5 py-2 text-xs text-left text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                                        {size}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose}
                        className={cn("flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap", COLORS.btnSecondary)}>
                        <X size={15} /> Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
