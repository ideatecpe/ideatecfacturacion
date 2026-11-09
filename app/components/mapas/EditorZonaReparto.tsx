"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Loader2, MapPinOff } from "lucide-react";
import {
  Coordenadas,
  ESTILO_ZONA,
  cargarLeaflet,
  crearMapa,
  distanciaKm,
  iconoTienda,
  iconoVertice,
  puntoAlEste,
} from "@/lib/mapas";
import { BotonAmpliar, FondoAmpliado, useMapaAmpliado } from "./Ampliar";

export type ModoZona = "CIRCULO" | "POLIGONO";

export const RADIO_MIN_KM = 0.5;
export const RADIO_MAX_KM = 200;

interface Props {
  tienda: Coordenadas;
  modo: ModoZona;
  radioKm: number;
  puntos: [number, number][];
  onRadio: (km: number) => void;
  onPuntos: (puntos: [number, number][]) => void;
  disabled?: boolean;
  alto?: number;
}

const redondearKm = (km: number) => Math.min(RADIO_MAX_KM, Math.max(RADIO_MIN_KM, Math.round(km * 10) / 10));
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const comoPunto = (ll: Leaflet.LatLng): [number, number] => [r6(ll.lat), r6(ll.lng)];

/**
 * Mapa para dibujar la zona de reparto alrededor de la tienda:
 * - Círculo: se arrastra el punto del borde (o se toca el mapa) para cambiar el radio.
 * - Polígono: cada toque en el mapa agrega un punto; los puntos se arrastran para ajustarla.
 */
export default function EditorZonaReparto({ tienda, modo, radioKm, puntos, onRadio, onPuntos, disabled = false, alto = 300 }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const capaRef = useRef<Leaflet.LayerGroup | null>(null);
  const tiendaRef = useRef<Leaflet.Marker | null>(null);
  /** Para qué modo ya se encuadró el mapa: se encuadra al entrar, no con cada punto. */
  const encuadradoRef = useRef<ModoZona | null>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ampliar = useMapaAmpliado();

  // Lo que usan los eventos de Leaflet, siempre al día.
  const actual = useRef({ tienda, modo, puntos, disabled, onRadio, onPuntos });
  actual.current = { tienda, modo, puntos, disabled, onRadio, onPuntos };

  useEffect(() => {
    let cancelado = false;
    cargarLeaflet()
      .then((L) => {
        if (cancelado || !contenedorRef.current || mapaRef.current) return;
        leafletRef.current = L;
        const mapa = crearMapa(L, contenedorRef.current, actual.current.tienda, 13);
        mapaRef.current = mapa;
        capaRef.current = L.layerGroup().addTo(mapa);
        tiendaRef.current = L.marker([actual.current.tienda.lat, actual.current.tienda.lng], {
          keyboard: false,
          icon: iconoTienda(L),
          zIndexOffset: 500,
        })
          .bindTooltip("Tu tienda", { direction: "top", offset: [0, -12] })
          .addTo(mapa);

        mapa.on("click", (e: Leaflet.LeafletMouseEvent) => {
          const a = actual.current;
          if (a.disabled) return;
          if (a.modo === "CIRCULO") a.onRadio(redondearKm(distanciaKm(a.tienda, e.latlng)));
          else a.onPuntos([...a.puntos, comoPunto(e.latlng)]);
        });
        setListo(true);
      })
      .catch(() => setError("No se pudo cargar el mapa. Revisa tu conexión."));
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      capaRef.current = null;
      tiendaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!listo || !el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => mapaRef.current?.invalidateSize());
    obs.observe(el);
    return () => obs.disconnect();
  }, [listo]);

  // Dibuja la zona. Se rehace entera con cada cambio: son pocas formas.
  const clavePuntos = JSON.stringify(puntos);
  useEffect(() => {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    const capa = capaRef.current;
    if (!listo || !L || !mapa || !capa) return;
    capa.clearLayers();
    tiendaRef.current?.setLatLng([tienda.lat, tienda.lng]);
    // Al dibujar, el cursor es una cruz: cada toque es un punto.
    mapa.getContainer().style.cursor = modo === "POLIGONO" && !disabled ? "crosshair" : "";
    let limites: Leaflet.LatLngBounds | null = null;

    if (modo === "CIRCULO") {
      const circulo = L.circle([tienda.lat, tienda.lng], { ...ESTILO_ZONA, radius: radioKm * 1000, interactive: false }).addTo(capa);
      const borde = puntoAlEste(tienda, radioKm);
      const tirador = L.marker([borde.lat, borde.lng], {
        draggable: !disabled,
        icon: iconoVertice(L, true),
        zIndexOffset: 1000,
      })
        .bindTooltip(`${radioKm.toFixed(1)} km`, { permanent: true, direction: "right", offset: [10, 0] })
        .addTo(capa);
      tirador.on("drag", () => {
        const km = distanciaKm(tienda, tirador.getLatLng());
        circulo.setRadius(km * 1000);
        tirador.setTooltipContent(`${km.toFixed(1)} km`);
      });
      tirador.on("dragend", () => actual.current.onRadio(redondearKm(distanciaKm(tienda, tirador.getLatLng()))));
      limites = circulo.getBounds();
    } else {
      const forma =
        puntos.length >= 3
          ? L.polygon(puntos, { ...ESTILO_ZONA, interactive: false })
          : L.polyline(puntos, { ...ESTILO_ZONA, dashArray: "6 6", interactive: false });
      forma.addTo(capa);
      const vertices: Leaflet.Marker[] = puntos.map((p, i) => {
        const m = L.marker(p, { draggable: !disabled, icon: iconoVertice(L, i === 0), zIndexOffset: 1000 }).addTo(capa);
        m.on("drag", () => forma.setLatLngs(vertices.map((v) => v.getLatLng())));
        m.on("dragend", () => actual.current.onPuntos(vertices.map((v) => comoPunto(v.getLatLng()))));
        return m;
      });
      if (puntos.length >= 2) limites = forma.getBounds();
    }

    if (encuadradoRef.current !== modo) {
      encuadradoRef.current = modo;
      if (limites) mapa.fitBounds(limites, { padding: [16, 16], animate: false });
      else mapa.setView([tienda.lat, tienda.lng], 14, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, modo, radioKm, clavePuntos, disabled, tienda.lat, tienda.lng]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-xs text-gray-500">
        <MapPinOff className="w-4 h-4 shrink-0 text-gray-400" /> {error}
      </div>
    );
  }

  return (
    // Al ampliarse, el mapa sale del flujo de la página: este hueco evita que el resto salte.
    <div style={ampliar.ampliado ? { height: alto + 2 } : undefined}>
      <FondoAmpliado visible={ampliar.ampliado} onCerrar={ampliar.cerrar} />
      <div className={`isolate overflow-hidden ${ampliar.claseContenedor}`}>
      <BotonAmpliar ampliado={ampliar.ampliado} onClick={ampliar.alternar} className="top-2 right-2" />
      <div ref={contenedorRef} style={{ height: ampliar.ampliado ? "100%" : alto }} className="w-full bg-gray-100" />
      {!listo && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-gray-50">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}
      </div>
    </div>
  );
}
