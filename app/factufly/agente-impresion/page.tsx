import { redirect } from "next/navigation";

/** El agente pasó a Herramientas; el enlace anterior sigue funcionando. */
export default function AgenteImpresionRedirect() {
  redirect("/factufly/herramientas/agente-impresion");
}
