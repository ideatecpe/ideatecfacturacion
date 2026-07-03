"use client";
import React, { useState } from "react";
import {
  RefreshCw,
  Mail,
  MessageCircle,
  CheckCircle2,
  X,
  Send,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useToast } from "@/app/components/ui/Toast";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface GuiaEnvioData {
  guiaId: number;
  numeroCompleto?: string;
  tipoDoc: string; // '09' | '31'
  desTraslado?: string;
  fecTraslado?: string;
  partidaDireccion?: string;
  llegadaDireccion?: string;
  clienteCorreo?: string;
  clienteWhatsapp?: string;
  enviadoPorCorreo: boolean;
  enviadoPorWhatsapp: boolean;
  destinatarioRznSocial?: string;
  details?: { descripcion: string; cantidad: number; unidad: string }[];
}

export interface ModalEnvioGuiaProps {
  guia: GuiaEnvioData;
  tipo: "email" | "whatsapp";
  accessToken: string;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TIPO_DOC_LABEL: Record<string, string> = {
  "09": "Guía Remitente",
  "31": "Guía Transportista",
};

const fmtFecha = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};

// ─── Componente ───────────────────────────────────────────────────────────────
export const ModalEnvioGuia = ({
  guia,
  tipo,
  accessToken,
  onClose,
}: ModalEnvioGuiaProps) => {
  const { showToast } = useToast();
  const esEmail = tipo === "email";

  const yaEnviado = esEmail ? guia.enviadoPorCorreo : guia.enviadoPorWhatsapp;
  const [destino, setDestino] = useState(
    esEmail ? (guia.clienteCorreo ?? "") : (guia.clienteWhatsapp ?? ""),
  );
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  const tipoLabel = TIPO_DOC_LABEL[guia.tipoDoc] ?? "Guía de Remisión";

  const handleEnviar = async () => {
    if (!destino.trim()) return;
    setEnviando(true);
    try {
      // ── 1. Obtener PDF ────────────────────────────────────────────
      const resPdf = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/guias/${guia.guiaId}/pdf`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!resPdf.ok) throw new Error("No se pudo obtener el PDF");
      const pdfBlob = await resPdf.blob();
      const pdfFile = new File(
        [pdfBlob],
        `${guia.numeroCompleto ?? guia.guiaId}.pdf`,
        { type: "application/pdf" },
      );

      // ── 2. Enviar según canal ─────────────────────────────────────
      if (esEmail) {
        const formData = new FormData();
        formData.append("toEmail", destino.trim());
        formData.append("toName", guia.destinatarioRznSocial ?? "");
        formData.append("subject", `${tipoLabel} ${guia.numeroCompleto ?? ""}`);
        formData.append(
          "body",
          `Se emitió la guía de remisión para el traslado de los bienes indicados.`,
        );
        formData.append("tipo", "9");
        formData.append(
          "guiaJson",
          JSON.stringify({
            serieNumero: guia.numeroCompleto ?? "",
            estadoSunat: "EMITIDO",
            motivoTraslado: guia.desTraslado ?? "",
            fechaTraslado: fmtFecha(guia.fecTraslado),
            direccionPartida: guia.partidaDireccion ?? "",
            direccionLlegada: guia.llegadaDireccion ?? "",
            bienes: (guia.details ?? []).map((b) => ({
              descripcion: b.descripcion,
              cantidad: b.cantidad,
              unidad: b.unidad,
            })),
          }),
        );
        formData.append("adjunto", pdfFile);

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/email/send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          },
        );
        if (!res.ok) throw new Error("Error al enviar correo");
      } else {
        const whatsappApiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY!;
        const whatsappBase = "https://do.velsat.pe:8443/whatsapp";

        const uploadForm = new FormData();
        uploadForm.append("file", pdfFile);
        const resUpload = await fetch(`${whatsappBase}/api/upload`, {
          method: "POST",
          headers: { "x-api-key": whatsappApiKey },
          body: uploadForm,
        });
        if (!resUpload.ok) throw new Error("No se pudo subir el PDF");
        const fileUrl = (await resUpload.json()).datos.url;

        const numeroFormateado = destino.trim().startsWith("51")
          ? destino.trim()
          : `51${destino.trim()}`;

        const payload = {
          phone: numeroFormateado,
          type: "documento",
          file_url: fileUrl,
          filename: pdfFile.name,
          mime_type: "application/pdf",
          text: `Estimado(a) ${guia.destinatarioRznSocial ?? ""}, adjuntamos la guía de remisión electrónica ${guia.numeroCompleto ?? ""}.`,
        };

        // ── Primer intento ──
        const resWsp1 = await fetch(`${whatsappBase}/api/send/single`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": whatsappApiKey,
          },
          body: JSON.stringify(payload),
        });

        // ── Si falla, esperar 2s y reintentar una vez ──
        if (!resWsp1.ok) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const resWsp2 = await fetch(`${whatsappBase}/api/send/single`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": whatsappApiKey,
            },
            body: JSON.stringify(payload),
          });
          if (!resWsp2.ok) throw new Error("Error al enviar por WhatsApp");
        }
      }

      setExito(true);
      showToast(
        esEmail
          ? "Correo enviado correctamente"
          : "WhatsApp enviado correctamente",
        "success",
      );
      setTimeout(() => {
        setExito(false);
        onClose();
      }, 1500);
    } catch {
      showToast(
        esEmail ? "Error al enviar por correo" : "Error al enviar por WhatsApp",
        "error",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 min-h-screen h-full">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div
          className={cn(
            "px-6 py-4 flex items-center justify-between",
            esEmail
              ? "bg-blue-50 border-b border-blue-100"
              : "bg-green-50 border-b border-green-100",
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                esEmail ? "bg-blue-100" : "bg-green-100",
              )}
            >
              {esEmail ? (
                <Mail size={18} className="text-blue-600" />
              ) : (
                <MessageCircle size={18} className="text-green-600" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Enviar por {esEmail ? "Correo electrónico" : "WhatsApp"}
              </h2>
              <p className="text-xs text-gray-500">
                {tipoLabel}: {guia.numeroCompleto}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="p-1.5 hover:bg-white/70 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">
          {/* Aviso si ya fue enviado */}
          {yaEnviado && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <CheckCircle2
                size={15}
                className="text-amber-500 mt-0.5 shrink-0"
              />
              <p className="text-xs text-amber-700">
                Esta guía ya fue enviada anteriormente por este canal. Puedes
                volver a enviarla.
              </p>
            </div>
          )}

          {/* Datos de la guía */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs text-gray-500">Destinatario</p>
            <p className="text-sm font-semibold text-gray-900">
              {guia.destinatarioRznSocial ?? "—"}
            </p>
            {guia.desTraslado && (
              <p className="text-xs text-gray-400">
                Motivo: {guia.desTraslado}
              </p>
            )}
          </div>

          {/* Input destino */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              {esEmail ? "Correo electrónico" : "Número de WhatsApp"}
            </label>
            <input
              type={esEmail ? "email" : "tel"}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder={esEmail ? "correo@ejemplo.com" : "987654321"}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-brand-blue/50 outline-none transition-all"
            />
            {!esEmail && (
              <p className="text-xs text-gray-400 mt-1">
                El código de país (51) se añade automáticamente si no lo
                incluyes.
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={enviando}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={enviando || exito || !destino.trim()}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50",
              exito
                ? "bg-emerald-500 text-white"
                : esEmail
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white",
            )}
          >
            {exito ? (
              <>
                <CheckCircle2 size={16} /> Enviado
              </>
            ) : enviando ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Send size={16} /> Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
