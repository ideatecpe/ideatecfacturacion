"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Lock, AlertTriangle, Banknote, CalendarClock, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOfflineSales } from "@/app/components/offline/OfflineSalesProvider";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { useCaja } from "@/hooks/useCaja";
import { ModalAbrirCaja } from "./ModalAbrirCaja";
import { ModalCuadrarCaja, soles } from "./ModalCuadrarCaja";
import { ModalRetiroCaja } from "./ModalRetiroCaja";
import { ModalCerrarSesion } from "./ModalCerrarSesion";
import {
  suscribirEmisionesSegundoPlano,
  obtenerEmisionesSegundoPlano,
  InfoEmisionSegundoPlano,
} from "@/lib/eventosCaja";


export function ControlCaja({ children }: { children: React.ReactNode }) {
  const { isOnline, cantidadPendientes, cantidadError } = useOfflineSales();
  const ventasSinSincronizar = cantidadPendientes + cantidadError;
  const { user, logout } = useAuth();
  const sinSucursal = !user?.sucursalID;
  const { estado, error, abrirCaja, iniciarTurno, obtenerCuadre, cuadrar, registrarRetiro } =
    useCaja({ autoIniciarTurno: true, activo: isOnline && !sinSucursal });
  const { showToast } = useToast();
  const router = useRouter();

  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [cuadreAbierto, setCuadreAbierto] = useState(false);
  const [retiroAbierto, setRetiroAbierto] = useState(false);
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [preguntarSesion, setPreguntarSesion] = useState(false);
  const [turnoIdCuadre, setTurnoIdCuadre] = useState<number | null>(null);
  const turno = estado?.turnoActual ?? estado?.turnoDeOtroUsuario ?? null;
  const claveAviso = estado?.caja ? `caja-dia-anterior-${estado.caja.cajaAperturaId}` : null;
  const [descartadoAhora, setDescartadoAhora] = useState(false);
  const [emisiones, setEmisiones] = useState<InfoEmisionSegundoPlano[]>(() => obtenerEmisionesSegundoPlano());
  useEffect(() => {
    return suscribirEmisionesSegundoPlano(setEmisiones);
  }, []);


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



  if (!isOnline || sinSucursal) return <>{children}</>;

  // Sin nada en caché (primera vez en la sesión) no hay forma de saber si la
  // caja está abierta o cerrada: recién aquí toca esperar a la respuesta.
  if (!estado) return <CargandoPanel error={error} />;

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

  const onRetirar = async (monto: number, motivo: string) => {
    if (!estado?.turnoActual) return;
    await registrarRetiro(estado.turnoActual.cajaTurnoId, monto, motivo);
    showToast("Retiro registrado correctamente", "success");
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
        ventasSinSincronizar={ventasSinSincronizar}
        obtenerCuadre={obtenerCuadre}
        onConfirmar={onCuadrar}
      />
      <ModalRetiroCaja
        isOpen={retiroAbierto}
        onClose={() => setRetiroAbierto(false)}
        onConfirmar={onRetirar}
      />
      <ModalCerrarSesion
        isOpen={preguntarSesion}
        onQuedarse={() => { setPreguntarSesion(false); router.push("/factufly/dashboard"); }}
        onCerrarSesion={logout}
      />
    </>
  );

  if (estado && !estado.cajaAbierta) {
    return (
      <>
        <PanelCentrado
          icono={<Lock className="w-7 h-7 text-brand-blue" />}
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

  if (estado?.turnoDeOtroUsuario) {
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


  if (estado?.cajaDeDiaAnterior && !avisoDescartado) {
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

  if (estado && !estado.turnoActual && estado.usuarioYaCuadro) {
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

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-lg">
        <div className="flex items-center gap-2 mr-auto min-w-0">
      
          {estado?.cajaDeDiaAnterior ? (
            <span className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1">
              <CalendarClock className="w-3 h-3 text-amber-600" />
              <span className="text-[11px] font-semibold text-amber-700">Caja del {fechaCaja}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-md  px-2 py-1">
              <span className="text-[11px] font-semibold text-emerald-700">Caja abierta</span>
            </span>
          )}
          <span className="text-xs text-gray-500 truncate">
            En caja:{" "}
            <span className="font-bold text-brand-blue tabular-nums">
              {estado ? soles(estado.saldoEfectivo) : "…"}
            </span>
          </span>

          {emisiones.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-brand-blue shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue shrink-0" />
              <span>
                {emisiones[0].conImpresion
                  ? `Emitiendo e imprimiendo ${emisiones[0].tipo}...`
                  : `Emitiendo ${emisiones[0].tipo}...`}
              </span>
              <span className="font-bold tabular-nums">S/ {emisiones[0].total.toFixed(2)}</span>
              {emisiones.length > 1 && (
                <span className="text-[10px] font-bold text-brand-blue">
                  (+{emisiones.length - 1})
                </span>
              )}
            </span>
          )}
        </div>

        <Button variant="outline" onClick={() => setRetiroAbierto(true)} className="px-3! py-1.5! text-xs!">
          <Banknote className="w-3.5 h-3.5" />
          Retirar efectivo
        </Button>
        <Button variant="outline" onClick={() => abrirCuadre(false)} className="px-3! py-1.5! text-xs!">
          <Banknote className="w-3.5 h-3.5" />
          Cuadrar Caja
        </Button>
        <Button variant="danger" onClick={() => abrirCuadre(true)} className="px-3! py-1.5! text-xs!">
          <Lock className="w-3.5 h-3.5" />
          Cerrar Caja
        </Button>
      </div>

      <div className="flex-1 min-h-0">{children}</div>
      {modales}
    </div>
  );
}

function CargandoPanel({ error }: { error?: string | null }) {
  return (
    <PanelCentrado
      icono={<Wallet className="w-6 h-6 text-gray-400 animate-pulse" />}
      titulo="Cargando estado de caja..."
      descripcion="Consultando si la caja del día está abierta o cerrada."
      error={error}
    >
      <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </PanelCentrado>
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
