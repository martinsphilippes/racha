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
  const { data: directory, loading: dirLoading } = useDirectory(true)
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const memberIds = useMemo(() => new Set(members.map((m) => m.uid)), [members])
  // Todos os cadastrados que ainda não estão no grupo, filtrados pela busca (opcional).
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return directory
      .filter((p) => !memberIds.has(p.uid))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [directory, memberIds, search])
  const roleOf = (uid: string) => directory.find((p) => p.uid === uid)?.platformRole

  if (!group || !user) return <Spinner />

  function toggle(uid: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n })
  }
  function selectAllVisible() {
    setSelected(new Set(candidates.map((p) => p.uid)))
  }

  async function addSelected() {
    const picked = candidates.filter((p) => selected.has(p.uid))
    if (picked.length === 0) return
    setBusy(true)
    try {
      await Promise.all(picked.map((p: DirectoryEntry) => addMember(group!.id, p, 'player', { uid: user!.uid, name: profile?.name ?? '' })))
      toast(picked.length === 1 ? `${picked[0].name} adicionado ao grupo` : `${picked.length} jogadores adicionados ao grupo`)
      setSelected(new Set()); setSearch('')
    } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
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

  const selectedCount = candidates.filter((p) => selected.has(p.uid)).length

  return (
    <div className="space-y-5">
      <PageHeader title="Jogadores" back="/manage" />

      <section>
        <SectionTitle right={<Pill>{candidates.length} disponíveis</Pill>}>Adicionar jogadores</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-muted">Quem já criou conta no app aparece aqui. Marque quem entra no grupo e toque em Adicionar.</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nome ou e-mail (opcional)" aria-label="Buscar jogador" />
          {dirLoading ? <Spinner /> : candidates.length === 0 ? (
            <p className="text-sm text-muted">{search.trim() ? 'Ninguém encontrado com esse filtro.' : 'Todos os cadastrados já estão no grupo. Quem ainda não tem conta precisa criar no app.'}</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{selectedCount} selecionado{selectedCount === 1 ? '' : 's'}</span>
                <div className="flex gap-3">
                  <button type="button" onClick={selectAllVisible} className="font-semibold text-gold-400">Selecionar todos</button>
                  {selectedCount > 0 && <button type="button" onClick={() => setSelected(new Set())} className="font-semibold text-muted">Limpar</button>}
                </div>
              </div>
              <ul className="max-h-80 divide-y divide-line/70 overflow-auto rounded-xl bg-surface-2 ring-1 ring-line">
                {candidates.map((p) => {
                  const on = selected.has(p.uid)
                  return (
                    <li key={p.uid}>
                      <label className={`flex cursor-pointer items-center gap-3 px-3 py-3 ${on ? 'bg-flame-500/10' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(p.uid)} aria-label={p.name} className="h-5 w-5 shrink-0 accent-[#f97316]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.name}</span>
                          <span className="block truncate text-xs text-muted">{p.email} · {PLATFORM_ROLE_LABEL[p.platformRole]}</span>
                        </span>
                        {on && <span className="text-flame-400">✓</span>}
                      </label>
                    </li>
                  )
                })}
              </ul>
              <Button className="w-full" onClick={addSelected} disabled={busy || selectedCount === 0}>
                {busy ? 'Adicionando…' : selectedCount === 0 ? 'Selecione os jogadores' : `Adicionar ${selectedCount} jogador${selectedCount === 1 ? '' : 'es'}`}
              </Button>
            </>
          )}
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
