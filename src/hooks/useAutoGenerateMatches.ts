import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { useGroup } from './useGroupContext'
import { useCourts, useSchedules, useVenues } from './useGroupData'
import { ensureUpcomingMatches } from '@/lib/repo'
import { todayString } from '@/lib/format'

/**
 * Gestor: garante que as próximas partidas das agendas ativas existam.
 * Roda no máximo uma vez por agenda por dia em cada aparelho (idempotente no banco).
 */
export function useAutoGenerateMatches() {
  const { user } = useAuth()
  const { group, isManager } = useGroup()
  const gid = isManager ? group?.id ?? null : null
  const { data: schedules } = useSchedules(gid)
  const { data: venues, loading: vl } = useVenues(gid)
  const { data: courts, loading: cl } = useCourts(gid)
  const done = useRef(new Set<string>())

  useEffect(() => {
    if (!group || !user || !isManager || vl || cl) return
    for (const s of schedules) {
      if (!s.active) continue
      const key = `${s.id}:${todayString()}`
      if (done.current.has(key)) continue
      done.current.add(key)
      ensureUpcomingMatches(group, s, venues, courts, user.uid).catch(() => done.current.delete(key))
    }
  }, [group, user, isManager, schedules, venues, courts, vl, cl])
}
