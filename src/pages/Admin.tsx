import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useAccessLogs, useAllGroups, useDirectory } from '@/hooks/usePlatform'
import { formatDateTime } from '@/lib/format'
import { setPlatformRole } from '@/lib/repo'
import { PLATFORM_ROLE_LABEL } from '@/lib/platform'
import { SPORTS } from '@/lib/types'
import { Button, Card, LinkButton, PageHeader, Pill, SectionTitle, Spinner, Stat } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

/** Área do dono: define quem é organizador e acessa qualquer grupo. */
export default function Admin() {
  const { user, isOwner } = useAuth()
  const { setGroupId } = useGroup()
  const { data: people, loading } = useDirectory(isOwner)
  const { data: groups } = useAllGroups(isOwner)
  const { data: logs, loading: logsLoading } = useAccessLogs(isOwner)
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [showAllLogs, setShowAllLogs] = useState(false)

  const accessStats = useMemo(() => {
    const now = Date.now()
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const week = now - 7 * 24 * 60 * 60 * 1000
    const today = logs.filter((l) => l.at >= startOfDay.getTime())
    const last7 = logs.filter((l) => l.at >= week)
    const people7 = new Set(last7.map((l) => l.uid ?? `visitante:${l.deviceId}`)).size
    const visitors7 = last7.filter((l) => !l.uid).length
    return { today: today.length, last7: last7.length, people7, visitors7 }
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [people, search])
  const organizers = people.filter((p) => p.platformRole === 'organizer').length

  async function toggle(uid: string, current: string) {
    const next = current === 'organizer' ? 'athlete' : 'organizer'
    if (!confirm(next === 'organizer' ? 'Tornar esta pessoa organizadora? Ela poderá criar e administrar grupos.' : 'Remover a permissão de organizador?')) return
    try { await setPlatformRole(uid, next); toast(next === 'organizer' ? 'Agora é organizador' : 'Voltou a ser atleta') } catch (err) { toast(errorMessage(err), 'error') }
  }

  if (!isOwner) return null

  return (
    <div className="space-y-5">
      <PageHeader title="Administração" right={<Pill tone="amber">👑 Dono</Pill>} />

      <section>
        <SectionTitle right={<Pill>{people.length} usuários · {organizers} organizadores</Pill>}>Usuários e permissões</SectionTitle>
        <Card className="space-y-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" />
          {loading && <Spinner />}
          <ul className="divide-y divide-line/70">
            {filtered.map((p) => (
              <li key={p.uid} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}{p.uid === user?.uid ? ' (você)' : ''}</div>
                  <div className="truncate text-xs text-muted">{p.email}{p.lastSeenAt ? ` · último acesso ${formatDateTime(p.lastSeenAt)}` : ' · nunca acessou'}</div>
                </div>
                {p.platformRole === 'owner' ? <Pill tone="amber">{PLATFORM_ROLE_LABEL.owner}</Pill> : (
                  <button
                    type="button"
                    onClick={() => toggle(p.uid, p.platformRole)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${p.platformRole === 'organizer' ? 'bg-sky-glow/20 text-sky-glow ring-sky-glow/40' : 'bg-surface-2 text-slate-200 ring-line'}`}
                    aria-label={`${p.platformRole === 'organizer' ? 'Tornar atleta' : 'Tornar organizador'}: ${p.name}`}
                  >
                    {PLATFORM_ROLE_LABEL[p.platformRole]} · {p.platformRole === 'organizer' ? 'rebaixar' : 'promover'}
                  </button>
                )}
              </li>
            ))}
            {!loading && filtered.length === 0 && <li className="py-2 text-sm text-muted">Nenhum usuário encontrado.</li>}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle right={<Pill>{logs.length} registros</Pill>}>Acessos ao app</SectionTitle>
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Hoje" value={accessStats.today} tone="green" />
            <Stat label="Últimos 7 dias" value={accessStats.last7} />
            <Stat label="Pessoas (7 dias)" value={accessStats.people7} tone="amber" />
            <Stat label="Visitantes sem conta (7 dias)" value={accessStats.visitors7} />
          </div>
          <p className="text-xs text-muted">Cada abertura do app conta uma vez a cada 30 minutos por aparelho. Quem abre o link sem conta aparece como Visitante até se cadastrar.</p>
          {logsLoading ? <Spinner /> : logs.length === 0 ? <p className="text-sm text-muted">Nenhum acesso registrado ainda.</p> : (
            <ul className="divide-y divide-line/70">
              {(showAllLogs ? logs : logs.slice(0, 20)).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{l.name ?? (l.uid ? 'Usuário' : 'Visitante sem conta')}</div>
                    <div className="truncate text-xs text-muted">{formatDateTime(l.at)} · {l.platform === 'ios' ? 'iPhone' : l.platform === 'android' ? 'Android' : 'Computador'}{l.installed ? ' · app instalado' : ' · navegador'}{l.path && l.path !== '/' ? ` · ${l.path}` : ''}</div>
                  </div>
                  <Pill tone={l.uid ? 'blue' : 'neutral'}>{l.uid ? 'conta' : 'visitante'}</Pill>
                </li>
              ))}
            </ul>
          )}
          {logs.length > 20 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllLogs((v) => !v)}>{showAllLogs ? 'Mostrar menos' : `Ver todos (${logs.length})`}</Button>}
        </Card>
      </section>

      <section>
        <SectionTitle right={<Pill>{groups.length}</Pill>}>Todos os grupos</SectionTitle>
        <Card className="divide-y divide-line/70 p-0">
          {groups.length === 0 && <p className="p-4 text-sm text-muted">Nenhum grupo criado ainda.</p>}
          {groups.map((g) => (
            <Link key={g.id} to="/manage" onClick={() => setGroupId(g.id)} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-semibold">{g.name}</div>
                <div className="text-xs text-muted">{SPORTS.find((s) => s.value === g.sport)?.label}</div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </Card>
        <div className="mt-2"><LinkButton to="/groups/new" className="w-full">+ Criar grupo</LinkButton></div>
      </section>
      <Button variant="ghost" size="sm" className="w-full" onClick={() => location.reload()}>Atualizar</Button>
    </div>
  )
}
