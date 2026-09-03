import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useAnnouncements, useGroupNames, useMatchPlayers, useMembers, useNextMatch, useUpcomingMatches } from '@/hooks/useGroupData'
import { useAutoGenerateMatches } from '@/hooks/useAutoGenerateMatches'
import { formatDate, formatTimeRange, WEEKDAYS_SHORT, parseDate } from '@/lib/format'
import { Button, Card, EmptyState, LinkButton, SectionTitle, Spinner } from '@/components/ui'
import MatchView, { AnnouncementCards } from '@/components/MatchView'

export default function Home() {
  const { profile, canOrganize, isOwner, roleReady } = useAuth()
  const { memberships, membershipsSynced, membershipsError, group, groupId, groupLoading, isManager, setGroupId } = useGroup()
  useAutoGenerateMatches()
  const { match, loading: matchLoading } = useNextMatch(groupId)
  const { data: upcoming } = useUpcomingMatches(groupId)
  const { data: players } = useMatchPlayers(groupId, match?.id ?? null)
  const { data: members } = useMembers(groupId)
  const { data: announcements } = useAnnouncements(groupId)
  const groupNames = useGroupNames(memberships.map((m) => m.groupId))

  if (membershipsError) return <SetupError error={membershipsError} />

  if (memberships.length === 0 && !membershipsSynced && !groupId) return <MatchSkeleton />

  if (memberships.length === 0 && membershipsSynced) {
    if (!roleReady) return <Spinner />
    return (
      <div className="space-y-4 pt-2">
        <div className="text-center">
          <img src="/brand/logo.webp" alt="Racha 10" className="mx-auto mb-2 h-40 w-auto" />
          <h1 className="text-2xl font-extrabold">Bem-vindo ao Racha!</h1>
        </div>
        {canOrganize ? (
          <Card className="space-y-3">
            <p className="text-center text-sm text-muted">Você é {isOwner ? 'o dono' : 'organizador'}. Crie o grupo do seu futebol e depois adicione os atletas.</p>
            <LinkButton to="/groups/new" variant="primary" className="w-full py-4 text-lg">CRIAR MEU GRUPO</LinkButton>
            {isOwner && <LinkButton to="/admin" className="w-full">Administração</LinkButton>}
          </Card>
        ) : (
          <Card className="space-y-2 text-center">
            <div className="text-3xl">⏳</div>
            <h2 className="text-lg font-bold">Aguardando o organizador</h2>
            <p className="text-sm text-muted">Sua conta está pronta. O organizador do seu futebol vai adicionar você ao grupo pelo seu nome ou e-mail:</p>
            <div className="rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">{profile?.email}</div>
            <p className="text-xs text-muted">Assim que for adicionado, a próxima partida aparece aqui automaticamente.</p>
          </Card>
        )}
      </div>
    )
  }

  if (groupLoading || !group) return <MatchSkeleton />

  const others = upcoming.filter((m) => m.id !== match?.id && (m.status === 'open' || m.status === 'confirmed')).slice(0, 4)

  return (
    <div className="space-y-4">
      {memberships.length > 1 && (
        <select value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value)} className="font-semibold" aria-label="Grupo">
          {memberships.map((m) => <option key={m.groupId} value={m.groupId}>{groupNames[m.groupId] ?? (m.groupId === groupId ? group.name : 'Grupo')}</option>)}
        </select>
      )}

      {matchLoading ? <MatchSkeleton /> : match ? (
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

/** Esqueleto do cartão principal: evita "spinner em cascata" enquanto os dados chegam. */
function MatchSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="glow-card animate-pulse rounded-2xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-4">
        <div className="mb-3 h-3 w-24 rounded bg-white/10" />
        <div className="mb-2 h-7 w-3/4 rounded bg-white/10" />
        <div className="mb-3 h-5 w-1/2 rounded bg-white/10" />
        <div className="h-4 w-2/3 rounded bg-white/10" />
      </div>
      <div className="animate-pulse rounded-2xl bg-surface p-4 ring-1 ring-line/60">
        <div className="mx-auto mb-3 h-6 w-40 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3"><div className="h-16 rounded-2xl bg-white/10" /><div className="h-16 rounded-2xl bg-white/10" /></div>
      </div>
    </div>
  )
}
