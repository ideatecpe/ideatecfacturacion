interface Props {
  value: string
  onChange: (value: string) => void
  modo: 'emision' | 'vencimiento' | 'cuota'
  fechaMinima?: string // para cuotas: fecha de la cuota anterior
  label?: string
  className?: string
}

export function DatePickerLimitado({ value, onChange, modo, fechaMinima, label, className }: Props) {
  const hoy = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const calcularLimites = () => {
    if (modo === 'emision') {
      const dosDiasAtras = new Date(hoy)
      dosDiasAtras.setDate(hoy.getDate() - 2)
      return { min: toISO(dosDiasAtras), max: toISO(hoy) }
    }
    if (modo === 'vencimiento') {
      return { min: toISO(hoy), max: undefined }
    }
    if (modo === 'cuota') {
      const manana = new Date(hoy)
      manana.setDate(hoy.getDate() + 1)
      return { min: fechaMinima ?? toISO(manana), max: undefined }
    }
    return { min: undefined, max: undefined }
  }

  const { min, max } = calcularLimites()

  return (
    <div className={className}>
      {label && <label className="text-[10px] font-bold text-gray-500 uppercase">{label}</label>}
      <input
        type="date"
        value={value?.slice(0, 10) ?? ''}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm"
      />
    </div>
  )
}