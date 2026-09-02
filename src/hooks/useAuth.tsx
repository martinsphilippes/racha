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
import type { UserProfile } from '@/lib/types'

interface SignupInput {
  name: string
  email: string
  phone: string
  address: string
  password: string
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signup: (input: SignupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfileData: (data: Pick<UserProfile, 'name' | 'phone' | 'address'>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
      if (!u) {
        setProfile(null)
        setProfileReady(true)
      } else {
        setProfileReady(false)
      }
    })
  }, [])

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
      address: input.address.trim(),
      createdAt: Date.now(),
    })
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  async function logout() {
    await signOut(auth)
  }

  async function updateProfileData(data: Pick<UserProfile, 'name' | 'phone' | 'address'>) {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), data)
    await updateProfile(user, { displayName: data.name })
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading: !authReady || !profileReady, signup, login, logout, updateProfileData }}>
      {children}
    </AuthContext.Provider>
  )
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
