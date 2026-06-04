"use client";

import { useState, useEffect, useRef } from "react";
import {
  Hash,
  RefreshCw,
  Mail,
  Phone,
  Car,
  Calendar,
  User,
  Building2,
  Plus,
  Check,
  FileText,
  DollarSign,
} from "lucide-react";
import { Modal }    from "@/app/components/ui/Modal";
import { Button }   from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth }        from "@/context/AuthContext";
import { buscarDocumento } from "./clienteLookup";
import type { FilaCarga } from "./types";
import { PERIODO_CFG } from "./constants";
import {
  getTipoDoc,
  finPeriodo,
  generarConcepto,
  toLocalIso,
  validarFila,
  calcItemVelsat,
  periodoLabel,
} from "./helpers";

// ─── Opciones de período predefinidas ────────────────────────────────────────

const PERIODO_OPTS = [
  { value: "1/2", key: "quincenal"  },
  { value: "1",   key: "mensual"    },
  { value: "2",   key: "bimestral"  },
  { value: "3",   key: "trimestral" },
  { value: "6",   key: "semestral"  },
  { value: "12",  key: "anual"      },
] as const;

// ─── Estado vacío del formulario ─────────────────────────────────────────────

const crearVacio = (): Omit<FilaCarga, "id"> => ({
  numdoc:      "",
  razonSocial: "",
  periodo:     "1",
  concepto:    "",
  importe:     0,
  igv:         18,
  moneda:      "PEN",
  correo:      "",
  whatsapp:    "",
  fechaini:    toLocalIso(new Date()),
  fechafin:    "",
  placa:       "",
});

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  isOpen:    boolean;
  onClose:   () => void;
  onGuardar: (fila: Omit<FilaCarga, "id">) => void;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export function ModalAgregarFila({ isOpen, onClose, onGuardar }: Props) {
  const [form,           setForm]           = useState(crearVacio);
  const [consultando,    setConsultando]    = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [periodoCustom,  setPeriodoCustom]  = useState(false);
  const lastNdRef = useRef("");

  const { showToast }    = useToast();
  const { accessToken, user } = useAuth();

  // Resetear al cerrar
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setForm(crearVacio());
        setIntentoGuardar(false);
        setPeriodoCustom(false);
        lastNdRef.current = "";
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-calcular fechafin y concepto cuando cambia fechaini, periodo o placa
  useEffect(() => {
    if (!form.fechaini || !form.periodo) return;
    const ff = finPeriodo(form.fechaini, form.periodo);
    const cc = generarConcepto(form.periodo, form.fechaini, ff, form.placa);
    setForm((p) => ({ ...p, fechafin: ff, concepto: cc }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fechaini, form.periodo, form.placa]);

  // Auto-consultar al llegar a 8 (DNI) u 11 (RUC) dígitos
  // Primero busca en clientes locales (con correo + whatsapp); si no, json.pe
  useEffect(() => {
    const numdoc = form.numdoc.trim().replace(/\D/g, "");
    if ((numdoc.length !== 8 && numdoc.length !== 11) || numdoc === lastNdRef.current) return;
    lastNdRef.current = numdoc;
    setConsultando(true);
    (async () => {
      try {
        const found = await buscarDocumento(numdoc, accessToken ?? "", user?.ruc ?? "");
        if (found.razonSocial || found.correo || found.whatsapp) {
          setForm((p) => ({
            ...p,
            razonSocial: found.razonSocial || p.razonSocial,
            // Solo autocompleta si el campo estaba vacío
            correo:   (!p.correo   && found.correo)   ? found.correo   : p.correo,
            whatsapp: (!p.whatsapp && found.whatsapp) ? found.whatsapp : p.whatsapp,
          }));
        }
      } catch { /* silencioso */ } finally {
        setConsultando(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.numdoc]);

  // Helper tipado para actualizar un campo
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const tipo     = getTipoDoc({ ...form, id: "" });
  const errores  = intentoGuardar ? validarFila({ ...form, id: "" }) : {} as Record<string, string>;
  const hayError = Object.keys(validarFila({ ...form, id: "" })).length > 0;

  // Desglose IGV
  const calcIgv  = form.importe > 0 ? calcItemVelsat(form.importe, 18) : null;
  const simbolo  = form.moneda === "USD" ? "$" : "S/";

  // Preview del período personalizado
  const periodoPreview = (() => {
    if (!form.periodo) return "";
    const limpio = form.periodo.trim().toLowerCase();
    if (limpio.endsWith("d")) {
      const n = Number(limpio.replace(/\D/g, ""));
      return n > 0 ? `${n} día${n !== 1 ? "s" : ""}` : "valor inválido";
    }
    const n = Number(limpio);
    if (!isNaN(n) && n > 0) return periodoLabel(form.periodo);
    return "valor inválido";
  })();

  const guardar = (cerrar: boolean) => {
    setIntentoGuardar(true);
    if (hayError) {
      showToast("Corrige los errores antes de guardar", "error");
      return;
    }
    try {
      onGuardar(form);
      showToast(
        `Ítem agregado — ${form.placa || form.razonSocial || "nuevo ítem"}`,
        "success",
      );
      if (cerrar) {
        onClose();
      } else {
        setForm(crearVacio());
        setIntentoGuardar(false);
        setPeriodoCustom(false);
        lastNdRef.current = "";
      }
    } catch {
      showToast("No se pudo agregar el ítem", "error");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar ítem manualmente">
      <div className="space-y-5">

        {/* ── CLIENTE ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            1 · Cliente
          </p>
          <div className="grid grid-cols-2 gap-3">

            {/* numdoc */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Hash className="w-3 h-3 text-gray-400" /> N° Documento
              </label>
              <input
                type="text"
                value={form.numdoc}
                onChange={(e) => {
                  set("numdoc", e.target.value);
                  if (e.target.value !== form.numdoc) set("razonSocial", "");
                }}
                placeholder="DNI (8 dígitos) o RUC (11 dígitos)"
                maxLength={11}
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-all ${
                  errores.numdoc
                    ? "border-red-400 bg-red-50 focus:ring-red-100"
                    : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                }`}
              />
              {errores.numdoc && (
                <p className="text-[10px] text-red-500">{errores.numdoc}</p>
              )}
            </div>

            {/* razonSocial */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Razón social / Nombre</label>
              {consultando ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg h-[38px]">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                  <span className="text-xs text-blue-500">Consultando SUNAT...</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={form.razonSocial}
                  onChange={(e) => set("razonSocial", e.target.value)}
                  placeholder="Se rellena automáticamente"
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-all ${
                    errores.razonSocial
                      ? "border-red-400 bg-red-50 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                  }`}
                />
              )}
              {errores.razonSocial && (
                <p className="text-[10px] text-red-500">{errores.razonSocial}</p>
              )}
            </div>
          </div>

          {/* Badge tipo comprobante */}
          {form.numdoc.trim().replace(/\D/g, "").length >= 8 && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
              tipo === "B"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
              {tipo === "B"
                ? <User className="w-3.5 h-3.5" />
                : <Building2 className="w-3.5 h-3.5" />
              }
              Se emitirá una <strong>{tipo === "B" ? "Boleta" : "Factura"}</strong>
              <span className="font-normal text-[10px] opacity-60 ml-0.5">
                — {tipo === "B" ? "DNI detectado" : "RUC detectado"}
              </span>
            </div>
          )}
        </section>

        {/* ── PERÍODO ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            2 · Período de facturación
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERIODO_OPTS.map(({ value, key }) => {
              const cfg    = PERIODO_CFG[key];
              const activo = !periodoCustom && form.periodo === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setPeriodoCustom(false); set("periodo", value); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    activo
                      ? `${cfg.activeClass} border-transparent shadow-sm`
                      : `border-gray-200 ${cfg.idleClass}`
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${activo ? "bg-white/60" : cfg.dotClass}`} />
                  {cfg.label}
                </button>
              );
            })}

            {/* Botón "Otro" para período personalizado */}
            <button
              type="button"
              onClick={() => { setPeriodoCustom(true); set("periodo", ""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                periodoCustom
                  ? "bg-gray-700 text-white border-transparent shadow-sm"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${periodoCustom ? "bg-white/60" : "bg-gray-300"}`} />
              Otro...
            </button>
          </div>

          {/* Input período personalizado */}
          {periodoCustom && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.periodo}
                  onChange={(e) => set("periodo", e.target.value)}
                  placeholder="Ej: 4 → cuatrimestral   |   17d → 17 días"
                  autoFocus
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-700 focus:ring-2 focus:ring-gray-100 transition-all"
                />
                {periodoPreview && (
                  <span className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap ${
                    periodoPreview === "valor inválido"
                      ? "bg-red-50 text-red-500"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {periodoPreview}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 px-0.5">
                Escribe el número de meses (ej: <strong>4</strong>, <strong>5</strong>, <strong>7</strong>) o días con "d" al final (ej: <strong>15d</strong>, <strong>45d</strong>).
              </p>
            </div>
          )}
        </section>

        {/* ── FECHAS ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            3 · Fechas del servicio
          </p>
          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" /> Fecha inicio
              </label>
              <input
                type="date"
                value={form.fechaini}
                onChange={(e) => set("fechaini", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-all ${
                  errores.fechaini
                    ? "border-red-400 bg-red-50 focus:ring-red-100"
                    : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                }`}
              />
              {errores.fechaini && <p className="text-[10px] text-red-500">{errores.fechaini}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" /> Fecha fin
                <span className="px-1.5 py-px bg-emerald-50 text-emerald-600 rounded text-[9px] font-semibold border border-emerald-100">
                  auto
                </span>
              </label>
              <input
                type="date"
                value={form.fechafin}
                onChange={(e) => set("fechafin", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-all bg-gray-50/80 ${
                  errores.fechafin
                    ? "border-red-400 focus:ring-red-100"
                    : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                }`}
              />
              {errores.fechafin && <p className="text-[10px] text-red-500">{errores.fechafin}</p>}
            </div>
          </div>

          {/* Vista previa del concepto generado */}
          {form.concepto && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                  Concepto que aparecerá en el comprobante
                </p>
                <p className="text-xs text-gray-600 italic leading-relaxed">"{form.concepto}"</p>
              </div>
            </div>
          )}
        </section>

        {/* ── VEHÍCULO + IMPORTE + MONEDA ──────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            4 · Vehículo e importe
          </p>
          <div className="grid grid-cols-3 gap-3">

            {/* Placa */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Car className="w-3 h-3 text-gray-400" /> Placa
              </label>
              <input
                type="text"
                value={form.placa}
                onChange={(e) => set("placa", e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase outline-none focus:ring-2 transition-all tracking-wider ${
                  errores.placa
                    ? "border-red-400 bg-red-50 focus:ring-red-100"
                    : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                }`}
              />
              {errores.placa && <p className="text-[10px] text-red-500">{errores.placa}</p>}
            </div>

            {/* Importe */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-gray-400" />
                Importe total
                <span className="text-[10px] font-normal text-amber-600">(inc. IGV 18%)</span>
              </label>
              <input
                type="number"
                value={form.importe || ""}
                onChange={(e) => set("importe", Number(e.target.value))}
                placeholder="0.00"
                min={0}
                step={0.01}
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-all ${
                  errores.importe
                    ? "border-red-400 bg-red-50 focus:ring-red-100"
                    : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                }`}
              />
              {errores.importe && <p className="text-[10px] text-red-500">{errores.importe}</p>}
            </div>

            {/* Moneda */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Moneda</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden h-[38px]">
                {(["PEN", "USD"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set("moneda", m)}
                    className={`flex-1 text-xs font-bold transition-all ${
                      form.moneda === m
                        ? "bg-slate-700 text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {m === "PEN" ? "S/ PEN" : "$ USD"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Desglose IGV */}
          {calcIgv && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-[11px]">
              <span className="text-gray-500">Base imponible:</span>
              <span className="font-bold text-gray-700">{simbolo} {calcIgv.baseIgv.toFixed(2)}</span>
              <span className="text-gray-300 mx-0.5">+</span>
              <span className="text-amber-600 font-semibold">IGV 18%:</span>
              <span className="font-bold text-amber-700">{simbolo} {calcIgv.montoIGV.toFixed(2)}</span>
              <span className="text-gray-300 mx-0.5">=</span>
              <span className="text-gray-500">Total:</span>
              <span className="font-black text-gray-800">{simbolo} {calcIgv.totalVentaItem.toFixed(2)}</span>
            </div>
          )}
        </section>

        {/* ── CONTACTO (opcional) ──────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            5 · Contacto{" "}
            <span className="normal-case font-normal">(opcional — para envío del comprobante)</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400" /> Correo electrónico
              </label>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => set("correo", e.target.value)}
                placeholder="cliente@correo.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400" /> WhatsApp
              </label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="9XXXXXXXX"
                maxLength={9}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => guardar(false)}>
              <Plus className="w-4 h-4" /> Agregar otro
            </Button>
            <Button type="button" onClick={() => guardar(true)}>
              <Check className="w-4 h-4" /> Guardar ítem
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
