import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'installed'

const DISMISS_KEY = 'racha:installDismissedAt'
const DISMISS_DAYS = 7

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function detectPlatform(): InstallPlatform {
  if (isStandalone()) return 'installed'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/**
 * Instalação do PWA:
 * - Android/Chrome: captura `beforeinstallprompt` e abre a instalação nativa com um toque.
 * - iOS: não há API; mostramos o passo a passo (Compartilhar → Adicionar à Tela de Início).
 * O aviso pode ser dispensado e volta depois de alguns dias; some quando o app já está instalado.
 */
export function useInstallPrompt() {
  const [platform, setPlatform] = useState<InstallPlatform>(() => detectPlatform())
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
      return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
    } catch { return false }
  })

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setPlatform('installed'); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setPlatform('installed')
    setDeferred(null)
    return outcome
  }

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  return { platform, canPromptNatively: Boolean(deferred), install, dismiss, visible: platform !== 'installed' && !dismissed }
}
