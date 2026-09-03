// Busca de endereços sem chave de API: Photon (OpenStreetMap) com Nominatim como reserva.
// As chamadas são feitas pelo navegador do usuário. Para trocar por Google Places no futuro,
// basta implementar outra função com a mesma assinatura de `searchAddress`.

export interface GeoResult {
  label: string // endereço formatado para exibir/gravar
  name: string | null // nome do estabelecimento (quando houver)
  lat: number
  lng: number
  hasNumber: boolean // o resultado já traz número (vindo do mapa ou do que foi digitado)
}

/** Separa o número digitado do restante ("657 Av X", "Av X 657", "Av X, 657"). */
export function splitHouseNumber(query: string): { text: string; number: string | null } {
  const q = query.trim()
  const lead = q.match(/^(\d{1,6}[a-zA-Z]?)\s+(.+)$/)
  if (lead) return { text: lead[2], number: lead[1] }
  const trail = q.match(/^(.+?)[,\s]+(?:n[ºo°.]?\s*)?(\d{1,6}[a-zA-Z]?)$/i)
  if (trail && !/^\d/.test(trail[1])) return { text: trail[1].replace(/[,\s]+$/, ''), number: trail[2] }
  return { text: q, number: null }
}

/** Insere o número logo após a rua: "Rua X - Bairro, Cidade - UF" → "Rua X, 657 - Bairro, Cidade - UF". */
export function withHouseNumber(label: string, number: string | null): string {
  if (!number) return label
  const idx = label.indexOf(' - ')
  const head = idx >= 0 ? label.slice(0, idx) : label
  const tail = idx >= 0 ? label.slice(idx) : ''
  if (/,\s*\d/.test(head)) return label // já tem número
  return `${head}, ${number}${tail}`
}

export function hasHouseNumber(address: string): boolean {
  return /,\s*\d{1,6}[a-zA-Z]?(\s*-|$)/.test(address)
}

const BRAZIL_BBOX = '-74,-34,-34,6' // minLon,minLat,maxLon,maxLat
const PHOTON = 'https://photon.komoot.io'
const NOMINATIM = 'https://nominatim.openstreetmap.org'

interface PhotonProps {
  name?: string
  street?: string
  housenumber?: string
  district?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
  osm_key?: string
  osm_value?: string
}

const UF: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF',
  'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
  'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO',
}

/** Monta "Rua X, 123 - Bairro, Cidade - UF" a partir das propriedades do Photon. */
export function formatPhoton(p: PhotonProps): { label: string; name: string | null } {
  const city = p.city ?? p.town ?? p.village ?? p.county ?? ''
  const state = p.state ? (UF[p.state] ?? p.state) : ''
  const isPlace = Boolean(p.name) && p.osm_key !== 'highway' && p.osm_key !== 'place'
  const street = [p.street, p.housenumber].filter(Boolean).join(', ')
  const parts: string[] = []
  if (isPlace && p.name) parts.push(p.name)
  if (street) parts.push(street)
  else if (!isPlace && p.name) parts.push(p.name)
  const cityPart = [p.district, city].filter(Boolean).join(', ')
  const tail = [cityPart, state].filter(Boolean).join(' - ')
  const label = [parts.join(', '), tail].filter(Boolean).join(' - ')
  return { label: label || p.name || '', name: isPlace ? p.name ?? null : null }
}

export async function searchAddress(query: string, opts: { signal?: AbortSignal; near?: { lat: number; lng: number } } = {}): Promise<GeoResult[]> {
  const { text, number } = splitHouseNumber(query)
  const q = text.trim()
  if (q.length < 3) return []
  const results = await searchRaw(q, opts)
  // Reaproveita o número digitado quando o mapa não o conhece.
  return results.map((r) => (number && !r.hasNumber ? { ...r, label: withHouseNumber(r.label, number), hasNumber: true } : r))
}

async function searchRaw(q: string, opts: { signal?: AbortSignal; near?: { lat: number; lng: number } }): Promise<GeoResult[]> {
  try {
    const url = new URL(`${PHOTON}/api/`)
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '6')
    url.searchParams.set('bbox', BRAZIL_BBOX)
    if (opts.near) { url.searchParams.set('lat', String(opts.near.lat)); url.searchParams.set('lon', String(opts.near.lng)) }
    const res = await fetch(url, { signal: opts.signal })
    if (!res.ok) throw new Error(`photon ${res.status}`)
    const data = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: PhotonProps }[] }
    const seen = new Set<string>()
    return data.features
      .map((f) => ({ ...formatPhoton(f.properties), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], hasNumber: Boolean(f.properties.housenumber) }))
      .filter((r) => r.label && !seen.has(r.label) && seen.add(r.label))
  } catch (err) {
    if ((err as Error).name === 'AbortError') return []
    return searchNominatim(q, opts.signal)
  }
}

async function searchNominatim(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  try {
    const url = new URL(`${NOMINATIM}/search`)
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '6')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('addressdetails', '1')
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = (await res.json()) as { lat: string; lon: string; display_name: string; name?: string; address?: Record<string, string> }[]
    return data.map((r) => {
      const a = r.address ?? {}
      const street = [a.road, a.house_number].filter(Boolean).join(', ')
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? ''
      const state = a.state ? (UF[a.state] ?? a.state) : ''
      const name = r.name && r.name !== a.road ? r.name : null
      const label = [[name, street].filter(Boolean).join(', '), [[a.suburb ?? a.neighbourhood, city].filter(Boolean).join(', '), state].filter(Boolean).join(' - ')].filter(Boolean).join(' - ')
      return { label: label || r.display_name, name, lat: Number(r.lat), lng: Number(r.lon), hasNumber: Boolean(a.house_number) }
    })
  } catch {
    return []
  }
}

/** Coordenadas → endereço (para "usar minha localização"). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}`)
    if (!res.ok) throw new Error('photon')
    const data = (await res.json()) as { features: { properties: PhotonProps }[] }
    const f = data.features[0]
    if (!f) return null
    return { ...formatPhoton(f.properties), lat, lng, hasNumber: Boolean(f.properties.housenumber) }
  } catch {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`, { headers: { Accept: 'application/json' } })
      const r = (await res.json()) as { display_name?: string }
      return r.display_name ? { label: r.display_name, name: null, lat, lng, hasNumber: false } : null
    } catch {
      return null
    }
  }
}

// ---------- Links de navegação ----------

export interface Destination { lat: number | null; lng: number | null; address: string; name?: string }

// Endereço com número é mais preciso que a coordenada da rua; sem número, usa a coordenada.
function preferText(d: Destination): boolean {
  return Boolean(d.address) && (d.lat == null || d.lng == null || hasHouseNumber(d.address))
}

export function googleMapsUrl(d: Destination): string | null {
  if (preferText(d)) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`
  if (d.lat != null && d.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`
  return null
}

export function wazeUrl(d: Destination): string | null {
  if (preferText(d)) return `https://waze.com/ul?q=${encodeURIComponent(d.address)}&navigate=yes`
  if (d.lat != null && d.lng != null) return `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`
  return null
}
