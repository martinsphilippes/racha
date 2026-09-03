import { describe, expect, it } from 'vitest'
import { formatPhoton, googleMapsUrl, wazeUrl } from './geocode'

describe('formatação de endereço', () => {
  it('estabelecimento com rua, bairro, cidade e UF', () => {
    expect(formatPhoton({ name: 'Arena Ituiutaba', osm_key: 'leisure', street: 'Avenida Central', housenumber: '100', district: 'Centro', city: 'Ituiutaba', state: 'Minas Gerais' }))
      .toEqual({ label: 'Arena Ituiutaba, Avenida Central, 100 - Centro, Ituiutaba - MG', name: 'Arena Ituiutaba' })
  })
  it('rua sem número e sem bairro', () => {
    expect(formatPhoton({ name: 'Rua das Flores', osm_key: 'highway', city: 'Uberlândia', state: 'Minas Gerais' }).label).toBe('Rua das Flores - Uberlândia - MG')
  })
  it('cidade apenas', () => {
    expect(formatPhoton({ name: 'Ituiutaba', osm_key: 'place', state: 'Minas Gerais' }).label).toBe('Ituiutaba - MG')
  })
})

describe('links de navegação', () => {
  it('usa coordenadas quando existem', () => {
    expect(googleMapsUrl({ lat: -18.97, lng: -49.46, address: 'x' })).toBe('https://www.google.com/maps/dir/?api=1&destination=-18.97,-49.46')
    expect(wazeUrl({ lat: -18.97, lng: -49.46, address: 'x' })).toBe('https://waze.com/ul?ll=-18.97,-49.46&navigate=yes')
  })
  it('cai para o endereço em texto', () => {
    expect(googleMapsUrl({ lat: null, lng: null, address: 'Av. Central, 100' })).toContain('destination=Av.%20Central%2C%20100')
    expect(wazeUrl({ lat: null, lng: null, address: '' })).toBeNull()
  })
})
