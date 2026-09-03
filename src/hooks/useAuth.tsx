import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { DirectoryEntry, UserProfile } from '@/lib/types'
import { isOwnerEmail, type PlatformRole } from '@/lib/platform'
import { ensureDirectoryEntry } from '@/lib/repo'
import type { Address } from '@/lib/cep'

interface SignupInput {
  name: string
  email: string
  phone: string
  address: Address
  password: string
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  platformRole: PlatformRole | null
  isOwner: boolean
  canOrganize: boolean
  loading: boolean // só a autenticação (rápida, vem da sessão salva)
  roleReady: boolean // perfil e papel de plataforma já carregados
  signup: (input: SignupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfileData: (data: { name: string; phone: string; address: Address }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [entry, setEntry] = useState<DirectoryEntry | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [entryReady, setEntryReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
      if (!u) {
        setProfile(null)
        setEntry(null)
        setProfileReady(true)
        setEntryReady(true)
      } else {
        setProfileReady(false)
        setEntryReady(false)
      }
    })
  }, [])

  // Registro no diretório (papel de plataforma). Criado no cadastro; reparado aqui se faltar.
  useEffect(() => {
    if (!user) return
    let repaired = false
    return onSnapshot(
      doc(db, 'directory', user.uid),
      (snap) => {
        if (snap.exists()) {
          setEntry({ id: snap.id, ...snap.data() } as DirectoryEntry)
          setEntryReady(true)
        } else if (!repaired) {
          repaired = true
          ensureDirectoryEntry(
            { uid: user.uid, name: user.displayName ?? 'Atleta', email: user.email ?? '' },
            isOwnerEmail(user.email) ? 'owner' : 'athlete',
          ).catch(() => setEntryReady(true))
        }
      },
      () => setEntryReady(true),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null)
        setProfileReady(true)
      },
      () => setProfileReady(true),
    )
  }, [user])

  async function signup(input: SignupInput) {
    const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password)
    await updateProfile(cred.user, { displayName: input.name.trim() })
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      address: cleanAddress(input.address),
      createdAt: Date.now(),
    })
    await ensureDirectoryEntry(
      { uid: cred.user.uid, name: input.name.trim(), email: input.email.trim() },
      isOwnerEmail(input.email) ? 'owner' : 'athlete',
    )
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  async function logout() {
    await signOut(auth)
  }

  async function updateProfileData(data: { name: string; phone: string; address: Address }) {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), { name: data.name, phone: data.phone, address: cleanAddress(data.address) })
    await updateProfile(user, { displayName: data.name })
    await updateDoc(doc(db, 'directory', user.uid), { name: data.name }).catch(() => undefined)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        platformRole: entry?.platformRole ?? null,
        isOwner: entry?.platformRole === 'owner',
        canOrganize: entry?.platformRole === 'owner' || entry?.platformRole === 'organizer',
        loading: !authReady,
        roleReady: profileReady && entryReady,
        signup, login, logout, updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function cleanAddress(a: Address): Address {
  return {
    cep: a.cep.replace(/\D/g, ''), street: a.street.trim(), number: a.number.trim(), complement: a.complement.trim(),
    district: a.district.trim(), city: a.city.trim(), state: a.state.trim().toUpperCase(),
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}

/** Traduz erros do Firebase Auth para mensagens amigáveis. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado.'
    case 'auth/invalid-email': return 'E-mail inválido.'
    case 'auth/weak-password': return 'A senha precisa ter pelo menos 6 caracteres.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
    case 'auth/network-request-failed': return 'Sem conexão. Verifique sua internet.'
    default: return 'Não foi possível concluir. Tente novamente.'
  }
}
