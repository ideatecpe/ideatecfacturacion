"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Lock, AlertTriangle, Banknote } from "lucide-react";
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
  const { estado, loading, error, abrirCaja, obtenerCuadre, cuadrar } = useCaja({
    autoIniciarTurno: true,
    activo: isOnline && !sinSucursal,
  });
  const { showToast } = useToast();
  const router = useRouter();

  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [cuadreAbierto, setCuadreAbierto] = useState(false);
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [preguntarSesion, setPreguntarSesion] = useState(false);

  // El turno a cuadrar es el propio; si otro usuario olvidó cuadrar, se cuadra el suyo.
  const turno = estado?.turnoActual ?? estado?.turnoDeOtroUsuario ?? null;

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

  const abrirCuadre = (cerrar: boolean) => {
    setCerrandoCaja(cerrar);
    setCuadreAbierto(true);
  };

  const onCuadrar = async (efectivoContado: number, observaciones?: string) => {
    if (!turno) return;
    await cuadrar(turno.cajaTurnoId, efectivoContado, cerrandoCaja, observaciones);
    setCuadreAbierto(false);
    showToast(cerrandoCaja ? "Caja cerrada correctamente" : "Turno cuadrado correctamente", "success");
    setPreguntarSesion(true);
  };

  const modales = (
    <>
      <ModalAbrirCaja
        isOpen={abrirAbierto}
        onClose={() => setAbrirAbierto(false)}
        onConfirmar={onAbrirCaja}
      />
      <ModalCuadrarCaja
        isOpen={cuadreAbierto}
        onClose={() => setCuadreAbierto(false)}
        cajaTurnoId={turno?.cajaTurnoId ?? null}
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
          descripcion="Ese turno quedó abierto sin cuadrar. Cuádralo para cerrarlo y poder iniciar el tuyo."
          error={error}
        >
          <Button onClick={() => abrirCuadre(false)} className="px-6">
            <Banknote className="w-4 h-4" />
            Cuadrar caja
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
          <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-100 px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-700">Caja abierta</span>
          </span>
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
