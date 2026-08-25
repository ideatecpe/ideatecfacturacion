"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, Smartphone, ArrowRightLeft, Wallet, Lock, AlertTriangle } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import type { CuadreTurno } from "@/hooks/useCaja";

export const soles = (n: number) =>
  `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ICONOS: Record<string, typeof Banknote> = {
  Efectivo: Banknote,
  Tarjeta: CreditCard,
  Yape: Smartphone,
  Plin: Smartphone,
  Transferencia: ArrowRightLeft,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cajaTurnoId: number | null;
  /** true = este cuadre además cierra la caja del día. */
  cerrarCaja: boolean;
  /** Ventas hechas offline por este usuario que aún no se subieron: no están
   *  incluidas en el cuadre porque el servidor todavía no las conoce. */
  ventasSinSincronizar?: number;
  obtenerCuadre: (cajaTurnoId: number) => Promise<CuadreTurno>;
  onConfirmar: (efectivoContado: number, observaciones?: string) => Promise<void>;
}

export function ModalCuadrarCaja({
  isOpen,
  onClose,
  cajaTurnoId,
  cerrarCaja,
  ventasSinSincronizar = 0,
  obtenerCuadre,
  onConfirmar,
}: Props) {
  const [cuadre, setCuadre] = useState<CuadreTurno | null>(null);
  const [cargando, setCargando] = useState(false);
  const [contado, setContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entiendoPendientes, setEntiendoPendientes] = useState(false);

  useEffect(() => {
    if (!isOpen || !cajaTurnoId) return;

    setCuadre(null);
    setContado("");
    setObservaciones("");
    setError(null);
    setEntiendoPendientes(false);
    setCargando(true);

    let vigente = true;
    obtenerCuadre(cajaTurnoId)
      .then((data) => { if (vigente) setCuadre(data); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo calcular el cuadre"); })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, [isOpen, cajaTurnoId, obtenerCuadre]);

  const contadoNumero = parseFloat(contado);
  const contadoValido = contado.trim() !== "" && Number.isFinite(contadoNumero) && contadoNumero >= 0;
  // La diferencia solo tiene sentido una vez que hay un monto contado válido.
  const diferencia = contadoValido && cuadre ? contadoNumero - cuadre.efectivoEsperado : null;
  const hayDescuadre = diferencia !== null && Math.abs(diferencia) >= 0.005;
  // Un faltante o sobrante no debe pasar en silencio: queda en el histórico y
  // alguien va a preguntar por él, así que se explica en el momento.
  const faltaJustificar = hayDescuadre && observaciones.trim() === "";
  const faltaConfirmarPendientes = ventasSinSincronizar > 0 && !entiendoPendientes;

  const confirmar = async () => {
    if (!contadoValido || faltaJustificar || faltaConfirmarPendientes || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(contadoNumero, observaciones.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cuadrar la caja");
    } finally {
      setGuardando(false);
    }
  };

  const titulo = cerrarCaja ? "Cerrar caja" : "Cuadrar caja";
  // Los medios sin recaudación no aportan nada al conteo, solo ruido.
  const mediosConMonto = cuadre?.medios.filter((m) => m.montoEsperado > 0) ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} className="max-w-2xl">
      {cargando && <p className="text-sm text-gray-400 py-8 text-center">Calculando el cuadre…</p>}

      {!cargando && cuadre && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            {cerrarCaja
              ? <Lock className="w-5 h-5 text-[#0f2e64] shrink-0 mt-0.5" />
              : <Wallet className="w-5 h-5 text-[#0f2e64] shrink-0 mt-0.5" />}
            <p className="text-xs text-gray-600 leading-relaxed">
              {cerrarCaja
                ? "Cuenta el efectivo del cajón y confirma. La caja quedará cerrada y mañana habrá que aperturarla de nuevo para poder vender."
                : "Cuenta el efectivo del cajón y confirma. Tu turno se cierra y el efectivo queda disponible para el siguiente usuario."}
            </p>
          </div>

          {ventasSinSincronizar > 0 && (
            <div className="space-y-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Tienes <strong>{ventasSinSincronizar}</strong> venta(s) hecha(s) sin conexión que
                  todavía no se subieron al servidor: no están incluidas en este cuadre. Se sincronizarán
                  solas en cuanto vuelva el internet, pero el efectivo que dejaron ya está en el cajón.
                </p>
              </div>
              <label className="flex items-center gap-2 pl-8 text-xs text-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entiendoPendientes}
                  onChange={(e) => setEntiendoPendientes(e.target.checked)}
                  className="accent-amber-600"
                />
                Entiendo y quiero cuadrar de todas formas
              </label>
            </div>
          )}

          {/* Recaudado por medio de pago */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              Recaudado en tu turno
            </p>
            <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-100 space-y-px">
              {mediosConMonto.length === 0 && (
                <p className="px-4 py-3 bg-white text-sm text-gray-400">
                  No registraste ventas en este turno.
                </p>
              )}
              {mediosConMonto.map(({ medioPago, montoEsperado }) => {
                const Icono = ICONOS[medioPago] ?? Wallet;
                return (
                  <div key={medioPago} className="flex items-center justify-between gap-4 px-4 py-2.5 bg-white">
                    <div className="flex items-center gap-2.5">
                      <Icono className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{medioPago}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 tabular-nums">
                      {soles(montoEsperado)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-4 py-2 mt-1 text-xs text-gray-400">
              <span>{cuadre.cantidadComprobantes} comprobante(s)</span>
              <span>Total vendido: {soles(cuadre.totalVentas)}</span>
            </div>
          </div>

          {/* Cuadre del efectivo */}
          <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-100 space-y-px">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-white">
              <span className="text-sm text-gray-500">Saldo al iniciar el turno</span>
              <span className="text-sm text-gray-700 tabular-nums">{soles(cuadre.saldoInicial)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-white">
              <span className="text-sm text-gray-500">+ Ventas en efectivo</span>
              <span className="text-sm text-gray-700 tabular-nums">{soles(cuadre.ventasEfectivo)}</span>
            </div>
            {cuadre.totalRetiros > 0 && (
              <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-white">
                <span className="text-sm text-gray-500">− Retiros de caja</span>
                <span className="text-sm text-rose-600 tabular-nums">{soles(cuadre.totalRetiros)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
              <span className="text-sm font-bold text-gray-800">Efectivo esperado en caja</span>
              <span className="text-base font-bold text-[#0f2e64] tabular-nums">
                {soles(cuadre.efectivoEsperado)}
              </span>
            </div>
          </div>

          <InputBase
            label="Efectivo contado (S/)"
            type="number"
            inputMode="decimal"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
            placeholder="0.00"
            autoFocus
          />

          {diferencia !== null && (
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                Math.abs(diferencia) < 0.005
                  ? "bg-emerald-50 border-emerald-100"
                  : diferencia < 0
                    ? "bg-rose-50 border-rose-100"
                    : "bg-amber-50 border-amber-100"
              }`}
            >
              <span className="text-sm font-medium text-gray-700">
                {Math.abs(diferencia) < 0.005 ? "Caja cuadrada" : diferencia < 0 ? "Faltante" : "Sobrante"}
              </span>
              <span
                className={`text-base font-bold tabular-nums ${
                  Math.abs(diferencia) < 0.005
                    ? "text-emerald-600"
                    : diferencia < 0
                      ? "text-rose-600"
                      : "text-amber-600"
                }`}
              >
                {soles(Math.abs(diferencia))}
              </span>
            </div>
          )}

          <InputBase
            label={hayDescuadre ? "Motivo de la diferencia" : "Observaciones"}
            labelOptional={hayDescuadre ? "" : "(opcional)"}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder={hayDescuadre ? "¿A qué se debe el descuadre?" : "Notas del turno"}
            maxLength={500}
            showError={faltaJustificar}
            errorMessage="Explica la diferencia para poder confirmar"
          />

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={!contadoValido || faltaJustificar || faltaConfirmarPendientes || guardando}>
              {guardando ? "Confirmando…" : cerrarCaja ? "Cerrar caja" : "Confirmar cuadre"}
            </Button>
          </div>
        </div>
      )}

      {!cargando && !cuadre && error && (
        <div className="space-y-4">
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
