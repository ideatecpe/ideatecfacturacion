"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import axios from "axios";
import type { GrupoData } from "./types";
import { PERIODO_CFG } from "./constants";
import { parseIsoLocalDate, formatFechaEs } from "./helpers";
import { useAuth } from "@/context/AuthContext";

export const STORAGE_DIAS_AVISO_KEY = "factufly:notif:dias-aviso";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type EstadoEnvio = "pendiente" | "enviando" | "enviado" | "error";
export type ResumenNotif = { ok: number; err: number };

// Lo único que guarda la API: id del billing row + flags de envío
type NotifRecord = {
  id:              number;
  emailEnviado:    boolean;
  whatsappEnviado: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Helper: ID numérico del grupo (primer item del billing) ─────────────────
const getGrupoId = (g: GrupoData): number => {
  const n = Number(g.items[0]?.id);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNotificaciones(
  grupos:      GrupoData[],
  accessToken: string | null | undefined,
) {
  const { user } = useAuth();

  // ── Días de aviso — fuente única: API NotificacionDias ────────────────────
  const [diasAviso,    _setDiasAviso] = useState<number | null>(null);
  const notificacionIdRef             = useRef<number | null>(null);

  // ── Registros de NotificacionesEnviadas ───────────────────────────────────
  const [notifRecords, setNotifRecords] = useState<NotifRecord[]>([]);
  const [notifLoaded,  setNotifLoaded]  = useState(false);
  // Ref para leer en el efecto de sync sin añadirlo como dep (evita loop)
  const notifRecordsRef = useRef<NotifRecord[]>([]);
  useEffect(() => { notifRecordsRef.current = notifRecords; }, [notifRecords]);

  // ── Estados transitorios de envío ─────────────────────────────────────────
  const [sendingEmail, setSendingEmail] = useState<Set<string>>(new Set());
  const [errorEmail,   setErrorEmail]   = useState<Set<string>>(new Set());
  const [enviandoBulk, setEnviandoBulk] = useState(false);
  const [progresoBulk, setProgresoBulk] = useState<{ actual: number; total: number } | null>(null);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }),
    [accessToken],
  );

  // ── Cargar días de aviso ──────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    axios
      .get(`${API}/api/NotificacionDias`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const item = (res.data ?? [])[0];
        if (!item) return;
        notificacionIdRef.current = item.id;
        const val = Number(item.dias);
        if (Number.isFinite(val) && val > 0) _setDiasAviso(val);
      })
      .catch(() => _setDiasAviso(7));
  }, [accessToken]);

  const setDiasAviso = useCallback((n: number) => {
    const val = Math.max(1, Math.min(365, Math.round(n)));
    _setDiasAviso(val);
    const id = notificacionIdRef.current;
    if (id !== null && accessToken) {
      axios.put(
        `${API}/api/notificaciondias/${id}`,
        { periodo: "global", dias: String(val) },
        { headers },
      ).catch(() => {});
    }
  }, [accessToken, headers]);

  // ── Fetch registros enviados ───────────────────────────────────────────────
  const fetchNotifEnviadas = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get<NotifRecord[]>(
        `${API}/api/notificacionesenviadas`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setNotifRecords(res.data ?? []);
    } catch { /* mantiene estado */ } finally {
      setNotifLoaded(true);
    }
  }, [accessToken]);

  useEffect(() => { fetchNotifEnviadas(); }, [fetchNotifEnviadas]);

  // ── Helpers de fecha ──────────────────────────────────────────────────────
  const getDiasRestantes = useCallback((fechafin: string): number => {
    if (!fechafin) return 0;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const fin = parseIsoLocalDate(fechafin);
    if (!fin) return 0;
    return Math.floor((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const formatFechaLarga = useCallback((iso: string): string => {
    const d = parseIsoLocalDate(iso);
    if (!d) return iso;
    const m = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${d.getDate()} de ${m[d.getMonth()]} del ${d.getFullYear()}`;
  }, []);

  const getFirstFechaFin = useCallback((g: GrupoData): string =>
    g.items.map((i) => i.fechafin).filter(Boolean).sort()[0] ?? "", []);

  // ── Grupos para notificar ─────────────────────────────────────────────────
  const gruposParaNotificar = useMemo(() => {
    if (diasAviso === null) return [];
    return grupos
      .filter((g) => { const ff = getFirstFechaFin(g); return ff && getDiasRestantes(ff) <= diasAviso; })
      .sort((a, b) => getDiasRestantes(getFirstFechaFin(a)) - getDiasRestantes(getFirstFechaFin(b)));
  }, [grupos, diasAviso, getDiasRestantes, getFirstFechaFin]);

  // ── Sync: POST nuevos, DELETE los que ya no están ─────────────────────────
  // No incluye notifRecords en deps → usa ref para evitar loop infinito
  useEffect(() => {
    if (!notifLoaded || !accessToken || diasAviso === null) return;

    const records    = notifRecordsRef.current;
    const apiIds     = new Set(records.map((r) => r.id));
    const currentIds = new Set(
      gruposParaNotificar.map(getGrupoId).filter((id) => id > 0),
    );

    const toAdd    = gruposParaNotificar.filter((g) => { const id = getGrupoId(g); return id > 0 && !apiIds.has(id); });
    const toDelete = records.filter((r) => !currentIds.has(r.id));

    if (toAdd.length === 0 && toDelete.length === 0) return;

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    Promise.all([
      ...toAdd.map((g) =>
        axios.post(
          `${API}/api/notificacionesenviadas`,
          { id: getGrupoId(g), emailEnviado: false, whatsappEnviado: false },
          { headers: { ...authHeader, "Content-Type": "application/json" } },
        ).catch(() => {}),
      ),
      ...toDelete.map((r) =>
        axios.delete(
          `${API}/api/notificacionesenviadas/${r.id}`,
          { headers: authHeader },
        ).catch(() => {}),
      ),
    ]).then(() => fetchNotifEnviadas());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruposParaNotificar, notifLoaded, diasAviso, accessToken]);

  // ── Mapa rápido id → record ───────────────────────────────────────────────
  const notifMap = useMemo(
    () => new Map(notifRecords.map((r) => [r.id, r])),
    [notifRecords],
  );

  // ── Estado email derivado ─────────────────────────────────────────────────
  const estadoEmail = useMemo<Record<string, EstadoEnvio>>(() => {
    const res: Record<string, EstadoEnvio> = {};
    for (const g of gruposParaNotificar) {
      if (sendingEmail.has(g.key)) { res[g.key] = "enviando"; continue; }
      if (errorEmail.has(g.key))   { res[g.key] = "error";    continue; }
      res[g.key] = notifMap.get(getGrupoId(g))?.emailEnviado ? "enviado" : "pendiente";
    }
    return res;
  }, [gruposParaNotificar, notifMap, sendingEmail, errorEmail]);

  // ── Estado wsp derivado ───────────────────────────────────────────────────
  const estadoWsp = useMemo<Record<string, EstadoEnvio>>(() => {
    const res: Record<string, EstadoEnvio> = {};
    for (const g of gruposParaNotificar) {
      res[g.key] = notifMap.get(getGrupoId(g))?.whatsappEnviado ? "enviado" : "pendiente";
    }
    return res;
  }, [gruposParaNotificar, notifMap]);

  // ── PUT para marcar email/wsp ─────────────────────────────────────────────
  const marcarEnvio = useCallback(async (
    g: GrupoData,
    patch: { emailEnviado?: boolean; whatsappEnviado?: boolean },
  ) => {
    const id = getGrupoId(g);
    if (!id || !accessToken) return;
    const existing = notifMap.get(id);
    const body = {
      emailEnviado:    patch.emailEnviado    ?? existing?.emailEnviado    ?? false,
      whatsappEnviado: patch.whatsappEnviado ?? existing?.whatsappEnviado ?? false,
    };
    try {
      await axios.put(`${API}/api/notificacionesenviadas/${id}`, body, { headers });
      // Actualizar localmente sin re-fetch
      setNotifRecords((prev) =>
        prev.map((r) => r.id === id ? { ...r, ...body } : r),
      );
    } catch { /* silencioso */ }
  }, [accessToken, headers, notifMap]);

  // ── Enviar email ──────────────────────────────────────────────────────────
  const enviarEmail = useCallback(async (grupo: GrupoData): Promise<boolean> => {
    if (!grupo.correo?.trim() || !accessToken) return false;

    const fechafin   = getFirstFechaFin(grupo);
    const periodoInt = parseInt(String(grupo.items[0]?.periodo ?? "1"), 10);

    const fd = new FormData();
    fd.append("toEmail",          grupo.correo.trim());
    fd.append("toName",           grupo.razonSocial);
    fd.append("concepto",         grupo.items[0]?.concepto ?? "Servicio de monitoreo GPS");
    fd.append("fechavencimiento", formatFechaLarga(fechafin));
    fd.append("periodo",          String(isNaN(periodoInt) ? 1 : periodoInt));
    fd.append("monto",            grupo.total.toFixed(2));
    fd.append("vencido",          "false");

    setSendingEmail((p) => new Set(p).add(grupo.key));
    setErrorEmail((p)   => { const n = new Set(p); n.delete(grupo.key); return n; });

    try {
      await axios.post(
        `${API}/api/email/notificar`, fd,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setSendingEmail((p) => { const n = new Set(p); n.delete(grupo.key); return n; });
      await marcarEnvio(grupo, { emailEnviado: true });
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown; status?: number } };
      console.error("[email/notificar]", e?.response?.status, e?.response?.data);
      setSendingEmail((p) => { const n = new Set(p); n.delete(grupo.key); return n; });
      setErrorEmail((p)   => new Set(p).add(grupo.key));
      return false;
    }
  }, [accessToken, formatFechaLarga, getFirstFechaFin, marcarEnvio]);

  // ── Abrir WhatsApp ────────────────────────────────────────────────────────
  const abrirWhatsApp = useCallback((grupo: GrupoData): void => {
    const raw = (grupo.whatsapp ?? "").replace(/\D/g, "");
    if (!raw) return;
    const numero     = raw.startsWith("51") ? raw : `51${raw}`;
    const fechafin   = getFirstFechaFin(grupo);
    const vencido    = getDiasRestantes(fechafin) < 0;
    const periodoStr = PERIODO_CFG[grupo.periodoTipo]?.label?.toLowerCase() ?? grupo.periodoTipo;
    const monto      = `${grupo.moneda === "USD" ? "$" : "S/"} ${grupo.total.toFixed(2)}`;
    const texto = vencido
      ? `Estimado/a ${grupo.razonSocial}, le informamos que su servicio de monitoreo GPS ${periodoStr} *venció el ${formatFechaEs(fechafin)}*. El monto pendiente es *${monto}*. Por favor, coordine su pago para restablecer el servicio. Gracias.`
      : `Estimado/a ${grupo.razonSocial}, le recordamos que su servicio de monitoreo GPS ${periodoStr} *vencerá el ${formatFechaEs(fechafin)}*. El monto a abonar es *${monto}*. Por favor, coordine su pago con anticipación. Gracias.`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank");
    marcarEnvio(grupo, { whatsappEnviado: true });
  }, [getDiasRestantes, getFirstFechaFin, marcarEnvio]);

  // ── Envío masivo ──────────────────────────────────────────────────────────
  const enviarTodosEmail = useCallback(async (lista: GrupoData[]): Promise<ResumenNotif> => {
    const conCorreo = lista.filter((g) => g.correo?.trim());
    if (!conCorreo.length) return { ok: 0, err: 0 };
    setEnviandoBulk(true);
    setProgresoBulk({ actual: 0, total: conCorreo.length });
    let ok = 0, err = 0;
    for (let i = 0; i < conCorreo.length; i++) {
      setProgresoBulk({ actual: i + 1, total: conCorreo.length });
      (await enviarEmail(conCorreo[i])) ? ok++ : err++;
    }
    setEnviandoBulk(false);
    setProgresoBulk(null);
    return { ok, err };
  }, [enviarEmail]);

  return {
    diasAviso:        diasAviso ?? 0,
    diasAvisoCargado: diasAviso !== null,
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
