import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collectionGroup, doc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Group, Member } from '@/lib/types'
import { useAuth } from './useAuth'
import { useCollection, useDocument } from './useFirestore'

interface GroupContextValue {
  memberships: Member[]
  membershipsLoading: boolean
  membershipsError: Error | null
  groupId: string | null
  group: Group | null
  groupLoading: boolean
  myRole: Member['role'] | null
  isManager: boolean
  setGroupId: (id: string) => void
}

const GroupContext = createContext<GroupContextValue | null>(null)
const STORAGE_KEY = 'racha:groupId'

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  // "De quais grupos eu participo?" — consulta em grupo de coleção filtrada pelo meu uid.
  // serverOnly: só considera a associação depois que o servidor confirmou a escrita,
  // senão os listeners do grupo seriam abertos antes de a permissão existir.
  const { data: memberships, loading: membershipsLoading, error: membershipsError } = useCollection<Member>(
    () => (uid ? query(collectionGroup(db, 'members'), where('uid', '==', uid)) : null),
    [uid],
    { serverOnly: true },
  )

  const [selected, setSelected] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
  })

  // Seleciona automaticamente o primeiro grupo válido.
  const groupId = useMemo(() => {
    if (memberships.length === 0) return null
    if (selected && memberships.some((m) => m.groupId === selected)) return selected
    return memberships[0].groupId
  }, [memberships, selected])

  useEffect(() => {
    if (groupId) { try { localStorage.setItem(STORAGE_KEY, groupId) } catch { /* ignore */ } }
  }, [groupId])

  const { data: group, loading: groupLoading } = useDocument<Group>(
    () => (groupId ? doc(db, 'groups', groupId) : null),
    [groupId],
  )

  const myRole = memberships.find((m) => m.groupId === groupId)?.role ?? null

  return (
    <GroupContext.Provider
      value={{
        memberships,
        membershipsLoading,
        membershipsError,
        groupId,
        group,
        groupLoading: membershipsLoading || (Boolean(groupId) && groupLoading),
        myRole,
        isManager: myRole === 'manager',
        setGroupId: setSelected,
      }}
    >
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup precisa estar dentro de GroupProvider')
  return ctx
}
