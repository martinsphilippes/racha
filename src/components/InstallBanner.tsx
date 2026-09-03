import { useState } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { Button } from './ui'
import { useToast } from './Toast'

/** Convite para adicionar o Racha 10 à tela de início (instalação do PWA). */
export default function InstallBanner({ compact = false }: { compact?: boolean }) {
  const { platform, canPromptNatively, install, dismiss, visible } = useInstallPrompt()
  const [showSteps, setShowSteps] = useState(false)
  const toast = useToast()
  if (!visible) return null

  async function onInstall() {
    const r = await install()
    if (r === 'accepted') toast('Racha 10 instalado! Procure o ícone na tela de início.')
    else if (r === 'unavailable') setShowSteps(true)
  }

  const iosSteps = (
    <ol className="mt-2 space-y-1 text-sm text-slate-200">
      <li>1. Toque em <strong>Compartilhar</strong> <span aria-hidden="true">(o quadrado com a seta para cima, na barra do Safari)</span>.</li>
      <li>2. Role e toque em <strong>Adicionar à Tela de Início</strong>.</li>
      <li>3. Confirme em <strong>Adicionar</strong>. O Racha 10 vira um app no seu iPhone.</li>
    </ol>
  )
  const androidSteps = (
    <ol className="mt-2 space-y-1 text-sm text-slate-200">
      <li>1. Toque no menu <strong>⋮</strong> do navegador (canto superior direito).</li>
      <li>2. Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
    </ol>
  )
  const desktopSteps = (
    <p className="mt-2 text-sm text-slate-200">No celular, abra este mesmo link para instalar como app. No computador, use o ícone de instalação na barra de endereço do Chrome ou Edge.</p>
  )

  return (
    <div className={`fade-in rounded-2xl border border-gold-400/30 bg-gradient-to-br from-navy-800 to-navy-900 ${compact ? 'p-3' : 'p-4'} ring-1 ring-gold-400/20`} role="region" aria-label="Instalar o app">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">Adicione o Racha 10 à tela de início</div>
          <p className="text-xs text-muted">Abre como app, com um toque, sem precisar do link.</p>
          {platform === 'android' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={onInstall}>{canPromptNatively ? '📲 Instalar agora' : '📲 Como instalar'}</Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          )}
          {platform === 'ios' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => setShowSteps((v) => !v)}>{showSteps ? 'Ocultar passos' : '📲 Ver como instalar'}</Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          )}
          {platform === 'desktop' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => setShowSteps((v) => !v)}>{showSteps ? 'Ocultar' : 'Como instalar'}</Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          )}
          {showSteps && (platform === 'ios' ? iosSteps : platform === 'android' ? androidSteps : desktopSteps)}
        </div>
      </div>
    </div>
  )
}
