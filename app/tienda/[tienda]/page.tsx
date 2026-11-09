import type { Metadata, Viewport } from "next";
import TiendaCliente from "./TiendaCliente";
import { colorBarraTienda } from "@/lib/colores";
import { datosTiendaServidor } from "@/lib/tiendaServidor";

type Params = { params: Promise<{ tienda: string }>; searchParams: Promise<{ e?: string; mesa?: string }> };

/** Enlace de la tienda tal como lo usa el resto de la app ("mi-bodega" o id de sucursal). */
const claveDe = (tienda: string) => decodeURIComponent(tienda).slice(0, 80);

/**
 * Color de la barra del celular (hora, batería) para esta tienda. Va desde el HTML: el
 * navegador del iPhone lo toma al abrir la página y no siempre lo cambia después.
 */
async function colorBarra({ params, searchParams }: Params): Promise<string> {
  const { tienda } = await params;
  const { e } = await searchParams;
  const datos = await datosTiendaServidor(claveDe(tienda), e === "beta");
  return colorBarraTienda(datos?.colorPrimario, datos?.abierta ?? true);
}

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

export async function generateViewport(props: Params): Promise<Viewport> {
  return { themeColor: await colorBarra(props) };
}

export default async function TiendaPage(props: Params) {
  const { tienda } = await props.params;
  const { e, mesa } = await props.searchParams;
  const barra = await colorBarra(props);

  return (
    <>
      {/* Safari del iPhone pinta la zona de la hora con el fondo de la página: ya viene
          del color de la tienda, sin esperar al JavaScript. (barra es un #RRGGBB validado.) */}
      <style>{`html,body{background-color:${barra}}`}</style>
      <TiendaCliente
        // Nombre del enlace ("mi-bodega") o id de la sucursal.
        clave={claveDe(tienda)}
        entorno={e === "beta" ? "beta" : null}
        // Un QR por mesa (…/tienda/mi-bodega?mesa=5) deja la mesa ya elegida en el pedido.
        mesaInicial={mesa?.slice(0, 20) ?? null}
      />
    </>
  );
}
