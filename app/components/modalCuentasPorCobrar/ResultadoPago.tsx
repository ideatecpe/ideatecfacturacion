'use client'
import React, { useRef, useState } from 'react'
import { CheckCircle2, FileText, MessageCircle, Printer } from 'lucide-react'
import { cn } from '@/app/utils/cn'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import { useConfiguracion } from '@/hooks/useConfiguracion'
import { ProductoComprobante } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/CuentasPorCobrar'
import { formatFecha, formatMoneda } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/helpers'
import { useCobroCliente } from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/UseCobroCliente'
import {
  construirHtmlConstancia, construirMensajeWhatsapp, DatosConstancia, generarPdfConstancia, PagoPorComprobante,
} from '@/app/factufly/cuentasporcobrar/gestionCuentasPorCobrar/constanciaPago'
import { enviarPdfPorWhatsapp, normalizarCelularPeru } from '@/lib/whatsapp/enviarDocumento'
import { anchoTicketConfig, imprimirHtmlEnNavegador, obtenerEmisorTicket } from '@/lib/impresion/ticketComprobante'
import { detectarAgente, imprimirHtmlConAgente } from '@/lib/impresion/agente'

export interface ResultadoPagoProps {
  empresaRuc: string
  clienteNombre: string
  /** null para clientes sin documento. */
  clienteDoc: string | null
  telefonoInicial: string | null
  moneda: string
  /** 'YYYY-MM-DD' */
  fechaPago: string
  medioPago: string
  numeroOperacion: string | null
  montoTotal: number
  saldoClienteRestante: number
  pagos: PagoPorComprobante[]
}

/**
 * Lo que se ve después de registrar un cobro (por cliente o de una sola cuota):
 * el detalle de lo pagado y la constancia para imprimir, ver en PDF o mandar por WhatsApp.
 */
export const ResultadoPago = (props: ResultadoPagoProps) => {
  const { empresaRuc, clienteNombre, clienteDoc, moneda, fechaPago, medioPago, montoTotal, saldoClienteRestante, pagos } = props
  const { user, accessToken } = useAuth()
  const { showToast } = useToast()
  const { config } = useConfiguracion()
  const { fetchProductos } = useCobroCliente()

  const [telefono, setTelefono] = useState(props.telefonoInicial ?? '')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)
  const [incluirProductos, setIncluirProductos] = useState(true)
  const productosCache = useRef<ProductoComprobante[] | null>(null)

  // 'YYYY-MM-DD' solo se lee como UTC y en Lima saldría el día anterior.
  const fechaPagoLocal = `${fechaPago}T00:00:00`

  // Lo que el cliente compró en cada comprobante pagado (se pide una sola vez).
  const obtenerProductos = async (): Promise<ProductoComprobante[]> => {
    if (!incluirProductos || pagos.length === 0) return []
    if (productosCache.current) return productosCache.current
    try {
      productosCache.current = await fetchProductos(empresaRuc, pagos.map(p => p.comprobanteId))
      return productosCache.current
    } catch {
      showToast('No se pudo obtener el detalle de productos; la constancia sale sin él', 'error')
      return []
    }
  }

  const datosConstancia = async (): Promise<DatosConstancia> => {
    const [emisor, productos] = await Promise.all([
      obtenerEmisorTicket(empresaRuc, accessToken).catch(() => null),
      obtenerProductos(),
    ])
    return {
      emisor,
      ruc: empresaRuc,
      clienteNombre,
      clienteDoc,
      fechaPago: fechaPagoLocal,
      medioPago,
      numeroOperacion: props.numeroOperacion,
      cajero: user?.username ?? null,
      tipoMoneda: moneda,
      montoTotal,
      saldoClienteRestante,
      pagos,
      productos,
    }
  }

  const armarConstancia = async (anchoMm: 58 | 80) => construirHtmlConstancia({ ...(await datosConstancia()), anchoMm })

  const imprimirConstancia = async () => {
    if (imprimiendo) return
    setImprimiendo(true)
    try {
      const anchoMm = anchoTicketConfig(config?.tamañoImpresion) ?? 80
      const html = await armarConstancia(anchoMm)
      const agente = await detectarAgente().catch(() => null)
      const porAgente = agente
        ? await imprimirHtmlConAgente(html, anchoMm, { documento: `Constancia de pago ${clienteNombre}` }).catch(() => false)
        : false
      if (porAgente) {
        // El agente solo deja el trabajo en la cola de Windows: si la ticketera está
        // apagada o desconectada no sale nada y no hay forma de saberlo desde aquí.
        showToast(
          `Constancia enviada a "${agente?.impresora ?? 'la impresora'}". Si no sale, revisa que esté encendida y conectada, o usa Vista previa.`,
          'info',
        )
      } else {
        imprimirHtmlEnNavegador(html)
      }
    } finally {
      setImprimiendo(false)
    }
  }

  // Siempre por el diálogo del navegador: permite elegir otra impresora o guardar en PDF.
  const vistaPreviaConstancia = async () => {
    if (imprimiendo) return
    setImprimiendo(true)
    try {
      imprimirHtmlEnNavegador(await armarConstancia(anchoTicketConfig(config?.tamañoImpresion) ?? 80))
    } finally {
      setImprimiendo(false)
    }
  }

  const telefonoValido = normalizarCelularPeru(telefono)

  // Igual que la caja con los comprobantes: se genera el PDF y se envía por la API de WhatsApp.
  const enviarWhatsapp = async () => {
    if (!telefonoValido || enviandoWhatsapp) return
    setEnviandoWhatsapp(true)
    try {
      const datos = await datosConstancia()
      const pdf = await generarPdfConstancia(datos)
      await enviarPdfPorWhatsapp({
        telefono: telefonoValido,
        pdf,
        nombreArchivo: `Constancia-pago-${clienteDoc ?? 'cliente'}-${fechaPago}.pdf`,
        mensaje: construirMensajeWhatsapp(datos),
      })
      showToast(`Constancia enviada por WhatsApp al ${telefono.replace(/\D/g, '').slice(-9)}`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? `No se pudo enviar por WhatsApp: ${err.message}` : 'No se pudo enviar por WhatsApp', 'error')
    } finally {
      setEnviandoWhatsapp(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-800">
            Pago registrado: {formatMoneda(montoTotal, moneda)} · {medioPago}
          </p>
          <p className="text-xs text-emerald-700">
            {saldoClienteRestante > 0.004
              ? `El cliente aún debe ${formatMoneda(saldoClienteRestante, moneda)}`
              : 'El cliente quedó al día'}
          </p>
        </div>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comprobante</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importe</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pagado antes</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Este pago</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Queda</th>
              <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pagos.map(p => (
              <tr key={p.comprobanteId}>
                <td className="px-3 py-2 font-medium text-gray-900">{p.numeroCompleto}</td>
                <td className="px-3 py-2 text-gray-500">{formatFecha(p.fechaEmision)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{p.importeTotal != null ? formatMoneda(p.importeTotal, moneda) : '-'}</td>
                <td className="px-3 py-2 text-right text-gray-500">{p.pagadoAntes != null ? formatMoneda(p.pagadoAntes, moneda) : '-'}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600">{formatMoneda(p.montoAplicado, moneda)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatMoneda(p.saldoRestante, moneda)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    p.estado === 'PAGADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                    {p.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none w-fit">
        <input type="checkbox" checked={incluirProductos} onChange={e => setIncluirProductos(e.target.checked)}
          className="w-4 h-4 accent-blue-600 cursor-pointer" />
        Incluir el detalle de productos (para que el cliente vea en qué gastó)
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <button onClick={imprimirConstancia} disabled={imprimiendo}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-wait">
          {imprimiendo
            ? <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            : <Printer size={15} />}
          Imprimir constancia
        </button>
        <button onClick={vistaPreviaConstancia} disabled={imprimiendo}
          title="Abre el diálogo del navegador: otra impresora o Guardar como PDF"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-wait">
          <FileText size={15} /> Vista previa / PDF
        </button>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Celular WhatsApp</label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="9 dígitos"
              className="w-36 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm" />
          </div>
          <button onClick={enviarWhatsapp} disabled={!telefonoValido || enviandoWhatsapp}
            title={telefonoValido ? 'Envía la constancia en PDF por WhatsApp' : 'Ingresa un celular de 9 dígitos'}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {enviandoWhatsapp
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : <MessageCircle size={15} />}
            {enviandoWhatsapp ? 'Enviando PDF...' : 'Enviar PDF por WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}
