// SelectConAgregar.tsx
import { ChevronDown, Plus } from "lucide-react"
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
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(!abierto)}
        className={`w-full ${compact ? "py-1.5" : "py-2"} px-3 bg-gray-50 border rounded-xl text-sm text-left outline-none focus:border-brand-blue/50 flex items-center justify-between ${
          showError ? "border-rose-400" : "border-gray-200"
        }`}
      >
        <span className={seleccionada ? "text-gray-700" : "text-gray-400"}>
          {seleccionada?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          
          {/* ── Opción agregar siempre al tope ── */}
          <button
            type="button"
            onMouseDown={() => { onAgregar(); setAbierto(false) }}
            className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 text-brand-blue font-semibold hover:bg-blue-50 border-b border-gray-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar nueva categoría
          </button>

          {/* ── Opciones normales ── */}
          {opciones.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Sin categorías</p>
          ) : (
            opciones.map(o => (
              <button
                key={o.value}
                type="button"
                onMouseDown={() => { onChange(o.value); setAbierto(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 ${
                  o.value === value ? "text-brand-blue font-medium" : "text-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}