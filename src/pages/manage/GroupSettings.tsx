import { useEffect, useState, type FormEvent } from 'react'
import { useGroup } from '@/hooks/useGroupContext'
import { updateGroup, updatePix } from '@/lib/repo'
import { PIX_KEY_TYPES, SPORTS, type PixKeyType, type Sport } from '@/lib/types'
import { Button, Card, ErrorText, Field, PageHeader, SectionTitle, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import NumberInput from '@/components/NumberInput'

export default function GroupSettings() {
  const { group } = useGroup()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', sport: 'futsal' as Sport, minPlayers: 10 as number | null, notes: '' })
  const [pix, setPix] = useState({ pixKeyType: 'cpf' as PixKeyType, pixKey: '', pixName: '', pixCity: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!group) return
    setForm({ name: group.name, sport: group.sport, minPlayers: group.minPlayers, notes: group.notes ?? '' })
    setPix({ pixKeyType: group.pixKeyType ?? 'cpf', pixKey: group.pixKey ?? '', pixName: group.pixName ?? '', pixCity: group.pixCity ?? '' })
  }, [group])

  if (!group) return <Spinner />

  async function saveGroup(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await updateGroup(group!.id, { name: form.name.trim(), sport: form.sport, minPlayers: form.minPlayers ?? 0, notes: form.notes.trim() })
      toast('Grupo salvo')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  async function savePix(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const key = pix.pixKey.trim()
      await updatePix(group!.id, {
        pixKeyType: key ? pix.pixKeyType : null,
        pixKey: key || null,
        pixName: pix.pixName.trim() || null,
        pixCity: pix.pixCity.trim() || null,
      })
      toast('PIX salvo')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Grupo e PIX" back="/manage" />
      <section>
        <SectionTitle>Dados do grupo</SectionTitle>
        <Card>
          <form onSubmit={saveGroup} className="space-y-4">
            <Field label="Nome do grupo"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Modalidade">
              <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })}>
                {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Mínimo de jogadores desejado" hint="Aplicado às novas partidas geradas">
              <NumberInput required value={form.minPlayers} onChange={(v) => setForm({ ...form, minPlayers: v })} />
            </Field>
            <Field label="Informações adicionais"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <Button type="submit" className="w-full" disabled={busy}>Salvar grupo</Button>
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle>Chave PIX</SectionTitle>
        <Card>
          <form onSubmit={savePix} className="space-y-4">
            <Field label="Tipo da chave">
              <select value={pix.pixKeyType} onChange={(e) => setPix({ ...pix, pixKeyType: e.target.value as PixKeyType })}>
                {PIX_KEY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Chave PIX"><input value={pix.pixKey} onChange={(e) => setPix({ ...pix, pixKey: e.target.value })} placeholder="CPF, telefone, e-mail ou chave aleatória" /></Field>
            <Field label="Nome do recebedor" hint="Usado no PIX copia e cola (máx. 25 caracteres)"><input maxLength={40} value={pix.pixName} onChange={(e) => setPix({ ...pix, pixName: e.target.value })} /></Field>
            <Field label="Cidade do recebedor" hint="Usado no PIX copia e cola"><input maxLength={30} value={pix.pixCity} onChange={(e) => setPix({ ...pix, pixCity: e.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy}>Salvar PIX</Button>
          </form>
        </Card>
      </section>
    </div>
  )
}
