import { describe, expect, it } from 'vitest'
import { computeSplit, effectiveStatus, matchCost, upcomingDates } from './matches'
import { generateTeams, movePlayer } from './teams'
import { buildPixPayload, normalizePixText, pixKeyForPayload } from './pix'
import type { MatchPlayer } from './types'

function player(id: string, status: MatchPlayer['status'], position: MatchPlayer['position'], paid = false): MatchPlayer {
  return { id, name: id, status, position, paid, paidAt: null, updatedAt: 0 }
}

describe('custo e rateio', () => {
  it('calcula custo automático: R$200/h × 1h30 = R$300', () => {
    expect(matchCost({ hourlyRate: 200, durationMinutes: 90, costOverride: null })).toBe(300)
  })
  it('respeita custo manual', () => {
    expect(matchCost({ hourlyRate: 200, durationMinutes: 90, costOverride: 250 })).toBe(250)
  })
  it('goleiros não pagam: 15 disponíveis, 3 goleiros → 12 pagantes × R$25', () => {
    const players = [
      ...Array.from({ length: 12 }, (_, i) => player(`l${i}`, 'available', 'line', i < 9)),
      ...Array.from({ length: 3 }, (_, i) => player(`g${i}`, 'available', 'goalkeeper')),
      player('x', 'unavailable', null),
    ]
    const s = computeSplit({ hourlyRate: 200, durationMinutes: 90, costOverride: null }, players)
    expect(s.cost).toBe(300)
    expect(s.available).toHaveLength(15)
    expect(s.goalkeepers).toHaveLength(3)
    expect(s.payers).toHaveLength(12)
    expect(s.perPlayer).toBe(25)
    expect(s.paidCount).toBe(9)
    expect(s.unpaidCount).toBe(3)
    expect(s.received).toBe(225)
    expect(s.remaining).toBe(75)
  })
  it('arredonda para cima nos centavos', () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`l${i}`, 'available', 'line'))
    const s = computeSplit({ hourlyRate: 300, durationMinutes: 60, costOverride: null }, players)
    expect(s.perPlayer).toBe(42.86)
  })
  it('sem pagantes o valor individual é zero', () => {
    const s = computeSplit({ hourlyRate: 300, durationMinutes: 60, costOverride: null }, [player('g', 'available', 'goalkeeper')])
    expect(s.perPlayer).toBe(0)
  })
})

describe('status efetivo', () => {
  it('partida aberta cujo horário passou aparece como finalizada', () => {
    expect(effectiveStatus({ status: 'open', endsAt: 100 }, 200)).toBe('finished')
    expect(effectiveStatus({ status: 'open', endsAt: 300 }, 200)).toBe('open')
    expect(effectiveStatus({ status: 'cancelled', endsAt: 100 }, 200)).toBe('cancelled')
  })
})

describe('geração de datas', () => {
  it('gera as próximas terças a partir de uma segunda', () => {
    const now = new Date(2026, 8, 7, 10, 0) // seg 07/09/2026
    expect(upcomingDates({ weekday: 2, startTime: '19:30', weeksAhead: 4 }, now)).toEqual([
      '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29',
    ])
  })
  it('se hoje é o dia mas o horário passou, pula para a próxima semana', () => {
    const now = new Date(2026, 8, 8, 21, 30) // ter 08/09 21h30
    expect(upcomingDates({ weekday: 2, startTime: '19:30', weeksAhead: 2 }, now)).toEqual(['2026-09-15', '2026-09-22'])
  })
  it('se hoje é o dia e o horário ainda não passou, inclui hoje', () => {
    const now = new Date(2026, 8, 8, 18, 0)
    expect(upcomingDates({ weekday: 2, startTime: '19:30', weeksAhead: 1 }, now)).toEqual(['2026-09-08'])
  })
})

describe('sorteio de times', () => {
  const rng = () => 0.42
  it('20 jogadores, 4 goleiros, 5 por time → 4 times com 1 goleiro cada', () => {
    const players = [
      ...Array.from({ length: 16 }, (_, i) => ({ id: `l${i}`, name: `L${i}`, position: 'line' as const })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `g${i}`, name: `G${i}`, position: 'goalkeeper' as const })),
    ]
    const teams = generateTeams(players, { playersPerTeam: 5 }, rng)
    expect(teams).toHaveLength(4)
    for (const t of teams) {
      expect(t.playerIds).toHaveLength(5)
      expect(t.playerIds.filter((id) => id.startsWith('g'))).toHaveLength(1)
    }
    expect(new Set(teams.flatMap((t) => t.playerIds)).size).toBe(20)
  })
  it('distribui goleiros de forma equilibrada quando há menos goleiros que times', () => {
    const players = [
      ...Array.from({ length: 13 }, (_, i) => ({ id: `l${i}`, name: `L${i}`, position: 'line' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `g${i}`, name: `G${i}`, position: 'goalkeeper' as const })),
    ]
    const teams = generateTeams(players, { numTeams: 3 }, rng)
    const sizes = teams.map((t) => t.playerIds.length).sort()
    expect(sizes).toEqual([5, 5, 5])
    expect(teams.map((t) => t.playerIds.filter((id) => id.startsWith('g')).length).sort()).toEqual([0, 1, 1])
  })
  it('move jogador entre times', () => {
    const teams = [
      { id: 't1', name: 'Time A', playerIds: ['a', 'b'] },
      { id: 't2', name: 'Time B', playerIds: ['c'] },
    ]
    const moved = movePlayer(teams, 'a', 't2')
    expect(moved[0].playerIds).toEqual(['b'])
    expect(moved[1].playerIds).toEqual(['c', 'a'])
  })
})

describe('pix copia e cola', () => {
  it('gera payload EMV válido com CRC', () => {
    const payload = buildPixPayload({ key: 'fulano@email.com', name: 'Fulano de Tal', city: 'Ituiutaba', amount: 25 })
    expect(payload.startsWith('000201')).toBe(true)
    expect(payload).toContain('0014br.gov.bcb.pix0116fulano@email.com')
    expect(payload).toContain('540525.00')
    expect(payload).toContain('5913FULANO DE TAL')
    expect(payload).toContain('6009ITUIUTABA')
    expect(payload).toMatch(/6304[0-9A-F]{4}$/)
  })
  it('normaliza acentos e tamanho', () => {
    expect(normalizePixText('João Ção Ituiutaba-MG', 15)).toBe('JOAO CAO ITUIUT')
  })
  it('formata chave de telefone com +55', () => {
    expect(pixKeyForPayload('phone', '(34) 99999-1234')).toBe('+5534999991234')
    expect(pixKeyForPayload('cpf', '123.456.789-09')).toBe('12345678909')
  })
})
