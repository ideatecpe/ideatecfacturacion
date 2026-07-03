import { ChevronDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface Opcion {
  value: number
  label: string
  labelCorto: string
}

interface Props {
  opciones: Opcion[]
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

export function SelectPersonalizado({ opciones, value, onChange, disabled, className }: Props) {
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
        className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-sm text-left outline-none focus:border-brand-blue/50 flex items-center justify-between"
      >
        <span className="text-gray-700">{seleccionada?.labelCorto ?? 'Seleccionar'}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="absolute z-50 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {opciones.map(o => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()  // ← fix
                onChange(o.value)
                setAbierto(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0
                ${o.value === value ? 'text-brand-blue font-medium' : 'text-gray-700'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}