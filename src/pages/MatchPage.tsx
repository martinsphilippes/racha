import { useParams } from 'react-router'
import { doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useGroup } from '@/hooks/useGroupContext'
import { useDocument } from '@/hooks/useFirestore'
import { useAnnouncements, useMatchPlayers, useMembers } from '@/hooks/useGroupData'
import type { Match } from '@/lib/types'
import { EmptyState, PageHeader, Spinner } from '@/components/ui'
import MatchView from '@/components/MatchView'

export default function MatchPage() {
  const { id = '' } = useParams()
  const { group, groupId, isManager } = useGroup()
  const { data: match, loading } = useDocument<Match>(() => (groupId ? doc(db, 'groups', groupId, 'matches', id) : null), [groupId, id])
  const { data: players } = useMatchPlayers(groupId, id)
  const { data: members } = useMembers(groupId)
  const { data: announcements } = useAnnouncements(groupId)

  return (
    <div>
      <PageHeader title="Partida" back="/" />
      {loading || !group ? <Spinner /> : !match ? <EmptyState icon="🤔" title="Partida não encontrada" /> : (
        <MatchView group={group} match={match} players={players} members={members} announcements={announcements.filter((a) => a.matchId === match.id)} isManager={isManager} />
      )}
    </div>
  )
}
