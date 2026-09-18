import type { Metadata, Viewport } from "next";
import TiendaCliente from "./TiendaCliente";

export const metadata: Metadata = {
  title: "Tienda online",
  robots: { index: false, follow: false },
};

// Barra de estado del celular del mismo azul que el encabezado de la tienda.
export const viewport: Viewport = {
  themeColor: "#0B1F49",
};

export default async function TiendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ tienda: string }>;
  searchParams: Promise<{ e?: string; mesa?: string }>;
}) {
  const { tienda } = await params;
  const { e, mesa } = await searchParams;

  return (
    <TiendaCliente
      // Nombre del enlace ("mi-bodega") o id de la sucursal.
      clave={decodeURIComponent(tienda).slice(0, 80)}
      entorno={e === "beta" ? "beta" : null}
      // Un QR por mesa (…/tienda/mi-bodega?mesa=5) deja la mesa ya elegida en el pedido.
      mesaInicial={mesa?.slice(0, 20) ?? null}
    />
  );
}
