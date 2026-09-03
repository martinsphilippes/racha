import { collection, doc, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DirectoryEntry, Group } from '@/lib/types'
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
