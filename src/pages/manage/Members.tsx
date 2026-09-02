import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useMembers } from '@/hooks/useGroupData'
import { regenerateInviteCode, removeMember, setMemberRole } from '@/lib/repo'
import { copyText } from '@/lib/clipboard'
import type { Member } from '@/lib/types'
import { Button, Card, PageHeader, Pill, SectionTitle, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

export default function Members() {
  const { user } = useAuth()
  const { group, groupId } = useGroup()
  const { data: members, loading } = useMembers(groupId)
  const toast = useToast()

  if (!group) return <Spinner />
  const link = `${location.origin}/groups/join?code=${group.inviteCode}`
  const shareText = `Entre no meu futebol "${group.name}" no Racha!\nCódigo de convite: ${group.inviteCode}\n${link}`

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Racha', text: shareText }); return } catch { /* cancelado */ }
    }
    toast((await copyText(shareText)) ? 'Convite copiado!' : 'Não foi possível copiar', 'ok')
  }
  async function regenerate() {
    if (!confirm('Gerar um novo código? O código atual deixará de funcionar.')) return
    try { await regenerateInviteCode(group!); toast('Novo código gerado') } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function toggleRole(m: Member) {
    const role = m.role === 'manager' ? 'player' : 'manager'
    if (!confirm(role === 'manager' ? `Tornar ${m.name} gestor do grupo?` : `Remover ${m.name} da gestão?`)) return
    try { await setMemberRole(group!.id, m.uid, role); toast('Permissão atualizada') } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function remove(m: Member) {
    if (!confirm(`Remover ${m.name} do grupo?`)) return
    try { await removeMember(group!.id, m.uid); toast('Jogador removido') } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Jogadores" back="/manage" />
      <section>
        <SectionTitle>Convite</SectionTitle>
        <Card className="space-y-3 text-center">
          <p className="text-sm text-neutral-600">Compartilhe o código com os atletas. Eles entram em "Tenho um código de convite".</p>
          <div className="text-4xl font-extrabold tracking-[0.3em]" data-testid="invite-code">{group.inviteCode}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={share}>Compartilhar</Button>
            <Button variant="outline" onClick={async () => toast((await copyText(group.inviteCode)) ? 'Código copiado!' : 'Erro ao copiar')}>Copiar código</Button>
          </div>
          <button type="button" onClick={regenerate} className="text-xs text-neutral-500 underline">Gerar novo código</button>
        </Card>
      </section>
      <section>
        <SectionTitle right={<Pill>{members.length}</Pill>}>Participantes</SectionTitle>
        <Card className="divide-y divide-neutral-100 p-0">
          {loading && <Spinner />}
          {members.map((m) => (
            <div key={m.uid} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{m.name}{m.uid === user?.uid ? ' (você)' : ''}</div>
                <Pill tone={m.role === 'manager' ? 'blue' : 'neutral'}>{m.role === 'manager' ? 'Gestor' : 'Atleta'}</Pill>
              </div>
              {m.uid !== user?.uid && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleRole(m)}>{m.role === 'manager' ? 'Rebaixar' : 'Promover'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label={`Remover ${m.name}`}>🗑️</Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
