import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { Button, Card, ErrorText, Field, LinkButton, PageHeader, Pill, SectionTitle } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { updateDoc } from 'firebase/firestore'
import { memberRef } from '@/lib/repo'
import { useGroupNames } from '@/hooks/useGroupData'
import { PLATFORM_ROLE_LABEL } from '@/lib/platform'
import AddressForm from '@/components/AddressForm'
import { EMPTY_ADDRESS, formatAddress, isAddressComplete, type Address } from '@/lib/cep'

export default function Profile() {
  const { user, profile, logout, updateProfileData, platformRole, canOrganize } = useAuth()
  const { memberships, groupId, setGroupId } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  const groupNames = useGroupNames(memberships.map((m) => m.groupId))
  const [form, setForm] = useState({ name: '', phone: '', address: EMPTY_ADDRESS as Address })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) {
      // Perfis antigos guardavam o endereço como texto: começa vazio para o usuário informar o CEP.
      const address = typeof profile.address === 'object' && profile.address ? profile.address : EMPTY_ADDRESS
      setForm({ name: profile.name, phone: profile.phone, address })
    }
  }, [profile])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isAddressComplete(form.address)) { setError('Informe o CEP, a rua, o número, a cidade e a UF.'); return }
    setBusy(true); setError('')
    try {
      await updateProfileData(form)
      // Propaga o nome para as listas dos grupos.
      await Promise.all(memberships.map((m) => updateDoc(memberRef(m.groupId, m.uid), { name: form.name.trim() }).catch(() => undefined)))
      toast('Perfil atualizado')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Perfil" right={platformRole ? <Pill tone={platformRole === 'owner' ? 'amber' : platformRole === 'organizer' ? 'blue' : 'neutral'}>{PLATFORM_ROLE_LABEL[platformRole]}</Pill> : null} />

      <section>
        <SectionTitle>Meus grupos</SectionTitle>
        <Card className="space-y-2">
          {memberships.length === 0 && <p className="text-sm text-muted">Você ainda não participa de nenhum grupo.</p>}
          {memberships.map((m) => (
            <button
              key={m.groupId}
              type="button"
              onClick={() => { setGroupId(m.groupId); navigate('/') }}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${m.groupId === groupId ? 'border-flame-500 bg-flame-500/10' : 'border-line'}`}
            >
              <span className="font-semibold">{groupNames[m.groupId] ?? 'Grupo'}</span>
              <Pill tone={m.role === 'manager' ? 'blue' : 'neutral'}>{m.role === 'manager' ? 'Gestor' : 'Atleta'}</Pill>
            </button>
          ))}
          {canOrganize && <LinkButton to="/groups/new" className="w-full">Criar grupo</LinkButton>}
          {!canOrganize && <p className="text-xs text-muted">Para entrar em um grupo, peça ao organizador para adicionar você pelo e-mail {user?.email}.</p>}
        </Card>
      </section>

      <section>
        <SectionTitle>Meus dados</SectionTitle>
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nome completo"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="E-mail"><input value={user?.email ?? ''} disabled className="bg-surface-2" /></Field>
            <Field label="Telefone"><input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            {typeof profile?.address === 'string' && profile.address && (
              <p className="rounded-xl bg-gold-400/10 px-3 py-2 text-xs text-gold-300">Endereço anterior: {formatAddress(profile.address)}. Informe o CEP para atualizar.</p>
            )}
            <AddressForm value={form.address} onChange={(address) => setForm((f) => ({ ...f, address }))} />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy}>Salvar</Button>
          </form>
        </Card>
      </section>

      <Button variant="outline" className="w-full" onClick={() => logout().then(() => navigate('/login'))}>Sair da conta</Button>
      <p className="text-center text-xs text-muted/70">Racha 10 · v{__APP_VERSION__}</p>
    </div>
  )
}
