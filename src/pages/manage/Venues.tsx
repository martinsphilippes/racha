import { useState, type FormEvent } from 'react'
import { useGroup } from '@/hooks/useGroupContext'
import { useCourts, useVenues } from '@/hooks/useGroupData'
import { deleteCourt, deleteVenue, saveCourt, saveVenue } from '@/lib/repo'
import { formatMoney } from '@/lib/format'
import { SPORTS, type Court, type Sport, type Venue } from '@/lib/types'
import { Button, Card, EmptyState, Field, PageHeader, Pill, SectionTitle, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import AddressInput from '@/components/AddressInput'
import NumberInput from '@/components/NumberInput'

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

      {editingVenue && <VenueForm key={editingVenue.id ?? 'new'} groupId={group.id} venue={editingVenue} onClose={() => setEditingVenue(null)} />}
      {editingCourt && <CourtForm key={editingCourt.id ?? 'new'} groupId={group.id} court={editingCourt} defaultSport={group.sport} onClose={() => setEditingCourt(null)} />}

      {loading ? <Spinner /> : venues.length === 0 && !editingVenue ? (
        <EmptyState icon="📍" title="Nenhum local cadastrado" text="Cadastre o local e a quadra onde o futebol acontece. O valor por hora da quadra calcula o custo das partidas." action={<Button onClick={() => setEditingVenue({})}>Cadastrar local</Button>} />
      ) : (
        venues.map((v) => (
          <Card key={v.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold">{v.name}</div>
                {v.address && <div className="text-sm text-muted">{v.lat != null ? '📍 ' : ''}{v.address}</div>}
                {v.notes && <div className="text-xs text-muted">{v.notes}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditingVenue(v)} aria-label={`Editar local ${v.name}`}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => removeVenue(v)} aria-label={`Excluir local ${v.name}`}>🗑️</Button>
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
                      <Button size="sm" variant="ghost" onClick={() => setEditingCourt(c)} aria-label={`Editar quadra ${c.name}`}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCourt(c)} aria-label={`Excluir quadra ${c.name}`}>🗑️</Button>
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
  const [form, setForm] = useState({
    name: venue.name ?? '', address: venue.address ?? '', notes: venue.notes ?? '',
    coords: venue.lat != null && venue.lng != null ? { lat: venue.lat, lng: venue.lng } : null as { lat: number; lng: number } | null,
  })
  // Fecha na hora (gravação otimista); se o servidor recusar, avisa.
  function submit(e: FormEvent) {
    e.preventDefault()
    saveVenue(groupId, { ...venue, name: form.name, address: form.address, notes: form.notes, lat: form.coords?.lat ?? null, lng: form.coords?.lng ?? null })
      .catch((err) => toast(errorMessage(err), 'error'))
    toast('Local salvo'); onClose()
  }
  return (
    <Card className="border-2 border-flame-500">
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-bold">{venue.id ? 'Editar local' : 'Novo local'}</h3>
        <Field label="Nome do local"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Arena Ituiutaba" /></Field>
        <Field label="Endereço" hint="Busque pelo nome da arena ou pela rua e escolha a sugestão: os atletas ganham o botão Como chegar.">
          <AddressInput value={form.address} coords={form.coords} onChange={(address, coords) => setForm({ ...form, address, coords })} />
        </Field>
        <Field label="Observações"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Card>
  )
}

function CourtForm({ groupId, court, defaultSport, onClose }: { groupId: string; court: Partial<Court>; defaultSport: Sport; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: court.name ?? '', sport: court.sport ?? defaultSport, hourlyRate: (court.hourlyRate ?? null) as number | null, notes: court.notes ?? '' })
  function submit(e: FormEvent) {
    e.preventDefault()
    saveCourt(groupId, { ...court, venueId: court.venueId!, ...form, hourlyRate: form.hourlyRate ?? 0 }).catch((err) => toast(errorMessage(err), 'error'))
    toast('Quadra salva'); onClose()
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
        <Field label="Valor por hora (R$)"><NumberInput decimal required value={form.hourlyRate} onChange={(v) => setForm({ ...form, hourlyRate: v })} placeholder="Ex.: 200" /></Field>
        <Field label="Observações"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Card>
  )
}
