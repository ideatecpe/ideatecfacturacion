"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import axios from "axios";
import type { GrupoData } from "./types";
import { PERIODO_CFG } from "./constants";
import { parseIsoLocalDate, formatFechaEs } from "./helpers";

// ─── localStorage ─────────────────────────────────────────────────────────────
export const STORAGE_DIAS_AVISO_KEY = "factufly:notif:dias-aviso";

const leerDiasAviso = (): number => {
  if (typeof window === "undefined") return 10;
  const val = Number(localStorage.getItem(STORAGE_DIAS_AVISO_KEY));
  return Number.isFinite(val) && val > 0 ? val : 10;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type EstadoEnvio = "pendiente" | "enviando" | "enviado" | "error";

export type ResumenNotif = {
  ok:  number;
  err: number;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNotificaciones(
  grupos:      GrupoData[],
  accessToken: string | null | undefined,
) {
  const [diasAviso,    _setDiasAviso] = useState<number>(leerDiasAviso);
  const [estadoEmail,  setEstadoEmail] = useState<Record<string, EstadoEnvio>>({});
  const [estadoWsp,    setEstadoWsp]   = useState<Record<string, EstadoEnvio>>({});
  const [enviandoBulk, setEnviandoBulk] = useState(false);
  const [progresoBulk, setProgresoBulk] = useState<{ actual: number; total: number } | null>(null);

  const setDiasAviso = useCallback((n: number) => {
    const val = Math.max(1, Math.min(365, Math.round(n)));
    _setDiasAviso(val);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_DIAS_AVISO_KEY, String(val));
  }, []);

  // ── Helpers de fecha ──────────────────────────────────────────────────────
  const getDiasRestantes = useCallback((fechafin: string): number => {
    if (!fechafin) return 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = parseIsoLocalDate(fechafin);
    if (!fin) return 0;
    return Math.floor((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const formatFechaLarga = useCallback((iso: string): string => {
    const d = parseIsoLocalDate(iso);
    if (!d) return iso;
    const meses = [
      "enero","febrero","marzo","abril","mayo","junio",
      "julio","agosto","septiembre","octubre","noviembre","diciembre",
    ];
    return `${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
  }, []);

  /** Fecha fin más temprana de todos los ítems del grupo */
  const getFirstFechaFin = useCallback((g: GrupoData): string =>
    g.items.map((i) => i.fechafin).filter(Boolean).sort()[0] ?? "", []);

  // ── Grupos que califican para notificación ────────────────────────────────
  const gruposParaNotificar = useMemo(() => {
    return grupos
      .filter((g) => {
        const ff   = getFirstFechaFin(g);
        if (!ff) return false;
        return getDiasRestantes(ff) <= diasAviso; // incluye vencidos
      })
      .sort((a, b) =>
        getDiasRestantes(getFirstFechaFin(a)) -
        getDiasRestantes(getFirstFechaFin(b)),
      );
  }, [grupos, diasAviso, getDiasRestantes, getFirstFechaFin]);

  // ── Enviar email (form-data) ──────────────────────────────────────────────
  const enviarEmail = useCallback(async (grupo: GrupoData): Promise<boolean> => {
    if (!grupo.correo?.trim() || !accessToken) return false;

    const fechafin   = getFirstFechaFin(grupo);
    // periodo → el API espera integer($int32); usamos el valor raw del primer ítem
    const periodoRaw = grupo.items[0]?.periodo ?? "1";
    const periodoInt = parseInt(String(periodoRaw), 10);

    const fd = new FormData();
    fd.append("toEmail",          grupo.correo.trim());
    fd.append("toName",           grupo.razonSocial);
    fd.append("concepto",         grupo.items[0]?.concepto ?? "Servicio de monitoreo GPS");
    fd.append("fechavencimiento", formatFechaLarga(fechafin));
    fd.append("periodo",          String(isNaN(periodoInt) ? 1 : periodoInt));
    fd.append("monto",            grupo.total.toFixed(2));
    fd.append("vencido",          "false"); // siempre false — son avisos previos al vencimiento

    setEstadoEmail((p) => ({ ...p, [grupo.key]: "enviando" }));
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/email/notificar`,
        fd,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setEstadoEmail((p) => ({ ...p, [grupo.key]: "enviado" }));
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown; status?: number } };
      console.error("[email/notificar] error:", e?.response?.status, e?.response?.data);
      setEstadoEmail((p) => ({ ...p, [grupo.key]: "error" }));
      return false;
    }
  }, [accessToken, formatFechaLarga, getFirstFechaFin]);

  // ── Abrir WhatsApp (wa.me) ────────────────────────────────────────────────
  const abrirWhatsApp = useCallback((grupo: GrupoData): void => {
    const raw = (grupo.whatsapp ?? "").replace(/\D/g, "");
    if (!raw) return;
    const numero   = raw.startsWith("51") ? raw : `51${raw}`;
    const fechafin  = getFirstFechaFin(grupo);
    const vencido   = getDiasRestantes(fechafin) < 0;
    const periodoStr = PERIODO_CFG[grupo.periodoTipo]?.label?.toLowerCase() ?? grupo.periodoTipo;
    const fechaStr   = formatFechaEs(fechafin);
    const monto      = `${grupo.moneda === "USD" ? "$" : "S/"} ${grupo.total.toFixed(2)}`;
    const texto = vencido
      ? `Estimado/a ${grupo.razonSocial}, le informamos que su servicio de monitoreo GPS ${periodoStr} *venció el ${fechaStr}*. El monto pendiente es *${monto}*. Por favor, coordine su pago para restablecer el servicio. Gracias.`
      : `Estimado/a ${grupo.razonSocial}, le recordamos que su servicio de monitoreo GPS ${periodoStr} *vencerá el ${fechaStr}*. El monto a abonar es *${monto}*. Por favor, coordine su pago con anticipación. Gracias.`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank");
    setEstadoWsp((p) => ({ ...p, [grupo.key]: "enviado" }));
  }, [getDiasRestantes, getFirstFechaFin]);

  // ── Envío masivo email ────────────────────────────────────────────────────
  const enviarTodosEmail = useCallback(async (
    lista: GrupoData[],
  ): Promise<ResumenNotif> => {
    const conCorreo = lista.filter((g) => g.correo?.trim());
    if (!conCorreo.length) return { ok: 0, err: 0 };

    setEnviandoBulk(true);
    setProgresoBulk({ actual: 0, total: conCorreo.length });

    let ok = 0;
    let err = 0;
    for (let i = 0; i < conCorreo.length; i++) {
      setProgresoBulk({ actual: i + 1, total: conCorreo.length });
      const res = await enviarEmail(conCorreo[i]);
      res ? ok++ : err++;
    }

    setEnviandoBulk(false);
    setProgresoBulk(null);
    return { ok, err };
  }, [enviarEmail]);

  return {
    diasAviso,
    setDiasAviso,
    gruposParaNotificar,
    estadoEmail,
    estadoWsp,
    enviandoBulk,
    progresoBulk,
    getDiasRestantes,
    getFirstFechaFin,
    formatFechaLarga,
    enviarEmail,
    abrirWhatsApp,
    enviarTodosEmail,
  };
}
