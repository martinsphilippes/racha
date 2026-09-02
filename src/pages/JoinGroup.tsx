import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { joinGroup } from '@/lib/repo'
import { Button, Card, ErrorText, Field, PageHeader } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

export default function JoinGroup() {
  const { user, profile } = useAuth()
  const { setGroupId, memberships } = useGroup()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [joinedId, setJoinedId] = useState<string | null>(null)

  // Só navega quando a associação já chegou do servidor.
  useEffect(() => {
    if (joinedId && memberships.some((m) => m.groupId === joinedId)) {
      setGroupId(joinedId)
      toast('Você entrou no grupo!')
      navigate('/', { replace: true })
    }
  }, [joinedId, memberships, setGroupId, navigate, toast])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true); setError('')
    try {
      setJoinedId(await joinGroup(code, { uid: user.uid, name: profile?.name ?? user.displayName ?? 'Atleta' }))
    } catch (err) {
      const c = (err as { code?: string })?.code ?? ''
      setError(c.includes('permission') ? 'Código de convite inválido.' : errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Entrar em um grupo" back={memberships.length ? '/profile' : undefined} />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Código de convite" hint="Peça o código ao organizador do seu futebol">
            <input required autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: AB12CD" className="text-center text-2xl font-bold tracking-[0.3em]" />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.trim().length < 4}>{busy ? 'Entrando…' : 'ENTRAR NO GRUPO'}</Button>
        </form>
      </Card>
    </div>
  )
}
