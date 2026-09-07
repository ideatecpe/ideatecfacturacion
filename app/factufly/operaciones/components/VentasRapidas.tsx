"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { GripHorizontal, Minus } from "lucide-react";
import {
  ItemCarrito,
  RecursosCaja,
  VentaRapidaInfo,
  VENTAS_RAPIDAS_CONFIG,
  SIN_RESERVAS,
  CajaAutopagoVista,
} from "@/app/factufly/operaciones/components/CajaAutopago";

interface VentanaSlot {
  montada: boolean;
  abierta: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface VentasRapidasProps {
  recursos: RecursosCaja;
  carritoPrincipal: ItemCarrito[];
  onReservasChange: (reservas: ItemCarrito[]) => void;
  onInfoChange: (info: VentaRapidaInfo[]) => void;
  onAlgunaAbiertaChange?: (abierta: boolean) => void;
}

export const VentasRapidas = memo(function VentasRapidas({
  recursos,
  carritoPrincipal,
  onReservasChange,
  onInfoChange,
  onAlgunaAbiertaChange,
}: VentasRapidasProps) {
  // Estado inicial para las ventanas flotantes
  const [slots, setSlots] = useState<VentanaSlot[]>(() => {
    const isClient = typeof window !== "undefined";
    const screenW = isClient ? window.innerWidth : 1400;
    const screenH = isClient ? window.innerHeight : 900;
    const defW = Math.round(screenW * 0.7);
    const defH = Math.min(840, Math.max(520, Math.round(screenH * 0.84)));
    const startX = Math.max(15, Math.round((screenW - defW) / 2));
    const startY = Math.max(15, Math.round((screenH - defH) / 2));
    return VENTAS_RAPIDAS_CONFIG.map((_, i) => ({
      montada: false,
      abierta: false,
      x: startX + i * 30,
      y: startY + i * 25,
      width: defW,
      height: defH,
      zIndex: 100 + i,
    }));
  });

  const [slotEnfocado, setSlotEnfocado] = useState<number | null>(null);
  const zIndexTopRef = useRef(110);

  // Carritos independientes para cada venta rápida
  const [carritosRapidos, setCarritosRapidos] = useState<ItemCarrito[][]>(() =>
    VENTAS_RAPIDAS_CONFIG.map(() => SIN_RESERVAS)
  );

  // Traer una ventana al frente (mayor zIndex)
  const traerAlFrente = useCallback((idx: number) => {
    zIndexTopRef.current += 1;
    const newZ = zIndexTopRef.current;
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, zIndex: newZ } : s)));
    setSlotEnfocado(idx);
  }, []);

  // Abrir ventana flotante
  const abrirSlot = useCallback((idx: number) => {
    zIndexTopRef.current += 1;
    const newZ = zIndexTopRef.current;
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, montada: true, abierta: true, zIndex: newZ } : s
      )
    );
    setSlotEnfocado(idx);
  }, []);

  // Minimizar ventana flotante
  const minimizarSlot = useCallback((idx: number) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, abierta: false } : s))
    );
    setSlotEnfocado((prev) => {
      if (prev === idx) {
        const otro = slots.findIndex((s, i) => i !== idx && s.abierta);
        return otro !== -1 ? otro : null;
      }
      return prev;
    });
  }, [slots]);

  // Callbacks estables de apertura por slot
  const abrirSlot0 = useCallback(() => abrirSlot(0), [abrirSlot]);
  const abrirSlot1 = useCallback(() => abrirSlot(1), [abrirSlot]);
  const abrirSlot2 = useCallback(() => abrirSlot(2), [abrirSlot]);
  const abrirSlot3 = useCallback(() => abrirSlot(3), [abrirSlot]);
  const abridores = useMemo(
    () => [abrirSlot0, abrirSlot1, abrirSlot2, abrirSlot3],
    [abrirSlot0, abrirSlot1, abrirSlot2, abrirSlot3]
  );

  // Callbacks estables de minimizado por slot
  const minimizarSlot0 = useCallback(() => minimizarSlot(0), [minimizarSlot]);
  const minimizarSlot1 = useCallback(() => minimizarSlot(1), [minimizarSlot]);
  const minimizarSlot2 = useCallback(() => minimizarSlot(2), [minimizarSlot]);
  const minimizarSlot3 = useCallback(() => minimizarSlot(3), [minimizarSlot]);
  const minimizadores = useMemo(
    () => [minimizarSlot0, minimizarSlot1, minimizarSlot2, minimizarSlot3],
    [minimizarSlot0, minimizarSlot1, minimizarSlot2, minimizarSlot3]
  );

  // Setters de carrito 100% referencialmente estables por slot para evitar re-renders en bucle
  const setCarritoSlot0 = useCallback((items: ItemCarrito[]) => {
    setCarritosRapidos((prev) => (prev[0] === items ? prev : [items, prev[1] ?? SIN_RESERVAS, prev[2] ?? SIN_RESERVAS, prev[3] ?? SIN_RESERVAS]));
  }, []);
  const setCarritoSlot1 = useCallback((items: ItemCarrito[]) => {
    setCarritosRapidos((prev) => (prev[1] === items ? prev : [prev[0] ?? SIN_RESERVAS, items, prev[2] ?? SIN_RESERVAS, prev[3] ?? SIN_RESERVAS]));
  }, []);
  const setCarritoSlot2 = useCallback((items: ItemCarrito[]) => {
    setCarritosRapidos((prev) => (prev[2] === items ? prev : [prev[0] ?? SIN_RESERVAS, prev[1] ?? SIN_RESERVAS, items, prev[3] ?? SIN_RESERVAS]));
  }, []);
  const setCarritoSlot3 = useCallback((items: ItemCarrito[]) => {
    setCarritosRapidos((prev) => (prev[3] === items ? prev : [prev[0] ?? SIN_RESERVAS, prev[1] ?? SIN_RESERVAS, prev[2] ?? SIN_RESERVAS, items]));
  }, []);
  const settersCarrito = useMemo(
    () => [setCarritoSlot0, setCarritoSlot1, setCarritoSlot2, setCarritoSlot3],
    [setCarritoSlot0, setCarritoSlot1, setCarritoSlot2, setCarritoSlot3]
  );

  // Arrastrar ventana con requestAnimationFrame (60/120 FPS fluido)
  const iniciarArrastre = useCallback(
    (idx: number, e: React.MouseEvent | React.TouchEvent) => {
      if ("button" in e && e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("input") || target.closest("select")) return;

      traerAlFrente(idx);
      const slot = slots[idx];
      if (!slot) return;

      const startMouseX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startMouseY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const startX = slot.x;
      const startY = slot.y;

      let rafId: number | null = null;
      let latestCurX = startMouseX;
      let latestCurY = startMouseY;

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      const updatePosition = () => {
        const deltaX = latestCurX - startMouseX;
        const deltaY = latestCurY - startMouseY;
        const newX = Math.max(0, Math.min(window.innerWidth - 150, startX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 80, startY + deltaY));

        setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, x: newX, y: newY } : s)));
        rafId = null;
      };

      const onMove = (moveEvt: MouseEvent | TouchEvent) => {
        latestCurX = "touches" in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
        latestCurY = "touches" in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

        if (!rafId) {
          rafId = requestAnimationFrame(updatePosition);
        }
      };

      const onEnd = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          updatePosition();
        }
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };

      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onEnd);
    },
    [slots, traerAlFrente]
  );

  // Redimensionar ventana
  const iniciarRedimension = useCallback(
    (idx: number, e: React.MouseEvent | React.TouchEvent) => {
      if ("button" in e && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      traerAlFrente(idx);
      const slot = slots[idx];
      if (!slot) return;

      const startMouseX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startMouseY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const startW = slot.width;
      const startH = slot.height;

      let rafId: number | null = null;
      let latestCurX = startMouseX;
      let latestCurY = startMouseY;

      document.body.style.userSelect = "none";
      document.body.style.cursor = "se-resize";

      const updateSize = () => {
        const deltaX = latestCurX - startMouseX;
        const deltaY = latestCurY - startMouseY;
        const newW = Math.max(480, Math.min(window.innerWidth - slot.x - 10, startW + deltaX));
        const newH = Math.max(400, Math.min(window.innerHeight - slot.y - 10, startH + deltaY));

        setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, width: newW, height: newH } : s)));
        rafId = null;
      };

      const onMove = (moveEvt: MouseEvent | TouchEvent) => {
        latestCurX = "touches" in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
        latestCurY = "touches" in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

        if (!rafId) {
          rafId = requestAnimationFrame(updateSize);
        }
      };

      const onEnd = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          updateSize();
        }
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };

      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onEnd);
    },
    [slots, traerAlFrente]
  );

  // Conteo y estado de ventanas abiertas
  const abiertasIndices = useMemo(
    () => slots.map((s, i) => (s.abierta ? i : -1)).filter((i) => i !== -1),
    [slots]
  );
  const abiertasCount = abiertasIndices.length;
  const algunaAbierta = abiertasCount > 0;

  const prevAlgunaRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevAlgunaRef.current !== algunaAbierta) {
      prevAlgunaRef.current = algunaAbierta;
      onAlgunaAbiertaChange?.(algunaAbierta);
    }
  }, [algunaAbierta, onAlgunaAbiertaChange]);

  // Slot enfocado para el teclado y escáner
  const slotActivo = useMemo(() => {
    if (abiertasCount === 0) return null;
    if (slotEnfocado !== null && slots[slotEnfocado]?.abierta) return slotEnfocado;
    return abiertasIndices[abiertasIndices.length - 1];
  }, [abiertasCount, slotEnfocado, slots, abiertasIndices]);

  // Reservas cruzadas de stock para la caja principal
  const reservasParaPrincipal = useMemo(
    () => carritosRapidos.flat(),
    [carritosRapidos]
  );

  const prevReservasRef = useRef<ItemCarrito[]>(SIN_RESERVAS);
  useEffect(() => {
    const prev = prevReservasRef.current;
    if (
      prev.length !== reservasParaPrincipal.length ||
      prev.some((it, idx) => it !== reservasParaPrincipal[idx])
    ) {
      prevReservasRef.current = reservasParaPrincipal;
      onReservasChange(reservasParaPrincipal);
    }
  }, [reservasParaPrincipal, onReservasChange]);

  // Reservas cruzadas de stock para cada ventana rápida
  const reservasParaRapida = useMemo(
    () =>
      VENTAS_RAPIDAS_CONFIG.map((_, i) => [
        ...carritoPrincipal,
        ...carritosRapidos.filter((_, j) => j !== i).flat(),
      ]),
    [carritoPrincipal, carritosRapidos]
  );

  // Totales por slot
  const totalesRapidos = useMemo(
    () => carritosRapidos.map((c) => c.reduce((t, i) => t + i.precio * i.cantidad, 0)),
    [carritosRapidos]
  );

  // Info para los botones/barras de la caja principal
  const ventasRapidasInfo: VentaRapidaInfo[] = useMemo(
    () =>
      VENTAS_RAPIDAS_CONFIG.map((_, i) => ({
        configIndex: i,
        items: carritosRapidos[i]?.length ?? 0,
        total: totalesRapidos[i] ?? 0,
        minimizada: !!(slots[i]?.montada && !slots[i]?.abierta && (carritosRapidos[i]?.length ?? 0) > 0),
        montada: !!slots[i]?.montada,
        onAbrir: abridores[i],
      })),
    [carritosRapidos, totalesRapidos, slots, abridores]
  );

  const prevInfoRef = useRef<string>("");
  useEffect(() => {
    const serialized = JSON.stringify(
      ventasRapidasInfo.map((v) => ({
        idx: v.configIndex,
        items: v.items,
        total: v.total,
        min: v.minimizada,
        mont: v.montada,
      }))
    );
    if (serialized !== prevInfoRef.current) {
      prevInfoRef.current = serialized;
      onInfoChange(ventasRapidasInfo);
    }
  }, [ventasRapidasInfo, onInfoChange]);

  // Teclas F1, F2, F3, F4 y Escape
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSlots((prev) => {
          const abiertas = prev.map((s, i) => (s.abierta ? i : -1)).filter((i) => i !== -1);
          if (abiertas.length === 0) return prev;
          const targetIdx =
            slotActivo !== null && prev[slotActivo]?.abierta
              ? slotActivo
              : abiertas[abiertas.length - 1];
          return prev.map((s, i) => (i === targetIdx ? { ...s, abierta: false } : s));
        });
        return;
      }

      const idx = VENTAS_RAPIDAS_CONFIG.findIndex((c) => c.key === e.key);
      if (idx === -1) return;
      e.preventDefault();
      setSlots((prev) => {
        const actual = prev[idx];
        if (!actual) return prev;
        if (actual.abierta) {
          return prev.map((s, i) => (i === idx ? { ...s, abierta: false } : s));
        }
        return prev.map((s, i) =>
          i === idx
            ? { ...s, montada: true, abierta: true, zIndex: zIndexTopRef.current + 1 }
            : s
        );
      });
      traerAlFrente(idx);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [slotActivo, traerAlFrente]);

  // Paneles y Clic fuera de las ventanas flotantes = minimizar
  const panelesRef = useRef<(HTMLDivElement | null)[]>([]);
  const setPanelRef = useCallback(
    (idx: number) => (el: HTMLDivElement | null) => {
      panelesRef.current[idx] = el;
    },
    []
  );

  useEffect(() => {
    if (abiertasCount === 0) return;
    const alPresionar = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Si el clic fue dentro de alguna ventana flotante, no minimizar
      const dentroDeVentana = panelesRef.current.some((panel) => panel && panel.contains(target));
      if (dentroDeVentana) return;

      // Si el clic fue en un modal, menú o portal flotante, no minimizar
      if (target.closest('[role="dialog"]') || target.closest(".modal-portal")) return;

      // Si el clic fue en un botón de la toolbar o barra de espera de la caja principal
      if (target.closest('button[title*="Venta"]') || target.closest('button[title*="Retomar"]')) return;

      // Clic afuera en la caja principal -> minimizar todas las ventas flotantes abiertas
      setSlots((prev) => prev.map((s) => (s.abierta ? { ...s, abierta: false } : s)));
    };

    window.addEventListener("mousedown", alPresionar);
    return () => window.removeEventListener("mousedown", alPresionar);
  }, [abiertasCount]);

  return (
    <>
      {VENTAS_RAPIDAS_CONFIG.map((cfg, idx) => {
        const slot = slots[idx];
        if (!slot?.montada) return null;
        const isEnfocado = slotActivo === idx;

        const estiloPosicion: React.CSSProperties = {
          position: "fixed",
          top: `${slot.y}px`,
          left: `${slot.x}px`,
          width: `${slot.width}px`,
          height: `${slot.height}px`,
          zIndex: slot.zIndex,
        };

        return (
          <div
            key={cfg.key}
            ref={setPanelRef(idx)}
            onMouseDown={() => traerAlFrente(idx)}
            style={estiloPosicion}
            className={`flex flex-col rounded-xl bg-gray-50 overflow-hidden transition-shadow duration-150 ${
              slot.abierta ? "block" : "hidden"
            } ${
              isEnfocado
                ? "shadow-[0_25px_65px_-12px_rgba(15,23,42,0.55)] ring-2 ring-brand-blue"
                : "shadow-[0_12px_35px_-10px_rgba(15,23,42,0.30)] ring-1 ring-slate-900/15"
            }`}
          >
            {/* Barra de título arrastrable */}
            <div
              onMouseDown={(e) => iniciarArrastre(idx, e)}
              onTouchStart={(e) => iniciarArrastre(idx, e)}
              className={`shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 ${cfg.color} text-white cursor-grab active:cursor-grabbing select-none`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="w-4 h-4 opacity-70 shrink-0" />
                <span className="text-xs sm:text-sm font-bold tracking-tight truncate">
                  {cfg.label}
                </span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">
                  {cfg.key}
                </span>
                {isEnfocado && (
                  <span className="hidden sm:inline-flex items-center text-[10px] bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 px-1.5 py-0.5 rounded font-semibold">
                    En foco
                  </span>
                )}
              </div>

              {/* Botón único de Minimizar */}
              <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={minimizadores[idx]}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  title={`Minimizar (${cfg.key} o Esc)`}
                >
                  <Minus className="w-3.5 h-3.5 stroke-3" />
                  <span>Minimizar</span>
                </button>
              </div>
            </div>

            {/* Contenido de la Caja Autopago */}
            <div className="flex-1 min-h-0 overflow-y-auto p-1.5 sm:p-2 bg-gray-50 cursor-default">
              <CajaAutopagoVista
                recursos={recursos}
                activo={slot.abierta && isEnfocado}
                esRapida
                cajaId={cfg.key}
                reservasOtraCaja={reservasParaRapida[idx] ?? []}
                onCarritoCambio={settersCarrito[idx]}
                onVentaTerminada={minimizadores[idx]}
              />
            </div>

            {/* Agarrador para redimensionar en esquina inferior derecha */}
            <div
              onMouseDown={(e) => iniciarRedimension(idx, e)}
              onTouchStart={(e) => iniciarRedimension(idx, e)}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 z-20 text-gray-400 hover:text-gray-700 select-none"
              title="Arrastra para redimensionar el tamaño"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-70">
                <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="5" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="8" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      })}
    </>
  );
});

export default VentasRapidas;
