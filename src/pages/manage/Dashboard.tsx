import { Link } from 'react-router'
import { useGroup } from '@/hooks/useGroupContext'
import { useAutoGenerateMatches } from '@/hooks/useAutoGenerateMatches'
import { useMatchPlayers, useMembers, useNextMatch, useUpcomingMatches } from '@/hooks/useGroupData'
import { formatDate, formatDateLong, formatMoney, formatTimeRange } from '@/lib/format'
import { computeSplit, effectiveStatus } from '@/lib/matches'
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle, Spinner, Stat } from '@/components/ui'
import { StatusPill } from '@/components/MatchView'

export default function Dashboard() {
  const { group, groupId } = useGroup()
  useAutoGenerateMatches()
  const { match, loading } = useNextMatch(groupId)
  const { data: upcoming } = useUpcomingMatches(groupId)
  const { data: players } = useMatchPlayers(groupId, match?.id ?? null)
  const { data: members } = useMembers(groupId)

  if (!group) return <Spinner />
  const split = match ? computeSplit(match, players) : null
  const pending = match ? members.filter((m) => !players.some((p) => p.id === m.uid)).length : 0

  return (
    <div className="space-y-5">
      <PageHeader title="Painel do gestor" />

      <section>
        <SectionTitle>Próxima partida</SectionTitle>
        {loading ? <Spinner /> : !match || !split ? (
          <EmptyState icon="📆" title="Nenhuma partida futura" text="Configure o futebol semanal ou crie uma partida avulsa." action={<LinkButton to="/manage/schedule" variant="primary">Configurar futebol semanal</LinkButton>} />
        ) : (
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-extrabold">{formatDateLong(match.date)}</div>
                <div className="text-sm text-muted">{formatTimeRange(match.startTime, match.durationMinutes)} · {match.venueName}{match.courtName ? ` · ${match.courtName}` : ''}</div>
              </div>
              <StatusPill status={effectiveStatus(match)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Disponíveis" value={split.available.length} tone="green" />
              <Stat label="Indisponíveis" value={split.unavailable.length} tone="red" />
              <Stat label="Sem resposta" value={pending} tone="amber" />
              <Stat label="Goleiros" value={split.goalkeepers.length} />
              <Stat label="Linha" value={split.linePlayers.length} />
              <Stat label="Times" value={match.teams.length || '—'} />
              <Stat label="Valor partida" value={formatMoney(split.cost)} />
              <Stat label={match.status === 'confirmed' ? 'Por atleta' : 'Por atleta (hoje)'} value={formatMoney(split.perPlayer)} />
              <Stat label={`Previsão c/ ${split.estimatedPlayers}`} value={formatMoney(split.estimatedPerPlayer)} tone="amber" />
              <Stat label="Recebido" value={formatMoney(split.received)} tone="green" />
              <Stat label="Pagos" value={split.paidCount} tone="green" />
              <Stat label="Não pagos" value={split.unpaidCount} tone="red" />
              <Stat label="Restante" value={formatMoney(split.remaining)} tone={split.remaining > 0 ? 'amber' : 'green'} />
            </div>
            <LinkButton to={`/manage/match/${match.id}`} variant="primary" className="w-full">Gerenciar partida</LinkButton>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {match && <Action to={`/manage/match/${match.id}#players`} icon="👥" label="Gerenciar jogadores" />}
          {match && <Action to={`/manage/match/${match.id}#teams`} icon="🎲" label="Gerar times" />}
          {match && <Action to={`/manage/match/${match.id}#payments`} icon="💰" label="Pagamentos" />}
          <Action to="/manage/announcements" icon="📣" label="Enviar comunicado" />
          <Action to="/manage/schedule" icon="🔁" label="Futebol semanal" />
          <Action to="/manage/match/new" icon="➕" label="Partida avulsa" />
          <Action to="/manage/venues" icon="📍" label="Locais e quadras" />
          <Action to="/manage/members" icon="🔗" label="Jogadores do grupo" />
          <Action to="/manage/group" icon="💳" label="PIX e grupo" />
        </div>
      </section>

      <section>
        <SectionTitle>Partidas futuras</SectionTitle>
        <Card className="divide-y divide-line/70 p-0">
          {upcoming.length === 0 && <p className="p-4 text-sm text-muted">Nenhuma partida gerada.</p>}
          {upcoming.map((m) => (
            <Link key={m.id} to={`/manage/match/${m.id}`} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-semibold">{formatDate(m.date)} · {formatTimeRange(m.startTime, m.durationMinutes)}</div>
                <div className="text-xs text-muted">{m.venueName}{m.courtName ? ` · ${m.courtName}` : ''}{m.scheduleId ? '' : ' · avulsa'}</div>
              </div>
              <StatusPill status={effectiveStatus(m)} />
            </Link>
          ))}
        </Card>
      </section>
    </div>
  )
}

function Action({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-3 text-sm font-semibold shadow-md ring-1 ring-line/60 active:bg-surface-2">
      <span className="text-xl">{icon}</span>{label}
    </Link>
  )
}
