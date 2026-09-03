import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useCourts, useSchedules, useVenues } from '@/hooks/useGroupData'
import { ensureUpcomingMatches, saveSchedule, setScheduleActive } from '@/lib/repo'
import { formatDuration, formatMoney, formatTimeRange, WEEKDAYS } from '@/lib/format'
import type { Schedule } from '@/lib/types'
import { Button, Card, EmptyState, Field, LinkButton, PageHeader, Pill, Spinner, Stat } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import NumberInput from '@/components/NumberInput'

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
          <Card key={s.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-tight">Toda {WEEKDAYS[s.weekday].toLowerCase()}</div>
                <div className="text-sm font-semibold text-sky-glow">{formatTimeRange(s.startTime, s.durationMinutes)} · {formatDuration(s.durationMinutes)}</div>
              </div>
              <Pill tone={s.active ? 'green' : 'neutral'} className="shrink-0">{s.active ? 'Ativa' : 'Pausada'}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Local" value={<span className="text-base">{venue?.name ?? '—'}</span>} />
              <Stat label="Quadra" value={<span className="text-base">{court?.name ?? '—'}</span>} />
              <Stat label="Valor da quadra" value={court ? `${formatMoney(court.hourlyRate)}/h` : '—'} />
              <Stat label="Custo por partida" value={court ? formatMoney((court.hourlyRate * s.durationMinutes) / 60) : '—'} tone="amber" />
            </div>
            <Button className="w-full" onClick={() => generate(s)} disabled={!s.active}>⚽ Gerar próximas partidas</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setEditing(s)}>Editar</Button>
              <Button variant="outline" onClick={() => toggle(s)}>{s.active ? 'Pausar' : 'Reativar'}</Button>
            </div>
            <p className="text-xs text-muted">As próximas {s.weeksAhead} semanas ficam geradas automaticamente. Cada data é uma partida independente.</p>
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
    durationMinutes: (schedule.durationMinutes ?? 90) as number | null,
    venueId: schedule.venueId ?? venues[0]?.id ?? '',
    courtId: schedule.courtId ?? '',
    weeksAhead: (schedule.weeksAhead ?? 4) as number | null,
  })
  const venueCourts = courts.filter((c) => c.venueId === (form.venueId || venues[0]?.id))
  const courtId = venueCourts.some((c) => c.id === form.courtId) ? form.courtId : venueCourts[0]?.id ?? ''

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!group || !user || !courtId) return
    const input = { ...form, durationMinutes: form.durationMinutes ?? 90, weeksAhead: form.weeksAhead ?? 4, venueId: form.venueId || venues[0]?.id, courtId }
    // Fecha na hora; a geração das partidas roda em seguida e avisa o resultado.
    onClose()
    saveSchedule(group.id, input, schedule.id)
      .then((id) => ensureUpcomingMatches(group, { ...input, id, active: true, createdAt: Date.now() }, venues, courts, user.uid))
      .then((n) => toast(n ? `Agenda salva · ${n} partida${n === 1 ? '' : 's'} gerada${n === 1 ? '' : 's'}` : 'Agenda salva'))
      .catch((err) => toast(errorMessage(err), 'error'))
  }

  return (
    <Card className="border-2 border-flame-500">
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-bold">{schedule.id ? 'Editar agenda' : 'Nova agenda semanal'}</h3>
        <Field label="Dia da semana">
          <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início"><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
          <Field label="Duração (min)"><NumberInput required value={form.durationMinutes} onChange={(v) => setForm({ ...form, durationMinutes: v })} /></Field>
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
        <Field label="Semanas geradas à frente"><NumberInput required value={form.weeksAhead} onChange={(v) => setForm({ ...form, weeksAhead: v })} /></Field>
        <div className="space-y-2 pt-1">
          <Button type="submit" className="w-full" disabled={!courtId}>Salvar e gerar partidas</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Card>
  )
}
