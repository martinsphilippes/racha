import { NavLink, Outlet } from 'react-router'
import { useGroup } from '@/hooks/useGroupContext'

const tabs = [
  { to: '/', label: 'Início', icon: '⚽', end: true },
  { to: '/history', label: 'Histórico', icon: '📅' },
  { to: '/manage', label: 'Gestão', icon: '🛠️', manager: true },
  { to: '/profile', label: 'Perfil', icon: '👤' },
]

export default function AppShell() {
  const { isManager } = useGroup()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="flex items-center justify-center pt-3">
        <img src="/brand/logo.webp" alt="Racha 10" className="h-14 w-auto drop-shadow-[0_4px_12px_rgba(37,99,235,0.45)]" />
      </header>
      <main className="flex-1 px-4 pb-24 pt-3">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy-950/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-lg">
          {tabs.filter((t) => !t.manager || isManager).map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-gold-400' : 'text-muted'}`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
