// Camada de escrita: toda ação do usuário passa por aqui e é persistida no Firestore.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type UpdateData,
} from 'firebase/firestore'
import { db } from './firebase'
import { newId } from './ids'
import { matchIdFor, matchTimes, upcomingDates } from './matches'
import type {
  Announcement, AvailabilityStatus, Court, DirectoryEntry, Group, Match, MatchPlayer, Member, PixKeyType, Position, Schedule, Sport, Team, Venue,
} from './types'
import type { PlatformRole } from './platform'

export const groupRef = (gid: string) => doc(db, 'groups', gid)
export const memberRef = (gid: string, uid: string) => doc(db, 'groups', gid, 'members', uid)
export const directoryRef = (uid: string) => doc(db, 'directory', uid)
export const venueRef = (gid: string, vid: string) => doc(db, 'groups', gid, 'venues', vid)
export const courtRef = (gid: string, cid: string) => doc(db, 'groups', gid, 'courts', cid)
export const scheduleRef = (gid: string, sid: string) => doc(db, 'groups', gid, 'schedules', sid)
export const matchRef = (gid: string, mid: string) => doc(db, 'groups', gid, 'matches', mid)
export const playerRef = (gid: string, mid: string, uid: string) => doc(db, 'groups', gid, 'matches', mid, 'players', uid)
export const announcementRef = (gid: string, aid: string) => doc(db, 'groups', gid, 'announcements', aid)

interface Actor { uid: string; name: string }

// ---------- Grupos ----------

export interface GroupInput {
  name: string
  sport: Sport
  minPlayers: number
  notes: string
}

export async function createGroup(input: GroupInput, actor: Actor): Promise<string> {
  const gid = newId()
  const batch = writeBatch(db)
  const group: Omit<Group, 'id'> = {
    name: input.name.trim(),
    sport: input.sport,
    createdBy: actor.uid,
    createdAt: Date.now(),
    minPlayers: input.minPlayers,
    notes: input.notes.trim(),
    defaultVenueId: null,
    defaultCourtId: null,
    weekday: null,
    startTime: null,
    durationMinutes: null,
    pixKeyType: null,
    pixKey: null,
    pixName: null,
    pixCity: null,
  }
  batch.set(groupRef(gid), group)
  const member: Omit<Member, 'id'> = { uid: actor.uid, groupId: gid, name: actor.name, role: 'manager', joinedAt: Date.now(), addedBy: actor.uid }
  batch.set(memberRef(gid, actor.uid), member)
  await batch.commit()
  return gid
}

export async function updateGroup(gid: string, data: UpdateData<Group>): Promise<void> {
  await updateDoc(groupRef(gid), data)
}

export interface PixInput { pixKeyType: PixKeyType | null; pixKey: string | null; pixName: string | null; pixCity: string | null }
export async function updatePix(gid: string, pix: PixInput): Promise<void> {
  await updateDoc(groupRef(gid), { ...pix })
}

// ---------- Diretório e papéis de plataforma ----------

/** Garante o registro público do usuário no diretório (criado no cadastro; reparado no login). */
export async function ensureDirectoryEntry(user: { uid: string; name: string; email: string }, role: PlatformRole): Promise<void> {
  const existing = await getDoc(directoryRef(user.uid)).catch(() => null)
  if (existing?.exists()) return
  const entry: Omit<DirectoryEntry, 'id'> = { uid: user.uid, name: user.name, email: user.email.toLowerCase(), platformRole: role, createdAt: Date.now() }
  await setDoc(directoryRef(user.uid), entry)
}

/** Dono: define o papel de plataforma de um usuário. */
export async function setPlatformRole(uid: string, platformRole: Exclude<PlatformRole, 'owner'>): Promise<void> {
  await updateDoc(directoryRef(uid), { platformRole })
}

/** Dono: apaga registros de acesso (ex.: testes) e registros do diretório. */
export async function deleteAccessLogs(ids: string[]): Promise<void> {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400))
  for (const chunk of chunks) {
    const batch = writeBatch(db)
    chunk.forEach((id) => batch.delete(doc(db, 'accessLogs', id)))
    await batch.commit()
  }
}

export async function deleteDirectoryEntry(uid: string): Promise<void> {
  await deleteDoc(directoryRef(uid))
}

/** Gestor/dono adiciona um usuário do diretório ao grupo. */
export async function addMember(gid: string, entry: Pick<DirectoryEntry, 'uid' | 'name'>, role: Member['role'], actor: Actor): Promise<void> {
  const member: Omit<Member, 'id'> = { uid: entry.uid, groupId: gid, name: entry.name, role, joinedAt: Date.now(), addedBy: actor.uid }
  await setDoc(memberRef(gid, entry.uid), member)
}

/** Adiciona vários atletas de uma vez (um único envio ao banco). */
export async function addMembers(gid: string, entries: Pick<DirectoryEntry, 'uid' | 'name'>[], actor: Actor): Promise<void> {
  if (entries.length === 0) return
  const batch = writeBatch(db)
  for (const entry of entries) {
    const member: Omit<Member, 'id'> = { uid: entry.uid, groupId: gid, name: entry.name, role: 'player', joinedAt: Date.now(), addedBy: actor.uid }
    batch.set(memberRef(gid, entry.uid), member)
  }
  await batch.commit()
}

export async function setMemberRole(gid: string, uid: string, role: Member['role']): Promise<void> {
  await updateDoc(memberRef(gid, uid), { role })
}

export async function removeMember(gid: string, uid: string): Promise<void> {
  await deleteDoc(memberRef(gid, uid))
}

// ---------- Locais e quadras ----------

export async function saveVenue(gid: string, venue: Partial<Venue> & Pick<Venue, 'name' | 'address' | 'notes'>): Promise<string> {
  const id = venue.id ?? newId()
  await setDoc(venueRef(gid, id), {
    name: venue.name.trim(), address: venue.address.trim(), lat: venue.lat ?? null, lng: venue.lng ?? null,
    notes: venue.notes.trim(), createdAt: venue.createdAt ?? Date.now(),
  })
  return id
}

export async function deleteVenue(gid: string, vid: string, courts: Court[]): Promise<void> {
  const batch = writeBatch(db)
  courts.filter((c) => c.venueId === vid).forEach((c) => batch.delete(courtRef(gid, c.id)))
  batch.delete(venueRef(gid, vid))
  await batch.commit()
}

export async function saveCourt(gid: string, court: Partial<Court> & Pick<Court, 'venueId' | 'name' | 'sport' | 'hourlyRate' | 'notes'>): Promise<string> {
  const id = court.id ?? newId()
  await setDoc(courtRef(gid, id), { venueId: court.venueId, name: court.name.trim(), sport: court.sport, hourlyRate: court.hourlyRate, notes: court.notes.trim() })
  return id
}

export async function deleteCourt(gid: string, cid: string): Promise<void> {
  await deleteDoc(courtRef(gid, cid))
}

// ---------- Agenda recorrente e partidas ----------

export interface ScheduleInput {
  weekday: number
  startTime: string
  durationMinutes: number
  venueId: string
  courtId: string
  weeksAhead: number
}

export async function saveSchedule(gid: string, input: ScheduleInput, existingId?: string): Promise<string> {
  const id = existingId ?? newId()
  await setDoc(scheduleRef(gid, id), { ...input, active: true, createdAt: Date.now() }, { merge: true })
  // Mantém os padrões do grupo sincronizados com a agenda (usado na tela inicial e no painel).
  await updateDoc(groupRef(gid), {
    defaultVenueId: input.venueId, defaultCourtId: input.courtId,
    weekday: input.weekday, startTime: input.startTime, durationMinutes: input.durationMinutes,
  })
  return id
}

export async function setScheduleActive(gid: string, sid: string, active: boolean): Promise<void> {
  await updateDoc(scheduleRef(gid, sid), { active })
}

function matchSnapshot(group: Group, venue: Venue | undefined, court: Court | undefined) {
  return {
    sport: court?.sport ?? group.sport,
    venueId: venue?.id ?? null,
    courtId: court?.id ?? null,
    venueName: venue?.name ?? '',
    courtName: court?.name ?? '',
    address: venue?.address ?? '',
    lat: venue?.lat ?? null,
    lng: venue?.lng ?? null,
    hourlyRate: court?.hourlyRate ?? 0,
  }
}

/**
 * Garante que as próximas partidas da agenda existam (idempotente).
 * Cada data é uma partida independente; partidas já criadas nunca são sobrescritas.
 */
export async function ensureUpcomingMatches(
  group: Group, schedule: Schedule, venues: Venue[], courts: Court[], actorUid: string,
): Promise<number> {
  if (!schedule.active) return 0
  const dates = upcomingDates(schedule)
  const existing = await getDocs(query(collection(db, 'groups', group.id, 'matches'), where('scheduleId', '==', schedule.id)))
  const have = new Set(existing.docs.map((d) => d.data().date as string))
  const venue = venues.find((v) => v.id === schedule.venueId)
  const court = courts.find((c) => c.id === schedule.courtId)
  const batch = writeBatch(db)
  let created = 0
  for (const date of dates) {
    if (have.has(date)) continue
    const { startsAt, endsAt } = matchTimes(date, schedule.startTime, schedule.durationMinutes)
    const match: Omit<Match, 'id'> = {
      scheduleId: schedule.id,
      date,
      startTime: schedule.startTime,
      durationMinutes: schedule.durationMinutes,
      startsAt,
      endsAt,
      ...matchSnapshot(group, venue, court),
      costOverride: null,
      minPlayers: group.minPlayers,
      status: 'open',
      teams: [],
      teamsGeneratedAt: null,
      createdAt: Date.now(),
      createdBy: actorUid,
    }
    batch.set(matchRef(group.id, matchIdFor(schedule.id, date)), match)
    created++
  }
  if (created) await batch.commit()
  return created
}

export interface MatchInput {
  date: string
  startTime: string
  durationMinutes: number
  venueId: string | null
  courtId: string | null
  costOverride: number | null
  minPlayers: number
}

export async function createMatch(group: Group, input: MatchInput, venues: Venue[], courts: Court[], actorUid: string): Promise<string> {
  const id = newId()
  const venue = venues.find((v) => v.id === input.venueId)
  const court = courts.find((c) => c.id === input.courtId)
  const { startsAt, endsAt } = matchTimes(input.date, input.startTime, input.durationMinutes)
  const match: Omit<Match, 'id'> = {
    scheduleId: null,
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    startsAt,
    endsAt,
    ...matchSnapshot(group, venue, court),
    costOverride: input.costOverride,
    minPlayers: input.minPlayers,
    status: 'open',
    teams: [],
    teamsGeneratedAt: null,
    createdAt: Date.now(),
    createdBy: actorUid,
  }
  await setDoc(matchRef(group.id, id), match)
  return id
}

export async function updateMatch(group: Group, match: Match, input: MatchInput, venues: Venue[], courts: Court[]): Promise<void> {
  const venue = venues.find((v) => v.id === input.venueId)
  const court = courts.find((c) => c.id === input.courtId)
  const { startsAt, endsAt } = matchTimes(input.date, input.startTime, input.durationMinutes)
  await updateDoc(matchRef(group.id, match.id), {
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    startsAt,
    endsAt,
    ...matchSnapshot(group, venue, court),
    costOverride: input.costOverride,
    minPlayers: input.minPlayers,
  })
}

export async function setMatchStatus(gid: string, mid: string, status: Match['status']): Promise<void> {
  await updateDoc(matchRef(gid, mid), { status })
}

export async function deleteMatch(gid: string, mid: string): Promise<void> {
  await deleteDoc(matchRef(gid, mid))
}

// ---------- Disponibilidade, posição e pagamento ----------

/**
 * Disponibilidade/posição do próprio atleta.
 * Sem transação: gravações simples têm atualização otimista (a tela muda na hora,
 * o servidor confirma em seguida). `exists` vem do snapshot já carregado na tela.
 */
export async function setAvailability(
  gid: string, mid: string, actor: Actor, status: AvailabilityStatus, position: Position | null, exists: boolean,
): Promise<void> {
  const ref = playerRef(gid, mid, actor.uid)
  const now = Date.now()
  if (exists) {
    await updateDoc(ref, { status, position, updatedAt: now, name: actor.name })
  } else {
    const player: Omit<MatchPlayer, 'id'> = { name: actor.name, status, position, paid: false, paidAt: null, updatedAt: now }
    await setDoc(ref, player)
  }
}

/**
 * Gestor define disponibilidade/posição de qualquer membro.
 * `merge` cria o registro se não existir e, se existir, altera só estes campos
 * (nunca mexe no pagamento, mesmo com toques rápidos em sequência).
 */
export async function managerSetPlayer(
  gid: string, mid: string, member: Pick<Member, 'uid' | 'name'>, status: AvailabilityStatus, position: Position | null, exists: boolean,
): Promise<void> {
  const ref = playerRef(gid, mid, member.uid)
  const base = { name: member.name, status, position, updatedAt: Date.now() }
  await setDoc(ref, exists ? base : { ...base, paid: false, paidAt: null }, { merge: true })
}

export async function setPaid(gid: string, mid: string, uid: string, paid: boolean): Promise<void> {
  await updateDoc(playerRef(gid, mid, uid), { paid, paidAt: paid ? Date.now() : null })
}

export async function saveTeams(gid: string, mid: string, teams: Team[]): Promise<void> {
  await updateDoc(matchRef(gid, mid), { teams, teamsGeneratedAt: teams.length ? Date.now() : null })
}

// ---------- Comunicados ----------

export async function postAnnouncement(gid: string, text: string, matchId: string | null, actor: Actor): Promise<void> {
  const id = newId()
  const a: Omit<Announcement, 'id'> = {
    text: text.trim(), matchId, createdBy: actor.uid, createdByName: actor.name, createdAt: Date.now(),
  }
  await setDoc(announcementRef(gid, id), a)
}

export async function deleteAnnouncement(gid: string, aid: string): Promise<void> {
  await deleteDoc(announcementRef(gid, aid))
}
