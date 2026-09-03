import { describe, expect, it } from 'vitest'
import { formatPhoton, googleMapsUrl, hasHouseNumber, splitHouseNumber, wazeUrl, withHouseNumber } from './geocode'

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

describe('número do endereço', () => {
  it('reconhece o número antes ou depois da rua', () => {
    expect(splitHouseNumber('657 Avenida Geraldo Alves Tavares')).toEqual({ text: 'Avenida Geraldo Alves Tavares', number: '657' })
    expect(splitHouseNumber('Avenida Geraldo Alves Tavares, 657')).toEqual({ text: 'Avenida Geraldo Alves Tavares', number: '657' })
    expect(splitHouseNumber('Avenida Geraldo Alves Tavares 657')).toEqual({ text: 'Avenida Geraldo Alves Tavares', number: '657' })
    expect(splitHouseNumber('Arena Ituiutaba')).toEqual({ text: 'Arena Ituiutaba', number: null })
  })
  it('insere o número após a rua sem duplicar', () => {
    expect(withHouseNumber('Avenida Geraldo Alves Tavares - Ipiranga, Ituiutaba - MG', '657')).toBe('Avenida Geraldo Alves Tavares, 657 - Ipiranga, Ituiutaba - MG')
    expect(withHouseNumber('Avenida Central, 100 - Centro, Ituiutaba - MG', '657')).toBe('Avenida Central, 100 - Centro, Ituiutaba - MG')
    expect(hasHouseNumber('Avenida Geraldo Alves Tavares, 657 - Ipiranga, Ituiutaba - MG')).toBe(true)
    expect(hasHouseNumber('Avenida Geraldo Alves Tavares - Ipiranga, Ituiutaba - MG')).toBe(false)
  })
  it('com número, os links usam o endereço em texto (mais preciso)', () => {
    const d = { lat: -18.9, lng: -49.4, address: 'Avenida Geraldo Alves Tavares, 657 - Ipiranga, Ituiutaba - MG' }
    expect(googleMapsUrl(d)).toContain('destination=Avenida%20Geraldo')
    expect(wazeUrl(d)).toContain('q=Avenida%20Geraldo')
  })
})
