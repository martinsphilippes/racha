// Camada de escrita: toda ação do usuário passa por aqui e é persistida no Firestore.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type UpdateData,
} from 'firebase/firestore'
import { db } from './firebase'
import { inviteCode, newId } from './ids'
import { matchIdFor, matchTimes, upcomingDates } from './matches'
import type {
  Announcement, AvailabilityStatus, Court, Group, Match, MatchPlayer, Member, PixKeyType, Position, Schedule, Sport, Team, Venue,
} from './types'

export const groupRef = (gid: string) => doc(db, 'groups', gid)
export const memberRef = (gid: string, uid: string) => doc(db, 'groups', gid, 'members', uid)
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
  const code = inviteCode()
  const batch = writeBatch(db)
  const group: Omit<Group, 'id'> = {
    name: input.name.trim(),
    sport: input.sport,
    createdBy: actor.uid,
    createdAt: Date.now(),
    inviteCode: code,
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
  const member: Omit<Member, 'id'> = { uid: actor.uid, groupId: gid, name: actor.name, role: 'manager', joinedAt: Date.now() }
  batch.set(memberRef(gid, actor.uid), member)
  batch.set(doc(db, 'invites', code), { code, groupId: gid, groupName: group.name, createdAt: Date.now() })
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

/** Entra em um grupo pelo código de convite. Retorna o id do grupo. */
export async function joinGroup(code: string, actor: Actor): Promise<string> {
  const normalized = code.trim().toUpperCase()
  const invite = await getDoc(doc(db, 'invites', normalized))
  if (!invite.exists()) throw new Error('Código de convite não encontrado.')
  const gid = invite.data().groupId as string
  const existing = await getDoc(memberRef(gid, actor.uid)).catch(() => null)
  if (existing?.exists()) return gid
  const member: Omit<Member, 'id'> = {
    uid: actor.uid, groupId: gid, name: actor.name, role: 'player', joinedAt: Date.now(), inviteCode: normalized,
  }
  await setDoc(memberRef(gid, actor.uid), member)
  return gid
}

export async function regenerateInviteCode(group: Group): Promise<string> {
  const code = inviteCode()
  const batch = writeBatch(db)
  batch.update(groupRef(group.id), { inviteCode: code })
  batch.set(doc(db, 'invites', code), { code, groupId: group.id, groupName: group.name, createdAt: Date.now() })
  if (group.inviteCode) batch.delete(doc(db, 'invites', group.inviteCode))
  await batch.commit()
  return code
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
  await setDoc(venueRef(gid, id), { name: venue.name.trim(), address: venue.address.trim(), notes: venue.notes.trim(), createdAt: venue.createdAt ?? Date.now() })
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

export async function setAvailability(
  gid: string, mid: string, actor: Actor, status: AvailabilityStatus, position: Position | null,
): Promise<void> {
  const ref = playerRef(gid, mid, actor.uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const now = Date.now()
    if (snap.exists()) {
      tx.update(ref, { status, position, updatedAt: now, name: actor.name })
    } else {
      const player: Omit<MatchPlayer, 'id'> = { name: actor.name, status, position, paid: false, paidAt: null, updatedAt: now }
      tx.set(ref, player)
    }
  })
}

/** Gestor define disponibilidade/posição de qualquer membro. */
export async function managerSetPlayer(
  gid: string, mid: string, member: Pick<Member, 'uid' | 'name'>, status: AvailabilityStatus, position: Position | null,
): Promise<void> {
  const ref = playerRef(gid, mid, member.uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const now = Date.now()
    if (snap.exists()) tx.update(ref, { status, position, updatedAt: now })
    else {
      const player: Omit<MatchPlayer, 'id'> = { name: member.name, status, position, paid: false, paidAt: null, updatedAt: now }
      tx.set(ref, player)
    }
  })
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
