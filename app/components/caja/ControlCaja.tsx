"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Lock, AlertTriangle, Banknote, CalendarClock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOfflineSales } from "@/app/components/offline/OfflineSalesProvider";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { useCaja } from "@/hooks/useCaja";
import { ModalAbrirCaja } from "./ModalAbrirCaja";
import { ModalCuadrarCaja, soles } from "./ModalCuadrarCaja";
import { ModalCerrarSesion } from "./ModalCerrarSesion";

/**
 * Envuelve el módulo de venta cuando la configuración "Administrar
 * apertura/cierres de caja" está activa: sin caja abierta no se renderiza nada
 * de la venta, solo el panel para aperturarla.
 */
export function ControlCaja({ children }: { children: React.ReactNode }) {
  const { isOnline } = useOfflineSales();
  const { user, logout } = useAuth();
  // La caja se lleva por sucursal, así que sin sucursal asignada no hay nada
  // que controlar y no tiene sentido bloquear la venta.
  const sinSucursal = !user?.sucursalID;
  const { estado, loading, error, abrirCaja, iniciarTurno, obtenerCuadre, cuadrar } =
    useCaja({ autoIniciarTurno: true, activo: isOnline && !sinSucursal });
  const { showToast } = useToast();
  const router = useRouter();

  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [cuadreAbierto, setCuadreAbierto] = useState(false);
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [preguntarSesion, setPreguntarSesion] = useState(false);
  // Turno concreto que se está cuadrando: no siempre es el propio (puede ser el
  // ajeno pendiente, o uno recién creado para cerrar una caja rezagada).
  const [turnoIdCuadre, setTurnoIdCuadre] = useState<number | null>(null);

  // El turno a cuadrar es el propio; si otro usuario olvidó cuadrar, se cuadra el suyo.
  const turno = estado?.turnoActual ?? estado?.turnoDeOtroUsuario ?? null;

  // Descartar el aviso de caja vieja se recuerda por caja y por pestaña: no
  // vuelve a interrumpir cada vez que se entra a Nueva Venta, pero reaparece
  // en una sesión nueva porque la caja sigue sin cerrarse.
  const claveAviso = estado?.caja ? `caja-dia-anterior-${estado.caja.cajaAperturaId}` : null;
  const [descartadoAhora, setDescartadoAhora] = useState(false);

  // Se lee en el render y no en un efecto: cuando claveAviso deja de ser null
  // ya estamos en cliente (depende del fetch del estado), así que no hay riesgo
  // de tocar sessionStorage durante el render del servidor.
  const avisoDescartado =
    descartadoAhora ||
    (claveAviso !== null && typeof window !== "undefined" && sessionStorage.getItem(claveAviso) === "1");

  const descartarAviso = () => {
    if (claveAviso) sessionStorage.setItem(claveAviso, "1");
    setDescartadoAhora(true);
  };

  const fechaCaja = estado?.caja
    ? new Date(estado.caja.fechaApertura).toLocaleDateString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : "";

  // Sin internet no se puede consultar ni registrar nada de la caja, y bloquear
  // aquí dejaría al usuario sin la venta offline que el resto de la app sí
  // soporta. El control vuelve a aplicarse en cuanto haya conexión.
  if (!isOnline || sinSucursal) return <>{children}</>;

  if (loading) return null;

  const onAbrirCaja = async (montoInicial: number, observaciones?: string) => {
    await abrirCaja(montoInicial, observaciones);
    setAbrirAbierto(false);
    showToast("Caja aperturada correctamente", "success");
  };

  const abrirCuadre = (cerrar: boolean, cajaTurnoId?: number) => {
    setTurnoIdCuadre(cajaTurnoId ?? turno?.cajaTurnoId ?? null);
    setCerrandoCaja(cerrar);
    setCuadreAbierto(true);
  };

  /**
   * Cerrar una caja que quedó de días atrás cuando ya nadie tiene turno
   * abierto: el cierre se cuadra sobre un turno, así que quien cuenta el
   * dinero abre el suyo primero. Queda registrado que fue él.
   */
  const cerrarCajaRezagada = async () => {
    try {
      let cajaTurnoId = estado?.turnoActual?.cajaTurnoId;
      if (!cajaTurnoId) {
        const nuevo = await iniciarTurno();
        cajaTurnoId = nuevo.turnoActual?.cajaTurnoId;
      }
      if (!cajaTurnoId) throw new Error("No se pudo preparar el cierre de la caja");

      abrirCuadre(true, cajaTurnoId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo preparar el cierre", "error");
    }
  };

  const onCuadrar = async (efectivoContado: number, observaciones?: string) => {
    if (!turnoIdCuadre) return;
    await cuadrar(turnoIdCuadre, efectivoContado, cerrandoCaja, observaciones);
    setCuadreAbierto(false);
    showToast(cerrandoCaja ? "Caja cerrada correctamente" : "Turno cuadrado correctamente", "success");
    setPreguntarSesion(true);
  };

  const modales = (
    <>
      <ModalAbrirCaja
        isOpen={abrirAbierto}
        onClose={() => setAbrirAbierto(false)}
        sugerencia={estado?.sugerenciaMontoInicial}
        onConfirmar={onAbrirCaja}
      />
      <ModalCuadrarCaja
        isOpen={cuadreAbierto}
        onClose={() => setCuadreAbierto(false)}
        cajaTurnoId={turnoIdCuadre}
        cerrarCaja={cerrandoCaja}
        obtenerCuadre={obtenerCuadre}
        onConfirmar={onCuadrar}
      />
      <ModalCerrarSesion
        isOpen={preguntarSesion}
        onQuedarse={() => { setPreguntarSesion(false); router.push("/factufly/dashboard"); }}
        onCerrarSesion={logout}
      />
    </>
  );

  // ── Caja cerrada: la venta no se monta, solo la invitación a aperturar ──
  if (!estado?.cajaAbierta) {
    return (
      <>
        <PanelCentrado
          icono={<Lock className="w-7 h-7 text-[#0f2e64]" />}
          titulo="La caja está cerrada"
          descripcion="Para empezar a vender debes aperturar la caja e indicar con cuánto efectivo inicias el día."
          error={error}
        >
          <Button onClick={() => setAbrirAbierto(true)} className="px-6">
            <Wallet className="w-4 h-4" />
            Abrir caja
          </Button>
        </PanelCentrado>
        {modales}
      </>
    );
  }

  // ── Turno ajeno sin cuadrar: hay que cerrarlo antes de poder vender ──
  if (estado.turnoDeOtroUsuario) {
    return (
      <>
        <PanelCentrado
          icono={<AlertTriangle className="w-7 h-7 text-amber-500" />}
          titulo={`Turno pendiente de ${estado.turnoDeOtroUsuario.nombreUsuario ?? "otro usuario"}`}
          descripcion={
            estado.cajaDeDiaAnterior
              ? `Ese turno quedó abierto sin cuadrar y la caja es del ${fechaCaja}. Puedes cuadrarlo y cerrar la caja de ese día, o solo cuadrarlo y seguir vendiendo sobre ella.`
              : "Ese turno quedó abierto sin cuadrar. Cuádralo para cerrarlo y poder iniciar el tuyo."
          }
          error={error}
        >
          {estado.cajaDeDiaAnterior ? (
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={() => abrirCuadre(true)} className="px-6">
                <Lock className="w-4 h-4" />
                Cuadrar y cerrar la caja del {fechaCaja}
              </Button>
              <Button variant="outline" onClick={() => abrirCuadre(false)} className="px-6">
                Solo cuadrar el turno
              </Button>
            </div>
          ) : (
            <Button onClick={() => abrirCuadre(false)} className="px-6">
              <Banknote className="w-4 h-4" />
              Cuadrar caja
            </Button>
          )}
        </PanelCentrado>
        {modales}
      </>
    );
  }

  // ── Caja de un día anterior: sugerir cerrarla, sin obligar ──
  // Va antes de las ramas de turno porque una caja rezagada importa más que el
  // estado del turno propio, y puede no haber ninguno abierto todavía.
  if (estado.cajaDeDiaAnterior && !avisoDescartado) {
    return (
      <>
        <PanelCentrado
          icono={<CalendarClock className="w-7 h-7 text-amber-500" />}
          titulo={`La caja del ${fechaCaja} sigue abierta`}
          descripcion={`Nadie la cerró al terminar ese día y quedan ${soles(estado.saldoEfectivo)} en el cajón. Lo recomendable es cerrarla para cuadrar la jornada, pero puedes seguir vendiendo sobre ella con tu turno de hoy.`}
          error={error}
        >
          <div className="flex flex-col gap-2 w-full">
            <Button onClick={cerrarCajaRezagada} className="px-6">
              <Lock className="w-4 h-4" />
              Cerrar la caja del {fechaCaja}
            </Button>
            <Button variant="outline" onClick={descartarAviso} className="px-6">
              Seguir vendiendo
            </Button>
          </div>
        </PanelCentrado>
        {modales}
      </>
    );
  }

  // Sin turno y sin haber cuadrado: el auto-inicio está en vuelo, no parpadees.
  if (!estado.turnoActual && !estado.usuarioYaCuadro) return null;

  // ── Ya cuadró en esta caja: un turno nuevo solo si lo pide ──
  if (!estado.turnoActual) {
    return (
      <>
        <PanelCentrado
          icono={<Banknote className="w-7 h-7 text-emerald-600" />}
          titulo="Tu turno está cuadrado"
          descripcion={`En caja quedan ${soles(estado.saldoEfectivo)}. Si vas a seguir vendiendo, inicia un turno nuevo.`}
          error={error}
        >
          <Button
            onClick={() =>
              iniciarTurno().catch((e) =>
                showToast(e instanceof Error ? e.message : "No se pudo iniciar el turno", "error"),
              )
            }
            className="px-6"
          >
            Iniciar nuevo turno
          </Button>
        </PanelCentrado>
        {modales}
      </>
    );
  }

  // ── Caja abierta con turno propio: barra + módulo de venta ──
  return (
    <div className="flex flex-col h-full gap-2">
      <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2 mr-auto min-w-0">
          {/* Tras descartar el aviso, la caja vieja sigue señalada aquí. */}
          {estado.cajaDeDiaAnterior ? (
            <span className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1">
              <CalendarClock className="w-3 h-3 text-amber-600" />
              <span className="text-[11px] font-semibold text-amber-700">Caja del {fechaCaja}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-100 px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-700">Caja abierta</span>
            </span>
          )}
          <span className="text-xs text-gray-500 truncate">
            En caja:{" "}
            <span className="font-bold text-[#0f2e64] tabular-nums">{soles(estado.saldoEfectivo)}</span>
          </span>
        </div>

        <Button variant="outline" onClick={() => abrirCuadre(false)} className="!px-3 !py-1.5 !text-xs">
          <Banknote className="w-3.5 h-3.5" />
          Cuadrar Caja
        </Button>
        <Button variant="danger" onClick={() => abrirCuadre(true)} className="!px-3 !py-1.5 !text-xs">
          <Lock className="w-3.5 h-3.5" />
          Cerrar Caja
        </Button>
      </div>

      <div className="flex-1 min-h-0">{children}</div>
      {modales}
    </div>
  );
}

function PanelCentrado({
  icono,
  titulo,
  descripcion,
  error,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="max-w-sm text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
          {icono}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-gray-800">{titulo}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{descripcion}</p>
        </div>
        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-center pt-1">{children}</div>
      </div>
    </div>
  );
}
