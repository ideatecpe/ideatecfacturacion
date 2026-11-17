"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/utils/cn";
import type { CategoriaGasto } from "@/app/factufly/gastos/gestionGastos/tipos";
import { COLORES_GASTO, ICONOS_GASTO, IconoCategoria } from "@/app/factufly/gastos/gestionGastos/iconosGasto";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Categoría a editar; null = nueva. */
  categoria: CategoriaGasto | null;
  onGuardar: (
    datos: { nombre: string; color: string; icono: string; conceptos: string[]; activa: boolean },
    id: number | null,
  ) => Promise<void>;
}

const MAX_CONCEPTOS = 20;

export function ModalCategoriaGasto({ isOpen, onClose, categoria, onGuardar }: Props) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES_GASTO[0]);
  const [icono, setIcono] = useState("tag");
  const [conceptos, setConceptos] = useState<string[]>([]);
  const [nuevoConcepto, setNuevoConcepto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNombre(categoria?.nombre ?? "");
    setColor(categoria?.color ?? COLORES_GASTO[0]);
    setIcono(categoria?.icono ?? "tag");
    setConceptos(categoria?.conceptos ?? []);
    setNuevoConcepto("");
  }, [isOpen, categoria]);

  const valido = nombre.trim().length >= 2;

  const agregarConcepto = () => {
    const texto = nuevoConcepto.replace(/\|/g, " ").trim().slice(0, 40);
    if (!texto) return;
    if (!conceptos.some((c) => c.toLowerCase() === texto.toLowerCase()) && conceptos.length < MAX_CONCEPTOS) {
      setConceptos((l) => [...l, texto]);
    }
    setNuevoConcepto("");
  };

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    setError(null);
    // Lo que quedó escrito sin presionar "Agregar" también se guarda.
    const pendiente = nuevoConcepto.replace(/\|/g, " ").trim().slice(0, 40);
    const lista = pendiente && !conceptos.some((c) => c.toLowerCase() === pendiente.toLowerCase())
      ? [...conceptos, pendiente].slice(0, MAX_CONCEPTOS)
      : conceptos;
    try {
      await onGuardar(
        { nombre: nombre.trim(), color, icono, conceptos: lista, activa: categoria?.activa ?? true },
        categoria?.categoriaId ?? null,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la categoría");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={categoria ? "Editar categoría" : "Nueva categoría"} className="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <IconoCategoria icono={icono} color={color} tamano="lg" />
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
            maxLength={80}
            autoFocus
            placeholder="Nombre de la categoría"
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase">Color</p>
          <div className="flex flex-wrap gap-2">
            {COLORES_GASTO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full flex items-center justify-center ring-offset-2 transition"
                style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
                aria-label={`Color ${c}`}
              >
                {color === c && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase">Icono</p>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONOS_GASTO.map(({ nombre: n, icono: Icono }) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcono(n)}
                className={cn(
                  "h-9 rounded-lg border flex items-center justify-center transition-colors",
                  icono === n ? "border-transparent text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50",
                )}
                style={icono === n ? { backgroundColor: color } : undefined}
                aria-label={n}
              >
                <Icono className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase">Conceptos <span className="font-normal normal-case text-gray-400">(opcional)</span></p>
          <p className="text-[11px] text-gray-400">
            Opciones que se eligen con un clic al registrar el gasto. Ej. en Servicios: Luz, Agua, Internet.
          </p>
          {conceptos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {conceptos.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 pl-2.5 pr-1 py-0.5 text-xs font-medium text-gray-700">
                  {c}
                  <button
                    type="button"
                    onClick={() => setConceptos((l) => l.filter((x) => x !== c))}
                    className="p-0.5 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                    aria-label={`Quitar ${c}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {conceptos.length < MAX_CONCEPTOS && (
            <div className="flex gap-2">
              <input
                value={nuevoConcepto}
                onChange={(e) => setNuevoConcepto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarConcepto(); } }}
                maxLength={40}
                placeholder="Escribe un concepto y presiona Enter"
                className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50"
              />
              <Button variant="outline" onClick={agregarConcepto} disabled={!nuevoConcepto.trim()} className="text-xs">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido || guardando}>
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {categoria ? "Guardar" : "Crear categoría"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
