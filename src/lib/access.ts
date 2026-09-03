// Registro de acessos: uma linha por abertura do app (com ou sem conta).
// O dono vê a lista na aba Admin. Não há rastreamento externo: fica só no seu Firestore.
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { detectPlatform, isStandalone } from '@/hooks/useInstallPrompt'

export interface AccessLog {
  id: string
  uid: string | null
  name: string | null
  email: string | null
  deviceId: string
  at: number
  platform: 'ios' | 'android' | 'desktop' | 'installed'
  installed: boolean
  version: string
  path: string
}

const DEVICE_KEY = 'racha:deviceId'
const SESSION_KEY = 'racha:lastAccessLog'
const MIN_INTERVAL_MS = 30 * 60 * 1000 // no máximo um registro a cada 30 min por aparelho/usuário

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) { id = crypto.randomUUID().replace(/-/g, '').slice(0, 16); localStorage.setItem(DEVICE_KEY, id) }
    return id
  } catch { return 'sem-armazenamento' }
}

function shouldLog(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const last = raw ? (JSON.parse(raw) as { key: string; at: number }) : null
    if (last && last.key === key && Date.now() - last.at < MIN_INTERVAL_MS) return false
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ key, at: Date.now() }))
    return true
  } catch { return true }
}

export async function logAccess(user: { uid: string; name: string | null; email: string | null } | null): Promise<void> {
  const key = user?.uid ?? 'anon'
  if (!shouldLog(key)) return
  const platform = detectPlatform()
  const entry: Omit<AccessLog, 'id'> = {
    uid: user?.uid ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    deviceId: deviceId(),
    at: Date.now(),
    platform: platform === 'installed' ? platformFromUa() : platform,
    installed: isStandalone(),
    version: __APP_VERSION__,
    path: location.pathname,
  }
  try {
    await addDoc(collection(db, 'accessLogs'), entry)
    if (user) await updateDoc(doc(db, 'directory', user.uid), { lastSeenAt: entry.at }).catch(() => undefined)
  } catch {
    /* registro de acesso nunca deve atrapalhar o uso */
  }
}

function platformFromUa(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}
