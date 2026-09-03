import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { authErrorMessage, useAuth } from '@/hooks/useAuth'
import { Button, ErrorText, Field } from '@/components/ui'
import InstallBanner from '@/components/InstallBanner'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally { setBusy(false) }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Organize seu futebol semanal">
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail"><input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha"><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Entrando…' : 'ENTRAR'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta? <Link to="/signup" className="font-semibold text-gold-400">Criar conta</Link>
      </p>
    </AuthLayout>
  )
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <img src="/brand/logo.webp" alt="Racha 10" className="w-72 max-w-full rounded-2xl" />
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="rounded-2xl bg-surface p-5 shadow-md ring-1 ring-line/60">
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
      </div>
      <div className="mt-4"><InstallBanner compact /></div>
    </div>
  )
}
