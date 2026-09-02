import { Link } from 'react-router'
import { useGroup } from '@/hooks/useGroupContext'
import { useAnnouncements, useGroupNames, useMatchPlayers, useMembers, useNextMatch, useUpcomingMatches } from '@/hooks/useGroupData'
import { useAutoGenerateMatches } from '@/hooks/useAutoGenerateMatches'
import { formatDate, formatTimeRange, WEEKDAYS_SHORT, parseDate } from '@/lib/format'
import { Button, Card, EmptyState, LinkButton, SectionTitle, Spinner } from '@/components/ui'
import MatchView, { AnnouncementCards } from '@/components/MatchView'

export default function Home() {
  const { memberships, membershipsLoading, membershipsError, group, groupId, groupLoading, isManager, setGroupId } = useGroup()
  useAutoGenerateMatches()
  const { match, loading: matchLoading } = useNextMatch(groupId)
  const { data: upcoming } = useUpcomingMatches(groupId)
  const { data: players } = useMatchPlayers(groupId, match?.id ?? null)
  const { data: members } = useMembers(groupId)
  const { data: announcements } = useAnnouncements(groupId)
  const groupNames = useGroupNames(memberships.map((m) => m.groupId))

  if (membershipsLoading) return <Spinner />

  if (membershipsError) return <SetupError error={membershipsError} />

  if (memberships.length === 0) {
    return (
      <div className="space-y-4 pt-6">
        <div className="text-center">
          <img src="/brand/logo.webp" alt="Racha 10" className="mx-auto mb-2 w-64 max-w-full rounded-2xl" />
          <h1 className="text-2xl font-extrabold">Bem-vindo ao Racha!</h1>
          <p className="mt-1 text-sm text-muted">Entre no grupo do seu futebol ou crie um novo.</p>
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
              <Link key={m.id} to={`/match/${m.id}`} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-md ring-1 ring-line/60">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-surface-2 leading-none">
                  <span className="text-[10px] font-bold uppercase text-muted">{WEEKDAYS_SHORT[parseDate(m.date).getDay()]}</span>
                  <span className="text-lg font-extrabold">{formatDate(m.date).slice(0, 2)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{formatDate(m.date)} · {formatTimeRange(m.startTime, m.durationMinutes)}</div>
                  <div className="truncate text-xs text-muted">{m.venueName}{m.courtName ? ` · ${m.courtName}` : ''}</div>
                </div>
                <span className="text-muted/70">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * Erro de configuração do Firestore (ex.: índice de grupo de coleção ausente).
 * O Firestore devolve na mensagem o link exato para criar o índice; mostramos na tela
 * para o gestor resolver sem precisar abrir o console do navegador.
 */
function SetupError({ error }: { error: Error }) {
  const link = error.message.match(/https:\/\/\S+/)?.[0]
  const isIndex = /index/i.test(error.message)
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-extrabold">{isIndex ? 'Falta criar um índice no Firestore' : 'Não foi possível carregar seus grupos'}</h2>
      {isIndex ? (
        <p className="text-sm text-slate-200">
          O Firestore precisa de um índice para a consulta "meus grupos" (grupo de coleções <code>members</code>, campo <code>uid</code>).
          {link ? ' Toque no botão abaixo, confirme a criação no console do Firebase e aguarde alguns minutos.' : ' Crie-o no console do Firebase em Firestore → Índices → Campo único.'}
        </p>
      ) : (
        <p className="text-sm text-slate-200">Verifique as regras de segurança e a configuração do Firebase.</p>
      )}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="block rounded-xl bg-flame-500 px-4 py-3 text-center font-semibold text-white">
          Criar índice no Firebase
        </a>
      )}
      <details className="text-xs text-muted"><summary>Detalhes técnicos</summary><pre className="mt-1 whitespace-pre-wrap break-all">{error.message}</pre></details>
      <Button variant="outline" className="w-full" onClick={() => location.reload()}>Tentar novamente</Button>
    </Card>
  )
}
