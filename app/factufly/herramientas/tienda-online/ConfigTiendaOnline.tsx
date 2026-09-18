"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clock, Copy, Download, ExternalLink, Loader2, PlayCircle, ShoppingBag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/app/components/ui/Toast";
import { TiendaOnlineConfig, pedidosOnlineApi, urlTiendaPublica } from "@/lib/pedidosOnline";

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
      horaApertura: prev.horaApertura ?? "08:00",
      horaCierre: prev.horaCierre ?? "20:00",
      diasAtencion: prev.diasAtencion.length ? prev.diasAtencion : [0, 1, 2, 3, 4, 5, 6],
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
    const imagen = new Image();
    imagen.onload = () => {
      const lienzo = document.createElement("canvas");
      lienzo.width = lienzo.height = 1024;
      const ctx = lienzo.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(imagen, 64, 64, 896, 896);
      const a = document.createElement("a");
      a.download = `qr-tienda-${guardadoSlug}.png`;
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
              <QRCodeSVG value={enlace} size={112} level="M" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-gray-500">
                Comparte el enlace por WhatsApp o imprime el QR. Para una mesa específica agrega{" "}
                <code className="rounded bg-white px-1 border border-gray-200">?mesa=5</code> al enlace.
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Opcion etiqueta="Recojo en caja" checked={config.permiteRecojo} onChange={(v) => cambiar("permiteRecojo", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Llevar a la mesa" checked={config.permiteMesa} onChange={(v) => cambiar("permiteMesa", v)} disabled={deshabilitado} />
          <Opcion etiqueta="Mostrar agotados" checked={config.mostrarAgotados} onChange={(v) => cambiar("mostrarAgotados", v)} disabled={deshabilitado} />
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {config.mostrarAgotados
            ? "Un producto sin stock sigue apareciendo en la tienda, marcado como \"Agotado\" (el cliente no puede pedirlo)."
            : "Un producto sin stock desaparece por completo de la tienda: el cliente ni lo ve."}
        </p>
      </div>

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
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Abre</span>
                <input
                  type="time"
                  value={config.horaApertura ?? "08:00"}
                  onChange={(e) => cambiar("horaApertura", e.target.value)}
                  disabled={deshabilitado}
                  className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Cierra</span>
                <input
                  type="time"
                  value={config.horaCierre ?? "20:00"}
                  onChange={(e) => cambiar("horaCierre", e.target.value)}
                  disabled={deshabilitado}
                  className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
                />
              </label>
            </div>
            <p className="text-[11px] text-gray-400">
              Si cierras después de medianoche (ej. abre 6:00 p. m. y cierra 2:00 a. m.), pon la hora de cierre igual: 02:00.
            </p>

            <div>
              <span className="text-xs font-medium text-gray-600">Días de atención</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((d) => {
                  const activo = config.diasAtencion.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      disabled={deshabilitado}
                      title={d.larga}
                      onClick={() =>
                        cambiar(
                          "diasAtencion",
                          activo ? config.diasAtencion.filter((v) => v !== d.valor) : [...config.diasAtencion, d.valor],
                        )
                      }
                      className={`h-9 w-9 rounded-full text-xs font-bold border transition-colors ${
                        activo
                          ? "bg-brand-blue border-brand-blue text-white"
                          : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {d.corta}
                    </button>
                  );
                })}
              </div>
            </div>
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
