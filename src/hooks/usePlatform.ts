import { collection, doc, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DirectoryEntry, Group } from '@/lib/types'
import type { AccessLog } from '@/lib/access'
import { useCollection, useDocument } from './useFirestore'

/** Registro público do usuário (nome, e-mail, papel de plataforma), em tempo real. */
export function useMyDirectoryEntry(uid: string | null) {
  return useDocument<DirectoryEntry>(() => (uid ? doc(db, 'directory', uid) : null), [uid])
}

/** Todos os usuários cadastrados (para o organizador montar o grupo e o dono definir papéis). */
export function useDirectory(enabled: boolean) {
  return useCollection<DirectoryEntry>(() => (enabled ? query(collection(db, 'directory'), orderBy('name')) : null), [enabled])
}

/** Dono: todos os grupos do sistema. */
export function useAllGroups(enabled: boolean) {
  return useCollection<Group>(() => (enabled ? query(collection(db, 'groups'), orderBy('name')) : null), [enabled])
}

/** Dono: últimos acessos ao app (mais recentes primeiro). */
export function useAccessLogs(enabled: boolean, max = 300) {
  return useCollection<AccessLog>(() => (enabled ? query(collection(db, 'accessLogs'), orderBy('at', 'desc'), limit(max)) : null), [enabled, max])
}
