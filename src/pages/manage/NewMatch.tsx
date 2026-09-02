import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useGroup } from '@/hooks/useGroupContext'
import { useCourts, useVenues } from '@/hooks/useGroupData'
import { createMatch, type MatchInput } from '@/lib/repo'
import { Card, PageHeader, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import MatchForm from './MatchForm'

export default function NewMatch() {
  const { user } = useAuth()
  const { group, groupId } = useGroup()
  const { data: venues } = useVenues(groupId)
  const { data: courts } = useCourts(groupId)
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!group || !user) return <Spinner />

  async function submit(input: MatchInput) {
    setBusy(true)
    try {
      const id = await createMatch(group!, input, venues, courts, user!.uid)
      toast('Partida criada')
      navigate(`/manage/match/${id}`, { replace: true })
    } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Partida avulsa" back="/manage" />
      <Card><MatchForm match={null} onSubmit={submit} submitLabel="CRIAR PARTIDA" busy={busy} /></Card>
    </div>
  )
}
