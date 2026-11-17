"use client";

import { useEffect, useState } from "react";
import { Banknote, Receipt } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { cn } from "@/app/utils/cn";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useApiGastos } from "@/app/factufly/gastos/gestionGastos/useGastos";
import type { CategoriaGasto } from "@/app/factufly/gastos/gestionGastos/tipos";
import { IconoGasto } from "@/app/factufly/gastos/gestionGastos/iconosGasto";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** gastoCategoriaId: si el retiro también es un gasto (módulo Gastos activo). */
  onConfirmar: (monto: number, motivo: string, gastoCategoriaId?: number | null) => Promise<void>;
}

export function ModalRetiroCaja({ isOpen, onClose, onConfirmar }: Props) {
  const { config } = useConfiguracion();
  const usaGastos = !!config?.usaGastos;
  const api = useApiGastos();

  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [intentoConfirmar, setIntentoConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esGasto, setEsGasto] = useState(false);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<CategoriaGasto[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMonto("");
    setMotivo("");
    setIntentoConfirmar(false);
    setError(null);
    setEsGasto(false);
    setCategoriaId(null);
  }, [isOpen]);

  // Las categorías se piden solo la primera vez que se marca "Es un gasto".
  useEffect(() => {
    if (!isOpen || !usaGastos || !esGasto || categorias || !api.listo) return;
    const hoy = new Date();
    api.getInicio(hoy.getFullYear(), hoy.getMonth() + 1)
      .then((d) => setCategorias(d.categorias.filter((c) => c.activa)))
      .catch(() => setCategorias([]));
    // api se recrea en cada render; basta con reaccionar a la casilla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, usaGastos, esGasto, categorias, api.listo]);

  const montoNumero = parseFloat(monto);
  const montoValido = monto.trim() !== "" && Number.isFinite(montoNumero) && montoNumero > 0;
  const motivoVacio = motivo.trim() === "";
  const faltaCategoria = esGasto && !categoriaId;

  const confirmar = async () => {
    setIntentoConfirmar(true);
    if (!montoValido || motivoVacio || faltaCategoria || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(montoNumero, motivo.trim(), esGasto ? categoriaId : null);
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

        {usaGastos && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={esGasto}
                onChange={(e) => setEsGasto(e.target.checked)}
                className="h-4 w-4 accent-brand-blue"
              />
              <Receipt className="w-4 h-4 text-gray-400" />
              Es un gasto del negocio
            </label>
            {esGasto && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Elige la categoría: se anotará también en Gastos.</p>
                {categorias === null ? (
                  <p className="text-xs text-gray-400">Cargando categorías…</p>
                ) : categorias.length === 0 ? (
                  <p className="text-xs text-gray-400">No hay categorías activas en Gastos.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {categorias.map((c) => {
                      const sel = c.categoriaId === categoriaId;
                      return (
                        <button
                          key={c.categoriaId}
                          type="button"
                          onClick={() => setCategoriaId(c.categoriaId)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition-colors",
                            sel ? "border-transparent text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50",
                          )}
                          style={sel ? { backgroundColor: c.color } : undefined}
                        >
                          <IconoGasto nombre={c.icono} className="w-3.5 h-3.5 shrink-0" style={sel ? undefined : { color: c.color }} />
                          <span className="truncate">{c.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {intentoConfirmar && faltaCategoria && (
                  <p className="text-xs text-rose-600">Elige la categoría del gasto</p>
                )}
              </div>
            )}
          </div>
        )}

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
