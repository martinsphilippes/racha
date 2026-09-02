import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { usePastMatches } from '@/hooks/useGroupData'
import { formatDateLong, formatMoney, formatTimeRange } from '@/lib/format'
import { effectiveStatus, matchCost, MATCH_STATUS_LABEL } from '@/lib/matches'
import { Card, EmptyState, PageHeader, Pill, Spinner } from '@/components/ui'
import { StatusPill } from '@/components/MatchView'
import { useMatchPlayers } from '@/hooks/useGroupData'
import type { Match } from '@/lib/types'

export default function History() {
  const { groupId, group } = useGroup()
  const { data: matches, loading } = usePastMatches(groupId)

  return (
    <div>
      <PageHeader title="Histórico" />
      {loading && <Spinner />}
      {!loading && matches.length === 0 && <EmptyState icon="📅" title="Nenhuma partida anterior" text="As partidas já realizadas aparecerão aqui." />}
      <div className="space-y-3">
        {matches.map((m) => <HistoryItem key={m.id} match={m} groupId={groupId!} groupName={group?.name ?? ''} />)}
      </div>
    </div>
  )
}

function HistoryItem({ match, groupId, groupName }: { match: Match; groupId: string; groupName: string }) {
  const { user } = useAuth()
  const { data: players } = useMatchPlayers(groupId, match.id)
  const status = effectiveStatus(match)
  const me = players.find((p) => p.id === user?.uid)
  const available = players.filter((p) => p.status === 'available')
  return (
    <Link to={`/match/${match.id}`} className="block">
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase text-muted">{groupName}</div>
            <div className="font-bold">{formatDateLong(match.date)}</div>
            <div className="text-sm text-muted">{formatTimeRange(match.startTime, match.durationMinutes)} · {match.venueName}{match.courtName ? ` · ${match.courtName}` : ''}</div>
          </div>
          <StatusPill status={status} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Pill>{available.length} jogador{available.length === 1 ? '' : 'es'}</Pill>
          <Pill>{formatMoney(matchCost(match))}</Pill>
          {match.teams.length > 0 && <Pill tone="blue">{match.teams.length} times</Pill>}
          {me?.status === 'available' ? (
            me.position === 'goalkeeper'
              ? <Pill tone="green">Você jogou · goleiro (isento)</Pill>
              : <Pill tone={me.paid ? 'green' : 'red'}>{me.paid ? 'Você jogou · pago' : 'Você jogou · não pago'}</Pill>
          ) : me?.status === 'unavailable' ? <Pill>Você não jogou</Pill> : <Pill>Sem resposta</Pill>}
        </div>
        <span className="sr-only">{MATCH_STATUS_LABEL[status]}</span>
      </Card>
    </Link>
  )
}
