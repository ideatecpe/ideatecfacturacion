"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bike,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Palette,
  PlayCircle,
  Plus,
  Printer,
  RotateCcw,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { HorarioDia, TiendaOnlineConfig, pedidosOnlineApi, urlMesa, urlTiendaPublica } from "@/lib/pedidosOnline";
import { COLORES_TIENDA_ORIGINALES, contraste, luminancia, normalizarHex, variablesTemaTienda } from "@/lib/colores";
import { QrPersonalizado } from "./QrPersonalizado";

interface Props {
  sucursalId: number;
  entorno: string | null;
  accessToken: string | null;
  canEdit: boolean;
}

const CONFIG_INICIAL: TiendaOnlineConfig = {
  slug: null,
  activa: false,
  mensaje: null,
  aceptaEfectivo: true,
  aceptaTarjeta: true,
  aceptaYape: false,
  yapeNumero: null,
  yapeTitular: null,
  permiteRecojo: true,
  permiteMesa: true,
  mostrarAgotados: true,
  usaHorario: false,
  horaApertura: "08:00",
  horaCierre: "20:00",
  diasAtencion: [0, 1, 2, 3, 4, 5, 6],
  cerradaTemporalmente: false,
  horario: [],
  cantidadMesas: 0,
  permiteDelivery: false,
  costoDelivery: 0,
  pedidoMinimoDelivery: 0,
  deliveryGratisDesde: null,
  zonaDelivery: null,
  tiempoDelivery: null,
  colorPrimario: null,
  colorSecundario: null,
  colorFondo: null,
  colorTarjeta: null,
  qrColor: null,
  qrColor2: null,
  qrFondo: null,
};

/** Segundo color que se propone al pasar el QR a degradado. */
const SEGUNDO_COLOR_QR = "#2563EB";

const MAX_MESAS = 200;
const TURNO_POR_DEFECTO = { abre: "08:00", cierra: "20:00" };

/** Horas "HH:mm" a minutos, para saber si un turno cruza la medianoche. */
const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Monto en soles desde un input: vacío o inválido = 0, con 2 decimales como máximo. */
const leerMonto = (texto: string) => {
  const n = parseFloat(texto.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};

/** domingo=0 … sábado=6, en el orden en que se muestran (lunes primero). */
const DIAS_SEMANA: { valor: number; corta: string; larga: string }[] = [
  { valor: 1, corta: "L", larga: "Lunes" },
  { valor: 2, corta: "M", larga: "Martes" },
  { valor: 3, corta: "X", larga: "Miércoles" },
  { valor: 4, corta: "J", larga: "Jueves" },
  { valor: 5, corta: "V", larga: "Viernes" },
  { valor: 6, corta: "S", larga: "Sábado" },
  { valor: 0, corta: "D", larga: "Domingo" },
];

/** Mismo criterio que el backend: minúsculas, sin tildes, palabras separadas por guion. */
function aSlug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

/**
 * Configuración de la tienda online de la sucursal actual. Se guarda aparte de la
 * configuración general porque es por sucursal y tiene su propio enlace público.
 */
export function ConfigTiendaOnline({ sucursalId, entorno, accessToken, canEdit }: Props) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<TiendaOnlineConfig>(CONFIG_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardadoSlug, setGuardadoSlug] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    pedidosOnlineApi
      .obtenerConfig(sucursalId, accessToken)
      .then((c) => {
        setConfig(c);
        // Solo hay enlace publicado si la tienda ya se guardó alguna vez.
        setGuardadoSlug(c.activa ? c.slug : null);
      })
      .catch(() => showToast("No se pudo cargar la configuración de la tienda online", "error"))
      .finally(() => setCargando(false));
  }, [sucursalId, accessToken, showToast]);

  const cambiar = <K extends keyof TiendaOnlineConfig>(clave: K, valor: TiendaOnlineConfig[K]) =>
    setConfig((prev) => ({ ...prev, [clave]: valor }));

  // Activar el interruptor no basta con mostrar un valor por defecto en el campo de
  // hora: si el cajero no llega a tocarlo, ese valor nunca se guardaba en el estado y
  // "Guardar" fallaba con "Indica la hora de apertura/cierre". Se siembran los
  // valores por defecto en el estado mismo, en el momento de activar el horario.
  const activarHorario = (usar: boolean) => {
    setConfig((prev) => ({
      ...prev,
      usaHorario: usar,
      horario: prev.horario.length
        ? prev.horario
        : DIAS_SEMANA.map((d) => ({ dia: d.valor, ...TURNO_POR_DEFECTO })),
    }));
  };

  const turnoDe = (dia: number) => config.horario.find((t) => t.dia === dia);

  /** Cambia el turno de un día; null lo marca como cerrado. */
  const cambiarTurno = (dia: number, turno: Omit<HorarioDia, "dia"> | null) =>
    setConfig((prev) => {
      const resto = prev.horario.filter((t) => t.dia !== dia);
      return { ...prev, horario: turno ? [...resto, { dia, ...turno }] : resto };
    });

  /** "Copiar a todos": el horario del primer día abierto se aplica a los demás días abiertos. */
  const copiarHorarioATodos = () => {
    const modelo = DIAS_SEMANA.map((d) => turnoDe(d.valor)).find(Boolean);
    if (!modelo) return;
    setConfig((prev) => ({
      ...prev,
      horario: prev.horario.map((t) => ({ ...t, abre: modelo.abre, cierra: modelo.cierra })),
    }));
  };

  const enviarConfig = async (siguiente: TiendaOnlineConfig, mensajeExito: string) => {
    setGuardando(true);
    try {
      const guardada = await pedidosOnlineApi.guardarConfig(
        sucursalId,
        { ...siguiente, slug: (siguiente.slug ?? "").replace(/-+$/, "") },
        accessToken,
      );
      setConfig(guardada);
      setGuardadoSlug(guardada.activa ? guardada.slug : null);
      showToast(mensajeExito, "success");
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar la tienda online", "error");
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardar = () =>
    enviarConfig(config, config.activa ? "Tienda online publicada" : "Configuración guardada (tienda desactivada)");

  // Cierre de emergencia: un solo clic, sin pasar por el resto del formulario, para
  // cortar los pedidos al instante (se acabó un insumo clave, imprevisto en el local)
  // sin perder ni tocar el horario configurado.
  const alternarCierreEmergencia = () => {
    const cerrando = !config.cerradaTemporalmente;
    void enviarConfig(
      { ...config, cerradaTemporalmente: cerrando },
      cerrando ? "Tienda cerrada temporalmente" : "Tienda reabierta",
    );
  };

  const enlace = guardadoSlug ? urlTiendaPublica(guardadoSlug, entorno) : null;

  const coloresQr = { color: config.qrColor, color2: config.qrColor2, fondo: config.qrFondo };

  // Avisos de legibilidad: se puede guardar igual, pero el negocio sabe qué arriesga.
  const colorPrimario = config.colorPrimario ?? COLORES_TIENDA_ORIGINALES.primario;
  const principalMuyClaro = contraste(colorPrimario, "#FFFFFF") < 3;
  const qrColor = config.qrColor ?? COLORES_TIENDA_ORIGINALES.qr;
  const qrFondo = config.qrFondo ?? COLORES_TIENDA_ORIGINALES.qrFondo;
  const qrInvertido =
    luminancia(qrFondo) < luminancia(qrColor) || (!!config.qrColor2 && luminancia(qrFondo) < luminancia(config.qrColor2));
  const qrPocoContraste =
    Math.min(contraste(qrColor, qrFondo), config.qrColor2 ? contraste(config.qrColor2, qrFondo) : 21) < 3;

  const copiarEnlace = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      showToast("No se pudo copiar el enlace", "error");
    }
  };

  const descargarQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || !guardadoSlug) return;
    descargarSvgComoPng(svg, `qr-tienda-${guardadoSlug}.png`);
  };

  const mesasQrRef = useRef<HTMLDivElement>(null);
  const [mesaCopiada, setMesaCopiada] = useState<number | null>(null);

  const copiarEnlaceMesa = async (mesa: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMesaCopiada(mesa);
      setTimeout(() => setMesaCopiada((actual) => (actual === mesa ? null : actual)), 2000);
    } catch {
      showToast("No se pudo copiar el enlace", "error");
    }
  };

  const descargarQrMesa = (mesa: number) => {
    const svg = mesasQrRef.current?.querySelector(`[data-mesa="${mesa}"] svg`);
    if (svg instanceof SVGSVGElement && guardadoSlug) descargarSvgComoPng(svg, `qr-${guardadoSlug}-mesa-${mesa}.png`);
  };

  /** Hoja lista para imprimir con el QR de cada mesa, para recortar y poner en las mesas. */
  const imprimirQrMesas = () => {
    const tarjetas = [...(mesasQrRef.current?.querySelectorAll<HTMLElement>("[data-mesa]") ?? [])]
      .map((el) => {
        const svg = el.querySelector("svg")?.outerHTML ?? "";
        return `<div class="tarjeta"><p class="mesa">Mesa ${el.dataset.mesa}</p>${svg}<p class="texto">Escanea y haz tu pedido</p><p class="url">${el.dataset.url ?? ""}</p></div>`;
      })
      .join("");
    const ventana = window.open("", "_blank", "noopener=no,width=900,height=700");
    if (!ventana) {
      showToast("Permite las ventanas emergentes para imprimir los QR", "error");
      return;
    }
    ventana.document.write(`<!doctype html><html><head><title>QR de mesas</title><style>
      body{font-family:system-ui,sans-serif;margin:16px}
      .grilla{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .tarjeta{border:1px dashed #94a3b8;border-radius:12px;padding:14px;text-align:center;break-inside:avoid}
      .tarjeta > svg{width:170px;height:170px}
      .mesa{font-size:22px;font-weight:800;margin:0 0 8px;color:#0B1F49}
      .texto{font-size:12px;color:#475569;margin:8px 0 0}
      .url{font-size:9px;color:#94a3b8;margin:4px 0 0;word-break:break-all}
      @media print{body{margin:0}}
    </style></head><body><div class="grilla">${tarjetas}</div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
    ventana.document.close();
  };

  const descargarSvgComoPng = (svg: SVGSVGElement, nombreArchivo: string) => {
    const imagen = new Image();
    imagen.onload = () => {
      const lienzo = document.createElement("canvas");
      lienzo.width = lienzo.height = 1024;
      const ctx = lienzo.getContext("2d");
      if (!ctx) return;
      // Mismo fondo que el QR, para que el margen de la imagen no quede de otro color.
      ctx.fillStyle = svg.dataset.fondo ?? "#ffffff";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(imagen, 64, 64, 896, 896);
      const a = document.createElement("a");
      a.download = nombreArchivo;
      a.href = lienzo.toDataURL("image/png");
      a.click();
    };
    imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  };

  if (cargando) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-xs text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando tienda online…
      </div>
    );
  }

  const deshabilitado = !canEdit || guardando;

  return (
    <div className="space-y-px bg-gray-100">
      <div className="flex items-center gap-4 px-4 py-3 bg-white">
        <Interruptor checked={config.activa} onChange={(v) => cambiar("activa", v)} disabled={deshabilitado} />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-brand-blue" /> Tienda online
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Tus clientes piden desde el celular y el pedido llega a la Caja Autopago con alerta sonora.
          </p>
        </div>
      </div>

      {/* Cierre de emergencia: aparte del horario, para cortar los pedidos al
          instante sin tocar el resto de la configuración (ej. se acabó un insumo
          clave). Un clic aplica de una vez, sin pasar por "Guardar tienda online". */}
      {config.activa && (
        <div className={`px-4 py-3 flex items-center gap-3 ${config.cerradaTemporalmente ? "bg-rose-50" : "bg-white"}`}>
          {config.cerradaTemporalmente ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-gray-300 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${config.cerradaTemporalmente ? "text-rose-700" : "text-gray-800"}`}>
              {config.cerradaTemporalmente ? "Tienda cerrada temporalmente" : "Cierre de emergencia"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {config.cerradaTemporalmente
                ? "Los clientes ven \"cerrado\" sin importar el horario. Reabre cuando quieras."
                : "Corta los pedidos ahora mismo, sin tocar el horario ni el resto de la configuración."}
            </p>
          </div>
          <button
            type="button"
            onClick={alternarCierreEmergencia}
            disabled={!canEdit || guardando}
            className={`shrink-0 h-9 px-3.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
              config.cerradaTemporalmente
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
          >
            {guardando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : config.cerradaTemporalmente ? (
              <PlayCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {config.cerradaTemporalmente ? "Reabrir tienda" : "Cerrar ahora"}
          </button>
        </div>
      )}

      <div className="px-4 py-3 bg-white space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Enlace de tu tienda</span>
          <div className="mt-1 flex items-stretch rounded-md border border-gray-200 overflow-hidden focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
            <span className="hidden sm:flex items-center px-2.5 bg-gray-50 text-xs text-gray-400 border-r border-gray-200 whitespace-nowrap">
              {typeof window !== "undefined" ? window.location.host : "factufly.pe"}/tienda/
            </span>
            <input
              value={config.slug ?? ""}
              onChange={(e) => cambiar("slug", aSlug(e.target.value))}
              disabled={deshabilitado}
              placeholder="nombre-de-tu-tienda"
              className="flex-1 min-w-0 h-9 px-2.5 text-sm outline-none disabled:bg-gray-50"
            />
          </div>
        </label>

        {enlace && (
          <div className="flex flex-col sm:flex-row gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div ref={qrRef} className="shrink-0 self-center rounded-md bg-white p-2 border border-gray-200">
              <QrPersonalizado valor={enlace} tamano={112} colores={coloresQr} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-gray-500">
                Enlace general: compártelo por WhatsApp o redes. Para las mesas usa sus QR propios (más abajo).
              </p>
              <p className="text-xs font-semibold text-brand-blue break-all">{enlace}</p>
              <div className="flex flex-wrap gap-2">
                <BotonSecundario onClick={copiarEnlace}>
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado ? "Copiado" : "Copiar enlace"}
                </BotonSecundario>
                <BotonSecundario onClick={() => window.open(enlace, "_blank", "noopener")}>
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir tienda
                </BotonSecundario>
                <BotonSecundario onClick={descargarQr}>
                  <Download className="w-3.5 h-3.5" /> Descargar QR
                </BotonSecundario>
              </div>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Mensaje de bienvenida (opcional)</span>
          <textarea
            value={config.mensaje ?? ""}
            onChange={(e) => cambiar("mensaje", e.target.value.slice(0, 300))}
            disabled={deshabilitado}
            rows={2}
            placeholder="Ej.: Pide desde tu mesa y te lo llevamos en minutos"
            className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm outline-none resize-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
          />
        </label>
      </div>

      {/* ── Colores de la tienda y de los QR ── */}
      <div className="px-4 py-4 bg-white space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-brand-blue" /> Colores de tu tienda
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Los colores de tu marca. Al guardar, tu tienda y tus QR los usan de inmediato.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectorColor
                etiqueta="Color principal"
                ayuda="Barra superior, portada y botones"
                valor={config.colorPrimario}
                porDefecto={COLORES_TIENDA_ORIGINALES.primario}
                onChange={(v) => cambiar("colorPrimario", v)}
                disabled={deshabilitado}
              />
              <SelectorColor
                etiqueta="Color secundario"
                ayuda="Destacados, contador y combos"
                valor={config.colorSecundario}
                porDefecto={COLORES_TIENDA_ORIGINALES.secundario}
                onChange={(v) => cambiar("colorSecundario", v)}
                disabled={deshabilitado}
              />
              <SelectorColor
                etiqueta="Fondo de la tienda"
                ayuda="Fondo de página y catálogo"
                valor={config.colorFondo}
                porDefecto={COLORES_TIENDA_ORIGINALES.fondo}
                onChange={(v) => cambiar("colorFondo", v)}
                disabled={deshabilitado}
              />
              <SelectorColor
                etiqueta="Fondo de tarjetas"
                ayuda="Superficie de productos y paneles"
                valor={config.colorTarjeta}
                porDefecto={COLORES_TIENDA_ORIGINALES.tarjeta}
                onChange={(v) => cambiar("colorTarjeta", v)}
                disabled={deshabilitado}
              />
            </div>
            {principalMuyClaro && (
              <Aviso>
                Tu color principal es claro: los textos blancos de la portada se leerán poco. Para la barra y la
                portada funciona mejor un tono oscuro.
              </Aviso>
            )}
          </div>
          <VistaPreviaTienda
            primario={config.colorPrimario}
            secundario={config.colorSecundario}
            fondo={config.colorFondo}
            tarjeta={config.colorTarjeta}
          />
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-700">Colores de los QR</p>
              <div className="inline-flex rounded-md border border-gray-200 p-0.5 text-xs font-semibold">
                {(["Un color", "Degradado"] as const).map((estilo) => {
                  const activo = estilo === "Degradado" ? !!config.qrColor2 : !config.qrColor2;
                  return (
                    <button
                      key={estilo}
                      type="button"
                      disabled={deshabilitado}
                      onClick={() => cambiar("qrColor2", estilo === "Degradado" ? (config.qrColor2 ?? SEGUNDO_COLOR_QR) : null)}
                      className={`px-3 h-7 rounded transition-colors disabled:opacity-50 ${
                        activo ? "bg-brand-blue text-white" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {estilo}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectorColor
                etiqueta={config.qrColor2 ? "Color inicial" : "Color del código"}
                valor={config.qrColor}
                porDefecto={COLORES_TIENDA_ORIGINALES.qr}
                onChange={(v) => cambiar("qrColor", v)}
                disabled={deshabilitado}
              />
              {config.qrColor2 && (
                <SelectorColor
                  key="segundo-color"
                  etiqueta="Color final"
                  valor={config.qrColor2}
                  porDefecto={SEGUNDO_COLOR_QR}
                  onChange={(v) => cambiar("qrColor2", v ?? SEGUNDO_COLOR_QR)}
                  disabled={deshabilitado}
                />
              )}
              <SelectorColor
                etiqueta="Fondo"
                valor={config.qrFondo}
                porDefecto={COLORES_TIENDA_ORIGINALES.qrFondo}
                onChange={(v) => cambiar("qrFondo", v)}
                disabled={deshabilitado}
              />
            </div>
            {qrInvertido ? (
              <Aviso>El fondo del QR debe ser más claro que el código: con colores invertidos muchos celulares no lo leen.</Aviso>
            ) : (
              qrPocoContraste && (
                <Aviso>Hay poco contraste entre el código y el fondo: algunos celulares podrían no leer el QR.</Aviso>
              )
            )}
            <p className="text-[11px] text-gray-400">
              Se aplica al QR general y al de cada mesa, al verlos, descargarlos e imprimirlos.
            </p>
          </div>
          <div className="justify-self-center rounded-lg border border-gray-200 p-3 text-center space-y-1.5">
            <QrPersonalizado valor={enlace ?? "https://factufly.pe"} tamano={132} colores={coloresQr} />
            <p className="text-[11px] text-gray-400">Vista previa</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-white">
        <p className="text-xs font-semibold text-gray-700 mb-2">Medios de pago</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Opcion etiqueta="Efectivo" checked={config.aceptaEfectivo} onChange={(v) => cambiar("aceptaEfectivo", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Tarjeta (POS)" checked={config.aceptaTarjeta} onChange={(v) => cambiar("aceptaTarjeta", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Yape" checked={config.aceptaYape} onChange={(v) => cambiar("aceptaYape", v)} disabled={deshabilitado} />
        </div>
        {config.aceptaYape && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Celular de Yape</span>
              <input
                value={config.yapeNumero ?? ""}
                onChange={(e) => cambiar("yapeNumero", e.target.value.replace(/\D/g, "").slice(0, 9))}
                disabled={deshabilitado}
                inputMode="numeric"
                placeholder="9 dígitos"
                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Titular (como aparece en Yape)</span>
              <input
                value={config.yapeTitular ?? ""}
                onChange={(e) => cambiar("yapeTitular", e.target.value.slice(0, 100))}
                disabled={deshabilitado}
                placeholder="Ej.: Juan P. Pérez"
                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
              />
            </label>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-white">
        <p className="text-xs font-semibold text-gray-700 mb-2">Entrega y catálogo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Opcion etiqueta="Recojo en caja" checked={config.permiteRecojo} onChange={(v) => cambiar("permiteRecojo", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Llevar a la mesa" checked={config.permiteMesa} onChange={(v) => cambiar("permiteMesa", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Delivery" checked={config.permiteDelivery} onChange={(v) => cambiar("permiteDelivery", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Mostrar agotados" checked={config.mostrarAgotados} onChange={(v) => cambiar("mostrarAgotados", v)} disabled={deshabilitado} />
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {config.mostrarAgotados
            ? "Un producto sin stock sigue apareciendo en la tienda, marcado como \"Agotado\" (el cliente no puede pedirlo)."
            : "Un producto sin stock desaparece por completo de la tienda: el cliente ni lo ve."}
        </p>
      </div>

      {/* ── Mesas con QR propio ── */}
      {config.permiteMesa && (
        <div className="px-4 py-3 bg-white space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-52">
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-brand-blue" /> Mesas con QR
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Cada mesa tiene su QR: el pedido llega a la caja como &quot;Mesa 3&quot; y el cliente ya no elige cómo recibirlo.
                Con 0, el cliente elige &quot;Llevar a mi mesa&quot; y lo ubican por su nombre.
              </p>
            </div>
            <label className="block w-32">
              <span className="text-xs font-medium text-gray-600">Cantidad de mesas</span>
              <input
                type="number"
                min={0}
                max={MAX_MESAS}
                value={config.cantidadMesas || ""}
                onChange={(e) =>
                  cambiar("cantidadMesas", Math.min(MAX_MESAS, Math.max(0, parseInt(e.target.value, 10) || 0)))
                }
                disabled={deshabilitado}
                placeholder="0"
                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm tabular-nums outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
              />
            </label>
          </div>

          {config.cantidadMesas > 0 &&
            (!enlace ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Guarda la tienda online (activa) para generar los QR de las mesas.
              </p>
            ) : (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {config.cantidadMesas} {config.cantidadMesas === 1 ? "mesa" : "mesas"}. Imprímelos y pega cada uno en su mesa.
                  </p>
                  <BotonSecundario onClick={imprimirQrMesas}>
                    <Printer className="w-3.5 h-3.5" /> Imprimir todos
                  </BotonSecundario>
                </div>
                <div
                  ref={mesasQrRef}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[28rem] overflow-y-auto pr-1"
                >
                  {Array.from({ length: config.cantidadMesas }, (_, i) => i + 1).map((mesa) => {
                    const enlaceMesa = urlMesa(enlace, mesa);
                    return (
                      <div
                        key={mesa}
                        data-mesa={mesa}
                        data-url={enlaceMesa}
                        className="rounded-md border border-gray-200 bg-white p-2 flex flex-col items-center gap-1.5 min-w-0"
                      >
                        <p className="text-xs font-bold text-gray-800">Mesa {mesa}</p>
                        <QrPersonalizado valor={enlaceMesa} tamano={88} colores={coloresQr} />
                        <p className="w-full text-center text-[10px] leading-snug text-brand-blue break-all select-all" title={enlaceMesa}>
                          {enlaceMesa}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => copiarEnlaceMesa(mesa, enlaceMesa)}
                            className="text-[11px] font-semibold text-brand-blue hover:underline flex items-center gap-1"
                          >
                            {mesaCopiada === mesa ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {mesaCopiada === mesa ? "Copiado" : "Copiar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => descargarQrMesa(mesa)}
                            className="text-[11px] font-semibold text-brand-blue hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Descargar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── Delivery ── */}
      {config.permiteDelivery && (
        <div className="px-4 py-3 bg-white space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-brand-blue" /> Delivery
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              El cliente deja su dirección, referencia y celular (y si quiere, su ubicación). El envío se suma al total y en caja se cobra como una línea más.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CampoMonto
              etiqueta="Costo de envío"
              valor={config.costoDelivery}
              onChange={(v) => cambiar("costoDelivery", v ?? 0)}
              disabled={deshabilitado}
              placeholder="0.00 = gratis"
            />
            <CampoMonto
              etiqueta="Pedido mínimo"
              valor={config.pedidoMinimoDelivery}
              onChange={(v) => cambiar("pedidoMinimoDelivery", v ?? 0)}
              disabled={deshabilitado}
              placeholder="Sin mínimo"
            />
            <CampoMonto
              etiqueta="Envío gratis desde (opcional)"
              valor={config.deliveryGratisDesde}
              onChange={(v) => cambiar("deliveryGratisDesde", v && v > 0 ? v : null)}
              disabled={deshabilitado}
              placeholder="Nunca"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Zona de reparto (opcional)</span>
              <input
                value={config.zonaDelivery ?? ""}
                onChange={(e) => cambiar("zonaDelivery", e.target.value.slice(0, 200))}
                disabled={deshabilitado}
                placeholder="Ej.: Solo Cercado de Cajamarca y Baños del Inca"
                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Tiempo estimado (opcional)</span>
              <input
                value={config.tiempoDelivery ?? ""}
                onChange={(e) => cambiar("tiempoDelivery", e.target.value.slice(0, 40))}
                disabled={deshabilitado}
                placeholder="Ej.: 30 a 45 min"
                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
              />
            </label>
          </div>
        </div>
      )}

      <div className="px-4 py-3 bg-white">
        <div className="flex items-center gap-4">
          <Interruptor checked={config.usaHorario} onChange={activarHorario} disabled={deshabilitado} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-blue" /> Horario de atención
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {config.usaHorario
                ? "Fuera de este horario, el enlace muestra \"cerrado\" y la hora en que vuelves a abrir."
                : "Desactivado: la tienda queda abierta las 24 horas mientras \"Tienda online\" esté activa."}
            </p>
          </div>
        </div>

        {config.usaHorario && (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-gray-100 divide-y divide-gray-100">
              {DIAS_SEMANA.map((d) => {
                const turno = turnoDe(d.valor);
                const cruzaMedianoche = !!turno && aMinutos(turno.cierra) <= aMinutos(turno.abre);
                return (
                  <div key={d.valor} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                    <div className="flex items-center gap-2.5 w-32">
                      <Interruptor
                        checked={!!turno}
                        onChange={(abierto) => cambiarTurno(d.valor, abierto ? { ...TURNO_POR_DEFECTO } : null)}
                        disabled={deshabilitado}
                      />
                      <span className={`text-sm font-medium ${turno ? "text-gray-800" : "text-gray-400"}`}>{d.larga}</span>
                    </div>
                    {turno ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={turno.abre}
                          onChange={(e) => cambiarTurno(d.valor, { abre: e.target.value, cierra: turno.cierra })}
                          disabled={deshabilitado}
                          aria-label={`Hora de apertura del ${d.larga}`}
                          className="h-8 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
                        />
                        <span className="text-xs text-gray-400">a</span>
                        <input
                          type="time"
                          value={turno.cierra}
                          onChange={(e) => cambiarTurno(d.valor, { abre: turno.abre, cierra: e.target.value })}
                          disabled={deshabilitado}
                          aria-label={`Hora de cierre del ${d.larga}`}
                          className="h-8 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
                        />
                        {cruzaMedianoche && (
                          <span className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                            cierra al día siguiente
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>
            {canEdit && config.horario.length > 1 && (
              <button
                type="button"
                onClick={copiarHorarioATodos}
                disabled={deshabilitado}
                className="text-xs font-semibold text-brand-blue hover:underline disabled:opacity-50"
              >
                Copiar el horario del primer día a todos los días abiertos
              </button>
            )}
            <p className="text-[11px] text-gray-400">
              ¿Cierras después de medianoche? Pon la hora real de cierre (ej. 18:00 a 02:00): cuenta como el mismo día.
            </p>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="px-4 py-3 bg-white flex justify-end">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="h-9 px-4 rounded-md bg-brand-blue text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0a2050] disabled:opacity-50"
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar tienda online
          </button>
        </div>
      )}
    </div>
  );
}

function Interruptor({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-brand-blue" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Opcion({
  etiqueta,
  checked,
  onChange,
  disabled,
}: {
  etiqueta: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2.5 rounded-md border px-3 py-2 ${checked ? "border-brand-blue/40 bg-blue-50/40" : "border-gray-200"}`}>
      <Interruptor checked={checked} onChange={onChange} disabled={disabled} />
      <span className="text-xs font-medium text-gray-700">{etiqueta}</span>
    </label>
  );
}

/**
 * Color con selector visual y campo hexadecimal. El campo guarda lo que se está
 * escribiendo y solo avisa cuando ya es un color completo (#RRGGBB).
 */
function SelectorColor({
  etiqueta,
  ayuda,
  valor,
  porDefecto,
  onChange,
  disabled,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: string | null;
  porDefecto: string;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const efectivo = valor ?? porDefecto;
  const [texto, setTexto] = useState(efectivo.replace("#", ""));

  useEffect(() => {
    setTexto(efectivo.replace("#", ""));
  }, [efectivo]);

  const elegir = (hex: string | null) => {
    setTexto((hex ?? porDefecto).replace("#", ""));
    onChange(hex);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{etiqueta}</span>
        {valor && !disabled && (
          <button
            type="button"
            onClick={() => elegir(null)}
            className="text-[11px] font-semibold text-gray-400 hover:text-brand-blue flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Original
          </button>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={efectivo.toLowerCase()}
          onChange={(e) => elegir(e.target.value.toUpperCase())}
          disabled={disabled}
          aria-label={`${etiqueta}: elegir color`}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-gray-200 bg-white p-0.5 disabled:cursor-not-allowed"
        />
        <div className="flex items-stretch rounded-md border border-gray-200 overflow-hidden focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
          <span className="flex items-center pl-2.5 pr-1 bg-gray-50 text-xs font-semibold text-gray-400">#</span>
          <input
            value={texto}
            onChange={(e) => {
              const limpio = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
              setTexto(limpio);
              if (limpio.length === 6) onChange(normalizarHex(limpio));
            }}
            onBlur={() => setTexto(efectivo.replace("#", ""))}
            disabled={disabled}
            aria-label={`${etiqueta}: código hexadecimal`}
            placeholder="0B1F49"
            className="w-20 h-9 px-1.5 text-sm font-mono uppercase outline-none disabled:bg-gray-50"
          />
        </div>
      </div>
      {ayuda && <p className="mt-1 text-[11px] text-gray-400">{ayuda}</p>}
    </div>
  );
}

/** Miniatura de la tienda con los 4 colores elegidos, para ver el resultado antes de guardar. */
function VistaPreviaTienda({
  primario,
  secundario,
  fondo,
  tarjeta,
}: {
  primario: string | null;
  secundario: string | null;
  fondo?: string | null;
  tarjeta?: string | null;
}) {
  const t = variablesTemaTienda(primario, secundario, fondo, tarjeta);
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden text-[11px] select-none shadow-sm" aria-hidden>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: t["--t-pri"], color: t["--t-sobre-pri"] }}>
        <span className="font-black tracking-tight">TU TIENDA</span>
        <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ background: t["--t-pri-claro"] }}>
          Mi pedido
          <span className="rounded-full px-1.5 font-bold" style={{ background: t["--t-sec"], color: t["--t-sobre-sec"] }}>
            2
          </span>
        </span>
      </div>
      <div className="px-3 pt-3 pb-4" style={{ background: t["--t-pri"], color: t["--t-sobre-pri"] }}>
        <p className="text-sm font-extrabold leading-tight">
          Haz tu pedido <span style={{ color: t["--t-sec"] }}>desde donde estés</span>
        </p>
        <span
          className="mt-2 inline-block rounded-full px-3 py-1 font-bold"
          style={{ background: t["--t-sec"], color: t["--t-sobre-sec"] }}
        >
          Ver combos
        </span>
      </div>
      <div className="p-3 flex items-center justify-between gap-2" style={{ background: t["--t-fondo"], color: t["--t-sobre-fondo"] }}>
        <div
          className="rounded-lg border px-2.5 py-2 flex-1 shadow-sm"
          style={{ background: t["--t-tarjeta"], color: t["--t-sobre-tarjeta"], borderColor: t["--t-tarjeta-borde"] }}
        >
          <p className="font-semibold" style={{ color: t["--t-sobre-tarjeta"] }}>Producto</p>
          <p className="font-black" style={{ color: t["--t-pri"] }}>S/ 5.00</p>
        </div>
        <span
          className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center"
          style={{ background: t["--t-pri"], color: t["--t-sobre-pri"] }}
        >
          <Plus className="w-3.5 h-3.5" />
        </span>
        <span className="rounded-lg px-3 py-2 font-bold" style={{ background: t["--t-pri"], color: t["--t-sobre-pri"] }}>
          Enviar pedido
        </span>
      </div>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  );
}

/** Monto en soles. Mantiene lo escrito mientras se edita y lo normaliza al salir del campo. */
function CampoMonto({
  etiqueta,
  valor,
  onChange,
  disabled,
  placeholder,
}: {
  etiqueta: string;
  valor: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(valor ? valor.toFixed(2) : "");
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{etiqueta}</span>
      <div className="mt-1 flex items-stretch rounded-md border border-gray-200 overflow-hidden focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
        <span className="flex items-center px-2.5 bg-gray-50 text-xs font-semibold text-gray-400 border-r border-gray-200">S/</span>
        <input
          value={texto}
          onChange={(e) => {
            const limpio = e.target.value.replace(/[^\d.,]/g, "").slice(0, 8);
            setTexto(limpio);
            onChange(limpio ? leerMonto(limpio) : null);
          }}
          onBlur={() => setTexto(texto ? leerMonto(texto).toFixed(2) : "")}
          disabled={disabled}
          inputMode="decimal"
          placeholder={placeholder}
          className="flex-1 min-w-0 h-9 px-2.5 text-sm tabular-nums outline-none disabled:bg-gray-50"
        />
      </div>
    </label>
  );
}

function BotonSecundario({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-2.5 rounded-md border border-gray-200 bg-white text-xs font-semibold text-gray-600 flex items-center gap-1.5 hover:text-brand-blue hover:border-brand-blue/40"
    >
      {children}
    </button>
  );
}
