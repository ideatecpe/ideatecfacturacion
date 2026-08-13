// SelectConAgregar.tsx
import { ChevronDown, Plus, Search, X } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface Opcion {
  value: number
  label: string
}

interface Props {
  opciones: Opcion[]
  value: number | null
  onChange: (value: number) => void
  onAgregar: () => void
  placeholder?: string
  showError?: boolean
  disabled?: boolean
  className?: string
  compact?: boolean
}

export function SelectConAgregar({
  opciones,
  value,
  onChange,
  onAgregar,
  placeholder = "Seleccionar",
  showError,
  disabled,
  className,
  compact = false,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const seleccionada = opciones.find(o => o.value === value)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (abierto) {
      setBusqueda("")
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [abierto])

  const opcionesFiltradas = opciones.filter(o =>
    o.label.toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(!abierto)}
        className={`w-full py-1.5 px-4 bg-gray-50 border rounded-xl text-sm text-left outline-none focus:border-brand-blue/50 flex items-center justify-between ${
          showError ? "border-rose-400" : "border-gray-200"
        }`}
      >
        <span className={seleccionada ? "text-gray-700 font-normal truncate" : "text-gray-400 truncate"}>
          {seleccionada?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 ml-1 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          
          {/* ── Opción agregar siempre al tope ── */}
          <button
            type="button"
            onMouseDown={() => { onAgregar(); setAbierto(false) }}
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-1.5 text-brand-blue font-semibold hover:bg-blue-50 border-b border-gray-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar nueva categoría
          </button>

          {/* ── Buscador compacto ── */}
          <div className="p-1.5 bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar categoría..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-gray-700 placeholder:text-gray-400"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* ── Lista de opciones compacta ── */}
          <div className="max-h-44 overflow-y-auto py-0.5">
            {opcionesFiltradas.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-gray-400 text-center font-medium">
                {opciones.length === 0 ? "Sin categorías" : "No se encontraron categorías"}
              </p>
            ) : (
              opcionesFiltradas.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onMouseDown={() => { onChange(o.value); setAbierto(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 ${
                    o.value === value ? "text-brand-blue font-semibold bg-blue-50/50" : "text-gray-700"
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}