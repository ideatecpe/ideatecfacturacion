export const ESTADO_CUOTA_COLORS: Record<string, string> = {
  PAGADO:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARCIAL:   'bg-amber-50 text-amber-700 border-amber-200',
  PENDIENTE: 'bg-red-50 text-red-700 border-red-200',
}

export const MEDIO_PAGO_OPTS = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'YAPE',
  'PLIN',
  'TARJETA',
  'CHEQUE',
  'OTRO',
]

export const formatFecha = (fecha: string | null): string => {
  if (!fecha) return '-'
  try {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  } catch { return '-' }
}

export const formatMoneda = (monto: number | string | null, moneda = 'PEN'): string => {
  if (monto === null || monto === undefined) return '-'
  const simbolo = moneda === 'USD' ? '$' : 'S/'
  return `${simbolo} ${parseFloat(String(monto)).toFixed(2)}`
}

export const tipoComprobanteLabel = (tipo: string): string => {
  const map: Record<string, string> = {
    '01': 'Factura',
    '03': 'Boleta',
    'NV': 'Nota de Venta',
  }
  return map[tipo] ?? 'Comprobante'
}

export const getEstadoCuota = (cuota: { estado: string | null; montoPagado: number | null }): string => {
  if (cuota.estado) return cuota.estado
  if (!cuota.montoPagado || cuota.montoPagado === 0) return 'PENDIENTE'
  return 'PENDIENTE'
}

export const getCuotaVencida = (fechaVencimiento: string): boolean => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())
  const venc = fechaVencimiento.split('T')[0]
  return venc < hoy
}

export const getDiasVencida = (fechaVencimiento: string): number => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())
  const venc = fechaVencimiento.split('T')[0]
  if (venc >= hoy) return 0
  const diff = new Date(hoy).getTime() - new Date(venc).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}