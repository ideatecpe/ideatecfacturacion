"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import {
  activarImpresionDirecta,
  detectarAgente,
  impresionDirectaActivada,
  suscribirImpresionDirecta,
  type InfoAgente,
} from "@/lib/impresion/agente";

/**
 * De dónde se baja el agente.
 *
 * Por defecto sale de `public/`, que funciona sin configurar nada. Pero un
 * binario de 50 MB en el repo se queda en el historial de git para siempre, así
 * que en producción conviene apuntar NEXT_PUBLIC_AGENTE_URL a un storage y
 * sacarlo de `public/`. Cambiar de sitio no toca código.
 */
const RUTA_DESCARGA =
  process.env.NEXT_PUBLIC_AGENTE_URL || "/descargas/FactuFlyAgente.exe";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
        <Icon className="w-4 h-4 text-brand-blue" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center">
        {numero}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-semibold text-gray-800">{titulo}</p>
        {children && (
          <div className="text-xs text-gray-500 mt-1 leading-relaxed">{children}</div>
        )}
      </div>
    </div>
  );
}

export default function AgenteImpresionPage() {
  // El interruptor vive en localStorage, que es un almacén externo a React.
  // `useSyncExternalStore` lo lee sin copiarlo a un estado dentro de un efecto,
  // y su tercer argumento devuelve `false` en el servidor para que el HTML
  // renderizado coincida con el del cliente.
  const activada = useSyncExternalStore(
    suscribirImpresionDirecta,
    impresionDirectaActivada,
    () => false,
  );

  // "inactivo" = ni siquiera se ha intentado buscar, porque está apagado.
  const [estado, setEstado] = useState<"inactivo" | "buscando" | "instalado" | "ausente">(
    "inactivo",
  );
  const [info, setInfo] = useState<InfoAgente | null>(null);

  const aplicar = (encontrado: InfoAgente | null) => {
    setInfo(encontrado);
    setEstado(encontrado ? "instalado" : "ausente");
  };

  const revisar = () => {
    setEstado("buscando");
    detectarAgente(true).catch(() => null).then(aplicar);
  };

  // La búsqueda solo corre si el equipo ya tenía la función activada: es la que
  // dispara el permiso de Chrome, y no debe aparecer sin que el usuario lo pida.
  useEffect(() => {
    if (!activada) return;

    let vigente = true;
    detectarAgente(true)
      .catch(() => null)
      .then((encontrado) => {
        if (vigente) aplicar(encontrado);
      });
    return () => {
      vigente = false;
    };
  }, [activada]);

  const alternar = () => {
    const nueva = !activada;
    activarImpresionDirecta(nueva);
    if (!nueva) {
      setInfo(null);
      setEstado("inactivo");
    }
    // Al encender, la búsqueda la dispara el efecto de arriba.
  };

  return (
    <div className="flex-1 space-y-4 pb-8">
      <div>
        <h2 className="text-lg font-bold text-brand-blue">Impresión directa</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Imprime tus comprobantes sin la ventana de impresión del navegador
        </p>
      </div>

      {/* Interruptor de este equipo */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">
              Usar impresión directa en esta computadora
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Se activa por computadora, no para toda la empresa. Si tienes varias cajas,
              actívala en cada una.
            </p>
          </div>

          <button
            type="button"
            onClick={alternar}
            role="switch"
            aria-checked={activada}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
              activada ? "bg-brand-blue" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                activada ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>

        {!activada && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <ShieldAlert className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Al activarla, Chrome te va a preguntar una vez si FactuFly puede{" "}
              <span className="font-semibold">
                &ldquo;acceder a otras aplicaciones y servicios en este dispositivo&rdquo;
              </span>
              . Dale a <span className="font-semibold">Permitir</span>: es lo que le da paso a tu
              impresora. Si le das Bloquear, seguirás imprimiendo con la ventana de siempre.
            </p>
          </div>
        )}
      </div>

      {/* Estado, solo cuando está activada */}
      {activada && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3">
              {estado === "buscando" && (
                <>
                  <RefreshCw className="w-5 h-5 text-gray-400 animate-spin shrink-0" />
                  <p className="text-sm font-semibold text-gray-700">Revisando este equipo…</p>
                </>
              )}

              {estado === "instalado" && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      Listo, ya imprime directo
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Usando{" "}
                      <span className="font-semibold">
                        {info?.impresora ?? "la impresora predeterminada"}
                      </span>
                      {info?.version && <> · versión {info.version}</>}
                    </p>
                  </div>
                </>
              )}

              {estado === "ausente" && (
                <>
                  <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Todavía no encuentro el programa
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Instálalo con los pasos de abajo. Mientras tanto sigues vendiendo igual, con
                      la ventana de siempre.
                    </p>
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              onClick={revisar}
              disabled={estado === "buscando"}
              className="shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${estado === "buscando" ? "animate-spin" : ""}`} />
              Volver a revisar
            </Button>
          </div>

          {estado === "instalado" && info && !info.soportaHtml && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                A este equipo le falta <span className="font-semibold">WebView2</span>, que el
                programa necesita para dibujar el comprobante. Mientras tanto seguirá apareciendo la
                ventana de Chrome.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Instalación */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-4">
        <SectionHeader
          icon={Download}
          title="Instalar en esta computadora"
          subtitle="Una sola vez por equipo. No necesitas ser administrador."
        />

        <a
          href={RUTA_DESCARGA}
          download
          // Si el archivo se sirve desde otro dominio, el navegador ignora
          // `download`; abrirlo aparte evita perder estas instrucciones.
          target={RUTA_DESCARGA.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="block"
        >
          <Button className="w-full sm:w-auto">
            <Download className="w-4 h-4" />
            Descargar el programa
          </Button>
        </a>

        <div className="pt-1">
          <Paso numero={1} titulo="Abre el archivo descargado con doble clic">
            Windows puede mostrar un aviso azul que dice{" "}
            <span className="font-semibold">&ldquo;Windows protegió su PC&rdquo;</span>. Haz clic en{" "}
            <span className="font-semibold">Más información</span> y luego en{" "}
            <span className="font-semibold">Ejecutar de todas formas</span>.
          </Paso>

          <Paso numero={2} titulo="Busca el ícono de impresora junto al reloj">
            Es la única señal de que está funcionando. No abre ninguna ventana.
          </Paso>

          <Paso numero={3} titulo="Clic derecho en ese ícono → Iniciar con Windows">
            Sin este paso tendrás que abrirlo a mano cada vez que prendas la computadora.
          </Paso>

          <Paso numero={4} titulo="Vuelve aquí y presiona Volver a revisar">
            Si todo salió bien, verás el mensaje en verde.
          </Paso>
        </div>
      </div>

      {/* Aclaraciones */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-4">
        <SectionHeader
          icon={Printer}
          title="Cómo funciona"
          subtitle="Qué hace y qué no hace"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600 leading-relaxed">
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="font-semibold text-gray-800 mb-1">Por qué hace falta un programa</p>
            <p>
              Ninguna página web puede imprimir sin que el navegador muestre su ventana de
              confirmación. Este programa va aparte, así que sí puede.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="font-semibold text-gray-800 mb-1">Es opcional</p>
            <p>
              Si no lo activas, todo sigue igual que siempre: aparece la ventana de Chrome y le das
              a Imprimir.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="font-semibold text-gray-800 mb-1">Solo para rollo térmico</p>
            <p>
              Aplica a los tamaños 58mm y 80mm. Si imprimes en A4, el comprobante sigue saliendo
              como PDF por la ventana del navegador.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="font-semibold text-gray-800 mb-1">No se conecta a internet</p>
            <p>
              Solo escucha a tu propia computadora. Recibe el comprobante de FactuFly y se lo pasa a
              tu impresora: no manda información a ningún lado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
