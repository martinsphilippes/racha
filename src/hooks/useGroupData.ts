import { useEffect, useMemo, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { todayString } from '@/lib/format'
import { effectiveStatus } from '@/lib/matches'
import type { Announcement, Court, Match, MatchPlayer, Member, Schedule, Venue } from '@/lib/types'
import { useCollection } from './useFirestore'

export function useMembers(gid: string | null) {
  return useCollection<Member>(() => (gid ? query(collection(db, 'groups', gid, 'members'), orderBy('name')) : null), [gid])
}

export function useVenues(gid: string | null) {
  return useCollection<Venue>(() => (gid ? query(collection(db, 'groups', gid, 'venues'), orderBy('name')) : null), [gid])
}

export function useCourts(gid: string | null) {
  return useCollection<Court>(() => (gid ? query(collection(db, 'groups', gid, 'courts'), orderBy('name')) : null), [gid])
}

export function useSchedules(gid: string | null) {
  return useCollection<Schedule>(() => (gid ? query(collection(db, 'groups', gid, 'schedules'), orderBy('weekday')) : null), [gid])
}

/** Partidas de hoje em diante, em ordem cronológica. */
export function useUpcomingMatches(gid: string | null) {
  const today = todayString()
  const state = useCollection<Match>(
    () => (gid ? query(collection(db, 'groups', gid, 'matches'), where('date', '>=', today), orderBy('date')) : null),
    [gid, today],
  )
  const sorted = useMemo(() => [...state.data].sort((a, b) => a.startsAt - b.startsAt), [state.data])
  return { ...state, data: sorted }
}

/** Próxima partida "viva": aberta ou confirmada e ainda não encerrada. */
export function useNextMatch(gid: string | null) {
  const { data, loading } = useUpcomingMatches(gid)
  const now = Date.now()
  const next = data.find((m) => {
    const s = effectiveStatus(m, now)
    return s === 'open' || s === 'confirmed'
  }) ?? null
  return { match: next, loading }
}

/** Histórico: partidas passadas (mais recentes primeiro). */
export function usePastMatches(gid: string | null, max = 60) {
  const today = todayString()
  return useCollection<Match>(
    () => (gid ? query(collection(db, 'groups', gid, 'matches'), where('date', '<', today), orderBy('date', 'desc'), limit(max)) : null),
    [gid, today, max],
  )
}

export function useMatchPlayers(gid: string | null, mid: string | null) {
  return useCollection<MatchPlayer>(
    () => (gid && mid ? query(collection(db, 'groups', gid, 'matches', mid, 'players'), orderBy('name')) : null),
    [gid, mid],
  )
}

export function useAnnouncements(gid: string | null, max = 20) {
  return useCollection<Announcement>(
    () => (gid ? query(collection(db, 'groups', gid, 'announcements'), orderBy('createdAt', 'desc'), limit(max)) : null),
    [gid, max],
  )
}

/** Nomes de vários grupos (para o seletor de grupo e o perfil). */
export function useGroupNames(groupIds: string[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({})
  const key = groupIds.join(',')
  useEffect(() => {
    const ids = key ? key.split(',') : []
    const unsubs = ids.map((id) =>
      onSnapshot(doc(db, 'groups', id), (snap) => {
        if (snap.exists()) setNames((n) => ({ ...n, [id]: (snap.data().name as string) ?? '' }))
      }, () => undefined),
    )
    return () => unsubs.forEach((u) => u())
  }, [key])
  return names
}
