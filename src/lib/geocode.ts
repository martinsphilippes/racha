// Busca de endereços sem chave de API: Photon (OpenStreetMap) com Nominatim como reserva.
// As chamadas são feitas pelo navegador do usuário. Para trocar por Google Places no futuro,
// basta implementar outra função com a mesma assinatura de `searchAddress`.

export interface GeoResult {
  label: string // endereço formatado para exibir/gravar
  name: string | null // nome do estabelecimento (quando houver)
  lat: number
  lng: number
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
  const q = query.trim()
  if (q.length < 3) return []
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
      .map((f) => ({ ...formatPhoton(f.properties), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
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
      return { label: label || r.display_name, name, lat: Number(r.lat), lng: Number(r.lon) }
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
    return { ...formatPhoton(f.properties), lat, lng }
  } catch {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`, { headers: { Accept: 'application/json' } })
      const r = (await res.json()) as { display_name?: string }
      return r.display_name ? { label: r.display_name, name: null, lat, lng } : null
    } catch {
      return null
    }
  }
}

// ---------- Links de navegação ----------

export interface Destination { lat: number | null; lng: number | null; address: string; name?: string }

export function googleMapsUrl(d: Destination): string | null {
  if (d.lat != null && d.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`
  if (d.address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`
  return null
}

export function wazeUrl(d: Destination): string | null {
  if (d.lat != null && d.lng != null) return `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`
  if (d.address) return `https://waze.com/ul?q=${encodeURIComponent(d.address)}&navigate=yes`
  return null
}
