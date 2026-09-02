import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { authErrorMessage, useAuth } from '@/hooks/useAuth'
import { Button, ErrorText, Field } from '@/components/ui'

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
      <p className="mt-6 text-center text-sm text-neutral-600">
        Ainda não tem conta? <Link to="/signup" className="font-semibold text-green-700">Criar conta</Link>
      </p>
    </AuthLayout>
  )
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <img src="/icons/icon.svg" alt="" className="h-16 w-16" />
        <h1 className="text-3xl font-extrabold tracking-tight">Racha</h1>
        {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}
