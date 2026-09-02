import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useCourts, useSchedules, useVenues } from '@/hooks/useGroupData'
import { ensureUpcomingMatches, saveSchedule, setScheduleActive } from '@/lib/repo'
import { formatDuration, formatMoney, formatTimeRange, WEEKDAYS } from '@/lib/format'
import type { Schedule } from '@/lib/types'
import { Button, Card, EmptyState, Field, LinkButton, PageHeader, Pill, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

export default function SchedulePage() {
  const { user } = useAuth()
  const { group, groupId } = useGroup()
  const { data: schedules, loading } = useSchedules(groupId)
  const { data: venues } = useVenues(groupId)
  const { data: courts } = useCourts(groupId)
  const [editing, setEditing] = useState<Partial<Schedule> | null>(null)
  const toast = useToast()

  if (!group || !user) return <Spinner />

  async function toggle(s: Schedule) {
    try { await setScheduleActive(group!.id, s.id, !s.active); toast(s.active ? 'Agenda pausada' : 'Agenda reativada') } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function generate(s: Schedule) {
    try {
      const n = await ensureUpcomingMatches(group!, s, venues, courts, user!.uid)
      toast(n ? `${n} partida${n === 1 ? '' : 's'} gerada${n === 1 ? '' : 's'}` : 'Próximas partidas já estavam geradas')
    } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Futebol semanal" back="/manage" right={courts.length > 0 ? <Button size="sm" onClick={() => setEditing({})}>+ Agenda</Button> : undefined} />

      {courts.length === 0 && (
        <EmptyState icon="📍" title="Cadastre uma quadra primeiro" text="A agenda precisa de um local e uma quadra com valor por hora." action={<LinkButton to="/manage/venues" variant="primary">Cadastrar local</LinkButton>} />
      )}

      {editing && <ScheduleForm schedule={editing} onClose={() => setEditing(null)} />}

      {loading ? <Spinner /> : schedules.map((s) => {
        const venue = venues.find((v) => v.id === s.venueId)
        const court = courts.find((c) => c.id === s.courtId)
        return (
          <Card key={s.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold">Toda {WEEKDAYS[s.weekday].toLowerCase()}</div>
                <div className="text-sm text-neutral-700">{formatTimeRange(s.startTime, s.durationMinutes)} · {formatDuration(s.durationMinutes)}</div>
                <div className="text-sm text-neutral-600">{venue?.name ?? '—'}{court ? ` · ${court.name}` : ''}</div>
                {court && <div className="text-xs text-neutral-500">{formatMoney(court.hourlyRate)}/h → {formatMoney((court.hourlyRate * s.durationMinutes) / 60)} por partida</div>}
              </div>
              <Pill tone={s.active ? 'green' : 'neutral'}>{s.active ? 'Ativa' : 'Pausada'}</Pill>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Editar</Button>
              <Button size="sm" variant="outline" onClick={() => toggle(s)}>{s.active ? 'Pausar' : 'Reativar'}</Button>
              <Button size="sm" variant="secondary" onClick={() => generate(s)} disabled={!s.active}>Gerar partidas</Button>
            </div>
            <p className="text-xs text-neutral-500">Mantém as próximas {s.weeksAhead} semanas geradas automaticamente. Cada data é uma partida independente.</p>
          </Card>
        )
      })}
      {!loading && schedules.length === 0 && courts.length > 0 && !editing && (
        <EmptyState icon="🔁" title="Nenhuma agenda" text="Defina o dia, horário e quadra do futebol semanal. As partidas serão geradas automaticamente." action={<Button onClick={() => setEditing({})}>Configurar</Button>} />
      )}
    </div>
  )
}

function ScheduleForm({ schedule, onClose }: { schedule: Partial<Schedule>; onClose: () => void }) {
  const { user } = useAuth()
  const { group, groupId } = useGroup()
  const { data: venues } = useVenues(groupId)
  const { data: courts } = useCourts(groupId)
  const toast = useToast()
  const [form, setForm] = useState({
    weekday: schedule.weekday ?? 2,
    startTime: schedule.startTime ?? '19:30',
    durationMinutes: schedule.durationMinutes ?? 90,
    venueId: schedule.venueId ?? venues[0]?.id ?? '',
    courtId: schedule.courtId ?? '',
    weeksAhead: schedule.weeksAhead ?? 4,
  })
  const [busy, setBusy] = useState(false)
  const venueCourts = courts.filter((c) => c.venueId === (form.venueId || venues[0]?.id))
  const courtId = venueCourts.some((c) => c.id === form.courtId) ? form.courtId : venueCourts[0]?.id ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!group || !user || !courtId) return
    setBusy(true)
    try {
      const input = { ...form, venueId: form.venueId || venues[0]?.id, courtId }
      const id = await saveSchedule(group.id, input, schedule.id)
      const n = await ensureUpcomingMatches(group, { ...input, id, active: true, createdAt: Date.now() }, venues, courts, user.uid)
      toast(n ? `Agenda salva · ${n} partida${n === 1 ? '' : 's'} gerada${n === 1 ? '' : 's'}` : 'Agenda salva')
      onClose()
    } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }

  return (
    <Card className="border-2 border-green-600">
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-bold">{schedule.id ? 'Editar agenda' : 'Nova agenda semanal'}</h3>
        <Field label="Dia da semana">
          <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início"><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
          <Field label="Duração (min)"><input type="number" inputMode="numeric" min={30} step={15} required value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Local">
          <select value={form.venueId || venues[0]?.id || ''} onChange={(e) => setForm({ ...form, venueId: e.target.value, courtId: '' })}>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="Quadra">
          <select value={courtId} onChange={(e) => setForm({ ...form, courtId: e.target.value })}>
            {venueCourts.map((c) => <option key={c.id} value={c.id}>{c.name} · {formatMoney(c.hourlyRate)}/h</option>)}
          </select>
        </Field>
        <Field label="Semanas geradas à frente"><input type="number" inputMode="numeric" min={1} max={12} value={form.weeksAhead} onChange={(e) => setForm({ ...form, weeksAhead: Number(e.target.value) })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy || !courtId}>Salvar e gerar</Button>
        </div>
      </form>
    </Card>
  )
}
