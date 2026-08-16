"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Debe lanzar si el backend rechaza la apertura, para poder mostrar el error. */
  onConfirmar: (montoInicial: number, observaciones?: string) => Promise<void>;
}

export function ModalAbrirCaja({ isOpen, onClose, onConfirmar }: Props) {
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMonto("");
    setObservaciones("");
    setError(null);
  }, [isOpen]);

  const montoNumero = parseFloat(monto);
  const montoValido = monto.trim() !== "" && Number.isFinite(montoNumero) && montoNumero >= 0;

  const confirmar = async () => {
    if (!montoValido || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(montoNumero, observaciones.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la caja");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Abrir caja" className="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <Wallet className="w-5 h-5 text-[#0f2e64] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Ingresa el efectivo con el que inicias el día. Este monto es el punto de
            partida para calcular el cuadre de cada turno.
          </p>
        </div>

        <InputBase
          label="Monto inicial (S/)"
          type="number"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
          placeholder="0.00"
          autoFocus
        />

        <InputBase
          label="Observaciones"
          labelOptional="(opcional)"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Notas de la apertura"
          maxLength={500}
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
          <Button onClick={confirmar} disabled={!montoValido || guardando}>
            {guardando ? "Abriendo…" : "Abrir caja"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
