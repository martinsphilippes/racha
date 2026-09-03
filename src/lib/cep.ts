// Endereço de pessoa por CEP: ViaCEP com reserva no BrasilAPI (gratuitos, sem chave).
// As chamadas são feitas pelo navegador do usuário.

export interface Address {
  cep: string // somente dígitos (8)
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string // UF
}

export const EMPTY_ADDRESS: Address = { cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' }

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

/** "38300000" → "38300-000" */
export function formatCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Endereço em uma linha: "Rua X, 123, ap 2 - Bairro, Cidade - UF, 38300-000" */
export function formatAddress(a: Address | string | null | undefined): string {
  if (!a) return ''
  if (typeof a === 'string') return a
  const streetPart = [a.street, a.number, a.complement].filter((x) => x && x.trim()).join(', ')
  const cityPart = [a.district, a.city].filter((x) => x && x.trim()).join(', ')
  const tail = [cityPart, a.state].filter((x) => x && x.trim()).join(' - ')
  const cep = a.cep ? formatCep(a.cep) : ''
  const main = [streetPart, tail].filter(Boolean).join(' - ')
  return cep ? (main ? `${main}, ${cep}` : cep) : main
}

export function isAddressComplete(a: Address): boolean {
  return onlyDigits(a.cep).length === 8 && a.street.trim().length > 0 && a.number.trim().length > 0 && a.city.trim().length > 0 && a.state.trim().length > 0
}

export interface CepResult { street: string; district: string; city: string; state: string }

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepResult | null> {
  const d = onlyDigits(cep)
  if (d.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal })
    if (!res.ok) throw new Error(`viacep ${res.status}`)
    const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (j.erro) return null
    return { street: j.logradouro ?? '', district: j.bairro ?? '', city: j.localidade ?? '', state: j.uf ?? '' }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null
  }
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`, { signal })
    if (!res.ok) return null
    const j = (await res.json()) as { street?: string; neighborhood?: string; city?: string; state?: string }
    return { street: j.street ?? '', district: j.neighborhood ?? '', city: j.city ?? '', state: j.state ?? '' }
  } catch {
    return null
  }
}
