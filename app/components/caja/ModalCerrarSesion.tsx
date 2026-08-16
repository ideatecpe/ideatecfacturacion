"use client";

import { LogOut } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";

interface Props {
  isOpen: boolean;
  /** "No": no cierra sesión, lleva al dashboard. */
  onQuedarse: () => void;
  onCerrarSesion: () => void;
}

/**
 * Se abre apenas se confirma un cuadre: el turno ya terminó, así que lo natural
 * es dejar la sesión libre para el siguiente usuario. Sin botón de cerrar (X)
 * porque ambas salidas son decisiones explícitas.
 */
export function ModalCerrarSesion({ isOpen, onQuedarse, onCerrarSesion }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onQuedarse} title="Turno cuadrado" className="max-w-md" elevated>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <LogOut className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Tu turno quedó registrado. ¿Deseas cerrar sesión para que el siguiente
            usuario ingrese con su cuenta?
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onQuedarse}>
            No, ir al dashboard
          </Button>
          <Button onClick={onCerrarSesion}>
            Sí, cerrar sesión
          </Button>
        </div>
      </div>
    </Modal>
  );
}
