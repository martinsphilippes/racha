import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
// Configuração pública do Firebase Web SDK (gerada por `npm run setup:firebase`).
// Não é segredo: a segurança vem da autenticação + regras do Firestore.
import committedConfig from '@/firebase.config.json'

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

// Com emuladores: projeto local fixo (demo-racha), nunca o projeto real.
// Sem emuladores: variáveis de ambiente (Vercel/.env) → arquivo versionado.
const firebaseConfig = useEmulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-racha', storageBucket: '', messagingSenderId: '', appId: 'demo' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || committedConfig.apiKey || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || committedConfig.authDomain || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || committedConfig.projectId || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || committedConfig.storageBucket || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || committedConfig.messagingSenderId || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || committedConfig.appId || '',
    }

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Cache local persistente: a tela abre instantaneamente com os últimos dados
// e o Firestore sincroniza em tempo real assim que houver rede.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (useEmulators) {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1'
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
}
