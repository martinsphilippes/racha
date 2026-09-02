import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useAnnouncements, useUpcomingMatches } from '@/hooks/useGroupData'
import { deleteAnnouncement, postAnnouncement } from '@/lib/repo'
import { formatDate, formatDateTime } from '@/lib/format'
import { Button, Card, Field, PageHeader, SectionTitle, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

const SUGGESTIONS = ['Hoje o futebol começará às 20h.', 'Precisamos de mais dois jogadores!', 'A quadra mudou. Confiram o local na partida.', 'Lembrem de pagar o PIX antes do jogo. 🙏']

export default function Announcements({ defaultMatchId = null }: { defaultMatchId?: string | null }) {
  const { user, profile } = useAuth()
  const { group, groupId } = useGroup()
  const { data: announcements, loading } = useAnnouncements(groupId, 50)
  const { data: upcoming } = useUpcomingMatches(groupId)
  const toast = useToast()
  const [text, setText] = useState('')
  const [matchId, setMatchId] = useState<string>(defaultMatchId ?? '')
  const [busy, setBusy] = useState(false)

  if (!group || !user) return <Spinner />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await postAnnouncement(group!.id, text, matchId || null, { uid: user!.uid, name: profile?.name ?? 'Organizador' })
      setText(''); toast('Comunicado enviado')
    } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (!confirm('Excluir este comunicado?')) return
    try { await deleteAnnouncement(group!.id, id) } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Comunicados" back="/manage" />
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Mensagem para os atletas">
            <textarea rows={3} required value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Hoje o futebol começará às 20h." />
          </Field>
          <div className="flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => setText(s)} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-slate-200">{s}</button>)}
          </div>
          <Field label="Vinculado a">
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">Todo o grupo (aparece na tela inicial)</option>
              {upcoming.map((m) => <option key={m.id} value={m.id}>Partida de {formatDate(m.date)}</option>)}
            </select>
          </Field>
          <Button type="submit" className="w-full" disabled={busy || !text.trim()}>ENVIAR COMUNICADO</Button>
        </form>
      </Card>
      <section>
        <SectionTitle>Enviados</SectionTitle>
        {loading ? <Spinner /> : announcements.length === 0 ? <p className="text-sm text-muted">Nenhum comunicado ainda.</p> : (
          <div className="space-y-2">
            {announcements.map((a) => (
              <Card key={a.id} className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">{formatDateTime(a.createdAt)} · {a.createdByName}{a.matchId ? ` · partida ${formatDate(upcoming.find((m) => m.id === a.matchId)?.date ?? '') || 'passada'}` : ' · grupo'}</div>
                  <p className="whitespace-pre-wrap text-sm">{a.text}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)} aria-label="Excluir">🗑️</Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
