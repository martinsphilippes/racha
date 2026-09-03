import type { Match, MatchPlayer, MatchStatus, Position, Schedule } from './types'
import { parseDate, toDateString } from './format'

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  open: 'Aguardando confirmações',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  finished: 'Finalizada',
}

/** Custo total da partida: manual (se definido) ou valor/hora × duração. */
export function matchCost(match: Pick<Match, 'hourlyRate' | 'durationMinutes' | 'costOverride'>): number {
  if (match.costOverride != null && match.costOverride >= 0) return match.costOverride
  return round2((match.hourlyRate * match.durationMinutes) / 60)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function isGoalkeeper(p: Pick<MatchPlayer, 'position'>): boolean {
  return p.position === 'goalkeeper'
}

export interface Split {
  cost: number
  /** Previsão do valor individual com a quantidade mínima de jogadores configurada (evita o susto de quem confirma cedo). */
  estimatedPerPlayer: number
  estimatedPlayers: number
  available: MatchPlayer[]
  unavailable: MatchPlayer[]
  goalkeepers: MatchPlayer[]
  linePlayers: MatchPlayer[]
  payers: MatchPlayer[] // goleiros nunca pagam
  perPlayer: number
  paidCount: number
  unpaidCount: number
  received: number
  remaining: number
}

/**
 * Rateio da partida. REGRA: goleiros não pagam; o custo é dividido
 * somente entre os jogadores de linha disponíveis. Recalculado a cada
 * mudança de disponibilidade/posição — o valor exibido é sempre o atual.
 */
export function computeSplit(
  match: Pick<Match, 'hourlyRate' | 'durationMinutes' | 'costOverride'> & { minPlayers?: number },
  players: MatchPlayer[],
): Split {
  const cost = matchCost(match)
  const available = players.filter((p) => p.status === 'available')
  const unavailable = players.filter((p) => p.status === 'unavailable')
  const goalkeepers = available.filter(isGoalkeeper)
  const linePlayers = available.filter((p) => !isGoalkeeper(p))
  const payers = linePlayers
  // Arredonda para cima nos centavos para que a soma cubra o custo.
  const perPlayer = payers.length ? Math.ceil((cost / payers.length) * 100) / 100 : 0
  const paidCount = payers.filter((p) => p.paid).length
  const unpaidCount = payers.length - paidCount
  const received = round2(paidCount * perPlayer)
  const remaining = Math.max(0, round2(cost - received))
  // Previsão: rateio com o mínimo de jogadores do grupo (ou os pagantes atuais, se já forem mais).
  const estimatedPlayers = Math.max(match.minPlayers ?? 0, payers.length)
  const estimatedPerPlayer = estimatedPlayers > 0 ? Math.ceil((cost / estimatedPlayers) * 100) / 100 : 0
  return { cost, estimatedPerPlayer, estimatedPlayers, available, unavailable, goalkeepers, linePlayers, payers, perPlayer, paidCount, unpaidCount, received, remaining }
}

/** Status efetivo: partidas abertas/confirmadas cujo horário já passou aparecem como finalizadas. */
export function effectiveStatus(match: Pick<Match, 'status' | 'endsAt'>, now = Date.now()): MatchStatus {
  if ((match.status === 'open' || match.status === 'confirmed') && match.endsAt < now) return 'finished'
  return match.status
}

export function isMatchOpen(match: Pick<Match, 'status' | 'endsAt'>, now = Date.now()): boolean {
  const s = effectiveStatus(match, now)
  return s === 'open' || s === 'confirmed'
}

/** Calcula startsAt/endsAt (epoch ms, fuso local) a partir de data e horário. */
export function matchTimes(date: string, startTime: string, durationMinutes: number): { startsAt: number; endsAt: number } {
  const d = parseDate(date)
  const [h, m] = startTime.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  const startsAt = d.getTime()
  return { startsAt, endsAt: startsAt + durationMinutes * 60_000 }
}

/** ID determinístico: a mesma data da mesma agenda nunca gera duas partidas. */
export function matchIdFor(scheduleId: string, date: string): string {
  return `${scheduleId}_${date}`
}

/**
 * Próximas datas de uma agenda semanal a partir de `from` (inclusive),
 * ignorando ocorrências cujo horário de início já passou.
 */
export function upcomingDates(
  schedule: Pick<Schedule, 'weekday' | 'startTime' | 'weeksAhead'>,
  now: Date = new Date(),
): string[] {
  const dates: string[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const delta = (schedule.weekday - cursor.getDay() + 7) % 7
  cursor.setDate(cursor.getDate() + delta)
  const [h, m] = schedule.startTime.split(':').map(Number)
  // Se hoje é o dia, mas o horário já passou, começa na próxima semana.
  const firstStart = new Date(cursor)
  firstStart.setHours(h, m, 0, 0)
  if (firstStart.getTime() < now.getTime()) cursor.setDate(cursor.getDate() + 7)
  for (let i = 0; i < Math.max(1, schedule.weeksAhead); i++) {
    dates.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return dates
}

export function defaultPosition(): Position {
  return 'line'
}

/** Mensagem de progresso rumo ao mínimo de jogadores. */
export function minPlayersMessage(availableCount: number, minPlayers: number): string {
  if (minPlayers <= 0) return `${availableCount} jogador${availableCount === 1 ? '' : 'es'} confirmado${availableCount === 1 ? '' : 's'}`
  const missing = minPlayers - availableCount
  if (missing <= 0) return `${availableCount} jogadores confirmados · mínimo atingido`
  return `Faltam ${missing} jogador${missing === 1 ? '' : 'es'} para atingir o mínimo de ${minPlayers}`
}
