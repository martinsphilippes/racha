import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { createGroup } from '@/lib/repo'
import { SPORTS, type Sport } from '@/lib/types'
import { Button, Card, ErrorText, Field, PageHeader } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import NumberInput from '@/components/NumberInput'

export default function NewGroup() {
  const { user, profile, canOrganize } = useAuth()
  const { setGroupId, memberships } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', sport: 'futsal' as Sport, minPlayers: 10 as number | null, notes: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // Só navega quando a associação ao grupo já chegou do servidor (senão a guarda de gestor redireciona).
  useEffect(() => {
    if (createdId && memberships.some((m) => m.groupId === createdId)) {
      setGroupId(createdId)
      toast('Grupo criado! Agora cadastre o local e o horário.')
      navigate('/manage/venues', { replace: true })
    }
  }, [createdId, memberships, setGroupId, navigate, toast])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true); setError('')
    try {
      setCreatedId(await createGroup({ ...form, minPlayers: form.minPlayers ?? 0 }, { uid: user.uid, name: profile?.name ?? user.displayName ?? 'Gestor' }))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (!canOrganize) {
    return (
      <div>
        <PageHeader title="Novo grupo" back="/" />
        <Card><p className="text-sm text-muted">Somente organizadores criam grupos. Peça ao dono do app para tornar você organizador.</p></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Novo grupo" back={memberships.length ? '/profile' : undefined} />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome do grupo"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Futsal de terça" /></Field>
          <Field label="Modalidade">
            <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })}>
              {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Mínimo de jogadores desejado" hint="Usado para mostrar quantos ainda faltam confirmar">
            <NumberInput required value={form.minPlayers} onChange={(v) => setForm({ ...form, minPlayers: v })} placeholder="Ex.: 10" />
          </Field>
          <Field label="Informações adicionais (opcional)"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Criando…' : 'CRIAR GRUPO'}</Button>
        </form>
      </Card>
    </div>
  )
}
