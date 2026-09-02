import { Link } from 'react-router'
import { useGroup } from '@/hooks/useGroupContext'
import { useAnnouncements, useGroupNames, useMatchPlayers, useMembers, useNextMatch, useUpcomingMatches } from '@/hooks/useGroupData'
import { useAutoGenerateMatches } from '@/hooks/useAutoGenerateMatches'
import { formatDate, formatTimeRange, WEEKDAYS_SHORT, parseDate } from '@/lib/format'
import { Card, EmptyState, LinkButton, SectionTitle, Spinner } from '@/components/ui'
import MatchView, { AnnouncementCards } from '@/components/MatchView'

export default function Home() {
  const { memberships, membershipsLoading, group, groupId, groupLoading, isManager, setGroupId } = useGroup()
  useAutoGenerateMatches()
  const { match, loading: matchLoading } = useNextMatch(groupId)
  const { data: upcoming } = useUpcomingMatches(groupId)
  const { data: players } = useMatchPlayers(groupId, match?.id ?? null)
  const { data: members } = useMembers(groupId)
  const { data: announcements } = useAnnouncements(groupId)
  const groupNames = useGroupNames(memberships.map((m) => m.groupId))

  if (membershipsLoading) return <Spinner />

  if (memberships.length === 0) {
    return (
      <div className="space-y-4 pt-6">
        <div className="text-center">
          <img src="/icons/icon.svg" alt="" className="mx-auto mb-2 h-16 w-16" />
          <h1 className="text-2xl font-extrabold">Bem-vindo ao Racha!</h1>
          <p className="mt-1 text-sm text-neutral-600">Entre no grupo do seu futebol ou crie um novo.</p>
        </div>
        <Card className="space-y-3">
          <LinkButton to="/groups/join" variant="primary" className="w-full py-4 text-lg">TENHO UM CÓDIGO DE CONVITE</LinkButton>
          <LinkButton to="/groups/new" className="w-full">Sou organizador: criar grupo</LinkButton>
        </Card>
      </div>
    )
  }

  if (groupLoading || !group) return <Spinner />

  const others = upcoming.filter((m) => m.id !== match?.id && (m.status === 'open' || m.status === 'confirmed')).slice(0, 4)

  return (
    <div className="space-y-4">
      {memberships.length > 1 && (
        <select value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value)} className="font-semibold" aria-label="Grupo">
          {memberships.map((m) => <option key={m.groupId} value={m.groupId}>{groupNames[m.groupId] ?? (m.groupId === groupId ? group.name : 'Grupo')}</option>)}
        </select>
      )}

      {matchLoading ? <Spinner /> : match ? (
        <MatchView group={group} match={match} players={players} members={members} announcements={announcements} isManager={isManager} />
      ) : (
        <>
          <AnnouncementCards items={announcements.filter((a) => a.matchId === null)} />
          <EmptyState
            icon="⚽"
            title="Nenhuma partida agendada"
            text={isManager ? 'Configure o futebol semanal para gerar as próximas partidas automaticamente.' : 'Assim que o organizador agendar, a próxima partida aparecerá aqui.'}
            action={isManager ? <LinkButton to="/manage/schedule" variant="primary">Configurar futebol semanal</LinkButton> : undefined}
          />
        </>
      )}

      {others.length > 0 && (
        <section>
          <SectionTitle>Próximas partidas</SectionTitle>
          <div className="space-y-2">
            {others.map((m) => (
              <Link key={m.id} to={`/match/${m.id}`} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-neutral-100 leading-none">
                  <span className="text-[10px] font-bold uppercase text-neutral-500">{WEEKDAYS_SHORT[parseDate(m.date).getDay()]}</span>
                  <span className="text-lg font-extrabold">{formatDate(m.date).slice(0, 2)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{formatDate(m.date)} · {formatTimeRange(m.startTime, m.durationMinutes)}</div>
                  <div className="truncate text-xs text-neutral-500">{m.venueName}{m.courtName ? ` · ${m.courtName}` : ''}</div>
                </div>
                <span className="text-neutral-400">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
