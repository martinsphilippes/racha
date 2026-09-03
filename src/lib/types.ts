// Modelo de dados do Racha (Firestore).
// Estrutura hierárquica: tudo que pertence a um grupo fica sob groups/{groupId}.
// Isso simplifica as regras de segurança (o caminho já diz a qual grupo o dado pertence).

export type Sport = 'futsal' | 'society'
export const SPORTS: { value: Sport; label: string }[] = [
  { value: 'futsal', label: 'Futsal' },
  { value: 'society', label: 'Society' },
]

// Posições. Estruturado para permitir novas posições por modalidade no futuro.
export type Position = 'line' | 'goalkeeper'
export const POSITIONS: { value: Position; label: string; short: string }[] = [
  { value: 'line', label: 'Linha', short: 'L' },
  { value: 'goalkeeper', label: 'Goleiro', short: 'G' },
]
export const POSITIONS_BY_SPORT: Record<Sport, Position[]> = {
  futsal: ['line', 'goalkeeper'],
  society: ['line', 'goalkeeper'],
}

export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random'
export const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'random', label: 'Chave aleatória' },
]

export type MemberRole = 'manager' | 'player'
export type MatchStatus = 'open' | 'confirmed' | 'cancelled' | 'finished'
export type AvailabilityStatus = 'available' | 'unavailable'

import type { PlatformRole } from './platform'

// directory/{uid} — visível a todos os usuários autenticados (para o organizador montar o grupo)
// e onde o dono define o papel de plataforma. Dados privados ficam em users/{uid}.
export interface DirectoryEntry {
  id: string
  uid: string
  name: string
  email: string
  platformRole: PlatformRole
  createdAt: number
}

// users/{uid} — privado (só o próprio usuário lê)
export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  address: string
  createdAt: number
}

// groups/{groupId}
export interface Group {
  id: string
  name: string
  sport: Sport
  createdBy: string
  createdAt: number
  minPlayers: number
  notes: string
  // Padrões do futebol recorrente (informativo; a agenda real fica em schedules)
  defaultVenueId: string | null
  defaultCourtId: string | null
  weekday: number | null // 0 = domingo ... 6 = sábado
  startTime: string | null // "19:30"
  durationMinutes: number | null
  // PIX
  pixKeyType: PixKeyType | null
  pixKey: string | null
  pixName: string | null // nome do recebedor (para "copia e cola")
  pixCity: string | null // cidade do recebedor (para "copia e cola")
}

// groups/{groupId}/members/{uid}
export interface Member {
  id: string // = uid
  uid: string
  groupId: string
  name: string
  role: MemberRole
  joinedAt: number
  addedBy: string // uid de quem adicionou (o próprio, na criação do grupo)
}

// groups/{groupId}/venues/{venueId}
export interface Venue {
  id: string
  name: string
  address: string
  notes: string
  createdAt: number
}

// groups/{groupId}/courts/{courtId}
export interface Court {
  id: string
  venueId: string
  name: string
  sport: Sport
  hourlyRate: number // R$ por hora
  notes: string
}

// groups/{groupId}/schedules/{scheduleId} — futebol recorrente
export interface Schedule {
  id: string
  weekday: number
  startTime: string // "19:30"
  durationMinutes: number
  venueId: string
  courtId: string
  weeksAhead: number // quantas partidas futuras manter geradas
  active: boolean
  createdAt: number
}

export interface Team {
  id: string
  name: string
  playerIds: string[]
}

// groups/{groupId}/matches/{matchId}
// Cada data é uma partida independente. Dados do local são copiados (snapshot)
// para que o histórico não mude se o local/quadra for editado depois.
export interface Match {
  id: string
  scheduleId: string | null
  date: string // "2026-09-08"
  startTime: string // "19:30"
  durationMinutes: number
  startsAt: number // epoch ms (fuso do navegador de quem criou)
  endsAt: number
  sport: Sport
  venueId: string | null
  courtId: string | null
  venueName: string
  courtName: string
  address: string
  hourlyRate: number
  costOverride: number | null // custo manual definido pelo gestor
  minPlayers: number
  status: MatchStatus
  teams: Team[]
  teamsGeneratedAt: number | null
  createdAt: number
  createdBy: string
}

// groups/{groupId}/matches/{matchId}/players/{uid}
// Disponibilidade + posição + pagamento em um só documento por atleta/partida.
export interface MatchPlayer {
  id: string // = uid
  name: string
  status: AvailabilityStatus
  position: Position | null
  paid: boolean
  paidAt: number | null
  updatedAt: number
}

// groups/{groupId}/announcements/{announcementId}
export interface Announcement {
  id: string
  text: string
  matchId: string | null
  createdBy: string
  createdByName: string
  createdAt: number
}

