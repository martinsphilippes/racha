import { useEffect, useRef, useState } from 'react'
import { formatCep, lookupCep, onlyDigits, type Address } from '@/lib/cep'
import { Field } from './ui'

interface Props {
  value: Address
  onChange: (value: Address) => void
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

/**
 * Endereço de pessoa: CEP preenche rua, bairro, cidade e UF automaticamente;
 * o usuário informa número e complemento. Todos os campos continuam editáveis
 * (se a consulta falhar ou o CEP for genérico, dá para completar à mão).
 */
export default function AddressForm({ value, onChange }: Props) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const [expanded, setExpanded] = useState(Boolean(value.street || value.city))
  const abort = useRef<AbortController | null>(null)
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch })

  useEffect(() => () => abort.current?.abort(), [])

  async function onCep(raw: string) {
    const cep = onlyDigits(raw).slice(0, 8)
    set({ cep })
    abort.current?.abort()
    if (cep.length !== 8) { setStatus('idle'); return }
    const ctrl = new AbortController(); abort.current = ctrl
    setStatus('busy')
    const r = await lookupCep(cep, ctrl.signal)
    if (ctrl.signal.aborted) return
    if (r) {
      onChange({ ...value, cep, street: r.street || value.street, district: r.district || value.district, city: r.city || value.city, state: r.state || value.state })
      setStatus('ok'); setExpanded(true)
    } else {
      setStatus('fail'); setExpanded(true)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="CEP" hint={status === 'busy' ? 'Buscando…' : status === 'ok' ? 'Endereço encontrado' : status === 'fail' ? 'CEP não encontrado: preencha abaixo' : undefined}>
          <input inputMode="numeric" autoComplete="postal-code" required value={formatCep(value.cep)} onChange={(e) => onCep(e.target.value)} placeholder="38300-000" />
        </Field>
        <Field label="Número">
          <input inputMode="numeric" autoComplete="address-line2" required value={value.number} onChange={(e) => set({ number: e.target.value })} placeholder="123" />
        </Field>
      </div>
      {!expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="text-xs font-semibold text-gold-400">Não sei o CEP: preencher o endereço à mão</button>
      )}
      {expanded && (
        <>
          <Field label="Rua"><input autoComplete="address-line1" required value={value.street} onChange={(e) => set({ street: e.target.value })} /></Field>
          <Field label="Complemento (opcional)"><input value={value.complement} onChange={(e) => set({ complement: e.target.value })} placeholder="Apto, bloco, casa…" /></Field>
          <Field label="Bairro"><input value={value.district} onChange={(e) => set({ district: e.target.value })} /></Field>
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <Field label="Cidade"><input autoComplete="address-level2" required value={value.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="UF">
              <select required value={value.state} onChange={(e) => set({ state: e.target.value })}>
                <option value="">UF</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </Field>
          </div>
        </>
      )}
    </div>
  )
}
