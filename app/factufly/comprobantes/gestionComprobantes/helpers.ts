export const COLORS = {
    sunat: {
        ACEPTADO: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
        PENDIENTE: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
        RECHAZADO: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
        ANULADO: { badge: 'bg-gray-50 text-gray-500 border-gray-200', dot: 'bg-gray-400' },

    },
    tipo: {
        '01': 'Factura',
        '03': 'Boleta',
        '07': 'N.Crédito',
        '08': 'N.Débito',
    } as Record<string, string>,
    email: { active: 'bg-blue-50 hover:bg-blue-100 text-blue-600', inactive: 'hover:bg-gray-100 text-gray-400 hover:text-gray-600' },
    whatsapp: { active: 'bg-green-50 hover:bg-green-100 text-green-600', inactive: 'hover:bg-gray-100 text-gray-400 hover:text-gray-600' },
    pdf: { btn: 'p-1.5 hover:bg-gray-100 rounded-md transition-colors' },
    btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    btnSecondary: 'border border-gray-200 hover:bg-gray-50 text-gray-700',
    btnGreen: 'bg-green-500 hover:bg-green-600 text-white',
    btnDisabled: 'opacity-40 cursor-not-allowed',
}

export const TIPO_PAGO_MAP: Record<string, string> = {
    'Contado': 'Contado',
    'Credito': 'Crédito',
}

export const TIPO_GUIA_MAP: Record<string, string> = {
    '09': 'Guía Transportista',
    '08': 'Guía Remitente',
}

export const PDF_SIZES = ['A4', 'Carta', 'Ticket80mm', 'Ticket58mm', 'MediaCarta']

export const tipoLabel = (tc: string) => COLORS.tipo[tc] ?? 'Comprobante'

export const formatFecha = (fecha: string) => {
    try {
        return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch { return fecha }
}

export const formatFechaHora = (fecha: string) => {
    try {
        const d = new Date(fecha)
        return `${d.toLocaleDateString('es-PE')} ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
    } catch { return fecha }
}

export const padCorrelativo = (c: string) => c.padStart(8, '0')

export const limpiarMensajeSunat = (mensaje: string): string => {
    const idx = mensaje.indexOf(' - Detalle')
    return idx !== -1 ? mensaje.substring(0, idx) : mensaje
}