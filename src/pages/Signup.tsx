import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { authErrorMessage, useAuth } from '@/hooks/useAuth'
import { Button, ErrorText, Field } from '@/components/ui'
import { AuthLayout } from './Login'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return }
    setBusy(true); setError('')
    try {
      await signup(form)
      navigate('/', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally { setBusy(false) }
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Leva menos de um minuto">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome completo"><input autoComplete="name" required value={form.name} onChange={set('name')} /></Field>
        <Field label="E-mail"><input type="email" autoComplete="email" inputMode="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Telefone"><input type="tel" autoComplete="tel" inputMode="tel" required value={form.phone} onChange={set('phone')} placeholder="(34) 99999-9999" /></Field>
        <Field label="Endereço"><input autoComplete="street-address" required value={form.address} onChange={set('address')} /></Field>
        <Field label="Senha" hint="Mínimo de 6 caracteres"><input type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={set('password')} /></Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Criando…' : 'CRIAR CONTA'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-600">
        Já tem conta? <Link to="/login" className="font-semibold text-green-700">Entrar</Link>
      </p>
    </AuthLayout>
  )
}
