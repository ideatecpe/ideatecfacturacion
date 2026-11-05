import type { Metadata, Viewport } from "next";
import TiendaCliente from "./TiendaCliente";

type Params = { params: Promise<{ tienda: string }>; searchParams: Promise<{ e?: string; mesa?: string }> };

/** Enlace de la tienda tal como lo usa el resto de la app ("mi-bodega" o id de sucursal). */
const claveDe = (tienda: string) => decodeURIComponent(tienda).slice(0, 80);

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { tienda } = await params;
  const { e } = await searchParams;
  // El ícono de la pestaña es el logo de la empresa de esta tienda (ver ./icono/route.ts).
  const icono = `/tienda/${encodeURIComponent(claveDe(tienda))}/icono${e === "beta" ? "?e=beta" : ""}`;

  return {
    title: "Tienda online",
    robots: { index: false, follow: false },
    icons: {
      icon: [{ url: icono, type: "image/png" }],
      shortcut: [{ url: icono }],
      apple: [{ url: icono }],
    },
  };
}

// Barra de estado del celular del mismo azul que el encabezado de la tienda.
export const viewport: Viewport = {
  themeColor: "#0B1F49",
};

export default async function TiendaPage({ params, searchParams }: Params) {
  const { tienda } = await params;
  const { e, mesa } = await searchParams;

  return (
    <TiendaCliente
      // Nombre del enlace ("mi-bodega") o id de la sucursal.
      clave={claveDe(tienda)}
      entorno={e === "beta" ? "beta" : null}
      // Un QR por mesa (…/tienda/mi-bodega?mesa=5) deja la mesa ya elegida en el pedido.
      mesaInicial={mesa?.slice(0, 20) ?? null}
    />
  );
}
