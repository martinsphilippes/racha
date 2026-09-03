import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useDocument } from '@/hooks/useFirestore'
import { useCourts, useMatchPlayers, useMembers, useVenues } from '@/hooks/useGroupData'
import { formatDateLong, formatMoney, formatTimeRange, shortName } from '@/lib/format'
import { computeSplit, effectiveStatus, isMatchOpen } from '@/lib/matches'
import { generateTeams, movePlayer, unassignedPlayers } from '@/lib/teams'
import { deleteMatch, managerSetPlayer, postAnnouncement, saveTeams, setMatchStatus, setPaid, updateMatch, type MatchInput } from '@/lib/repo'
import { POSITIONS, type Match, type MatchPlayer, type Member, type Position } from '@/lib/types'
import { Button, Card, EmptyState, Field, PageHeader, Pill, SectionTitle, Spinner, Stat } from '@/components/ui'
import { StatusPill } from '@/components/MatchView'
import { errorMessage, useToast } from '@/components/Toast'
import NumberInput from '@/components/NumberInput'
import MatchForm from './MatchForm'

export default function ManageMatch() {
  const { id = '' } = useParams()
  const { group, groupId } = useGroup()
  const { data: match, loading } = useDocument<Match>(() => (groupId ? doc(db, 'groups', groupId, 'matches', id) : null), [groupId, id])
  const { data: players } = useMatchPlayers(groupId, id)
  const { data: members } = useMembers(groupId)
  const location = useLocation()

  useEffect(() => {
    if (!location.hash || loading) return
    const el = document.getElementById(location.hash.slice(1))
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, loading])

  if (!group) return <Spinner />
  if (loading) return <Spinner />
  if (!match) return <div><PageHeader title="Partida" back="/manage" /><EmptyState icon="🤔" title="Partida não encontrada" /></div>

  const split = computeSplit(match, players)
  const status = effectiveStatus(match)
  const open = isMatchOpen(match)

  return (
    <div className="space-y-5">
      <PageHeader title="Gerenciar partida" back="/manage" right={<StatusPill status={status} />} />
      <Card className="glow-card bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 text-white">
        <div className="text-lg font-extrabold">{formatDateLong(match.date)}</div>
        <div className="text-sm text-sky-glow">{formatTimeRange(match.startTime, match.durationMinutes)} · {match.venueName}{match.courtName ? ` · ${match.courtName}` : ''}</div>
      </Card>

      <StatusSection match={match} />
      <PlayersSection match={match} players={players} members={members} open={open} />
      <PaymentsSection match={match} players={players} split={split} />
      <TeamsSection match={match} players={players} split={split} />
      <AnnouncementSection match={match} />
      <DetailsSection match={match} />
      <DangerSection match={match} />
    </div>
  )
}

function StatusSection({ match }: { match: Match }) {
  const { group } = useGroup()
  const toast = useToast()
  async function set(status: Match['status']) {
    if (status === 'cancelled' && !confirm('Cancelar esta partida?')) return
    try { await setMatchStatus(group!.id, match.id, status); toast('Status atualizado') } catch (err) { toast(errorMessage(err), 'error') }
  }
  return (
    <section id="status">
      <SectionTitle>Status</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {match.status !== 'confirmed' && match.status !== 'finished' && <Button onClick={() => set('confirmed')}>✅ Confirmar futebol</Button>}
        {match.status !== 'cancelled' && match.status !== 'finished' && <Button variant="danger" onClick={() => set('cancelled')}>Cancelar futebol</Button>}
        {(match.status === 'cancelled' || match.status === 'finished') && <Button variant="outline" onClick={() => set('open')}>Reabrir confirmações</Button>}
        {match.status !== 'finished' && match.status !== 'cancelled' && <Button variant="outline" onClick={() => set('finished')}>Finalizar</Button>}
      </div>
    </section>
  )
}

function PlayersSection({ match, players, members, open }: { match: Match; players: MatchPlayer[]; members: Member[]; open: boolean }) {
  const { group } = useGroup()
  const toast = useToast()
  const byId = new Map(players.map((p) => [p.id, p]))
  function set(m: Member, status: 'available' | 'unavailable', position: Position | null) {
    managerSetPlayer(group!.id, match.id, m, status, position, byId.has(m.uid)).catch((err) => toast(errorMessage(err), 'error'))
  }
  const seg = (active: boolean, tone: 'green' | 'red' | 'blue' | 'amber') => {
    const on = { green: 'bg-green-500 text-white', red: 'bg-red-500 text-white', blue: 'bg-royal-500 text-white', amber: 'bg-gold-400 text-navy-950' }[tone]
    return `min-h-10 flex-1 rounded-lg px-2 text-sm font-bold transition ${active ? on : 'bg-surface-2 text-muted hover:bg-navy-700'}`
  }
  return (
    <section id="players">
      <SectionTitle right={<Pill>{members.length} membros</Pill>}>Jogadores</SectionTitle>
      <Card className="divide-y divide-line/70 p-0">
        {members.map((m) => {
          const p = byId.get(m.uid)
          const status = p?.status ?? null
          return (
            <div key={m.uid} className="space-y-2 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate font-semibold">{shortName(m.name)}</div>
                {status === 'available' ? <Pill tone="green">Vai jogar{p?.position === 'goalkeeper' ? ' · goleiro' : ''}</Pill>
                  : status === 'unavailable' ? <Pill tone="red">Não vai</Pill> : <Pill>Sem resposta</Pill>}
              </div>
              <div className="flex gap-2" role="group" aria-label={`Disponibilidade de ${m.name}`}>
                <button type="button" onClick={() => set(m, 'available', p?.position ?? 'line')} className={seg(status === 'available', 'green')} aria-pressed={status === 'available'} aria-label={`${m.name} disponível`}>✓ Vai</button>
                <button type="button" onClick={() => set(m, 'unavailable', null)} className={seg(status === 'unavailable', 'red')} aria-pressed={status === 'unavailable'} aria-label={`${m.name} indisponível`}>✗ Não vai</button>
                {status === 'available' && POSITIONS.map((pos) => (
                  <button key={pos.value} type="button" onClick={() => set(m, 'available', pos.value)} className={seg(p?.position === pos.value, pos.value === 'goalkeeper' ? 'amber' : 'blue')} aria-pressed={p?.position === pos.value} aria-label={`${m.name} ${pos.label.toLowerCase()}`}>
                    {pos.value === 'goalkeeper' ? '🧤' : '⚽'} {pos.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {members.length === 0 && <p className="p-4 text-sm text-muted">Nenhum jogador no grupo ainda. Adicione em Gestão → Jogadores.</p>}
      </Card>
      {!open && <p className="mt-1 text-xs text-muted">Partida encerrada: os atletas não podem mais alterar a resposta, mas você pode ajustar.</p>}
    </section>
  )
}

function PaymentsSection({ match, players, split }: { match: Match; players: MatchPlayer[]; split: ReturnType<typeof computeSplit> }) {
  const { group } = useGroup()
  const toast = useToast()
  async function toggle(p: MatchPlayer) {
    try { await setPaid(group!.id, match.id, p.id, !p.paid) } catch (err) { toast(errorMessage(err), 'error') }
  }
  const list = [...split.linePlayers, ...split.goalkeepers]
  void players
  return (
    <section id="payments">
      <SectionTitle>Financeiro</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Custo quadra" value={formatMoney(split.cost)} />
          <Stat label="Pagantes" value={split.payers.length} />
          <Stat label="Individual" value={formatMoney(split.perPlayer)} />
          <Stat label="Recebido" value={formatMoney(split.received)} tone="green" />
          <Stat label="Restante" value={formatMoney(split.remaining)} tone={split.remaining > 0 ? 'amber' : 'green'} />
          <Stat label="Pagos / não" value={`${split.paidCount} / ${split.unpaidCount}`} />
        </div>
        {match.costOverride != null && <p className="text-xs text-gold-300">Custo definido manualmente.</p>}
        <ul className="divide-y divide-line/70">
          {list.length === 0 && <li className="py-2 text-sm text-muted">Nenhum jogador disponível ainda.</li>}
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="font-medium">{shortName(p.name)}</span>
              {p.position === 'goalkeeper' ? <Pill tone="amber">Goleiro / Isento</Pill> : (
                <button type="button" onClick={() => toggle(p)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${p.paid ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {p.paid ? '🟢 PAGO' : '🔴 NÃO PAGO'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

function TeamsSection({ match, players, split }: { match: Match; players: MatchPlayer[]; split: ReturnType<typeof computeSplit> }) {
  const { group } = useGroup()
  const toast = useToast()
  const [mode, setMode] = useState<'numTeams' | 'perTeam'>('numTeams')
  const [value, setValue] = useState<number | null>(2)
  const byId = new Map(players.map((p) => [p.id, p]))
  const available = split.available
  const unassigned = unassignedPlayers(match.teams, available.map((p) => p.id))

  async function generate() {
    const n = Math.max(1, value ?? 1)
    const teams = generateTeams(available.map((p) => ({ id: p.id, name: p.name, position: p.position })), mode === 'numTeams' ? { numTeams: n } : { playersPerTeam: n })
    try { await saveTeams(group!.id, match.id, teams); toast('Times sorteados!') } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function move(playerId: string, toTeamId: string) {
    try { await saveTeams(group!.id, match.id, movePlayer(match.teams, playerId, toTeamId)) } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function clear() {
    if (!confirm('Apagar os times?')) return
    try { await saveTeams(group!.id, match.id, []) } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function addManualTeam() {
    const n = match.teams.length
    try { await saveTeams(group!.id, match.id, [...match.teams, { id: `t${n + 1}`, name: `Time ${String.fromCharCode(65 + n)}`, playerIds: [] }]) } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <section id="teams">
      <SectionTitle right={<Pill tone="green">{available.length} disponíveis</Pill>}>Times</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dividir por">
            <select value={mode} onChange={(e) => setMode(e.target.value as 'numTeams' | 'perTeam')}>
              <option value="numTeams">Número de times</option>
              <option value="perTeam">Jogadores por time</option>
            </select>
          </Field>
          <Field label={mode === 'numTeams' ? 'Times' : 'Por time'}>
            <NumberInput required value={value} onChange={(v) => setValue(v)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={generate} disabled={available.length === 0}>{match.teams.length ? '🎲 SORTEAR NOVAMENTE' : '🎲 GERAR TIMES'}</Button>
          <Button variant="outline" onClick={addManualTeam}>+ Time (manual)</Button>
        </div>
        <p className="text-xs text-muted">Goleiros são distribuídos de forma equilibrada entre os times. Depois do sorteio, mova jogadores manualmente pelo seletor.</p>

        {match.teams.length > 0 && (
          <div className="space-y-3">
            {match.teams.map((t) => (
              <div key={t.id} className="rounded-xl border border-line p-3">
                <div className="mb-1 flex items-center justify-between"><span className="font-extrabold">{t.name}</span><Pill>{t.playerIds.length}</Pill></div>
                <ul className="space-y-1">
                  {t.playerIds.map((pid) => {
                    const p = byId.get(pid)
                    return (
                      <li key={pid} className="flex items-center justify-between gap-2 text-sm">
                        <span>{p?.position === 'goalkeeper' ? '🧤 ' : ''}{p ? shortName(p.name) : pid}</span>
                        <select value={t.id} onChange={(e) => move(pid, e.target.value)} className="w-auto rounded-lg px-2 py-1 text-xs" aria-label={`Mover ${p?.name ?? pid}`}>
                          {match.teams.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {unassigned.length > 0 && (
              <div className="rounded-xl bg-gold-400/10 p-3 ring-1 ring-gold-400/20">
                <div className="mb-1 text-xs font-bold uppercase text-gold-300">Sem time ({unassigned.length})</div>
                <ul className="space-y-1">
                  {unassigned.map((pid) => {
                    const p = byId.get(pid)
                    return (
                      <li key={pid} className="flex items-center justify-between gap-2 text-sm">
                        <span>{p?.position === 'goalkeeper' ? '🧤 ' : ''}{p ? shortName(p.name) : pid}</span>
                        <select value="" onChange={(e) => e.target.value && move(pid, e.target.value)} className="w-auto rounded-lg px-2 py-1 text-xs" aria-label={`Colocar ${p?.name ?? pid} em um time`}>
                          <option value="">Escolher time…</option>
                          {match.teams.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={clear}>Apagar times</Button>
          </div>
        )}
      </Card>
    </section>
  )
}

function AnnouncementSection({ match }: { match: Match }) {
  const { user, profile } = useAuth()
  const { group } = useGroup()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return
    setBusy(true)
    try { await postAnnouncement(group!.id, text, match.id, { uid: user.uid, name: profile?.name ?? 'Organizador' }); setText(''); toast('Comunicado enviado') } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }
  return (
    <section id="announcement">
      <SectionTitle>Comunicado desta partida</SectionTitle>
      <Card>
        <form onSubmit={submit} className="space-y-2">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Hoje o futebol começará às 20h." />
          <Button type="submit" className="w-full" disabled={busy || !text.trim()}>ENVIAR COMUNICADO</Button>
        </form>
      </Card>
    </section>
  )
}

function DetailsSection({ match }: { match: Match }) {
  const { group, groupId } = useGroup()
  const { data: venues } = useVenues(groupId)
  const { data: courts } = useCourts(groupId)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [openForm, setOpenForm] = useState(false)
  async function submit(input: MatchInput) {
    setBusy(true)
    try { await updateMatch(group!, match, input, venues, courts); toast('Partida atualizada'); setOpenForm(false) } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }
  return (
    <section id="details">
      <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => setOpenForm((v) => !v)}>{openForm ? 'Fechar' : 'Editar'}</Button>}>Dados da partida</SectionTitle>
      {openForm ? <Card><MatchForm key={match.id} match={match} onSubmit={submit} submitLabel="SALVAR ALTERAÇÕES" busy={busy} /></Card> : (
        <Card className="text-sm text-slate-200">
          <div>{formatDateLong(match.date)} · {formatTimeRange(match.startTime, match.durationMinutes)}</div>
          <div>{match.venueName || '—'}{match.courtName ? ` · ${match.courtName}` : ''}</div>
          <div>Quadra: {formatMoney(match.hourlyRate)}/h · Custo: {formatMoney(computeSplit(match, []).cost)}{match.costOverride != null ? ' (manual)' : ''} · Mínimo: {match.minPlayers} jogadores</div>
        </Card>
      )}
    </section>
  )
}

function DangerSection({ match }: { match: Match }) {
  const { group } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  async function remove() {
    if (!confirm('Excluir esta partida definitivamente? As respostas dos atletas serão perdidas.')) return
    try { await deleteMatch(group!.id, match.id); toast('Partida excluída'); navigate('/manage', { replace: true }) } catch (err) { toast(errorMessage(err), 'error') }
  }
  return <Button variant="ghost" size="sm" className="w-full text-red-300" onClick={remove}>Excluir partida</Button>
}
