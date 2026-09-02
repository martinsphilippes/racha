export const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "2026-09-08" -> Date local (meia-noite) */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date -> "2026-09-08" (fuso local) */
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayString(): string {
  return toDateString(new Date())
}

/** "2026-09-08" -> "08/09/2026" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** "2026-09-08" -> "Terça-feira — 08/09/2026" */
export function formatDateLong(date: string): string {
  const d = parseDate(date)
  return `${WEEKDAYS[d.getDay()]} — ${formatDate(date)}`
}

/** "19:30" + 90 -> "21:00" */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** "19:30", 90 -> "19h30 às 21h00" */
export function formatTimeRange(start: string, durationMinutes: number): string {
  const end = addMinutes(start, durationMinutes)
  return `${start.replace(':', 'h')} às ${end.replace(':', 'h')}`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`
  if (h) return `${h}h`
  return `${m}min`
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/** "João da Silva Souza" -> "João Souza" (nome curto para listas) */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 2) return parts.join(' ')
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
