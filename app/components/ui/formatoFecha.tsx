/**
 * Formatea un monto eliminando decimales innecesarios.
 * 70.00 → "70"   |   70.50 → "70.5"   |   70.55 → "70.55"
 */
export function fmtMonto(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

export function formatoFechaActual() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const fechaHora = `${fecha}T${hora}`

  return { fecha, hora, fechaHora }
}

/**
 * Convierte una Date a string local YYYY-MM-DDTHH:MM (sin UTC).
 * Útil para atributos min/max de inputs datetime-local.
 */
export function fechaLocalISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Recibe "2024-10-30T19:51:00" y devuelve { fecha, hora, fechaHora }
export function separarFechaHora(fechaHora: string) {
  const [fecha, hora] = fechaHora.split('T')
  return { fecha, hora: hora ?? '00:00:00', fechaHora }
}