"use client";

import { useEffect, useRef, useState } from "react";
import { Bike, Check, Circle, Crosshair, Hexagon, Infinity as SinLimite, Loader2, MapPin, Route, Trash2, Undo2 } from "lucide-react";
import MapaUbicacion from "@/app/components/mapas/MapaUbicacion";
import EditorZonaReparto, { ModoZona, RADIO_MAX_KM, RADIO_MIN_KM } from "@/app/components/mapas/EditorZonaReparto";
import { Coordenadas, direccionDe, ubicacionActual } from "@/lib/mapas";
import { TiendaOnlineConfig, costoPorDistancia } from "@/lib/pedidosOnline";

interface Props {
  config: TiendaOnlineConfig;
  cambiar: <K extends keyof TiendaOnlineConfig>(clave: K, valor: TiendaOnlineConfig[K]) => void;
  disabled: boolean;
}

const KM_EJEMPLO = [1, 3, 5, 10];
/** Radio con el que arranca el círculo si todavía no había uno. */
const RADIO_INICIAL_KM = 3;

type Zona = "NINGUNA" | ModoZona;

const leer = (t: string) => {
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Delivery de la tienda online: dónde está el local (en el mapa), hasta dónde se reparte
 * (un círculo o una zona dibujada) y cómo se cobra el envío (fijo o según los km por calles).
 */
export default function ConfigDelivery({ config, cambiar, disabled }: Props) {
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);

  const tienda: Coordenadas | null =
    config.latitudTienda != null && config.longitudTienda != null
      ? { lat: config.latitudTienda, lng: config.longitudTienda }
      : null;
  const porDistancia = config.modoCostoDelivery === "DISTANCIA";

  // ── Dirección de la tienda: se rellena sola con el punto del mapa (o lo que se buscó) y
  //    se puede corregir a mano, p. ej. para agregar el número ("Jr. Tarapacá 478").
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [direccionSinLeer, setDireccionSinLeer] = useState(false);
  const consultaDireccion = useRef(0);

  const completarDireccion = async (c: Coordenadas) => {
    const consulta = ++consultaDireccion.current;
    setBuscandoDireccion(true);
    setDireccionSinLeer(false);
    const texto = await direccionDe(c);
    if (consulta !== consultaDireccion.current) return;
    setBuscandoDireccion(false);
    if (texto) cambiar("direccionTienda", texto);
    else setDireccionSinLeer(true);
  };

  // Tienda ya ubicada pero sin dirección guardada (configurada antes de este campo).
  const completadaAlAbrir = useRef(false);
  useEffect(() => {
    if (completadaAlAbrir.current || !tienda || config.direccionTienda) return;
    completadaAlAbrir.current = true;
    void completarDireccion(tienda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tienda?.lat, tienda?.lng, config.direccionTienda]);

  const ponerUbicacion = (c: Coordenadas, direccionBuscada?: string) => {
    cambiar("latitudTienda", Math.round(c.lat * 1e6) / 1e6);
    cambiar("longitudTienda", Math.round(c.lng * 1e6) / 1e6);
    if (direccionBuscada) {
      consultaDireccion.current++;
      setBuscandoDireccion(false);
      setDireccionSinLeer(false);
      cambiar("direccionTienda", direccionBuscada);
    } else {
      void completarDireccion(c);
    }
  };

  const usarMiUbicacion = async () => {
    setBuscandoUbicacion(true);
    setAvisoUbicacion(null);
    try {
      ponerUbicacion(await ubicacionActual());
    } catch (e) {
      setAvisoUbicacion(e instanceof Error ? e.message : "No se pudo obtener tu ubicación.");
    } finally {
      setBuscandoUbicacion(false);
    }
  };

  // ── Zona de reparto ──
  const [zona, setZona] = useState<Zona>(
    config.zonaPoligono && config.zonaPoligono.length > 0 ? "POLIGONO" : config.radioDeliveryKm ? "CIRCULO" : "NINGUNA",
  );
  const puntos = config.zonaPoligono ?? [];

  const elegirZona = (nueva: Zona) => {
    setZona(nueva);
    if (nueva === "CIRCULO") {
      cambiar("radioDeliveryKm", config.radioDeliveryKm || RADIO_INICIAL_KM);
      cambiar("zonaPoligono", null);
    } else if (nueva === "POLIGONO") {
      cambiar("radioDeliveryKm", null);
      cambiar("zonaPoligono", config.zonaPoligono ?? []);
    } else {
      cambiar("radioDeliveryKm", null);
      cambiar("zonaPoligono", null);
    }
  };

  return (
    <div className="px-4 py-3 bg-white space-y-5">
      <div>
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
          <Bike className="w-3.5 h-3.5 text-brand-blue" /> Delivery
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          El cliente marca en el mapa dónde le llevas el pedido. Se calcula la distancia por calles desde tu tienda y, si
          quieres, el costo del envío según los km. El envío se suma al total y en caja se cobra como una línea más.
        </p>
      </div>

      {/* 1. Ubicación de la tienda */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400" /> ¿Dónde está tu tienda?
          </p>
          {tienda ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="w-3 h-3" /> Ubicación marcada
            </span>
          ) : (
            <span className="text-[11px] font-medium text-amber-700">Sin marcar: no se calcula la distancia ni la zona</span>
          )}
        </div>
        <MapaUbicacion
          posicion={tienda}
          onCambiar={ponerUbicacion}
          referencia={null}
          radioKm={null}
          conBuscador
          placeholderBuscador="Busca la dirección de tu tienda"
          alto={240}
          ampliable
          disabled={disabled}
        />
        {tienda && (
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Dirección de la tienda</span>
            <div className="mt-1 flex items-center rounded-md border border-gray-200 bg-white focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
              <MapPin className="ml-2.5 w-3.5 h-3.5 shrink-0 text-rose-500" />
              <input
                value={config.direccionTienda ?? ""}
                onChange={(e) => {
                  consultaDireccion.current++;
                  setBuscandoDireccion(false);
                  setDireccionSinLeer(false);
                  cambiar("direccionTienda", e.target.value.slice(0, 200));
                }}
                disabled={disabled}
                placeholder={buscandoDireccion ? "Buscando la dirección…" : "Ej.: Jr. Tarapacá 478, Cajamarca"}
                className="flex-1 min-w-0 h-9 px-2 text-sm outline-none bg-transparent disabled:bg-gray-50"
              />
              {buscandoDireccion && <Loader2 className="mr-2.5 w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
            <span className="mt-1 block text-[11px] text-gray-400">
              {direccionSinLeer
                ? "No pudimos leer la dirección de este punto: escríbela tú."
                : "Se completa sola al marcar el mapa. Corrígela si hace falta (número, interior, referencia)."}
            </span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void usarMiUbicacion()}
            disabled={disabled || buscandoUbicacion}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 text-xs font-semibold text-gray-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
          >
            {buscandoUbicacion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
            Estoy en la tienda: usar mi ubicación
          </button>
          <p className="text-[11px] text-gray-400">O busca la dirección, toca el mapa o arrastra el pin hasta la puerta de tu local.</p>
        </div>
        {avisoUbicacion && <p className="text-[11px] text-rose-600">{avisoUbicacion}</p>}
      </section>

      {/* 2. Zona de reparto */}
      <section className="space-y-2">
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Route className="w-3.5 h-3.5 text-gray-400" /> ¿Hasta dónde repartes?
        </p>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          {(
            [
              ["NINGUNA", "Sin límite", SinLimite],
              ["CIRCULO", "Círculo", Circle],
              ["POLIGONO", "Dibujar zona", Hexagon],
            ] as const
          ).map(([valor, etiqueta, Icono]) => (
            <button
              key={valor}
              type="button"
              disabled={disabled || (valor !== "NINGUNA" && !tienda)}
              onClick={() => elegirZona(valor)}
              title={valor !== "NINGUNA" && !tienda ? "Marca primero tu tienda en el mapa" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors disabled:opacity-50 ${
                zona === valor ? "bg-brand-blue text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icono className="w-3.5 h-3.5" /> {etiqueta}
            </button>
          ))}
        </div>

        {!tienda ? (
          <p className="text-[11px] text-gray-400">Marca primero tu tienda en el mapa para limitar la zona de reparto.</p>
        ) : zona === "NINGUNA" ? (
          <p className="text-[11px] text-gray-400">Se aceptan pedidos de cualquier lugar.</p>
        ) : (
          <>
            {zona === "CIRCULO" ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <CampoNumero
                    etiqueta="Radio"
                    valor={config.radioDeliveryKm}
                    onChange={(v) => cambiar("radioDeliveryKm", v && v > 0 ? Math.min(RADIO_MAX_KM, v) : null)}
                    sufijo="km"
                    disabled={disabled}
                  />
                </div>
                <p className="text-[11px] text-gray-400 pb-2">
                  Arrastra el punto azul del borde (o toca el mapa) para agrandar o achicar el círculo. Entre {RADIO_MIN_KM} y{" "}
                  {RADIO_MAX_KM} km.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-gray-500 flex-1 min-w-[220px]">
                  Toca el mapa para marcar el borde de tu zona, punto por punto. Arrastra los puntos para ajustarla.{" "}
                  <strong className={puntos.length >= 3 ? "text-emerald-700" : "text-amber-700"}>
                    {puntos.length === 0
                      ? "Aún no hay puntos."
                      : puntos.length < 3
                        ? `${puntos.length} punto${puntos.length === 1 ? "" : "s"}: faltan ${3 - puntos.length} para cerrar la zona.`
                        : `Zona de ${puntos.length} puntos.`}
                  </strong>
                </p>
                <button
                  type="button"
                  onClick={() => cambiar("zonaPoligono", puntos.slice(0, -1))}
                  disabled={disabled || puntos.length === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 text-xs font-semibold text-gray-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Deshacer punto
                </button>
                <button
                  type="button"
                  onClick={() => cambiar("zonaPoligono", [])}
                  disabled={disabled || puntos.length === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Borrar zona
                </button>
              </div>
            )}
            <EditorZonaReparto
              tienda={tienda}
              modo={zona}
              radioKm={config.radioDeliveryKm || RADIO_INICIAL_KM}
              puntos={puntos}
              onRadio={(km) => cambiar("radioDeliveryKm", km)}
              onPuntos={(p) => cambiar("zonaPoligono", p)}
              alto={320}
              disabled={disabled}
            />
            <p className="text-[11px] text-gray-400">
              Si el cliente marca su casa fuera de la zona, no puede enviar el pedido y se le avisa que no llegan ahí.
            </p>
          </>
        )}
      </section>

      {/* 3. Costo de envío */}
      <section className="space-y-2">
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Bike className="w-3.5 h-3.5 text-gray-400" /> Costo del envío
        </p>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          {(
            [
              ["FIJO", "Precio fijo"],
              ["DISTANCIA", "Según la distancia"],
            ] as const
          ).map(([modo, etiqueta]) => (
            <button
              key={modo}
              type="button"
              disabled={disabled || (modo === "DISTANCIA" && !tienda)}
              onClick={() => cambiar("modoCostoDelivery", modo)}
              title={modo === "DISTANCIA" && !tienda ? "Marca primero tu tienda en el mapa" : undefined}
              className={`px-3 py-1.5 transition-colors disabled:opacity-50 ${
                config.modoCostoDelivery === modo ? "bg-brand-blue text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {porDistancia ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2 text-xs text-gray-600">
              <CampoNumero
                etiqueta="Precio base"
                valor={config.costoDelivery}
                onChange={(v) => cambiar("costoDelivery", v ?? 0)}
                prefijo="S/"
                decimales={2}
                disabled={disabled}
                ancho="w-32"
              />
              <span className="pb-2">incluye los primeros</span>
              <CampoNumero
                etiqueta="Km incluidos"
                valor={config.kmIncluidosDelivery}
                onChange={(v) => cambiar("kmIncluidosDelivery", v ?? 0)}
                sufijo="km"
                disabled={disabled}
                ancho="w-28"
              />
              <span className="pb-2">y cada km adicional suma</span>
              <CampoNumero
                etiqueta="Por km adicional"
                valor={config.costoKmDelivery}
                onChange={(v) => cambiar("costoKmDelivery", v ?? 0)}
                prefijo="S/"
                decimales={2}
                disabled={disabled}
                ancho="w-32"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KM_EJEMPLO.map((km) => (
                <span key={km} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600 tabular-nums">
                  a {km} km: <strong className="text-gray-800">S/ {costoPorDistancia(config.costoDelivery, config.kmIncluidosDelivery, config.costoKmDelivery, km).toFixed(2)}</strong>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">La distancia se mide por calles (el recorrido real), no en línea recta.</p>
          </div>
        ) : (
          <div className="max-w-[220px]">
            <CampoNumero
              etiqueta="Costo de envío"
              valor={config.costoDelivery}
              onChange={(v) => cambiar("costoDelivery", v ?? 0)}
              prefijo="S/"
              decimales={2}
              placeholder="0.00 = gratis"
              disabled={disabled}
            />
          </div>
        )}
      </section>

      {/* 4. Reglas opcionales */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CampoNumero
          etiqueta="Pedido mínimo (opcional)"
          valor={config.pedidoMinimoDelivery || null}
          onChange={(v) => cambiar("pedidoMinimoDelivery", v && v > 0 ? v : 0)}
          prefijo="S/"
          decimales={2}
          placeholder="Sin mínimo"
          disabled={disabled}
        />
        <CampoNumero
          etiqueta="Envío gratis desde (opcional)"
          valor={config.deliveryGratisDesde}
          onChange={(v) => cambiar("deliveryGratisDesde", v && v > 0 ? v : null)}
          prefijo="S/"
          decimales={2}
          placeholder="Nunca"
          disabled={disabled}
        />
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Tiempo estimado (opcional)</span>
          <input
            value={config.tiempoDelivery ?? ""}
            onChange={(e) => cambiar("tiempoDelivery", e.target.value.slice(0, 40))}
            disabled={disabled}
            placeholder="Ej.: 30 a 45 min"
            className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
          />
        </label>
        <p className="sm:col-span-3 -mt-1 text-[11px] text-gray-400">Deja vacío lo que no uses.</p>
        <label className="block sm:col-span-3">
          <span className="text-xs font-medium text-gray-600">Nota sobre la zona (opcional, la ve el cliente)</span>
          <input
            value={config.zonaDelivery ?? ""}
            onChange={(e) => cambiar("zonaDelivery", e.target.value.slice(0, 200))}
            disabled={disabled}
            placeholder="Ej.: Cercado de Cajamarca y Baños del Inca"
            className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-gray-50"
          />
        </label>
      </section>
    </div>
  );
}

const formatear = (valor: number | null, prefijo: string | undefined, decimales: number) =>
  valor == null ? "" : prefijo ? valor.toFixed(decimales) : String(valor);

function CampoNumero({
  etiqueta,
  valor,
  onChange,
  prefijo,
  sufijo,
  decimales = 2,
  placeholder,
  disabled,
  ancho = "w-full",
}: {
  etiqueta: string;
  valor: number | null;
  onChange: (v: number | null) => void;
  prefijo?: string;
  sufijo?: string;
  decimales?: number;
  placeholder?: string;
  disabled?: boolean;
  ancho?: string;
}) {
  const [texto, setTexto] = useState(formatear(valor, prefijo, decimales));
  // El valor también cambia desde fuera (p. ej. al arrastrar el borde del círculo).
  const [valorVisto, setValorVisto] = useState(valor);
  if (valor !== valorVisto) {
    setValorVisto(valor);
    // Vacío y 0 valen lo mismo: no se rellena "0.00" mientras el usuario borra para escribir.
    if ((leer(texto) ?? 0) !== (valor ?? 0)) setTexto(formatear(valor, prefijo, decimales));
  }
  return (
    <label className={`block ${ancho}`}>
      <span className="text-xs font-medium text-gray-600">{etiqueta}</span>
      <div className="mt-1 flex items-stretch rounded-md border border-gray-200 overflow-hidden bg-white focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
        {prefijo && (
          <span className="flex items-center px-2.5 bg-gray-50 text-xs font-semibold text-gray-400 border-r border-gray-200">{prefijo}</span>
        )}
        <input
          value={texto}
          onChange={(e) => {
            const limpio = e.target.value.replace(/[^\d.,]/g, "").slice(0, 8);
            setTexto(limpio);
            onChange(limpio ? leer(limpio) : null);
          }}
          onBlur={() => setTexto(formatear(leer(texto), prefijo, decimales))}
          disabled={disabled}
          inputMode="decimal"
          placeholder={placeholder}
          className="flex-1 min-w-0 h-9 px-2.5 text-sm tabular-nums outline-none disabled:bg-gray-50"
        />
        {sufijo && (
          <span className="flex items-center px-2.5 bg-gray-50 text-xs font-semibold text-gray-400 border-l border-gray-200">{sufijo}</span>
        )}
      </div>
    </label>
  );
}
