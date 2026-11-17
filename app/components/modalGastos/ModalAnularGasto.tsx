"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, FileCheck, Loader2 } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { formatSoles, nombreComprobante, type Gasto } from "@/app/factufly/gastos/gestionGastos/tipos";

interface Props {
  gasto: Gasto | null;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}

export function ModalAnularGasto({ gasto, onClose, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gasto) return;
    setMotivo("");
    setError(null);
  }, [gasto]);

  const confirmar = async () => {
    if (motivo.trim().length < 3 || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(motivo.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo anular el gasto");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen={!!gasto} onClose={onClose} title={gasto?.tipo === "I" ? "Anular ingreso" : "Anular gasto"} className="max-w-md">
      {gasto && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">{gasto.descripcion}</p>
              <p>
                {formatSoles(gasto.monto)} · ya no sumará en los totales
                {gasto.tipo === "I" ? "." : " ni en el presupuesto."}
              </p>
            </div>
          </div>
          {gasto.pagadoConCaja && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Banknote className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {gasto.tipo === "I" ? "Entró al" : "Salió del"} efectivo de la caja. Si el turno sigue abierto, también se quita
                de la caja; si ya se cuadró, se mantiene porque el dinero sí {gasto.tipo === "I" ? "entró al" : "salió del"} cajón.
              </span>
            </div>
          )}
          {gasto.comprobanteId && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <FileCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                La {nombreComprobante(gasto.tipoComprobante).toLowerCase()} {[gasto.serie, gasto.numero].filter(Boolean).join("-")} sigue
                vigente: anular el ingreso no anula el comprobante. Para eso emite una nota de crédito.
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-gray-500 uppercase">Motivo <span className="text-rose-500">*</span></p>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
              maxLength={200}
              autoFocus
              placeholder="Ej. Registrado dos veces"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50"
            />
          </div>
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button variant="danger" onClick={confirmar} disabled={motivo.trim().length < 3 || guardando}>
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              Anular gasto
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
