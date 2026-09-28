/**
 * Impresión rápida del comprobante (configuración "impresionRapida").
 *
 * El flujo normal imprime después de GenerarXml → enviar a SUNAT → GET
 * /api/Comprobantes/{id}/html: el cliente espera a SUNAT (2-3 s) para recibir
 * su ticket. Con la impresión rápida, en cuanto GenerarXml / NotaVenta devuelve
 * la serie y el correlativo reales, el ticket se arma aquí con el MISMO
 * payload que se mandó a la API y se imprime de inmediato; SUNAT sigue en
 * segundo plano.
 *
 * `construirHtmlComprobante` es una réplica 1:1 de
 * IdeatecAPI ComprobanteHtmlService.GenerarHtmlTicketAsync (mismo CSS, mismo
 * orden, mismas reglas). Si se cambia el ticket del backend hay que cambiarlo
 * aquí también. La única diferencia inevitable: el QR no lleva el hash de la
 * firma, porque la firma se hace al enviar a SUNAT (el HTML del backend
 * tampoco lo lleva mientras el comprobante sigue PENDIENTE).
 *
 * Lo que se reimprime desde Comprobantes sigue saliendo del backend.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { imprimirHtmlConAgente } from "./agente";

// ── Datos de cabecera (empresa / sucursal) ──────────────────────────────────

export interface EmisorTicket {
  ruc: string;
  razonSocial: string | null;
  nombreComercial: string | null;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  telefono: string | null;
  email: string | null;
  logoBase64: string | null;
}

export interface SucursalTicket {
  codEstablecimiento?: string | null;
  nombre?: string | null;
  direccion?: string | null;
  telefono?: string | null;
}

// El payload de /api/companies/{ruc} ya lo pide useEmpresaEmisor; se guarda
// aquí lo que el ticket necesita (logo, teléfono, email) para no repetir la
// consulta ni meter el logo en el payload de cada venta.
const emisores = new Map<string, EmisorTicket>();
const emisoresEnVuelo = new Map<string, Promise<EmisorTicket | null>>();

type EmpresaApi = Record<string, unknown>;

function texto(v: unknown): string | null {
  return typeof v === "string" ? v : v == null ? null : String(v);
}

export function guardarEmisorTicket(data: EmpresaApi): void {
  const ruc = texto(data?.ruc);
  if (!ruc) return;
  emisores.set(ruc, {
    ruc,
    razonSocial: texto(data.razonSocial),
    nombreComercial: texto(data.nombreComercial),
    direccion: texto(data.direccion),
    distrito: texto(data.distrito),
    provincia: texto(data.provincia),
    departamento: texto(data.departamento),
    telefono: texto(data.telefono),
    email: texto(data.email),
    logoBase64: texto(data.logoBase64),
  });
}

/** Devuelve la cabecera en memoria o la pide a la API (una sola vez a la vez). */
export async function obtenerEmisorTicket(ruc: string, token: string | null): Promise<EmisorTicket | null> {
  const guardado = emisores.get(ruc);
  if (guardado) return guardado;
  const enVuelo = emisoresEnVuelo.get(ruc);
  if (enVuelo) return enVuelo;

  const promesa = (async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies/${ruc}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      guardarEmisorTicket(await res.json());
      return emisores.get(ruc) ?? null;
    } catch {
      return null;
    } finally {
      emisoresEnVuelo.delete(ruc);
    }
  })();
  emisoresEnVuelo.set(ruc, promesa);
  return promesa;
}

// ── Personalización (Herramientas → Tickets) ────────────────────────────────
// Réplica de IdeatecAPI TicketPersonalizadoDto: se guarda como JSON en
// configuracion.ticketpersonalizado y la aplican los dos tickets.

export interface TicketPersonalizado {
  mensajeFinal: string | null;
  textoCabecera: string | null;
  mostrarLogo: boolean;
  mostrarTelefonoEmail: boolean;
  mostrarCajero: boolean;
  mostrarAtendidoPor: boolean;
  mostrarCodigo: boolean;
  tamanoLetra: "normal" | "grande";
}

export const MAX_TEXTO_TICKET = 300;

export const TICKET_POR_DEFECTO: TicketPersonalizado = {
  mensajeFinal: null,
  textoCabecera: null,
  mostrarLogo: true,
  mostrarTelefonoEmail: true,
  mostrarCajero: true,
  mostrarAtendidoPor: true,
  mostrarCodigo: true,
  tamanoLetra: "normal",
};

function recortar(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const limpio = v.replace(/\r\n/g, "\n").trim();
  return limpio.length > MAX_TEXTO_TICKET ? limpio.slice(0, MAX_TEXTO_TICKET) : limpio;
}

/** Normaliza igual que el backend (textos recortados, booleanos por defecto en true). */
export function normalizarPersonalizacion(v: Partial<TicketPersonalizado> | null | undefined): TicketPersonalizado {
  const o = v ?? {};
  const bool = (x: unknown) => (typeof x === "boolean" ? x : true);
  return {
    mensajeFinal: recortar(o.mensajeFinal),
    textoCabecera: recortar(o.textoCabecera),
    mostrarLogo: bool(o.mostrarLogo),
    mostrarTelefonoEmail: bool(o.mostrarTelefonoEmail),
    mostrarCajero: bool(o.mostrarCajero),
    mostrarAtendidoPor: bool(o.mostrarAtendidoPor),
    mostrarCodigo: bool(o.mostrarCodigo),
    tamanoLetra: o.tamanoLetra === "grande" ? "grande" : "normal",
  };
}

/** Lee el JSON de config.ticketPersonalizado; vacío o dañado → ticket por defecto. */
export function leerPersonalizacion(json: string | null | undefined): TicketPersonalizado {
  if (!json || !json.trim()) return { ...TICKET_POR_DEFECTO };
  try {
    return normalizarPersonalizacion(JSON.parse(json));
  } catch {
    return { ...TICKET_POR_DEFECTO };
  }
}

// Mismo bloque que CssLetraGrande en ComprobanteHtmlService.
const CSS_LETRA_GRANDE =
  "body { font-size: 13px; } " +
  ".small, .empresa-sub, table.cliente td, table.items, table.totales, .leyenda, table.pagos, .footer, .motivo, .sec-title { font-size: 12px; } " +
  ".empresa-nombre { font-size: 14px; } " +
  ".badge, .numero-doc, table.totales tr.total-final { font-size: 13px; }";

// ── Formatos (mismos helpers que el backend) ────────────────────────────────

/** C# decimal.ToString("0.##"): redondeo a 2 decimales alejándose de cero, sin ceros sobrantes. */
function N(v: unknown): string {
  const n = Number(v) || 0;
  const r = Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7) / 100;
  return String(r === 0 ? 0 : r);
}

function Fmt(monto: unknown, moneda: string): string {
  return moneda === "USD" ? `$ ${N(monto)}` : `S/ ${N(monto)}`;
}

/** Escapa HTML y codifica @ (igual que el backend, para que Cloudflare no oculte emails). */
function HE(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/@/g, "&#64;");
}

const vacio = (s: string | null | undefined): s is null | undefined | "" => s == null || s === "";
const enBlanco = (s: string | null | undefined) => s == null || s.trim() === "";
const pad2 = (n: number) => String(n).padStart(2, "0");

interface FechaPartes { y: number; m: number; d: number; hh: number; mi: number; ss: number }

/** Lee "YYYY-MM-DD[THH:mm[:ss]]" tal cual, sin pasar por zonas horarias. */
function partesFecha(valor: unknown): FechaPartes | null {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return {
      y: valor.getFullYear(), m: valor.getMonth() + 1, d: valor.getDate(),
      hh: valor.getHours(), mi: valor.getMinutes(), ss: valor.getSeconds(),
    };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(valor ?? ""));
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3], hh: +(m[4] ?? 0), mi: +(m[5] ?? 0), ss: +(m[6] ?? 0) };
}

const ddMMyyyy = (f: FechaPartes | null) => (f ? `${pad2(f.d)}/${pad2(f.m)}/${f.y}` : "");
const ddMMyy = (f: FechaPartes | null) => (f ? `${pad2(f.d)}/${pad2(f.m)}/${pad2(f.y % 100)}` : "");
const HHmmss = (f: FechaPartes | null) => (f ? `${pad2(f.hh)}:${pad2(f.mi)}:${pad2(f.ss)}` : "");
const yyyyMMdd = (f: FechaPartes | null) => (f ? `${f.y}-${pad2(f.m)}-${pad2(f.d)}` : "");

/** DateTime.AddMonths(1): si el día no existe en el mes siguiente, queda en el último día. */
function sumarUnMes(f: FechaPartes): FechaPartes {
  const y = f.m === 12 ? f.y + 1 : f.y;
  const m = f.m === 12 ? 1 : f.m + 1;
  const ultimo = new Date(y, m, 0).getDate();
  return { ...f, y, m, d: Math.min(f.d, ultimo) };
}

/** Math.Round(decimal, 0) de C#: redondeo bancario. */
function redondeoBancario(n: number): number {
  const piso = Math.floor(n);
  const dif = n - piso;
  if (Math.abs(dif - 0.5) < 1e-9) return piso % 2 === 0 ? piso : piso + 1;
  return Math.round(n);
}

// ── Modelo normalizado (lo que el backend lee de la BD tras guardar) ────────

interface DetalleTicket {
  item: number;
  codigo: string | null;
  descripcion: string | null;
  cantidad: number;
  tipoAfectacionIGV: string | null;
  porcentajeIGV: number;
  descuentoUnitario: number;
  descuentoTotal: number;
  precioVenta: number;
  totalVentaItem: number;
  trabajadorId: number | null;
}

interface PagoTicket { medioPago: string | null; monto: number }
interface CuotaTicket { numeroCuota: string | null; monto: number; fechaVencimiento: unknown }
interface DetraccionTicket { cuentaBancoDetraccion: string | null; porcentajeDetraccion: number; montoDetraccion: number }

export type TipoComprobanteTicket = "01" | "03" | "NV";

export interface TrabajadorTicket { id: number; nombres?: string | null; apellidos?: string | null }

export interface DatosTicketComprobante {
  /** El mismo objeto que se envió a GenerarXml (boleta/factura) o a /api/NotaVenta. */
  payload: Record<string, unknown>;
  tipo: TipoComprobanteTicket;
  /** Serie y correlativo que devolvió la API (los reales, no los que mostraba la pantalla). */
  serie: string;
  correlativo: number;
  emisor: EmisorTicket;
  sucursal?: SucursalTicket | null;
  /** username del usuario que emite (el backend lo saca de usuarioCreacion). */
  cajero?: string | null;
  trabajadores?: TrabajadorTicket[];
  /** Vales adjuntos (solo descripción; el backend los lee de la tabla vale). */
  vales?: { descripcion?: string | null }[];
  anchoMm: 58 | 80;
  /** Personalización de la empresa; sin ella sale el ticket por defecto. */
  personalizacion?: TicketPersonalizado | null;
}

const num = (v: unknown) => Number(v) || 0;
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);

function normalizarDetalles(payload: Record<string, unknown>, esNV: boolean): DetalleTicket[] {
  const crudos = arr(payload.details ?? payload.Details ?? payload.detalles ?? payload.Detalles);
  return crudos
    .map((d) => ({
      item: num(d.item ?? d.Item),
      codigo: texto(d.codigo ?? d.Codigo),
      descripcion: texto(d.descripcion ?? d.Descripcion),
      cantidad: num(d.cantidad ?? d.Cantidad),
      // Nota de venta: NotaVentaService guarda todo como inafecto-exonerado sin IGV.
      tipoAfectacionIGV: esNV ? "20" : texto(d.tipoAfectacionIGV ?? d.TipoAfectacionIGV),
      porcentajeIGV: esNV ? 0 : num(d.porcentajeIGV ?? d.PorcentajeIGV),
      descuentoUnitario: num(d.descuentoUnitario ?? d.DescuentoUnitario),
      descuentoTotal: num(d.descuentoTotal ?? d.DescuentoTotal),
      precioVenta: num(d.precioVenta ?? d.PrecioVenta),
      totalVentaItem: num(d.totalVentaItem ?? d.TotalVentaItem),
      trabajadorId: (() => {
        const t = Number(d.trabajadorId ?? d.trabajadorID ?? d.TrabajadorID ?? 0);
        return t > 0 ? t : null;
      })(),
    }))
    // Igual que GetDatosCompletosByComprobanteIdAsync: sin líneas en cero y por ítem.
    .filter((d) => d.cantidad > 0)
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.item - b.d.item || a.i - b.i)
    .map(({ d }) => d);
}

// ── QR ──────────────────────────────────────────────────────────────────────

function generarQrDataUri(contenido: string): string {
  // qrcode.react solo expone componentes, así que el SVG se saca con
  // renderToStaticMarkup: es una función pura, sin DOM ni raíz de React, y por
  // eso se puede llamar durante el render (la vista previa de Herramientas →
  // Tickets lo hace) sin romper nada. Mismo nivel de corrección (Q), mismo
  // color (#1A2B4A) y la misma zona muda de 4 módulos que QRCoder en el backend.
  const svg = renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: contenido,
      level: "Q",
      marginSize: 4,
      size: 256,
      fgColor: "#1A2B4A",
      bgColor: "#FFFFFF",
    }),
  );
  if (!svg.includes("<svg")) throw new Error("No se pudo generar el QR");
  const conNs = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(conNs)))}`;
}

// ── Secciones ───────────────────────────────────────────────────────────────

function buildPagosHtml(
  tipoPago: string,
  pagos: PagoTicket[],
  cuotas: CuotaTicket[],
  moneda: string,
  importeTotal: number,
  montoCredito: number,
  comision: number,
): string {
  const esCredito = ["credito", "crédito"].includes(tipoPago.toLowerCase());
  const tieneInicial = pagos.length > 0 && cuotas.length > 0;
  let sb = `<p class="sec-title">FORMA DE PAGO</p><table class="pagos">`;

  if (!esCredito) {
    sb += `<tr><td>Tipo</td><td>Contado</td></tr>`;
    if (pagos.length) {
      for (const p of pagos) {
        let montoMedio = p.monto;
        if ((p.medioPago ?? "").toLowerCase() === "tarjeta" && comision > 0) montoMedio += comision;
        sb += `<tr><td>${HE(p.medioPago ?? "Efectivo")}</td><td>${Fmt(montoMedio, moneda)}</td></tr>`;
      }
    } else {
      sb += `<tr><td>Efectivo</td><td>${Fmt(importeTotal, moneda)}</td></tr>`;
    }
  } else if (tieneInicial) {
    sb += `<tr><td>Tipo</td><td>Crédito c/ inicial</td></tr>`;
    for (const p of pagos)
      sb += `<tr><td>Inicial (${HE(p.medioPago ?? "Efectivo")})</td><td>${Fmt(p.monto, moneda)}</td></tr>`;
    sb += `<tr><td colspan="2" class="bold" style="padding-top:2px;">Cuotas:</td></tr>`;
    for (const cu of cuotas)
      sb += `<tr><td>${HE(cu.numeroCuota ?? "")}</td><td>${Fmt(cu.monto, moneda)} — ${ddMMyy(partesFecha(cu.fechaVencimiento))}</td></tr>`;
  } else {
    sb += `<tr><td>Tipo</td><td>Crédito</td></tr>`;
    sb += `<tr><td>Monto Crédito</td><td>${Fmt(montoCredito, moneda)}</td></tr>`;
    if (cuotas.length) {
      sb += `<tr><td colspan="2" class="bold" style="padding-top:2px;">Cuotas:</td></tr>`;
      for (const cu of cuotas)
        sb += `<tr><td>${HE(cu.numeroCuota ?? "")}</td><td>${Fmt(cu.monto, moneda)} — ${ddMMyy(partesFecha(cu.fechaVencimiento))}</td></tr>`;
    }
  }

  return sb + "</table>";
}

function buildDetraccionHtml(detracciones: DetraccionTicket[], moneda: string, tipo: string): string {
  if (!detracciones.length) return "";
  let sb = `<p class="sec-title">DETRACCIÓN</p><table class="pagos">`;
  for (const det of detracciones) {
    if (tipo === "01") sb += `<tr><td>Cta. BN</td><td>${HE(det.cuentaBancoDetraccion ?? "-")}</td></tr>`;
    sb += `<tr><td>% Detrac.</td><td>${Math.round(det.porcentajeDetraccion)}%</td></tr>`;
    sb += `<tr><td>Monto</td><td>${moneda === "USD" ? "$" : "S/"} ${redondeoBancario(det.montoDetraccion)}</td></tr>`;
  }
  return sb + "</table>";
}

function buildValesHtml(
  numeroCompleto: string,
  fecha: FechaPartes | null,
  vales: { descripcion?: string | null }[],
): string {
  if (!vales.length) return "";
  let sb = "";
  for (const vale of vales) {
    sb += `<div style="page-break-before:always;"></div>`;
    sb += `<p class="center bold" style="font-size:11px;margin-top:6px;">COD. VALE: ${HE(numeroCompleto)}</p>`;
    if (!enBlanco(vale.descripcion)) {
      const desc = vale
        .descripcion!.replace(/<br><br>/gi, "\n\n")
        .replace(/<br \/>/gi, "\n")
        .replace(/<br\/>/gi, "\n")
        .replace(/<br>/gi, "\n");
      sb += `<p style="font-size:10px;white-space:pre-line;">${HE(desc)}</p>`;
    }
    sb += `<p class="small">Emitido: ${ddMMyyyy(fecha)} ${HHmmss(fecha)}</p>`;
    sb += `<p class="small">Válido hasta: ${fecha ? ddMMyyyy(sumarUnMes(fecha)) : ""}</p>`;
  }
  return sb;
}

function buildDirFiscalHtml(e: EmisorTicket): string {
  if (vacio(e.direccion)) return "";
  const partes = [HE(e.direccion)];
  const ubigeo = [e.distrito, e.provincia, e.departamento]
    .filter((x): x is string => !vacio(x))
    .map(HE)
    .join(" ");
  if (ubigeo) partes.push(ubigeo);
  return `<p class="empresa-sub">Dir. Fiscal: ${partes.join(", ")}</p>`;
}

function buildSucursalHtml(nombre: string | null | undefined, direccion: string | null | undefined): string {
  if (vacio(nombre) && vacio(direccion)) return "";
  const partes: string[] = [];
  if (!vacio(nombre)) partes.push(HE(nombre));
  if (!vacio(direccion)) partes.push(HE(direccion));
  return `<p class="empresa-sub">Suc.: ${partes.join(" - ")}</p>`;
}

function buildTelefonoEmailHtml(telefono: string | null | undefined, email: string | null | undefined): string {
  const partes: string[] = [];
  if (!vacio(telefono)) partes.push(`Tel: ${HE(telefono)}`);
  if (!vacio(email)) partes.push(HE(email));
  return partes.length ? `<p class="empresa-sub">${partes.join(" | ")}</p>` : "";
}

// ── HTML final ──────────────────────────────────────────────────────────────

export function construirHtmlComprobante(datos: DatosTicketComprobante): string {
  const { payload, tipo, emisor } = datos;
  const perso = normalizarPersonalizacion(datos.personalizacion);
  const esNV = tipo === "NV";
  const p = payload;

  const cliente = (p.cliente ?? p.Cliente ?? {}) as Record<string, unknown>;
  const company = (p.company ?? p.Company ?? {}) as Record<string, unknown>;
  const detalles = normalizarDetalles(p, esNV);
  const pagos: PagoTicket[] = arr(p.pagos ?? p.Pagos).map((x) => ({
    medioPago: texto(x.medioPago ?? x.MedioPago),
    monto: num(x.monto ?? x.Monto),
  }));
  const cuotas: CuotaTicket[] = arr(p.cuotas ?? p.Cuotas).map((x) => ({
    numeroCuota: texto(x.numeroCuota ?? x.NumeroCuota),
    monto: num(x.monto ?? x.Monto),
    fechaVencimiento: x.fechaVencimiento ?? x.FechaVencimiento,
  }));
  // NotaVentaService no guarda leyendas ni detracciones.
  const leyendas = esNV ? [] : arr(p.legends ?? p.Legends).map((l) => texto(l.value ?? l.Value));
  const detracciones: DetraccionTicket[] = esNV
    ? []
    : arr(p.detracciones ?? p.Detracciones).map((x) => ({
        cuentaBancoDetraccion: texto(x.cuentaBancoDetraccion ?? x.CuentaBancoDetraccion),
        porcentajeDetraccion: num(x.porcentajeDetraccion ?? x.PorcentajeDetraccion),
        montoDetraccion: num(x.montoDetraccion ?? x.MontoDetraccion),
      }));

  const moneda = texto(p.tipoMoneda) ?? "PEN";
  const tipoPago = texto(p.tipoPago) ?? "";
  const importeTotal = num(p.importeTotal);
  const totalIgv = num(p.totalIGV);
  const comision = num(p.totalComisionPagoTarjeta);
  const fecha = partesFecha(p.fechaEmision);
  const correlativo8 = String(datos.correlativo).padStart(8, "0");
  const numeroCompleto = `${datos.serie}-${correlativo8}`;
  const clienteTipoDoc = texto(cliente.tipoDocumento);
  const clienteNumDoc = texto(cliente.numeroDocumento);

  const es58 = datos.anchoMm === 58;
  const anchoMm = es58 ? "54mm" : "76mm";
  const paginaMm = es58 ? "58mm" : "80mm";
  const margenMm = es58 ? "1mm" : "2mm";

  // ── QR (no aplica para Nota de Venta)
  const qr = esNV
    ? ""
    : generarQrDataUri(
        [
          emisor.ruc ?? "",
          tipo,
          datos.serie,
          correlativo8,
          totalIgv.toFixed(2),
          importeTotal.toFixed(2),
          yyyyMMdd(fecha),
          clienteTipoDoc ?? "0",
          clienteNumDoc ?? "0",
          "",
        ].join("|"),
      );

  // ── Sucursal: solo si el establecimiento no es la sede principal
  const codEstab = texto(company.establecimientoAnexo);
  const esSedePrincipal = vacio(codEstab) || codEstab === "0000";
  const suc = !esSedePrincipal ? datos.sucursal : null;

  // ── Logo
  let logoHtml = "";
  if (perso.mostrarLogo && !vacio(emisor.logoBase64)) {
    const src = emisor.logoBase64.startsWith("data:") ? emisor.logoBase64 : `data:image/png;base64,${emisor.logoBase64}`;
    logoHtml = `<div class="center"><img src="${src}" style="max-width:55mm;max-height:20mm;object-fit:contain;"></div>`;
  }

  const tipoNombre = tipo === "01" ? "FACTURA ELECTRÓNICA" : tipo === "03" ? "BOLETA ELECTRÓNICA" : "NOTA DE VENTA";

  // ── Ítems
  const mostrarCodigo = perso.mostrarCodigo && detalles.some((d) => !enBlanco(d.codigo));
  let items = `<table class="items"><thead><tr><th>#</th>`;
  if (mostrarCodigo) items += "<th>Cód</th>";
  items += `<th>Cant</th><th class="tdesc">Descripción</th><th>P.Vent</th><th>Total</th></tr></thead><tbody>`;
  detalles.forEach((d, i) => {
    const esGratuito = d.tipoAfectacionIGV === "11" || d.tipoAfectacionIGV === "21" || d.tipoAfectacionIGV === "31";
    const pVent = d.descuentoTotal > 0 ? d.precioVenta + d.descuentoUnitario : d.precioVenta;
    const descTxt = HE(d.descripcion ?? "-") + (esGratuito ? " <em>(GR)</em>" : "");
    const totalTxt = esGratuito ? "0" : N(d.totalVentaItem);
    const tieneDescuento = d.descuentoUnitario > 0;
    items += tieneDescuento ? `<tr class="nodiv">` : "<tr>";
    items += `<td>${i + 1}</td>`;
    if (mostrarCodigo) items += `<td>${HE(d.codigo ?? "-")}</td>`;
    items += `<td>${N(d.cantidad)}</td>`;
    items += `<td class="tdesc">${descTxt}</td>`;
    items += `<td class="tr">${N(pVent)}</td>`;
    items += `<td class="tr">${totalTxt}</td>`;
    items += "</tr>";
    if (tieneDescuento) {
      const colspan = mostrarCodigo ? 6 : 5;
      items += `<tr><td colspan="${colspan}" class="tr" style="font-size:10px;color:#555;">Dscto: -${N(d.descuentoUnitario)}</td></tr>`;
    }
  });
  items += "</tbody></table>";

  // ── Totales (NV: NotaVentaService no guarda gravadas/exoneradas/inafectas)
  const fila = (label: string, valor: string) => `<tr><td>${label}</td><td>${valor}</td></tr>`;
  let totales = `<table class="totales">`;
  totales += fila("Op. Gravadas", Fmt(esNV ? 0 : p.totalOperacionesGravadas, moneda));
  totales += fila("Op. Exoneradas", Fmt(esNV ? 0 : p.totalOperacionesExoneradas, moneda));
  totales += fila("Op. Inafectas", Fmt(esNV ? 0 : p.totalOperacionesInafectas, moneda));
  const porIgv = detalles.find((d) => d.porcentajeIGV > 0)?.porcentajeIGV ?? 18;
  totales += fila(`I.G.V. (${porIgv}%)`, Fmt(totalIgv, moneda));
  if (!esNV && num(p.totalIcbper) > 0) totales += fila("ICBPER", Fmt(p.totalIcbper, moneda));
  if (num(p.totalDescuentos) > 0) totales += fila("Descuentos", `-${Fmt(p.totalDescuentos, moneda)}`);
  if (num(p.descuentoGlobal) > 0) totales += fila("Dscto. Global", `-${Fmt(p.descuentoGlobal, moneda)}`);
  totales += `<tr class="total-final"><td>IMPORTE TOTAL</td><td>${Fmt(importeTotal, moneda)}</td></tr>`;
  if (comision > 0) totales += fila("Comisión por pago con tarjeta", `(${Fmt(comision, moneda)})`);
  totales += "</table>";

  const leyendasHtml = leyendas.map((l) => `<p class="leyenda">${HE((l ?? "").toUpperCase())}</p>`).join("");
  const pagosHtml = buildPagosHtml(tipoPago, pagos, cuotas, moneda, importeTotal, num(p.montoCredito), comision);
  const detracHtml = buildDetraccionHtml(detracciones, moneda, tipo);
  const valesHtml = esNV ? "" : buildValesHtml(numeroCompleto, fecha, datos.vales ?? []);

  // ── Cliente
  const labelDoc =
    tipo === "01"
      ? "RUC"
      : clienteTipoDoc === "01"
        ? "DNI"
        : clienteTipoDoc === "6"
          ? "RUC"
          : clienteTipoDoc === "7"
            ? "Pasaporte"
            : clienteTipoDoc === "4"
              ? "Carnet Ext."
              : "Doc.";

  const fechaVcto = ["credito", "crédito"].includes(tipoPago.toLowerCase())
    ? `<tr><td class="lbl">Fcto. Vcto.:</td><td>${ddMMyyyy(partesFecha(p.fechaVencimiento))}</td></tr>`
    : "";

  const tipoCambio = p.tipoCambio == null ? null : Number(p.tipoCambio);
  const monedaRow =
    moneda !== "PEN" && tipoCambio != null && !isNaN(tipoCambio)
      ? `<tr><td class="lbl">Moneda:</td><td>${HE(moneda)} T.C. S/${tipoCambio.toFixed(3)}</td></tr>`
      : "";

  const mostrarPersonal = emisor.ruc !== "20512134832";
  const cajeroRow =
    mostrarPersonal && perso.mostrarCajero && !enBlanco(datos.cajero) ? `<tr><td class="lbl">Cajero:</td><td>${HE(datos.cajero!)}</td></tr>` : "";

  const nombreTrabajador = detalles
    .map((d) => {
      if (d.trabajadorId == null) return null;
      const t = datos.trabajadores?.find((x) => x.id === d.trabajadorId);
      return t ? `${t.nombres ?? ""} ${t.apellidos ?? ""}`.trim() : null;
    })
    .find((n) => !enBlanco(n));
  const atendidoRow =
    mostrarPersonal && perso.mostrarAtendidoPor && !enBlanco(nombreTrabajador)
      ? `<tr><td class="lbl">Atendido por:</td><td>${HE(nombreTrabajador!)}</td></tr>`
      : "";

  const cabeceraExtra = perso.textoCabecera
    ? `<p class="empresa-sub" style="white-space:pre-line;">${HE(perso.textoCabecera)}</p>`
    : "";
  const mensajeFinal = perso.mensajeFinal
    ? `<p class="footer" style="white-space:pre-line;margin-top:4px;">${HE(perso.mensajeFinal)}</p>`
    : "";
  const cssLetraGrande = perso.tamanoLetra === "grande" ? CSS_LETRA_GRANDE : "";

  const clienteDireccion = texto(cliente.direccionLineal);
  const clienteRazonSocial = texto(cliente.razonSocial);

  return `<!DOCTYPE html>
            <html lang="es">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>${HE(tipoNombre)} ${HE(numeroCompleto)}</title>
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
            .center  { text-align: center; }
            .bold    { font-weight: bold; }
            .small   { font-size: 11px; color: #000; }
            hr       { border: none; border-top: 1px solid #000; margin: 3px 0; }
            .empresa-nombre { font-size: 13px; font-weight: bold; text-align: center; }
            .empresa-sub    { font-size: 11px; text-align: center; color: #000; }

            .badge {
                font-weight: bold;
                font-size: 12px;
                text-align: center;
                padding: 3px 2px;
                margin: 3px 0;
                border-top: 1px solid #000;
                border-bottom: 1px solid #000;
            }
            .numero-doc { font-size: 12px; font-weight: bold; text-align: center; margin-bottom: 3px; }

            table.cliente { width: 100%; border-collapse: collapse; margin: 3px 0; }
            table.cliente td { font-size: 11px; padding: 1px 0; vertical-align: top; color: #000; }
            table.cliente td.lbl { font-weight: bold; width: 38%; color: #000; white-space: nowrap; }

            table.items { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 11px; }
            table.items th { background: none; color: #000; padding: 2px; text-align: left; font-weight: bold; border-bottom: 1px solid #000; }
            table.items td { padding: 2px; border-bottom: 1px solid #ccc; vertical-align: top; color: #000; }
            table.items .tdesc { }
            table.items .tr { text-align: right; }
            table.items tr.nodiv td { border-bottom: none; }

            table.totales { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 11px; }
            table.totales tr td { padding: 2px 1px; color: #000; }
            table.totales tr td:last-child { text-align: right; font-weight: bold; }
            table.totales tr.total-final { background: none; color: #000; font-weight: bold; font-size: 12px; border-top: 1px solid #000; }
            table.totales tr.total-final td { padding: 3px 2px; }

            .leyenda { font-weight: bold; font-size: 11px; color: #000; margin: 2px 0; }

            table.pagos { width: 100%; border-collapse: collapse; font-size: 11px; }
            table.pagos td { padding: 1px 0; color: #000; }
            table.pagos td:last-child { text-align: right; }

            .qr { text-align: center; margin: 6px 0 3px; }
            .qr img { width: 55mm; height: 55mm; }

            .footer { font-size: 11px; text-align: center; color: #000; margin-top: 3px; }

            .motivo { font-size: 11px; margin: 2px 0; color: #000; }
            .sec-title { font-weight: bold; color: #000; font-size: 11px; margin: 4px 0 1px; }
            ${cssLetraGrande}
            </style>
            </head>
            <body>

            ${logoHtml}

            ${!vacio(emisor.nombreComercial) ? `<p class="empresa-nombre">${HE(emisor.nombreComercial)}</p>` : ""}
            ${vacio(emisor.nombreComercial) ? `<p class="empresa-nombre">${HE(emisor.razonSocial ?? "")}</p>` : `<p class="empresa-sub">${HE(emisor.razonSocial ?? "")}</p>`}
            ${buildDirFiscalHtml(emisor)}
            ${buildSucursalHtml(suc?.nombre, suc?.direccion)}
            ${perso.mostrarTelefonoEmail ? buildTelefonoEmailHtml(suc?.telefono ?? emisor.telefono, esSedePrincipal ? emisor.email : null) : ""}
            ${cabeceraExtra}
            ${emisor.ruc === "20263635869" ? `<p class="empresa-sub">Atención: Lunes a Sábado de 9:00 am - 08:00 pm</p><p class="empresa-sub">Domingos 9:00 am - 06:00 pm</p><p class="empresa-sub">Venta de telas, edredones, sábanas, forros de muebles y confección de cortinas.</p>` : ""}

            <hr>

            <p class="center bold" style="font-size:12px;">RUC: ${HE(emisor.ruc ?? "")}</p>
            <div class="badge">${HE(tipoNombre)}</div>
            <p class="numero-doc">N° ${HE(datos.serie)}-${correlativo8}</p>
            ${esNV ? `<p class="center" style="font-size:9px;font-weight:bold;">CONTROL INTERNO</p>` : ""}

            <hr>

            <table class="cliente">
            <tr><td class="lbl">Cliente:</td><td>${HE(clienteRazonSocial ?? "-")}</td></tr>
            <tr><td class="lbl">${HE(labelDoc)}:</td><td>${HE(clienteNumDoc ?? "-")}</td></tr>
            ${!vacio(clienteDireccion) ? `<tr><td class="lbl">Dir.:</td><td>${HE(clienteDireccion)}</td></tr>` : ""}
            <tr><td class="lbl">Fecha:</td><td>${ddMMyyyy(fecha)} ${HHmmss(fecha)}</td></tr>
            ${fechaVcto}
            ${monedaRow}
            ${cajeroRow}
            ${atendidoRow}
            </table>

            <hr>

            ${items}

            <hr>

            ${totales}

            ${leyendas.length ? "<hr>" + leyendasHtml : ""}

            ${detracciones.length ? "<hr>" + detracHtml : ""}

            ${detracciones.length ? "" : pagosHtml}

            <hr>

            ${qr ? `
            <div class="qr">
            <img src="${qr}" alt="QR">
            </div>` : ""}

            ${esNV
              ? `<p class="footer"><strong>DOCUMENTO DE CONTROL INTERNO</strong><br>NO VÁLIDO ANTE SUNAT</p>`
              : `<p class="footer">Representación impresa de ${HE(tipoNombre)}<br>Consulte en www.sunat.gob.pe</p>`}

            ${mensajeFinal}

            ${valesHtml}

            </body>
            </html>`;
}

// ── Impresión ───────────────────────────────────────────────────────────────

/** "58" | "80" | "A4" de la configuración → ancho de rollo, o null si no es ticket. */
export function anchoTicketConfig(tamanoImpresion: string | null | undefined): 58 | 80 | null {
  const raw = String(tamanoImpresion ?? "").toLowerCase();
  if (raw.includes("58")) return 58;
  if (raw.includes("80")) return 80;
  return null;
}

/** Imprime un HTML en un iframe oculto (diálogo del navegador). */
export function imprimirHtmlEnNavegador(html: string): void {
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";

  let impreso = false;
  const ejecutar = () => {
    if (impreso) return;
    impreso = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn("Error al abrir diálogo de impresión:", err);
    }
    setTimeout(() => {
      try {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      } catch {}
      URL.revokeObjectURL(blobUrl);
    }, 30000);
  };

  // onload espera al logo y al QR (data URI); el temporizador es solo un
  // respaldo por si el navegador no dispara onload.
  iframe.onload = ejecutar;
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
  setTimeout(ejecutar, 1500);
}

export interface ImpresionRapidaInput extends Omit<DatosTicketComprobante, "emisor"> {
  ruc: string;
  token: string | null;
}

/**
 * Arma el ticket en el navegador y lo imprime (agente de impresión si está,
 * si no el diálogo del navegador).
 * @returns true si el ticket salió; false si hay que usar el HTML del backend.
 */
export async function imprimirComprobanteRapido(input: ImpresionRapidaInput): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const emisor = await obtenerEmisorTicket(input.ruc, input.token);
    if (!emisor) return false;
    const html = construirHtmlComprobante({ ...input, emisor });
    const documento = `${input.serie}-${String(input.correlativo).padStart(8, "0")}`;
    const porAgente = await imprimirHtmlConAgente(html, input.anchoMm, { documento }).catch(() => false);
    if (!porAgente) imprimirHtmlEnNavegador(html);
    return true;
  } catch (err) {
    console.warn("Impresión rápida no disponible, se usará el ticket del servidor:", err);
    return false;
  }
}

/** "B001-00000207" → { serie: "B001", correlativo: 207 } */
export function separarNumeroCompleto(numero: string | null | undefined): { serie: string; correlativo: number } | null {
  if (!numero) return null;
  const i = numero.lastIndexOf("-");
  if (i <= 0) return null;
  const correlativo = parseInt(numero.slice(i + 1), 10);
  if (!Number.isFinite(correlativo)) return null;
  return { serie: numero.slice(0, i), correlativo };
}
