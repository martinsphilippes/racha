import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { formatDateLong, formatDateTime, formatMoney, formatTimeRange, shortName } from '@/lib/format'
import { computeSplit, effectiveStatus, isMatchOpen, MATCH_STATUS_LABEL, minPlayersMessage } from '@/lib/matches'
import { buildPixPayload, formatPixKey, pixKeyForPayload } from '@/lib/pix'
import { setAvailability, setPaid } from '@/lib/repo'
import { copyText } from '@/lib/clipboard'
import { POSITIONS, POSITIONS_BY_SPORT, type Announcement, type Group, type Match, type MatchPlayer, type MatchStatus, type Member, type Position } from '@/lib/types'
import { Button, Card, Pill, SectionTitle, Toggle } from './ui'
import { errorMessage, useToast } from './Toast'

interface Props {
  group: Group
  match: Match
  players: MatchPlayer[]
  members: Member[]
  announcements: Announcement[]
  isManager: boolean
}

export function StatusPill({ status }: { status: MatchStatus }) {
  const tone = status === 'confirmed' ? 'green' : status === 'cancelled' ? 'red' : status === 'finished' ? 'neutral' : 'amber'
  return <Pill tone={tone}>{MATCH_STATUS_LABEL[status]}</Pill>
}

export default function MatchView({ group, match, players, members, announcements, isManager }: Props) {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const me = players.find((p) => p.id === uid) ?? null
  const status = effectiveStatus(match)
  const open = isMatchOpen(match)
  const split = useMemo(() => computeSplit(match, players), [match, players])
  const relevantAnnouncements = announcements.filter((a) => a.matchId === match.id || a.matchId === null)

  return (
    <div className="space-y-4">
      <MatchHeader group={group} match={match} status={status} availableCount={split.available.length} />
      <AnnouncementCards items={relevantAnnouncements} />
      {open && <AvailabilityCard group={group} match={match} me={me} />}
      {me?.status === 'available' && open && <PaymentCard group={group} match={match} me={me} split={split} />}
      {match.teams.length > 0 && <TeamsCard match={match} players={players} />}
      <PlayersCard group={group} match={match} players={players} members={members} split={split} isManager={isManager} open={open} />
      {isManager && (
        <Link to={`/manage/match/${match.id}`} className="block rounded-2xl bg-royal-500 px-4 py-4 text-center font-semibold text-white shadow-lg shadow-royal-500/30">
          🛠️ Gerenciar esta partida
        </Link>
      )}
    </div>
  )
}

function MatchHeader({ group, match, status, availableCount }: { group: Group; match: Match; status: MatchStatus; availableCount: number }) {
  return (
    <Card className="glow-card bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 text-white">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gold-400">{group.name}</span>
        <StatusPill status={status} />
      </div>
      <h1 className="text-2xl font-extrabold leading-tight">{formatDateLong(match.date)}</h1>
      <div className="mt-1 text-lg font-semibold text-sky-glow">{formatTimeRange(match.startTime, match.durationMinutes)}</div>
      <div className="mt-2 text-sm text-slate-200">
        {match.venueName || 'Local a definir'}
        {match.courtName && <span> · {match.courtName}</span>}
      </div>
      {match.address && (
        <a className="mt-0.5 block text-xs text-muted/70 underline-offset-2 hover:underline" href={`https://maps.google.com/?q=${encodeURIComponent(match.address)}`} target="_blank" rel="noreferrer">
          {match.address}
        </a>
      )}
      {(status === 'open' || status === 'confirmed') && (
        <div className="mt-3 rounded-xl bg-surface/10 px-3 py-2 text-sm font-semibold">
          {minPlayersMessage(availableCount, match.minPlayers)}
        </div>
      )}
    </Card>
  )
}

function AvailabilityCard({ group, match, me }: { group: Group; match: Match; me: MatchPlayer | null }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const positions = POSITIONS.filter((p) => POSITIONS_BY_SPORT[match.sport ?? group.sport].includes(p.value))

  async function answer(status: 'available' | 'unavailable', position?: Position | null) {
    if (!user) return
    setBusy(true)
    try {
      const pos = status === 'available' ? (position ?? me?.position ?? 'line') : null
      await setAvailability(group.id, match.id, { uid: user.uid, name: profile?.name ?? user.displayName ?? 'Atleta' }, status, pos)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <h2 className="mb-3 text-center text-lg font-extrabold">Você vai jogar?</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer('available')}
          className={`rounded-2xl py-5 text-lg font-extrabold transition ${me?.status === 'available' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 ring-4 ring-green-500/30' : 'bg-green-500/15 text-green-300 ring-1 ring-green-500/40 hover:bg-green-500/25'} disabled:opacity-60`}
          aria-pressed={me?.status === 'available'}
        >
          ✅ DISPONÍVEL
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer('unavailable')}
          className={`rounded-2xl py-5 text-lg font-extrabold transition ${me?.status === 'unavailable' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 ring-4 ring-red-500/30' : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40 hover:bg-red-500/25'} disabled:opacity-60`}
          aria-pressed={me?.status === 'unavailable'}
        >
          ❌ INDISPONÍVEL
        </button>
      </div>
      {me?.status === 'available' && (
        <div className="mt-4 fade-in">
          <div className="mb-2 text-sm font-semibold text-slate-200">Sua posição</div>
          <Toggle options={positions} value={me.position ?? 'line'} onChange={(v) => answer('available', v as Position)} disabled={busy} />
          {me.position === 'goalkeeper' && <p className="mt-2 text-xs text-muted">Goleiros não pagam a quadra.</p>}
        </div>
      )}
      {!me && <p className="mt-3 text-center text-xs text-muted">Você pode mudar sua resposta enquanto a partida estiver aberta.</p>}
    </Card>
  )
}

function PaymentCard({ group, match, me, split }: { group: Group; match: Match; me: MatchPlayer; split: ReturnType<typeof computeSplit> }) {
  const toast = useToast()
  const isGk = me.position === 'goalkeeper'
  const hasPix = Boolean(group.pixKey)
  const payload = useMemo(() => {
    if (!group.pixKey) return null
    return buildPixPayload({
      key: pixKeyForPayload(group.pixKeyType, group.pixKey),
      name: group.pixName || group.name,
      city: group.pixCity || 'BRASIL',
      amount: split.perPlayer,
      txid: `RACHA${match.date.replace(/-/g, '')}`,
    })
  }, [group, split.perPlayer, match.date])

  async function copy(text: string, label: string) {
    const ok = await copyText(text)
    toast(ok ? `${label} copiado!` : 'Não foi possível copiar', ok ? 'ok' : 'error')
  }

  return (
    <Card>
      <SectionTitle right={isGk ? <Pill tone="green">Goleiro · isento</Pill> : <Pill tone={me.paid ? 'green' : 'red'}>{me.paid ? '🟢 PAGO' : '🔴 NÃO PAGO'}</Pill>}>Pagamento</SectionTitle>
      {isGk ? (
        <p className="text-sm text-muted">Goleiros não entram no rateio. Obrigado por defender o gol!</p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted">Sua parte ({split.payers.length} pagante{split.payers.length === 1 ? '' : 's'} · quadra {formatMoney(split.cost)})</div>
              <div className="text-3xl font-extrabold">{formatMoney(split.perPlayer)}</div>
            </div>
          </div>
          {hasPix ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-xl bg-surface-2 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase text-muted">PIX ({group.pixKeyType})</div>
                <div className="break-all font-mono text-sm">{formatPixKey(group.pixKeyType, group.pixKey!)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => copy(group.pixKey!, 'Chave PIX')}>COPIAR CHAVE</Button>
                <Button variant="outline" onClick={() => payload && copy(payload, 'PIX copia e cola')} disabled={!payload || split.perPlayer <= 0}>COPIA E COLA</Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">O organizador ainda não cadastrou a chave PIX.</p>
          )}
        </>
      )}
    </Card>
  )
}

function TeamsCard({ match, players }: { match: Match; players: MatchPlayer[] }) {
  const byId = new Map(players.map((p) => [p.id, p]))
  return (
    <Card>
      <SectionTitle right={match.teamsGeneratedAt ? <span className="text-xs text-muted/70">{formatDateTime(match.teamsGeneratedAt)}</span> : null}>Times</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {match.teams.map((t, i) => (
          <div key={t.id} className={`rounded-xl p-3 ${['bg-royal-500/20', 'bg-gold-400/15', 'bg-emerald-500/15', 'bg-rose-500/15', 'bg-violet-500/15', 'bg-cyan-500/15'][i % 6]}`}>
            <div className="mb-1 font-extrabold">{t.name}</div>
            <ul className="space-y-0.5 text-sm">
              {t.playerIds.map((id) => {
                const p = byId.get(id)
                return (
                  <li key={id} className="flex items-center gap-1">
                    {p?.position === 'goalkeeper' && <span title="Goleiro">🧤</span>}
                    <span className="truncate">{p ? shortName(p.name) : '—'}</span>
                  </li>
                )
              })}
              {t.playerIds.length === 0 && <li className="text-muted/70">vazio</li>}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

function PlayersCard({ group, match, players, members, split, isManager, open }: {
  group: Group; match: Match; players: MatchPlayer[]; members: Member[]; split: ReturnType<typeof computeSplit>; isManager: boolean; open: boolean
}) {
  const toast = useToast()
  const answered = new Set(players.map((p) => p.id))
  const pending = members.filter((m) => !answered.has(m.uid))
  const ordered = [...split.goalkeepers, ...split.linePlayers]

  async function togglePaid(p: MatchPlayer) {
    try {
      await setPaid(group.id, match.id, p.id, !p.paid)
    } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <SectionTitle right={<Pill tone="green">{split.available.length}</Pill>}>Disponíveis</SectionTitle>
          {ordered.length === 0 && <p className="text-sm text-muted">Ninguém confirmou ainda.</p>}
          <ul className="divide-y divide-line/70">
            {ordered.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${p.position === 'goalkeeper' ? 'bg-gold-400/25 text-gold-300' : 'bg-green-500/25 text-green-300'}`}>
                    {p.position === 'goalkeeper' ? 'G' : 'L'}
                  </span>
                  <span className="font-medium">{shortName(p.name)}</span>
                  <span className="text-xs text-muted">{p.position === 'goalkeeper' ? 'Goleiro' : 'Linha'}</span>
                </div>
                {p.position === 'goalkeeper' ? (
                  <Pill tone="amber">Isento</Pill>
                ) : isManager ? (
                  <button type="button" onClick={() => togglePaid(p)} aria-label={`${p.paid ? 'Marcar como não pago' : 'Marcar como pago'}: ${p.name}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-current/30 ${p.paid ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {p.paid ? '🟢 PAGO' : '🔴 NÃO PAGO'}
                  </button>
                ) : (
                  <span className={`text-xs font-bold ${p.paid ? 'text-gold-400' : 'text-red-600'}`}>{p.paid ? '🟢 Pago' : '🔴 Não pago'}</span>
                )}
              </li>
            ))}
          </ul>
          {split.available.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              <Pill>{split.linePlayers.length} linha</Pill>
              <Pill tone="amber">{split.goalkeepers.length} goleiro{split.goalkeepers.length === 1 ? '' : 's'}</Pill>
              <Pill>{formatMoney(split.perPlayer)} por jogador</Pill>
            </div>
          )}
        </div>

        <div>
          <SectionTitle right={<Pill tone="red">{split.unavailable.length}</Pill>}>Indisponíveis</SectionTitle>
          {split.unavailable.length === 0 ? <p className="text-sm text-muted">—</p> : (
            <ul className="flex flex-wrap gap-2">
              {split.unavailable.map((p) => <li key={p.id} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted line-through decoration-muted">{shortName(p.name)}</li>)}
            </ul>
          )}
        </div>

        {open && (
          <div>
            <SectionTitle right={<Pill>{pending.length}</Pill>}>Ainda não responderam</SectionTitle>
            {pending.length === 0 ? <p className="text-sm text-muted">Todos responderam 🎉</p> : (
              <ul className="flex flex-wrap gap-2">
                {pending.map((m) => <li key={m.uid} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">{shortName(m.name)}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export function AnnouncementCards({ items }: { items: Announcement[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.slice(0, 3).map((a) => (
        <div key={a.id} className="fade-in rounded-2xl border-l-4 border-gold-400 bg-gold-400/10 px-4 py-3 ring-1 ring-gold-400/20">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gold-300">📣 Aviso do organizador · {formatDateTime(a.createdAt)}</div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-100">{a.text}</p>
        </div>
      ))}
    </div>
  )
}
