import { useState, type FormEvent } from 'react'
import { useGroup } from '@/hooks/useGroupContext'
import { useCourts, useVenues } from '@/hooks/useGroupData'
import { deleteCourt, deleteVenue, saveCourt, saveVenue } from '@/lib/repo'
import { formatMoney } from '@/lib/format'
import { SPORTS, type Court, type Sport, type Venue } from '@/lib/types'
import { Button, Card, EmptyState, Field, PageHeader, Pill, SectionTitle, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

export default function Venues() {
  const { group, groupId } = useGroup()
  const { data: venues, loading } = useVenues(groupId)
  const { data: courts } = useCourts(groupId)
  const [editingVenue, setEditingVenue] = useState<Partial<Venue> | null>(null)
  const [editingCourt, setEditingCourt] = useState<Partial<Court> | null>(null)
  const toast = useToast()

  if (!group) return <Spinner />

  async function removeVenue(v: Venue) {
    if (!confirm(`Excluir "${v.name}" e suas quadras?`)) return
    try { await deleteVenue(group!.id, v.id, courts); toast('Local excluído') } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function removeCourt(c: Court) {
    if (!confirm(`Excluir a quadra "${c.name}"?`)) return
    try { await deleteCourt(group!.id, c.id); toast('Quadra excluída') } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Locais e quadras" back="/manage" right={<Button size="sm" onClick={() => setEditingVenue({})}>+ Local</Button>} />

      {editingVenue && <VenueForm groupId={group.id} venue={editingVenue} onClose={() => setEditingVenue(null)} />}
      {editingCourt && <CourtForm groupId={group.id} court={editingCourt} defaultSport={group.sport} onClose={() => setEditingCourt(null)} />}

      {loading ? <Spinner /> : venues.length === 0 && !editingVenue ? (
        <EmptyState icon="📍" title="Nenhum local cadastrado" text="Cadastre o local e a quadra onde o futebol acontece. O valor por hora da quadra calcula o custo das partidas." action={<Button onClick={() => setEditingVenue({})}>Cadastrar local</Button>} />
      ) : (
        venues.map((v) => (
          <Card key={v.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold">{v.name}</div>
                {v.address && <div className="text-sm text-muted">{v.address}</div>}
                {v.notes && <div className="text-xs text-muted">{v.notes}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditingVenue(v)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => removeVenue(v)}>🗑️</Button>
              </div>
            </div>
            <div>
              <SectionTitle right={<Button size="sm" variant="outline" onClick={() => setEditingCourt({ venueId: v.id })}>+ Quadra</Button>}>Quadras</SectionTitle>
              <ul className="divide-y divide-line/70">
                {courts.filter((c) => c.venueId === v.id).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-semibold">{c.name} <Pill className="ml-1">{SPORTS.find((s) => s.value === c.sport)?.label}</Pill></div>
                      <div className="text-sm text-muted">{formatMoney(c.hourlyRate)} / hora{c.notes ? ` · ${c.notes}` : ''}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingCourt(c)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCourt(c)}>🗑️</Button>
                    </div>
                  </li>
                ))}
                {courts.filter((c) => c.venueId === v.id).length === 0 && <li className="py-2 text-sm text-muted">Nenhuma quadra. Adicione uma com o valor por hora.</li>}
              </ul>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function VenueForm({ groupId, venue, onClose }: { groupId: string; venue: Partial<Venue>; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: venue.name ?? '', address: venue.address ?? '', notes: venue.notes ?? '' })
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { await saveVenue(groupId, { ...venue, ...form }); toast('Local salvo'); onClose() } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }
  return (
    <Card className="border-2 border-flame-500">
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-bold">{venue.id ? 'Editar local' : 'Novo local'}</h3>
        <Field label="Nome do local"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Arena Ituiutaba" /></Field>
        <Field label="Endereço"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Observações"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>Salvar</Button>
        </div>
      </form>
    </Card>
  )
}

function CourtForm({ groupId, court, defaultSport, onClose }: { groupId: string; court: Partial<Court>; defaultSport: Sport; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: court.name ?? '', sport: court.sport ?? defaultSport, hourlyRate: court.hourlyRate ?? 0, notes: court.notes ?? '' })
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { await saveCourt(groupId, { ...court, venueId: court.venueId!, ...form }); toast('Quadra salva'); onClose() } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }
  return (
    <Card className="border-2 border-flame-500">
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-bold">{court.id ? 'Editar quadra' : 'Nova quadra'}</h3>
        <Field label="Nome da quadra"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Society 1" /></Field>
        <Field label="Modalidade">
          <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })}>
            {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Valor por hora (R$)"><input type="number" inputMode="decimal" min={0} step="0.01" required value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} /></Field>
        <Field label="Observações"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>Salvar</Button>
        </div>
      </form>
    </Card>
  )
}
