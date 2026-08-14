import { ChevronDown, Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";

export interface OpcionSelectConBuscador {
  value: number;
  label: string;
  codigoBarras?: string;
  sublabel?: string;
}

interface Props {
  opciones: OpcionSelectConBuscador[];
  value?: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  showError?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  placement?: "auto" | "top" | "bottom";
}

export function SelectConBuscador({
  opciones,
  value,
  onChange,
  placeholder = "Seleccionar",
  showError = false,
  disabled,
  className,
  compact = true,
  placement = "auto",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [coords, setCoords] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  }>({
    left: 0,
    width: 0,
    maxHeight: 220,
  });

  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const seleccionada = opciones.find((o) => o.value === value);

  const actualizarPosicion = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const abrirArribaCalc =
        placement === "top" ||
        (placement === "auto" && espacioAbajo < 250 && espacioArriba > espacioAbajo);

      const maxH = abrirArribaCalc
        ? Math.min(240, Math.max(120, espacioArriba - 20))
        : Math.min(240, Math.max(120, espacioAbajo - 20));

      setCoords({
        left: rect.left,
        width: rect.width,
        top: abrirArribaCalc ? undefined : rect.bottom + 4,
        bottom: abrirArribaCalc ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: maxH,
      });
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (abierto) {
      setBusqueda("");
      actualizarPosicion();
      setTimeout(() => searchInputRef.current?.focus(), 50);

      window.addEventListener("scroll", actualizarPosicion, true);
      window.addEventListener("resize", actualizarPosicion);
      return () => {
        window.removeEventListener("scroll", actualizarPosicion, true);
        window.removeEventListener("resize", actualizarPosicion);
      };
    }
  }, [abierto, placement]);

  const opcionesFiltradas = opciones.filter((o) => {
    const q = busqueda.trim();
    if (!q) return true;
    const qClean = q.replace(/\s+/g, "").toLowerCase();
    const barcodeClean = (o.codigoBarras ?? "").replace(/\s+/g, "").toLowerCase();
    if (barcodeClean && (barcodeClean === qClean || barcodeClean.includes(qClean))) return true;
    return coincideBusqueda(q, o.label, o.codigoBarras, o.sublabel);
  });

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(!abierto)}
        className={`w-full ${compact ? "py-1.5" : "py-2"} px-3 bg-gray-50 border ${
          showError ? "border-rose-400" : "border-gray-200"
        } rounded-xl text-xs text-left outline-none focus:border-brand-blue/50 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={seleccionada ? "text-gray-800 font-medium truncate" : "text-gray-400 truncate"}>
          {seleccionada?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 ml-1 transition-transform ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        <div
          style={{
            position: "fixed",
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            zIndex: 99999,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* ── Buscador ── */}
          <div className="p-1.5 bg-gray-50/90 border-b border-gray-100 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código o código de barras..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-gray-700 placeholder:text-gray-400"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Lista de opciones ── */}
          <div
            style={{ maxHeight: `${coords.maxHeight - 42}px` }}
            className="overflow-y-auto py-0.5"
          >
            {/* Opción deseleccionar / por defecto */}
            <button
              type="button"
              onMouseDown={() => {
                onChange(null);
                setAbierto(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 italic hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              {placeholder}
            </button>

            {opcionesFiltradas.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-gray-400 text-center font-medium">
                No se encontraron productos
              </p>
            ) : (
              opcionesFiltradas.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onMouseDown={() => {
                    onChange(o.value);
                    setAbierto(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-blue-50/50 flex flex-col gap-0.5 border-b border-gray-50 last:border-0 ${
                    o.value === value
                      ? "text-brand-blue font-semibold bg-blue-50/60"
                      : "text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-medium truncate">{o.label}</span>
                    {o.codigoBarras && (
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                        🏷️ {o.codigoBarras}
                      </span>
                    )}
                  </div>
                  {o.sublabel && (
                    <span className="text-[10px] text-gray-400 truncate">{o.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
