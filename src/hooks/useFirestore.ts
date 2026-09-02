import { useEffect, useState, type DependencyList } from 'react'
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore'

interface State<T> {
  data: T
  loading: boolean
  error: Error | null
}

interface Options {
  /**
   * Ignora snapshots com escritas locais ainda não confirmadas pelo servidor.
   * Útil quando outros listeners dependem de a escrita já existir no servidor
   * (ex.: virar membro de um grupo antes de assinar os dados do grupo).
   */
  serverOnly?: boolean
}

const RETRY_DELAY_MS = 1500
const MAX_RETRIES = 3

function isPermissionDenied(error: unknown): boolean {
  return String((error as { code?: string })?.code ?? '').includes('permission-denied')
}

/**
 * Assina uma consulta do Firestore em tempo real.
 * Qualquer alteração no banco (por qualquer usuário) chega aqui sem recarregar a página.
 * Listeners recusados por permissão são retentados algumas vezes: cobre a janela em que
 * uma permissão acabou de ser concedida (ex.: entrada em um grupo) e ainda não propagou.
 */
export function useCollection<T>(makeQuery: () => Query | null, deps: DependencyList, options: Options = {}): State<T[]> {
  const [state, setState] = useState<State<T[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    const q = makeQuery()
    if (!q) {
      setState({ data: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    let unsubscribe = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const subscribe = () => {
      unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: Boolean(options.serverOnly) },
        (snap) => {
          if (options.serverOnly && snap.metadata.hasPendingWrites) return
          setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null })
        },
        (error) => {
          if (isPermissionDenied(error) && attempts < MAX_RETRIES) {
            attempts++
            timer = setTimeout(subscribe, RETRY_DELAY_MS * attempts)
            return
          }
          if (import.meta.env.DEV) console.error('[firestore:collection]', error)
          setState({ data: [], loading: false, error })
        },
      )
    }
    subscribe()
    return () => { unsubscribe(); if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export function useDocument<T>(makeRef: () => DocumentReference | null, deps: DependencyList, options: Options = {}): State<T | null> {
  const [state, setState] = useState<State<T | null>>({ data: null, loading: true, error: null })
  useEffect(() => {
    const ref = makeRef()
    if (!ref) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    let unsubscribe = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const subscribe = () => {
      unsubscribe = onSnapshot(
        ref,
        { includeMetadataChanges: Boolean(options.serverOnly) },
        (snap) => {
          if (options.serverOnly && snap.metadata.hasPendingWrites) return
          setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null })
        },
        (error) => {
          if (isPermissionDenied(error) && attempts < MAX_RETRIES) {
            attempts++
            timer = setTimeout(subscribe, RETRY_DELAY_MS * attempts)
            return
          }
          if (import.meta.env.DEV) console.error('[firestore:document]', error)
          setState({ data: null, loading: false, error })
        },
      )
    }
    subscribe()
    return () => { unsubscribe(); if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
