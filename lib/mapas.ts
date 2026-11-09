/**
 * Mapas sin clave ni costo: Leaflet dibuja el mapa con las imágenes (teselas) de Google
 * para que se vea como Google Maps, y si esas imágenes no cargan pasa a las de
 * OpenStreetMap. Las direcciones (buscar y "qué dirección es este punto") salen de
 * OpenStreetMap/Nominatim a través de /api/geocodificar.
 */

import type * as Leaflet from "leaflet";

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Centro por defecto (Perú) cuando todavía no hay ninguna ubicación. */
export const CENTRO_PERU: Coordenadas = { lat: -9.19, lng: -75.0152 };

/** Calles de Google (la misma capa "Google Road" que usa Traccar). */
export const CAPA_GOOGLE = {
  url: "https://mt{s}.google.com/vt/lyrs=m&hl=es&gl=PE&x={x}&y={y}&z={z}",
  subdomains: "0123",
  maxZoom: 20,
  attribution: "Imágenes del mapa &copy; Google",
};

/** Respaldo si las imágenes de Google dejan de cargar. */
export const CAPA_OSM = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  subdomains: "",
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
};

let promesa: Promise<typeof Leaflet> | null = null;

/** Leaflet se carga solo en el navegador y una sola vez. */
export function cargarLeaflet(): Promise<typeof Leaflet> {
  promesa ??= import("leaflet").then((m) => (m.default ?? m) as typeof Leaflet);
  return promesa;
}

/** Tras estas imágenes fallidas de Google, el mapa pasa a OpenStreetMap. */
const ERRORES_PARA_CAMBIAR_CAPA = 4;

/** Crea el mapa con las calles de Google (y OpenStreetMap de respaldo). */
export function crearMapa(L: typeof Leaflet, contenedor: HTMLElement, centro: Coordenadas, zoom: number): Leaflet.Map {
  const mapa = L.map(contenedor, {
    center: [centro.lat, centro.lng],
    zoom,
    scrollWheelZoom: true,
    // Zoom con la rueda más suave (por defecto salta de nivel muy rápido).
    wheelPxPerZoomLevel: 120,
  });
  mapa.attributionControl.setPrefix(false);

  const capaGoogle = L.tileLayer(CAPA_GOOGLE.url, {
    subdomains: CAPA_GOOGLE.subdomains,
    maxZoom: CAPA_GOOGLE.maxZoom,
    attribution: CAPA_GOOGLE.attribution,
  }).addTo(mapa);
  let errores = 0;
  capaGoogle.on("tileerror", () => {
    errores += 1;
    if (errores !== ERRORES_PARA_CAMBIAR_CAPA) return;
    mapa.removeLayer(capaGoogle);
    L.tileLayer(CAPA_OSM.url, { maxZoom: CAPA_OSM.maxZoom, attribution: CAPA_OSM.attribution }).addTo(mapa);
  });
  return mapa;
}

// Íconos en SVG (los de Leaflet por defecto no funcionan con el empaquetador).
const SVG_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 39s13-13.2 13-23.5C28 7.5 22.2 2 15 2S2 7.5 2 15.5C2 25.8 15 39 15 39z" fill="#EA4335" stroke="#B31412" stroke-width="1.5"/><circle cx="15" cy="15.5" r="5" fill="#7A0E0B"/></svg>`;
const SVG_TIENDA = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#0B1F49" stroke="#fff" stroke-width="3"/><path d="M8 11.5h10l-1-3H9zM9 12.5v5h8v-5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

/** Pin rojo del punto que se elige. */
export const iconoPin = (L: typeof Leaflet) =>
  L.divIcon({ html: SVG_PIN, className: "", iconSize: [30, 40], iconAnchor: [15, 39] });

/** Círculo azul oscuro con la tienda. */
export const iconoTienda = (L: typeof Leaflet) =>
  L.divIcon({ html: SVG_TIENDA, className: "", iconSize: [26, 26], iconAnchor: [13, 13] });

/** Punto blanco con borde azul: vértices de la zona y el tirador del radio. */
export const iconoVertice = (L: typeof Leaflet, primero = false) =>
  L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:9999px;background:${primero ? "#2563EB" : "#fff"};border:2.5px solid #2563EB;box-shadow:0 1px 3px rgba(0,0,0,.35);cursor:grab"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

/** Estilo de la zona de reparto (círculo o polígono). */
export const ESTILO_ZONA = {
  color: "#2563EB",
  opacity: 0.7,
  weight: 2,
  fillColor: "#3B82F6",
  fillOpacity: 0.1,
};

/** Punto a `km` al este de `c` (para el tirador del círculo). */
export function puntoAlEste(c: Coordenadas, km: number): Coordenadas {
  const grados = km / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  return { lat: c.lat, lng: c.lng + grados };
}

/** Distancia en línea recta, en km. */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** "lat,lng" con 6 decimales, como lo guarda el pedido. */
export const textoCoordenadas = (c: Coordenadas) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;

export function parsearCoordenadas(texto: string | null | undefined): Coordenadas | null {
  if (!texto) return null;
  const [lat, lng] = texto.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Dirección legible de unas coordenadas ("Jr. Amalia Puga 123, Cajamarca"). */
export async function direccionDe(c: Coordenadas): Promise<string | null> {
  try {
    const res = await fetch(`/api/geocodificar?lat=${c.lat.toFixed(6)}&lng=${c.lng.toFixed(6)}`);
    const datos = (await res.json()) as { ok?: boolean; direccion?: string | null };
    return datos.ok ? (datos.direccion ?? null) : null;
  } catch {
    return null;
  }
}

/** Busca una dirección escrita ("Jr. Amalia Puga 123, Cajamarca"), priorizando la zona de `cerca`. */
export async function buscarDireccion(
  texto: string,
  cerca?: Coordenadas | null,
): Promise<{ posicion: Coordenadas; direccion: string } | null> {
  const parametros = new URLSearchParams({ q: texto });
  if (cerca) {
    parametros.set("lat", cerca.lat.toFixed(6));
    parametros.set("lng", cerca.lng.toFixed(6));
  }
  try {
    const res = await fetch(`/api/geocodificar?${parametros.toString()}`);
    const datos = (await res.json()) as {
      ok?: boolean;
      resultado?: { lat: number; lng: number; direccion: string } | null;
    };
    const r = datos.ok ? datos.resultado : null;
    return r ? { posicion: { lat: r.lat, lng: r.lng }, direccion: r.direccion } : null;
  } catch {
    return null;
  }
}

/** Ubicación del celular o la PC. Rechaza con un mensaje listo para mostrar. */
export function ubicacionActual(): Promise<Coordenadas> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no permite compartir la ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
