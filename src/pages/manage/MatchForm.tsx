import { useState, type FormEvent } from 'react'
import { useGroup } from '@/hooks/useGroupContext'
import { useCourts, useVenues } from '@/hooks/useGroupData'
import { formatMoney, todayString } from '@/lib/format'
import type { MatchInput } from '@/lib/repo'
import type { Match } from '@/lib/types'
import { Button, Field } from '@/components/ui'

export default function MatchForm({ match, onSubmit, submitLabel, busy }: {
  match: Partial<Match> | null
  onSubmit: (input: MatchInput) => Promise<void>
  submitLabel: string
  busy: boolean
}) {
  const { group, groupId } = useGroup()
  const { data: venues } = useVenues(groupId)
  const { data: courts } = useCourts(groupId)
  const [form, setForm] = useState({
    date: match?.date ?? todayString(),
    startTime: match?.startTime ?? group?.startTime ?? '19:30',
    durationMinutes: match?.durationMinutes ?? group?.durationMinutes ?? 90,
    venueId: match?.venueId ?? group?.defaultVenueId ?? '',
    courtId: match?.courtId ?? group?.defaultCourtId ?? '',
    costOverride: match?.costOverride ?? null as number | null,
    minPlayers: match?.minPlayers ?? group?.minPlayers ?? 10,
  })
  const venueId = venues.some((v) => v.id === form.venueId) ? form.venueId : venues[0]?.id ?? ''
  const venueCourts = courts.filter((c) => c.venueId === venueId)
  const courtId = venueCourts.some((c) => c.id === form.courtId) ? form.courtId : venueCourts[0]?.id ?? ''
  const court = courts.find((c) => c.id === courtId)
  const autoCost = court ? (court.hourlyRate * form.durationMinutes) / 60 : 0

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ ...form, venueId: venueId || null, courtId: courtId || null })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Início"><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duração (min)"><input type="number" inputMode="numeric" min={30} step={15} required value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></Field>
        <Field label="Mínimo de jogadores"><input type="number" inputMode="numeric" min={0} value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Local">
        <select value={venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value, courtId: '' })}>
          {venues.length === 0 && <option value="">Nenhum local cadastrado</option>}
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </Field>
      <Field label="Quadra">
        <select value={courtId} onChange={(e) => setForm({ ...form, courtId: e.target.value })}>
          {venueCourts.length === 0 && <option value="">Nenhuma quadra</option>}
          {venueCourts.map((c) => <option key={c.id} value={c.id}>{c.name} · {formatMoney(c.hourlyRate)}/h</option>)}
        </select>
      </Field>
      <Field label="Custo da partida (R$)" hint={`Automático: ${formatMoney(autoCost)}. Preencha apenas para definir um valor manual.`}>
        <input type="number" inputMode="decimal" min={0} step="0.01" value={form.costOverride ?? ''} placeholder={autoCost.toFixed(2)} onChange={(e) => setForm({ ...form, costOverride: e.target.value === '' ? null : Number(e.target.value) })} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>{submitLabel}</Button>
    </form>
  )
}
