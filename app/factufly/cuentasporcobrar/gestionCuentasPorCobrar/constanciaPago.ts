import type { EmisorTicket } from '@/lib/impresion/ticketComprobante'
import type { ComprobantePendienteCliente, PagoClienteDetalle, ProductoComprobante } from './CuentasPorCobrar'
import { formatFecha, formatMoneda } from './helpers'

/** Lo cobrado a un comprobante, sumando sus cuotas. */
export interface PagoPorComprobante {
  comprobanteId: number
  numeroCompleto: string
  fechaEmision: string | null
  /** Importe total del comprobante (lo que suman sus productos). */
  importeTotal: number | null
  /** Lo que ya estaba pagado antes de este cobro (adelanto + abonos previos). */
  pagadoAntes: number | null
  saldoAnterior: number
  montoAplicado: number
  saldoRestante: number
  estado: 'PAGADO' | 'PARCIAL'
}

/**
 * @param comprobantes Los comprobantes tal como estaban ANTES del cobro: dan el importe
 *   total, y con él cuánto ya se había pagado. Sin eso la constancia mostraba los
 *   productos sumando S/ 4.00 y "Total pagado S/ 2.00" sin explicar la diferencia.
 */
export function agruparPorComprobante(
  detalle: PagoClienteDetalle[],
  comprobantes: ComprobantePendienteCliente[] = [],
): PagoPorComprobante[] {
  const importes = new Map(comprobantes.map((c) => [c.comprobanteId, c.importeTotal]))
  const mapa = new Map<number, PagoPorComprobante>()
  for (const d of detalle) {
    const actual = mapa.get(d.comprobanteId)
    if (actual) {
      actual.saldoAnterior += d.saldoAnterior
      actual.montoAplicado += d.montoAplicado
      actual.saldoRestante += d.saldoRestante
    } else {
      mapa.set(d.comprobanteId, {
        comprobanteId: d.comprobanteId,
        numeroCompleto: d.numeroCompleto ?? String(d.comprobanteId),
        fechaEmision: d.fechaEmision,
        importeTotal: importes.get(d.comprobanteId) ?? null,
        pagadoAntes: null,
        saldoAnterior: d.saldoAnterior,
        montoAplicado: d.montoAplicado,
        saldoRestante: d.saldoRestante,
        estado: 'PAGADO',
      })
    }
  }
  return [...mapa.values()].map((p) => ({
    ...p,
    pagadoAntes: p.importeTotal != null ? Math.max(0, Math.round((p.importeTotal - p.saldoAnterior) * 100) / 100) : null,
    estado: p.saldoRestante > 0.004 ? 'PARCIAL' : 'PAGADO',
  }))
}

export interface DatosConstancia {
  emisor: EmisorTicket | null
  ruc: string
  clienteNombre: string
  clienteDoc: string | null
  fechaPago: string
  medioPago: string
  numeroOperacion: string | null
  cajero: string | null
  tipoMoneda: string
  montoTotal: number
  saldoClienteRestante: number
  pagos: PagoPorComprobante[]
  /** Productos de cada comprobante pagado; vacío si no se pidió el detalle. */
  productos: ProductoComprobante[]
}

const esc = (v: string | null | undefined) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const cantidadTexto = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

const productosDe = (d: DatosConstancia, comprobanteId: number) =>
  d.productos.filter((p) => p.comprobanteId === comprobanteId)

const nombreEmpresa = (d: DatosConstancia) => d.emisor?.nombreComercial || d.emisor?.razonSocial || ''

// ── Ticket (impresora térmica) ───────────────────────────────────────────────

/** Constancia de pago en formato ticket (sirve igual para impresora térmica o A4). */
export function construirHtmlConstancia(d: DatosConstancia & { anchoMm: 58 | 80 }): string {
  const linea = (etiqueta: string, monto: number, clase = '') =>
    `<tr class="res ${clase}"><td>${esc(etiqueta)}</td><td class="r">${esc(formatMoneda(monto, d.tipoMoneda))}</td></tr>`

  const filas = d.pagos.map((p) => {
    const productos = productosDe(d, p.comprobanteId).map((it) => `
      <tr class="prod"><td>${esc(cantidadTexto(it.cantidad))} x ${esc(it.descripcion)}</td><td class="r">${esc(formatMoneda(it.total, d.tipoMoneda))}</td></tr>`).join('')
    const resumen = [
      p.importeTotal != null ? linea('Importe del comprobante', p.importeTotal) : '',
      p.pagadoAntes ? linea('Pagado antes', p.pagadoAntes) : '',
      linea('Este pago', p.montoAplicado, 'b'),
      linea(p.estado === 'PAGADO' ? 'Queda (cancelado)' : 'Queda', p.saldoRestante),
    ].join('')
    return `
    <tr class="comp"><td>${esc(p.numeroCompleto)}</td><td class="r sub">${esc(formatFecha(p.fechaEmision))}</td></tr>${productos}${resumen}`
  }).join('')

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Constancia de pago</title>
<style>
  @page { margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: ${d.anchoMm === 58 ? 10 : 11}px; color: #000;
         width: ${d.anchoMm === 58 ? 48 : 72}mm; margin: 0 auto; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  .sub { font-size: 0.85em; color: #333; }
  h1 { font-size: 1.25em; margin: 4px 0; } h2 { font-size: 1.1em; margin: 8px 0 4px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  tr.comp td { padding-top: 6px; }
  tr.prod td { padding: 1px 0; font-size: 0.9em; }
  tr.prod td:first-child { padding-left: 6px; padding-right: 4px; }
  tr.prod td.r, tr.comp td.r, tr.res td.r { white-space: nowrap; }
  tr.comp td { font-weight: bold; border-top: 1px dotted #999; }
  tr.res td { padding: 1px 0 1px 6px; font-size: 0.9em; }
  tr.res.b td { font-weight: bold; }
  .tot td { font-weight: bold; font-size: 1.1em; padding-top: 6px; }
  img { max-width: 60%; max-height: 60px; }
</style></head>
<body>
  <div class="c">
    ${d.emisor?.logoBase64 ? `<img src="${d.emisor.logoBase64.startsWith('data:') ? d.emisor.logoBase64 : `data:image/png;base64,${d.emisor.logoBase64}`}" alt="">` : ''}
    <h1>${esc(nombreEmpresa(d))}</h1>
    <div>RUC ${esc(d.ruc)}</div>
    ${d.emisor?.direccion ? `<div class="sub">${esc(d.emisor.direccion)}</div>` : ''}
    <h2>CONSTANCIA DE PAGO</h2>
    <div class="sub">No es un comprobante de pago</div>
  </div>
  <hr>
  <div><span class="b">Cliente:</span> ${esc(d.clienteNombre)}</div>
  ${d.clienteDoc ? `<div><span class="b">Doc.:</span> ${esc(d.clienteDoc)}</div>` : ''}
  <div><span class="b">Fecha de pago:</span> ${esc(formatFecha(d.fechaPago))}</div>
  <div><span class="b">Medio:</span> ${esc(d.medioPago)}${d.numeroOperacion ? ` · Op. ${esc(d.numeroOperacion)}` : ''}</div>
  ${d.cajero ? `<div><span class="b">Atendió:</span> ${esc(d.cajero)}</div>` : ''}
  <hr>
  <table>
    ${filas}
    <tr class="tot"><td>TOTAL DE ESTE PAGO</td><td class="r">${esc(formatMoneda(d.montoTotal, d.tipoMoneda))}</td></tr>
  </table>
  <hr>
  <table><tr><td class="b">Saldo pendiente</td><td class="r b">${esc(formatMoneda(d.saldoClienteRestante, d.tipoMoneda))}</td></tr></table>
  <hr>
  <div class="c sub">Impreso: ${esc(new Date().toLocaleString('es-PE'))}</div>
</body></html>`
}

// ── PDF A4 (para WhatsApp) ───────────────────────────────────────────────────

const AZUL: [number, number, number] = [15, 46, 100]

function formatoImagen(dataUri: string): 'PNG' | 'JPEG' | null {
  if (dataUri.startsWith('data:image/png')) return 'PNG'
  if (dataUri.startsWith('data:image/jpeg') || dataUri.startsWith('data:image/jpg')) return 'JPEG'
  return null
}

/** Constancia en PDF A4 con el detalle de productos de cada comprobante pagado. */
export async function generarPdfConstancia(d: DatosConstancia): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const margen = 15
  let y = margen

  // Cabecera: logo + empresa a la izquierda, recuadro del documento a la derecha
  let xTexto = margen
  const logo = d.emisor?.logoBase64
  if (logo) {
    const uri = logo.startsWith('data:') ? logo : `data:image/png;base64,${logo}`
    const formato = formatoImagen(uri)
    if (formato) {
      try {
        // 'FAST' comprime el logo: sin eso el PDF pesaba ~650 KB para una página.
        doc.addImage(uri, formato, margen, y, 22, 22, undefined, 'FAST')
        xTexto = margen + 26
      } catch {
        // Logo en un formato que jsPDF no entiende: la constancia sale sin él.
      }
    }
  }
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...AZUL)
  doc.text(nombreEmpresa(d) || 'Empresa', xTexto, y + 6)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60)
  doc.text(`RUC ${d.ruc}`, xTexto, y + 11)
  if (d.emisor?.direccion) doc.text(doc.splitTextToSize(d.emisor.direccion, 95), xTexto, y + 15)

  const cajaAncho = 62
  const cajaX = ancho - margen - cajaAncho
  doc.setDrawColor(...AZUL).setLineWidth(0.5).roundedRect(cajaX, y, cajaAncho, 22, 2, 2)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...AZUL)
  doc.text('CONSTANCIA DE PAGO', cajaX + cajaAncho / 2, y + 8, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60)
  doc.text(formatFecha(d.fechaPago), cajaX + cajaAncho / 2, y + 14, { align: 'center' })
  doc.setFontSize(7).text('No es un comprobante de pago', cajaX + cajaAncho / 2, y + 19, { align: 'center' })
  y += 30

  // Datos del cliente y del pago
  doc.setFillColor(243, 246, 251).roundedRect(margen, y, ancho - margen * 2, 18, 2, 2, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(30)
  doc.text('Cliente:', margen + 4, y + 6)
  doc.text('Medio de pago:', margen + 4, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(`${d.clienteNombre}${d.clienteDoc ? `  ·  ${d.clienteDoc}` : ''}`, margen + 30, y + 6)
  doc.text(`${d.medioPago}${d.numeroOperacion ? `  ·  Op. ${d.numeroOperacion}` : ''}${d.cajero ? `  ·  Atendió: ${d.cajero}` : ''}`, margen + 30, y + 13)
  y += 24

  // Resumen del pago por comprobante
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    head: [['Comprobante', 'Fecha', 'Importe', 'Pagado antes', 'Este pago', 'Queda', 'Estado']],
    body: d.pagos.map((p) => [
      p.numeroCompleto,
      formatFecha(p.fechaEmision),
      p.importeTotal != null ? formatMoneda(p.importeTotal, d.tipoMoneda) : '-',
      p.pagadoAntes != null ? formatMoneda(p.pagadoAntes, d.tipoMoneda) : '-',
      formatMoneda(p.montoAplicado, d.tipoMoneda),
      formatMoneda(p.saldoRestante, d.tipoMoneda),
      p.estado === 'PAGADO' ? 'Cancelado' : 'Parcial',
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'center' } },
    // columnStyles no alcanza a la cabecera: se alinea a mano con su columna.
    didParseCell: (c) => {
      if (c.section === 'head' && [2, 3, 4, 5].includes(c.column.index)) c.cell.styles.halign = 'right'
      if (c.section === 'head' && c.column.index === 6) c.cell.styles.halign = 'center'
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // Detalle de productos de cada comprobante
  if (d.productos.length > 0) {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...AZUL)
    doc.text('Detalle de lo que se pagó', margen, y + 2)
    y += 5
    for (const p of d.pagos) {
      const productos = productosDe(d, p.comprobanteId)
      if (productos.length === 0) continue
      autoTable(doc, {
        startY: y,
        margin: { left: margen, right: margen },
        head: [[{ content: `${p.numeroCompleto}  ·  ${formatFecha(p.fechaEmision)}`, colSpan: 4 }], ['Cant.', 'Descripción', 'P. Unit.', 'Importe']],
        body: productos.map((it) => [
          cantidadTexto(it.cantidad),
          it.descripcion ?? '',
          formatMoneda(it.precioVenta, d.tipoMoneda),
          formatMoneda(it.total, d.tipoMoneda),
        ]),
        foot: [[{ content: 'Total del comprobante', colSpan: 3, styles: { halign: 'right' } },
          formatMoneda(productos.reduce((t, it) => t + it.total, 0), d.tipoMoneda)]],
        styles: { fontSize: 8.5, cellPadding: 1.6 },
        headStyles: { fillColor: [232, 238, 248], textColor: 30, fontStyle: 'bold' },
        footStyles: { fillColor: [248, 250, 252], textColor: 30, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 16, halign: 'center' }, 2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' } },
        didParseCell: (c) => {
          if (c.section === 'foot' && c.column.index === 3) c.cell.styles.halign = 'right'
          if (c.section !== 'head' || c.row.index !== 1) return
          if (c.column.index === 0) c.cell.styles.halign = 'center'
          if (c.column.index >= 2) c.cell.styles.halign = 'right'
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    }
  }

  // Totales
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    y = margen
  }
  const xTot = ancho - margen - 80
  doc.setDrawColor(210).setLineWidth(0.3).line(xTot, y, ancho - margen, y)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30)
  doc.text('TOTAL DE ESTE PAGO', xTot, y + 7)
  doc.text(formatMoneda(d.montoTotal, d.tipoMoneda), ancho - margen, y + 7, { align: 'right' })
  doc.setFontSize(10).setTextColor(...(d.saldoClienteRestante > 0.004 ? AZUL : [22, 128, 61] as [number, number, number]))
  doc.text(d.saldoClienteRestante > 0.004 ? 'Saldo pendiente' : 'Cuenta al día', xTot, y + 14)
  doc.text(formatMoneda(d.saldoClienteRestante, d.tipoMoneda), ancho - margen, y + 14, { align: 'right' })

  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(130)
  doc.text(`Generado el ${new Date().toLocaleString('es-PE')}`, margen, doc.internal.pageSize.getHeight() - 8)

  return doc.output('blob')
}

/** Texto que acompaña al PDF en WhatsApp. */
export function construirMensajeWhatsapp(d: DatosConstancia): string {
  return [
    `Hola ${d.clienteNombre}, registramos tu pago de *${formatMoneda(d.montoTotal, d.tipoMoneda)}* del ${formatFecha(d.fechaPago)} (${d.medioPago}).`,
    d.saldoClienteRestante > 0.004
      ? `Saldo pendiente: *${formatMoneda(d.saldoClienteRestante, d.tipoMoneda)}*.`
      : 'Tu cuenta queda al día.',
    'Te adjuntamos la constancia con el detalle de lo pagado.',
    nombreEmpresa(d) ? `\n${nombreEmpresa(d)}` : '',
  ].join('\n').trim()
}
