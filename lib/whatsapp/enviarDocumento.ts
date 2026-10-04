// Envío de un PDF por la API de WhatsApp de la empresa: se sube el archivo y luego
// se manda como documento con un mensaje. Es el mismo flujo que usa la caja para
// el comprobante (CajaAutopago → enviarComprobantePorWhatsapp).

const WHATSAPP_BASE = "https://do.velsat.pe:8443/whatsapp";

/** Celular peruano de 9 dígitos (o con 51 delante) → 51XXXXXXXXX; null si no es válido. */
export function normalizarCelularPeru(numero: string | null | undefined): string | null {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  if (digitos.length === 9 && digitos.startsWith("9")) return `51${digitos}`;
  if (digitos.length === 11 && digitos.startsWith("519")) return digitos;
  return null;
}

export async function enviarPdfPorWhatsapp(opciones: {
  /** Celular en formato 51XXXXXXXXX (ver normalizarCelularPeru). */
  telefono: string;
  pdf: Blob;
  nombreArchivo: string;
  mensaje: string;
}): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY;
  if (!apiKey) throw new Error("Falta configurar la API de WhatsApp");

  const archivo = new File([opciones.pdf], opciones.nombreArchivo, { type: "application/pdf" });
  const form = new FormData();
  form.append("file", archivo);

  const resUpload = await fetch(`${WHATSAPP_BASE}/api/upload`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  if (!resUpload.ok) throw new Error("No se pudo subir el PDF");
  const fileUrl = (await resUpload.json())?.datos?.url;
  if (!fileUrl) throw new Error("La API de WhatsApp no devolvió la URL del archivo");

  const res = await fetch(`${WHATSAPP_BASE}/api/send/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      phone: opciones.telefono,
      type: "documento",
      file_url: fileUrl,
      filename: opciones.nombreArchivo,
      mime_type: "application/pdf",
      text: opciones.mensaje,
    }),
  });
  if (!res.ok) throw new Error("No se pudo enviar el mensaje de WhatsApp");
}
