import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast { id: number; text: string; tone: 'ok' | 'error' }
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`fade-in rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${t.tone === 'ok' ? 'bg-royal-600' : 'bg-red-600'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message && !err.message.includes('permission')) return err.message
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) return 'Você não tem permissão para esta ação.'
  if (code.includes('unavailable')) return 'Sem conexão. A ação será enviada quando a rede voltar.'
  return 'Não foi possível concluir. Tente novamente.'
}
