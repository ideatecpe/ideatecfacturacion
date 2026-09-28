"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Eye,
  Info,
  Loader2,
  Lock,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  Zap,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { notificarConfiguracionActualizada, useConfiguracion } from "@/hooks/useConfiguracion";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { imprimirHtmlConAgente } from "@/lib/impresion/agente";
import {
  MAX_TEXTO_TICKET,
  TICKET_POR_DEFECTO,
  anchoTicketConfig,
  construirHtmlComprobante,
  imprimirHtmlEnNavegador,
  leerPersonalizacion,
  normalizarPersonalizacion,
  obtenerEmisorTicket,
  type EmisorTicket,
  type TicketPersonalizado,
  type TipoComprobanteTicket,
} from "@/lib/impresion/ticketComprobante";
import type { Sucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/Boleta";

const TIPOS: { key: TipoComprobanteTicket; label: string }[] = [
  { key: "03", label: "Boleta" },
  { key: "01", label: "Factura" },
  { key: "NV", label: "Nota de Venta" },
];

// Productos de ejemplo: solo para ver cómo queda el papel.
const ITEMS_EJEMPLO = [
  { codigo: "ARR-001", descripcion: "Arroz extra 1 kg", cantidad: 2, precio: 4.5 },
  { codigo: "ACE-014", descripcion: "Aceite vegetal 900 ml", cantidad: 1, precio: 8.9 },
  { codigo: "GAS-220", descripcion: "Gaseosa 500 ml", cantidad: 3, precio: 2.5 },
];

function payloadEjemplo(
  tipo: TipoComprobanteTicket,
  igvPct: number,
  codEstablecimiento: string,
  conTrabajador: boolean,
): Record<string, unknown> {
  const { fechaHora, fecha } = formatoFechaActual();
  const total = ITEMS_EJEMPLO.reduce((a, it) => a + it.precio * it.cantidad, 0);
  const esNV = tipo === "NV";
  const gravadas = esNV ? 0 : +(total / (1 + igvPct / 100)).toFixed(2);
  const igv = esNV ? 0 : +(total - gravadas).toFixed(2);

  const cliente =
    tipo === "01"
      ? { tipoDocumento: "6", numeroDocumento: "20100070970", razonSocial: "EMPRESA DE EJEMPLO S.A.C.", direccionLineal: "AV. EJEMPLO 123, LIMA" }
      : tipo === "NV"
        ? { tipoDocumento: "1", numeroDocumento: "99999999", razonSocial: "Clientes Varios" }
        : { tipoDocumento: "0", numeroDocumento: "0", razonSocial: "Clientes Varios" };

  const detalles = ITEMS_EJEMPLO.map((it, i) => ({
    item: i + 1,
    codigo: it.codigo,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    tipoAfectacionIGV: "10",
    porcentajeIGV: esNV ? 0 : igvPct,
    descuentoUnitario: 0,
    descuentoTotal: 0,
    precioVenta: it.precio,
    totalVentaItem: +(it.precio * it.cantidad).toFixed(2),
    trabajadorId: conTrabajador ? -1 : null,
  }));

  return {
    tipoComprobante: tipo,
    fechaEmision: fechaHora,
    fechaVencimiento: fecha,
    tipoMoneda: "PEN",
    tipoPago: "Contado",
    cliente,
    company: { establecimientoAnexo: codEstablecimiento },
    totalOperacionesGravadas: gravadas,
    totalOperacionesExoneradas: 0,
    totalOperacionesInafectas: 0,
    totalIGV: igv,
    totalDescuentos: 0,
    descuentoGlobal: 0,
    importeTotal: +total.toFixed(2),
    montoCredito: 0,
    [esNV ? "detalles" : "details"]: detalles,
    pagos: [{ medioPago: "Efectivo", monto: +total.toFixed(2) }],
    cuotas: [],
    legends: esNV ? [] : [{ code: "1000", value: numeroAlertas(total, "SOLES") }],
    detracciones: [],
  };
}

function serieEjemplo(tipo: TipoComprobanteTicket, sucursal: Sucursal | null) {
  if (tipo === "01") return { serie: sucursal?.serieFactura || "F001", correlativo: sucursal?.correlativoFactura || 1 };
  if (tipo === "NV") return { serie: sucursal?.serieNotaVenta || "NV01", correlativo: sucursal?.correlativoNotaVenta || 1 };
  return { serie: sucursal?.serieBoleta || "B001", correlativo: sucursal?.correlativoBoleta || 1 };
}

export default function TicketsPage() {
  const { user, accessToken } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const { sucursal } = useSucursal();
  const { showToast } = useToast();

  const canEdit = user?.rol === "admin" || user?.rol === "superadmin";

  const [emisor, setEmisor] = useState<EmisorTicket | null>(null);
  const [errorEmisor, setErrorEmisor] = useState(false);
  const [perso, setPerso] = useState<TicketPersonalizado>(TICKET_POR_DEFECTO);
  const [guardado, setGuardado] = useState<TicketPersonalizado>(TICKET_POR_DEFECTO);
  const [tipo, setTipo] = useState<TipoComprobanteTicket>("03");
  const [anchoManual, setAnchoManual] = useState<58 | 80 | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [altoPreview, setAltoPreview] = useState(600);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const ancho: 58 | 80 = anchoManual ?? anchoTicketConfig(config?.tamañoImpresion) ?? 80;

  // La personalización guardada llega con la config; se copia una sola vez al
  // formulario (y otra vez tras guardar, cuando la config se recarga).
  const jsonGuardado = config?.ticketPersonalizado ?? null;
  useEffect(() => {
    if (loadingConfig) return;
    const leida = leerPersonalizacion(jsonGuardado);
    setPerso(leida);
    setGuardado(leida);
  }, [jsonGuardado, loadingConfig]);

  useEffect(() => {
    if (!user?.ruc || !accessToken) return;
    let vigente = true;
    obtenerEmisorTicket(user.ruc, accessToken).then((e) => {
      if (!vigente) return;
      setEmisor(e);
      setErrorEmisor(!e);
    });
    return () => {
      vigente = false;
    };
  }, [user?.ruc, accessToken]);

  const html = useMemo(() => {
    if (!emisor) return null;
    const { serie, correlativo } = serieEjemplo(tipo, sucursal);
    const igvPct = parseFloat(config?.igv ?? "18") || 18;
    const conTrabajador = !!config?.trabajadores;
    try {
      return construirHtmlComprobante({
        payload: payloadEjemplo(tipo, igvPct, sucursal?.codEstablecimiento ?? "0000", conTrabajador),
        tipo,
        serie,
        correlativo,
        emisor,
        sucursal,
        cajero: user?.username ?? null,
        trabajadores: conTrabajador ? [{ id: -1, nombres: "Juan", apellidos: "Pérez" }] : [],
        anchoMm: ancho,
        personalizacion: perso,
      });
    } catch {
      return null;
    }
  }, [emisor, tipo, sucursal, config?.igv, config?.trabajadores, user?.username, ancho, perso]);

  // Mide el papel para que la vista previa no deje espacio sobrante: el <body> del ticket
  // tiene el alto real del contenido (documentElement nunca baja del alto del iframe).
  //
  // No se usa onLoad: con srcDoc el iframe puede terminar de cargar antes de que React
  // enganche el handler, y en la primera carga no se disparaba nunca. Se mide por
  // reintentos hasta que dos medidas seguidas coinciden, que es cuando el QR y el logo ya
  // acabaron de pintarse.
  useEffect(() => {
    if (!html) return;
    let anterior = -1;
    let iguales = 0;
    const id = setInterval(() => {
      const doc = iframeRef.current?.contentDocument;
      const alto = doc?.body ? Math.ceil(doc.body.getBoundingClientRect().height) : 0;
      if (alto <= 0) return;
      setAltoPreview(Math.max(120, alto + 4));
      iguales = alto === anterior ? iguales + 1 : 0;
      anterior = alto;
      if (iguales >= 2) clearInterval(id);
    }, 60);
    const tope = setTimeout(() => clearInterval(id), 3000);
    return () => {
      clearInterval(id);
      clearTimeout(tope);
    };
  }, [html]);

  const hayCambios = JSON.stringify(normalizarPersonalizacion(perso)) !== JSON.stringify(guardado);

  const set = <K extends keyof TicketPersonalizado>(k: K, v: TicketPersonalizado[K]) =>
    setPerso((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!canEdit || !user?.ruc) return;
    setGuardando(true);
    try {
      const cuerpo = normalizarPersonalizacion(perso);
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/Configuracion/${user.ruc}/ticket`, cuerpo, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setGuardado(cuerpo);
      setPerso(cuerpo);
      showToast("Personalización del ticket guardada", "success");
      // Las cajas abiertas en esta sesión vuelven a pedir la config y usan el ticket nuevo.
      notificarConfiguracionActualizada();
    } catch {
      showToast("No se pudo guardar la personalización del ticket", "error");
    } finally {
      setGuardando(false);
    }
  };

  const imprimirPrueba = async () => {
    if (!html) return;
    const porAgente = await imprimirHtmlConAgente(html, ancho, { documento: "Ticket de prueba" }).catch(() => false);
    if (!porAgente) imprimirHtmlEnNavegador(html);
  };

  // El papel se mide por el <body>, no por documentElement: ese último nunca baja del alto
  // del propio iframe, así que al pasar de Boleta (con QR) a Nota de Venta se quedaba con el
  // alto anterior y dejaba un vacío enorme.
  if (loadingConfig || !config) {
    return (
      <div className="py-20 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    // Dos columnas desde arriba: la vista previa acompaña al título, no empieza debajo.
    <div className="flex-1 flex flex-col lg:flex-row items-start gap-4 pb-8">
      <div className="w-full lg:flex-1 lg:min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-brand-blue">Tickets</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Así se imprimen tus boletas, facturas y notas de venta en la ticketera
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPerso({ ...TICKET_POR_DEFECTO })}
              disabled={guardando}
              title="Volver al ticket estándar"
            >
              <RotateCcw className="w-4 h-4" /> Restablecer
            </Button>
            <Button onClick={guardar} disabled={guardando || !hayCambios}>
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </Button>
          </div>
        )}
      </div>

      <div
        className={`flex items-start gap-2 rounded-lg border p-3 ${
          config.impresionRapida ? "border-emerald-200 bg-emerald-50" : "border-blue-100 bg-blue-50"
        }`}
      >
        <Zap className={`w-4 h-4 shrink-0 mt-0.5 ${config.impresionRapida ? "text-emerald-600" : "text-brand-blue"}`} />
        <p className="text-xs text-gray-700 leading-relaxed">
          {config.impresionRapida ? (
            <>
              <span className="font-semibold">Impresión rápida activada:</span> al cobrar, el ticket
              sale tal como lo ves aquí, sin esperar a SUNAT.
            </>
          ) : (
            <>
              <span className="font-semibold">Impresión rápida desactivada.</span> El ticket tiene este
              mismo diseño, pero sale después de la respuesta de SUNAT. Puedes activarla en Empresa →
              Configuración → Impresión.
            </>
          )}{" "}
          La personalización se aplica también a los tickets que reimprimes desde Comprobantes.
        </p>
      </div>

        {/* ── Personalización ── */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
              <ReceiptText className="w-4 h-4 text-brand-blue" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Personalizar</p>
              <p className="text-xs text-gray-500">
                {canEdit ? "Los cambios se ven al instante en la vista previa" : "Solo un administrador puede modificarlo"}
              </p>
            </div>
          </div>

          <CampoTexto
            label="Mensaje al final del ticket"
            placeholder="¡Muchas gracias por su compra!"
            value={perso.mensajeFinal ?? ""}
            onChange={(v) => set("mensajeFinal", v)}
            disabled={!canEdit}
          />
          <CampoTexto
            label="Texto bajo los datos de la empresa"
            placeholder={"Atención: Lun a Sáb 9:00 am - 8:00 pm\nSíguenos en Facebook: @minegocio"}
            value={perso.textoCabecera ?? ""}
            onChange={(v) => set("textoCabecera", v)}
            disabled={!canEdit}
          />

          <div className="rounded-lg border border-gray-100 divide-y divide-gray-100">
            <Interruptor label="Logo de la empresa" checked={perso.mostrarLogo} onChange={(v) => set("mostrarLogo", v)} disabled={!canEdit} />
            <Interruptor label="Teléfono y correo" checked={perso.mostrarTelefonoEmail} onChange={(v) => set("mostrarTelefonoEmail", v)} disabled={!canEdit} />
            <Interruptor label="Nombre del cajero" checked={perso.mostrarCajero} onChange={(v) => set("mostrarCajero", v)} disabled={!canEdit} />
            {config.trabajadores && (
              <Interruptor label="Atendido por (trabajador)" checked={perso.mostrarAtendidoPor} onChange={(v) => set("mostrarAtendidoPor", v)} disabled={!canEdit} />
            )}
            <Interruptor label="Código de producto" checked={perso.mostrarCodigo} onChange={(v) => set("mostrarCodigo", v)} disabled={!canEdit} />
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <div>
                <p className="text-sm text-gray-800">Tamaño de letra</p>
                <p className="text-xs text-gray-400">&ldquo;Grande&rdquo; ayuda si tu ticketera imprime tenue</p>
              </div>
              <Segmentado
                opciones={[
                  { valor: "normal", label: "Normal" },
                  { valor: "grande", label: "Grande" },
                ]}
                valor={perso.tamanoLetra}
                onChange={(v) => set("tamanoLetra", v as TicketPersonalizado["tamanoLetra"])}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              No se pueden cambiar porque los exige SUNAT o son datos de la venta: RUC, tipo y número del
              comprobante, cliente, productos, precios, totales, importe en letras, forma de pago, QR y la
              frase &ldquo;Representación impresa&rdquo;.
            </p>
          </div>
        </div>
      </div>

      {/* ── Vista previa ── */}
      <div className="w-full lg:w-auto lg:shrink-0 lg:sticky lg:top-0 rounded-xl border border-gray-100 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Eye className="w-4 h-4 text-brand-blue" />
            <p className="text-sm font-bold text-gray-900 flex-1">Vista previa</p>
            <Segmentado
              opciones={[
                { valor: "58", label: "58 mm" },
                { valor: "80", label: "80 mm" },
              ]}
              valor={String(ancho)}
              onChange={(v) => setAnchoManual(v === "58" ? 58 : 80)}
            />
          </div>

          <Segmentado
            opciones={TIPOS.filter((t) => t.key !== "NV" || config.useNotaVenta).map((t) => ({ valor: t.key, label: t.label }))}
            valor={tipo}
            onChange={(v) => setTipo(v as TipoComprobanteTicket)}
            ancho
          />

          <div className="rounded-lg bg-gray-100 p-4 flex justify-center overflow-x-auto">
            {html ? (
              <iframe
                ref={iframeRef}
                title="Vista previa del ticket"
                srcDoc={html}
                scrolling="no"
                className="bg-white shadow-md border-0 shrink-0 overflow-hidden"
                // Área imprimible real: papel menos el margen de @page (1 mm en 58, 2 mm en 80).
                style={{ width: ancho === 58 ? "56mm" : "76mm", height: altoPreview, padding: ancho === 58 ? "1mm" : "2mm", boxSizing: "content-box" }}
              />
            ) : errorEmisor ? (
              <p className="py-16 text-sm text-gray-500 text-center max-w-60">No se pudieron cargar los datos de la empresa para la vista previa.</p>
            ) : (
              <Loader2 className="my-16 w-6 h-6 animate-spin text-brand-blue" />
            )}
          </div>

          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed flex-1">
              Productos y cliente de ejemplo. El papel usa tu configuración ({ancho} mm).
            </p>
          </div>

        <Button variant="outline" className="w-full" onClick={imprimirPrueba} disabled={!html}>
          <Printer className="w-4 h-4" /> Imprimir ticket de prueba
        </Button>
      </div>
    </div>
  );
}

function CampoTexto({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-[11px] text-gray-400 tabular-nums">
          {value.length}/{MAX_TEXTO_TICKET}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_TEXTO_TICKET))}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <span className="text-[11px] text-gray-400">Déjalo vacío para no mostrar nada. Puedes usar varias líneas.</span>
    </label>
  );
}

function Interruptor({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <p className="text-sm text-gray-800">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
          checked ? "bg-brand-blue" : "bg-gray-300"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

function Segmentado({
  opciones,
  valor,
  onChange,
  disabled,
  ancho,
}: {
  opciones: { valor: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ancho?: boolean;
}) {
  return (
    <div className={`flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold ${ancho ? "w-full" : ""}`}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.valor)}
          className={`px-3 py-1.5 transition-colors ${ancho ? "flex-1" : ""} ${
            valor === o.valor ? "bg-brand-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
