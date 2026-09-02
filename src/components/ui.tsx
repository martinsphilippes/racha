import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
const variants: Record<Variant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-green-600/50',
  secondary: 'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-black disabled:bg-neutral-900/50',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-600/50',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300',
  outline: 'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50',
}

export function Button({
  variant = 'primary', size = 'md', className = '', children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-4 py-3 text-base', lg: 'px-5 py-4 text-lg' }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function LinkButton({ to, variant = 'outline', className = '', children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition select-none ${variants[variant]} ${className}`}>
      {children}
    </Link>
  )
}

export function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  // Só aplica o fundo branco padrão se quem usa não definiu outro fundo (evita conflito de classes).
  const bg = /(^|\s)bg-/.test(className) ? '' : 'bg-white'
  return <div className={`rounded-2xl ${bg} p-4 shadow-sm ${className}`} {...props}>{children}</div>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{children}</h2>
      {right}
    </div>
  )
}

export function Pill({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'amber' | 'blue'; className?: string }) {
  const tones = {
    neutral: 'bg-neutral-200 text-neutral-700',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>
}

/** Rótulo envolvendo o campo: associação implícita (acessibilidade e toque no rótulo foca o campo). */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-neutral-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-green-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="max-w-xs text-sm text-neutral-600">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{children}</p>
}

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {back && (
        <Link to={back} aria-label="Voltar" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm">
          ‹
        </Link>
      )}
      <h1 className="flex-1 text-xl font-extrabold tracking-tight">{title}</h1>
      {right}
    </div>
  )
}

export function Stat({ label, value, tone = 'neutral' }: { label: string; value: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'amber' }) {
  const tones = { neutral: 'text-neutral-900', green: 'text-green-700', red: 'text-red-700', amber: 'text-amber-700' }
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-base font-extrabold leading-tight tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  )
}

export function Toggle({ options, value, onChange, disabled }: { options: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-3 py-3 text-base font-semibold transition ${
            value === o.value ? 'border-green-600 bg-green-600 text-white' : 'border-neutral-300 bg-white text-neutral-800'
          } disabled:opacity-60`}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
