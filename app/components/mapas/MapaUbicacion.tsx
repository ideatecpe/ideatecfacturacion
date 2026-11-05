"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Loader2, MapPinOff, Search } from "lucide-react";
import {
  CENTRO_PERU,
  Coordenadas,
  ESTILO_ZONA,
  buscarDireccion,
  cargarLeaflet,
  crearMapa,
  iconoPin,
  iconoTienda,
} from "@/lib/mapas";
import { BotonAmpliar, FondoAmpliado, useMapaAmpliado } from "./Ampliar";

interface Props {
  /** Punto que se está eligiendo (pin rojo arrastrable). null = todavía sin elegir. */
  posicion: Coordenadas | null;
  /** El usuario movió el pin, tocó el mapa o buscó una dirección. */
  onCambiar: (posicion: Coordenadas, direccionBuscada?: string) => void;
  /** Punto fijo de referencia (la tienda), con su etiqueta. */
  referencia?: (Coordenadas & { etiqueta?: string }) | null;
  /** Radio de cobertura alrededor de la referencia, en km. */
  radioKm?: number | null;
  /** Zona de reparto dibujada (manda sobre el círculo). */
  poligono?: [number, number][] | null;
  /** Encuadra el mapa para que se vea toda la zona de reparto. */
  encuadrarZona?: boolean;
  /** Muestra el buscador de direcciones encima del mapa. */
  conBuscador?: boolean;
  placeholderBuscador?: string;
  alto?: number;
  /** Botón para ver el mapa en grande. */
  ampliable?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Mapa con un pin que se arrastra (o se pone tocando el mapa) y, opcionalmente, un
 * buscador de direcciones, la tienda marcada y la zona de reparto (círculo o polígono).
 * Usa Leaflet con las imágenes de Google: se ve como Google Maps sin clave ni costo.
 */
export default function MapaUbicacion({
  posicion,
  onCambiar,
  referencia,
  radioKm,
  poligono,
  encuadrarZona = false,
  conBuscador = false,
  placeholderBuscador = "Busca una dirección",
  alto = 260,
  ampliable = false,
  disabled = false,
  className = "",
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const pinRef = useRef<Leaflet.Marker | null>(null);
  const tiendaRef = useRef<Leaflet.Marker | null>(null);
  const zonaRef = useRef<Leaflet.Circle | Leaflet.Polygon | null>(null);
  const onCambiarRef = useRef(onCambiar);
  onCambiarRef.current = onCambiar;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const encuadrarRef = useRef(encuadrarZona);
  encuadrarRef.current = encuadrarZona;

  /** Muestra toda la zona de reparto (si se pidió y el mapa ya tiene tamaño). */
  const encuadrar = () => {
    const mapa = mapaRef.current;
    const zona = zonaRef.current;
    if (!encuadrarRef.current || !mapa || !zona || mapa.getSize().x === 0) return;
    mapa.fitBounds(zona.getBounds(), { padding: [8, 8], animate: false });
  };

  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [sinResultado, setSinResultado] = useState(false);
  const ampliar = useMapaAmpliado();

  // Crea el mapa una vez.
  useEffect(() => {
    let cancelado = false;
    cargarLeaflet()
      .then((L) => {
        if (cancelado || !contenedorRef.current || mapaRef.current) return;
        leafletRef.current = L;
        const centro = posicion ?? referencia ?? CENTRO_PERU;
        const mapa = crearMapa(L, contenedorRef.current, centro, posicion || referencia ? 15 : 5);
        mapaRef.current = mapa;

        const pin = L.marker([centro.lat, centro.lng], {
          draggable: !disabledRef.current,
          autoPan: true,
          icon: iconoPin(L),
          zIndexOffset: 1000,
        });
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          onCambiarRef.current({ lat: p.lat, lng: p.lng });
        });
        pinRef.current = pin;

        mapa.on("click", (e: Leaflet.LeafletMouseEvent) => {
          if (disabledRef.current) return;
          onCambiarRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
        setListo(true);
      })
      .catch(() => setError("No se pudo cargar el mapa. Revisa tu conexión."));
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      pinRef.current = null;
      tiendaRef.current = null;
      zonaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El contenedor puede cambiar de tamaño (panel que se abre, pestaña oculta): Leaflet
  // necesita enterarse para no dejar zonas grises.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!listo || !el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => {
      mapaRef.current?.invalidateSize();
      encuadrar();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [listo]);

  // Pin: sigue a la posición elegida.
  useEffect(() => {
    const pin = pinRef.current;
    const mapa = mapaRef.current;
    if (!listo || !pin || !mapa) return;
    if (disabled) pin.dragging?.disable();
    else pin.dragging?.enable();
    if (posicion) {
      pin.setLatLng([posicion.lat, posicion.lng]);
      if (!mapa.hasLayer(pin)) pin.addTo(mapa);
      if (!mapa.getBounds().contains([posicion.lat, posicion.lng])) {
        mapa.setView([posicion.lat, posicion.lng], Math.max(mapa.getZoom(), 16));
      }
    } else if (mapa.hasLayer(pin)) {
      mapa.removeLayer(pin);
    }
  }, [listo, posicion, disabled]);

  // Tienda y zona de reparto.
  const refLat = referencia?.lat;
  const refLng = referencia?.lng;
  const refEtiqueta = referencia?.etiqueta;
  const claveZona = poligono ? JSON.stringify(poligono) : "";
  useEffect(() => {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    if (!listo || !L || !mapa) return;

    if (refLat != null && refLng != null) {
      tiendaRef.current ??= L.marker([refLat, refLng], { keyboard: false, icon: iconoTienda(L) }).addTo(mapa);
      tiendaRef.current.setLatLng([refLat, refLng]);
      tiendaRef.current.unbindTooltip().bindTooltip(refEtiqueta ?? "Tienda", { direction: "top", offset: [0, -12] });
    } else if (tiendaRef.current) {
      mapa.removeLayer(tiendaRef.current);
      tiendaRef.current = null;
    }

    // La zona se vuelve a dibujar entera: cambia poco y así no hay que sincronizar formas.
    if (zonaRef.current) {
      mapa.removeLayer(zonaRef.current);
      zonaRef.current = null;
    }
    if (poligono && poligono.length >= 3) {
      zonaRef.current = L.polygon(poligono, { ...ESTILO_ZONA, interactive: false }).addTo(mapa);
    } else if (refLat != null && refLng != null && radioKm && radioKm > 0) {
      zonaRef.current = L.circle([refLat, refLng], { ...ESTILO_ZONA, radius: radioKm * 1000, interactive: false }).addTo(mapa);
    }
    zonaRef.current?.bringToBack();
    encuadrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, refLat, refLng, refEtiqueta, radioKm, claveZona]);

  const buscar = async () => {
    const q = texto.trim();
    if (q.length < 3 || buscando) return;
    setBuscando(true);
    setSinResultado(false);
    try {
      const r = await buscarDireccion(q, posicion ?? referencia ?? null);
      if (!r) {
        setSinResultado(true);
        return;
      }
      mapaRef.current?.setView([r.posicion.lat, r.posicion.lng], 17);
      onCambiarRef.current(r.posicion, r.direccion);
    } finally {
      setBuscando(false);
    }
  };

  if (error) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-xs text-gray-500 ${className}`}>
        <MapPinOff className="w-4 h-4 shrink-0 text-gray-400" /> {error}
      </div>
    );
  }

  return (
    // Al ampliarse, el mapa sale del flujo de la página: este hueco evita que el resto salte.
    <div className={className} style={ampliar.ampliado ? { height: alto + 2 } : undefined}>
      <FondoAmpliado visible={ampliar.ampliado} onCerrar={ampliar.cerrar} />
      <div className={`isolate overflow-hidden ${ampliar.claseContenedor}`}>
      {ampliable && <BotonAmpliar ampliado={ampliar.ampliado} onClick={ampliar.alternar} className="top-2 right-2" />}
      {conBuscador && !disabled && (
        <div className={`absolute left-12 top-2 z-[1000] ${ampliable ? "right-14" : "right-2"}`}>
          <div className="flex items-center h-10 rounded-lg bg-white shadow-md px-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value.slice(0, 150));
                setSinResultado(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void buscar();
                }
              }}
              placeholder={placeholderBuscador}
              className="ml-2 flex-1 min-w-0 text-sm outline-none bg-transparent"
            />
            {buscando ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              texto.trim().length >= 3 && (
                <button type="button" onClick={() => void buscar()} className="text-xs font-semibold text-blue-600">
                  Buscar
                </button>
              )
            )}
          </div>
          {sinResultado && (
            <p className="mt-1 rounded-md bg-white/95 px-2 py-1 text-[11px] text-rose-600 shadow">
              No encontramos esa dirección. Prueba con otra o mueve el pin en el mapa.
            </p>
          )}
        </div>
      )}
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
