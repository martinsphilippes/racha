import { useEffect, useRef, useState } from 'react'
import { reverseGeocode, searchAddress, splitHouseNumber, withHouseNumber, type GeoResult } from '@/lib/geocode'
import { useToast } from './Toast'

interface Props {
  value: string
  coords: { lat: number; lng: number } | null
  onChange: (address: string, coords: { lat: number; lng: number } | null) => void
  placeholder?: string
}

/**
 * Campo de endereço com busca (autocompletar), número próprio e "usar minha localização".
 * O mapa costuma conhecer a rua, não o número: o número é digitado pelo organizador e
 * entra no endereço final ("Rua X, 657 - Bairro, Cidade - UF") sem perder a marcação.
 */
export default function AddressInput({ value, coords, onChange, placeholder }: Props) {
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [base, setBase] = useState<string | null>(null) // sugestão escolhida (sem número)
  const [number, setNumber] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abort = useRef<AbortController | null>(null)
  const toast = useToast()

  useEffect(() => () => { abort.current?.abort(); if (timer.current) clearTimeout(timer.current) }, [])

  function search(q: string) {
    if (timer.current) clearTimeout(timer.current)
    abort.current?.abort()
    if (q.trim().length < 3) { setResults([]); return }
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController(); abort.current = ctrl
      setBusy(true)
      const found = await searchAddress(q, { signal: ctrl.signal })
      if (!ctrl.signal.aborted) { setResults(found); setOpen(true); setBusy(false) }
    }, 350)
  }

  const typedNumber = splitHouseNumber(value).number
  /** Rótulo exibido/gravado: sugestão + número digitado (quando o mapa não trouxe número). */
  const compose = (r: GeoResult, n: string) => (r.hasNumber ? r.label : withHouseNumber(r.label, n || null))

  function pick(r: GeoResult) {
    const n = r.hasNumber ? '' : (number || typedNumber || '')
    setBase(r.label); setNumber(n)
    onChange(compose(r, n), { lat: r.lat, lng: r.lng })
    setResults([]); setOpen(false)
  }

  function changeNumber(n: string) {
    const clean = n.replace(/[^0-9a-zA-Z]/g, '').slice(0, 7)
    setNumber(clean)
    if (base) onChange(withHouseNumber(base, clean || null), coords)
  }

  function useMyLocation() {
    if (!navigator.geolocation) { toast('Seu navegador não permite localização', 'error'); return }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        setBusy(false)
        if (r) pick(r)
        else { onChange(value, { lat: pos.coords.latitude, lng: pos.coords.longitude }); toast('Localização marcada; complete o endereço') }
      },
      () => { setBusy(false); toast('Não foi possível obter sua localização', 'error') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="relative space-y-2">
      <input
        value={value}
        onChange={(e) => { setBase(null); onChange(e.target.value, null); search(e.target.value) }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Nome da arena ou rua (ex.: Av. Geraldo Alves Tavares)'}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && results.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-navy-900 shadow-xl">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.label}`} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2">
                {(() => { const label = compose(r, number || typedNumber || ''); return r.name && label.startsWith(r.name) ? <><span className="font-semibold">{r.name}</span>{label.slice(r.name.length)}</> : label })()}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Nº</span>
          <input
            value={number}
            onChange={(e) => changeNumber(e.target.value)}
            inputMode="numeric"
            placeholder="657"
            disabled={!base && !coords}
            aria-label="Número"
            className="w-24"
          />
        </label>
        <button type="button" onClick={useMyLocation} className="whitespace-nowrap text-xs font-semibold text-gold-400">📡 Usar minha localização</button>
      </div>
      <p className={`text-xs ${coords ? 'text-green-300' : 'text-muted'}`}>
        {busy ? 'Buscando…' : coords ? '📍 Marcado no mapa' : 'Escolha uma sugestão e depois informe o número'}
      </p>
    </div>
  )
}
