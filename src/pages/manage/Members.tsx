import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useMembers } from '@/hooks/useGroupData'
import { useDirectory } from '@/hooks/usePlatform'
import { addMember, removeMember, setMemberRole } from '@/lib/repo'
import { PLATFORM_ROLE_LABEL } from '@/lib/platform'
import type { DirectoryEntry, Member } from '@/lib/types'
import { Button, Card, PageHeader, Pill, SectionTitle, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

export default function Members() {
  const { user, profile, isOwner } = useAuth()
  const { group, groupId } = useGroup()
  const { data: members, loading } = useMembers(groupId)
  const { data: directory } = useDirectory(true)
  const toast = useToast()
  const [search, setSearch] = useState('')

  const memberIds = useMemo(() => new Set(members.map((m) => m.uid)), [members])
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return directory.filter((p) => !memberIds.has(p.uid) && (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))).slice(0, 8)
  }, [directory, memberIds, search])
  const roleOf = (uid: string) => directory.find((p) => p.uid === uid)?.platformRole

  if (!group || !user) return <Spinner />

  async function add(p: DirectoryEntry) {
    try {
      await addMember(group!.id, p, 'player', { uid: user!.uid, name: profile?.name ?? '' })
      toast(`${p.name} adicionado ao grupo`)
      setSearch('')
    } catch (err) { toast(errorMessage(err), 'error') }
  }
  async function toggleRole(m: Member) {
    const role = m.role === 'manager' ? 'player' : 'manager'
    if (role === 'manager' && roleOf(m.uid) !== 'organizer' && roleOf(m.uid) !== 'owner') {
      toast('Só organizadores podem ser gestores. Promova a pessoa em Administração.', 'error'); return
    }
    if (!confirm(role === 'manager' ? `Tornar ${m.name} gestor deste grupo?` : `Remover ${m.name} da gestão deste grupo?`)) return
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
        <SectionTitle>Adicionar jogador</SectionTitle>
        <Card className="space-y-2">
          <p className="text-sm text-muted">O atleta cria a conta no app; você o encontra aqui pelo nome ou e-mail e adiciona ao grupo.</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar jogador" />
          {candidates.length > 0 && (
            <ul className="divide-y divide-line/70">
              {candidates.map((p) => (
                <li key={p.uid} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted">{p.email} · {PLATFORM_ROLE_LABEL[p.platformRole]}</div>
                  </div>
                  <Button size="sm" onClick={() => add(p)} aria-label={`Adicionar ${p.name}`}>Adicionar</Button>
                </li>
              ))}
            </ul>
          )}
          {search.trim() && candidates.length === 0 && <p className="text-sm text-muted">Ninguém encontrado. A pessoa já criou a conta no app?</p>}
        </Card>
      </section>
      <section>
        <SectionTitle right={<Pill>{members.length}</Pill>}>Participantes</SectionTitle>
        <Card className="divide-y divide-line/70 p-0">
          {loading && <Spinner />}
          {members.map((m) => (
            <div key={m.uid} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{m.name}{m.uid === user?.uid ? ' (você)' : ''}</div>
                <Pill tone={m.role === 'manager' ? 'blue' : 'neutral'}>{m.role === 'manager' ? 'Gestor' : 'Atleta'}</Pill>
              </div>
              {m.uid !== user?.uid && (
                <div className="flex shrink-0 gap-1">
                  {isOwner && <Button size="sm" variant="ghost" onClick={() => toggleRole(m)}>{m.role === 'manager' ? 'Rebaixar' : 'Promover'}</Button>}
                  {(isOwner || m.role === 'player') && <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label={`Remover ${m.name}`}>🗑️</Button>}
                </div>
              )}
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
