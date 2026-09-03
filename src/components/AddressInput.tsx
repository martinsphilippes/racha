import { useEffect, useRef, useState } from 'react'
import { reverseGeocode, searchAddress, type GeoResult } from '@/lib/geocode'
import { useToast } from './Toast'

interface Props {
  value: string
  coords: { lat: number; lng: number } | null
  onChange: (address: string, coords: { lat: number; lng: number } | null) => void
  placeholder?: string
}

/**
 * Campo de endereço com busca (autocompletar) e "usar minha localização".
 * Ao escolher uma sugestão, grava endereço + coordenadas; editar o texto à mão
 * descarta as coordenadas (o botão "Como chegar" então usa o texto).
 */
export default function AddressInput({ value, coords, onChange, placeholder }: Props) {
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
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

  function pick(r: GeoResult) {
    onChange(r.label, { lat: r.lat, lng: r.lng })
    setResults([]); setOpen(false)
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
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value, null); search(e.target.value) }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Digite o nome da arena ou o endereço'}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className={coords ? 'text-green-300' : 'text-muted'}>
          {busy ? 'Buscando…' : coords ? '📍 Localização marcada no mapa' : 'Escolha uma sugestão para marcar no mapa'}
        </span>
        <button type="button" onClick={useMyLocation} className="font-semibold text-gold-400">Usar minha localização</button>
      </div>
      {open && results.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-navy-900 shadow-xl">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.label}`} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2">
                {r.name && <span className="font-semibold">{r.name} · </span>}{r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
