"use client";

import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (monto: number, motivo: string) => Promise<void>;
}

export function ModalRetiroCaja({ isOpen, onClose, onConfirmar }: Props) {
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [intentoConfirmar, setIntentoConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMonto("");
    setMotivo("");
    setIntentoConfirmar(false);
    setError(null);
  }, [isOpen]);

  const montoNumero = parseFloat(monto);
  const montoValido = monto.trim() !== "" && Number.isFinite(montoNumero) && montoNumero > 0;
  const motivoVacio = motivo.trim() === "";

  const confirmar = async () => {
    setIntentoConfirmar(true);
    if (!montoValido || motivoVacio || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(montoNumero, motivo.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el retiro");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Retirar efectivo" className="max-w-md" elevated>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <Banknote className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Registra un retiro de efectivo del cajón (ej. pago a un proveedor). Se descuenta
            del efectivo esperado de tu turno.
          </p>
        </div>

        <InputBase
          label="Monto a retirar (S/)"
          type="number"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          autoFocus
        />

        <InputBase
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
          placeholder="¿Para qué se retira este efectivo?"
          maxLength={255}
          showError={intentoConfirmar && motivoVacio}
          errorMessage="Indica el motivo del retiro"
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
          <Button onClick={confirmar} disabled={!montoValido || motivoVacio || guardando}>
            {guardando ? "Retirando…" : "Retirar efectivo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
