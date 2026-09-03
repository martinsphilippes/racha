import { describe, expect, it } from 'vitest'
import { formatAddress, formatCep, isAddressComplete } from './cep'

describe('CEP e endereço do perfil', () => {
  it('formata o CEP', () => {
    expect(formatCep('38300000')).toBe('38300-000')
    expect(formatCep('383')).toBe('383')
    expect(formatCep('38300-000x')).toBe('38300-000')
  })
  it('monta o endereço em uma linha', () => {
    expect(formatAddress({ cep: '38300000', street: 'Rua 20', number: '1500', complement: 'ap 2', district: 'Centro', city: 'Ituiutaba', state: 'MG' }))
      .toBe('Rua 20, 1500, ap 2 - Centro, Ituiutaba - MG, 38300-000')
    expect(formatAddress({ cep: '', street: 'Rua 20', number: '1500', complement: '', district: '', city: 'Ituiutaba', state: 'MG' }))
      .toBe('Rua 20, 1500 - Ituiutaba - MG')
    expect(formatAddress('Rua antiga, 1')).toBe('Rua antiga, 1')
    expect(formatAddress(null)).toBe('')
  })
  it('valida completude', () => {
    expect(isAddressComplete({ cep: '38300000', street: 'Rua 20', number: '1', complement: '', district: '', city: 'Ituiutaba', state: 'MG' })).toBe(true)
    expect(isAddressComplete({ cep: '38300', street: 'Rua 20', number: '1', complement: '', district: '', city: 'Ituiutaba', state: 'MG' })).toBe(false)
  })
})
