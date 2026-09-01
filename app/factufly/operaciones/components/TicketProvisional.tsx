export interface TicketProvisionalData {
  id: string;
  fecha: Date;
  clienteNombre: string;
  items: { descripcion: string; cantidad: number; precioVenta: number }[];
  total: number;
  moneda: string;
  medioPago: string;
  // "58" | "80" — igual que config.tamañoImpresion. Cualquier otro valor
  // (ej. "A4") cae a 58mm, que es el formato de ticket más común.
  tamanoImpresion?: string | null;
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Mismo criterio de tamaño de página que usa el backend para el ticket real
// (GET /api/Comprobantes/{id}/html?tamano=Ticket58mm|Ticket80mm): declarar
// @page con el ancho físico exacto del rollo, en vez de dejar que el
// navegador "adivine" y el driver de la térmica tenga que escalar la
// página — eso es lo que produce el efecto borroso.
function medidas(tamanoImpresion?: string | null) {
  if (tamanoImpresion === "80") {
    return { paginaMm: "80mm", anchoMm: "76mm", margenMm: "2mm" };
  }
  return { paginaMm: "58mm", anchoMm: "54mm", margenMm: "1mm" };
}

// Se exporta para que el agente de impresión pueda imprimir exactamente el
// mismo ticket que vería el navegador, sin duplicar el maquetado.
export function construirHtmlTicket(data: TicketProvisionalData) {
  const simbolo = data.moneda === "USD" ? "$" : "S/";
  const { paginaMm, anchoMm, margenMm } = medidas(data.tamanoImpresion);

  const filas = data.items
    .map(
      (it) => `
      <tr>
        <td class="tdesc">${escapeHtml(it.descripcion)}</td>
        <td class="tr">${it.cantidad}</td>
        <td class="tr">${simbolo} ${it.precioVenta.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Ticket Provisional</title>
    <style>
    @page {
      size: ${paginaMm} auto;
      margin: ${margenMm};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 12px;
      width: ${anchoMm};
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .small { font-size: 11px; color: #000; }
    hr { border: none; border-top: 1px solid #000; margin: 3px 0; }
    .empresa-nombre { font-size: 13px; font-weight: bold; text-align: center; }
    .badge {
      font-weight: bold;
      font-size: 12px;
      text-align: center;
      padding: 3px 2px;
      margin: 3px 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .aviso { font-size: 11px; text-align: center; color: #000; margin: 2px 0; }
    table.cliente { width: 100%; border-collapse: collapse; margin: 3px 0; }
    table.cliente td { font-size: 11px; padding: 1px 0; vertical-align: top; color: #000; }
    table.cliente td.lbl { font-weight: bold; width: 38%; color: #000; white-space: nowrap; }
    table.items { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 11px; }
    table.items th { text-align: left; font-weight: bold; padding: 2px; border-bottom: 1px solid #000; color: #000; }
    table.items td { padding: 2px; border-bottom: 1px solid #ccc; vertical-align: top; color: #000; }
    table.items .tr { text-align: right; }
    .total-final { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding: 3px 2px; margin-top: 2px; }
    .footer { font-size: 11px; text-align: center; color: #000; margin-top: 4px; }
    .id { font-size: 10px; text-align: center; color: #000; margin-top: 4px; word-break: break-all; }
    </style>
    </head>
    <body>

    <p class="empresa-nombre">FactuFly</p>

    <hr>

    <div class="badge">COMPROBANTE PROVISIONAL</div>
    <p class="aviso">Sin validez SUNAT — pendiente de sincronizar</p>

    <hr>

    <table class="cliente">
      <tr><td class="lbl">Cliente:</td><td>${escapeHtml(data.clienteNombre)}</td></tr>
      <tr><td class="lbl">Fecha:</td><td>${data.fecha.toLocaleString("es-PE")}</td></tr>
      <tr><td class="lbl">Pago:</td><td>${escapeHtml(data.medioPago || "-")}</td></tr>
    </table>

    <hr>

    <table class="items">
      <thead><tr><th class="tdesc">Descripción</th><th class="tr">Cant</th><th class="tr">Precio</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>

    <hr>

    <div class="total-final"><span>TOTAL</span><span>${simbolo} ${data.total.toFixed(2)}</span></div>

    <p class="footer">Este ticket no reemplaza el comprobante electrónico.<br>Se emitirá automáticamente al reconectar.</p>
    <p class="id">ID local: ${data.id}</p>

    </body>
    </html>
  `;
}

// Imprime un ticket no fiscal para ventas hechas sin conexión, mientras la
// boleta real (con su serie/correlativo SUNAT) se genera al sincronizar.
export function imprimirTicketProvisional(data: TicketProvisionalData) {
  if (typeof window === "undefined") return;
  try {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";
    document.body.appendChild(iframe);
    iframe.srcdoc = construirHtmlTicket(data);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    };
  } catch {
    // Si falla la impresión, la venta ya quedó guardada en la cola; no se pierde nada.
  }
}
