import type { Team } from './types'

export interface TeamCandidate {
  id: string
  name: string
  position: 'line' | 'goalkeeper' | null
}

export type Rng = () => number

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function teamName(index: number): string {
  return `Time ${String.fromCharCode(65 + index)}`
}

export function resolveTeamCount(playerCount: number, opts: { numTeams?: number; playersPerTeam?: number }): number {
  if (opts.numTeams && opts.numTeams > 0) return Math.min(opts.numTeams, Math.max(1, playerCount))
  if (opts.playersPerTeam && opts.playersPerTeam > 0) return Math.max(1, Math.ceil(playerCount / opts.playersPerTeam))
  return Math.max(1, Math.ceil(playerCount / 5))
}

/**
 * Sorteio automático.
 * 1. Goleiros são embaralhados e distribuídos um por time (equilíbrio).
 * 2. Jogadores de linha são embaralhados e distribuídos sempre no time
 *    com menos jogadores, mantendo os tamanhos equilibrados.
 */
export function generateTeams(
  players: TeamCandidate[],
  opts: { numTeams?: number; playersPerTeam?: number },
  rng: Rng = Math.random,
): Team[] {
  const count = resolveTeamCount(players.length, opts)
  const teams: Team[] = Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}`, name: teamName(i), playerIds: [] }))
  if (players.length === 0) return teams

  const goalkeepers = shuffle(players.filter((p) => p.position === 'goalkeeper'), rng)
  const line = shuffle(players.filter((p) => p.position !== 'goalkeeper'), rng)

  goalkeepers.forEach((gk, i) => teams[i % count].playerIds.push(gk.id))

  // Começa pelos times sem goleiro, para que quem ficou sem goleiro receba um jogador a mais.
  const order = shuffle(teams.map((_, i) => i), rng)
  for (const p of line) {
    const target = order.reduce((best, i) => (teams[i].playerIds.length < teams[best].playerIds.length ? i : best), order[0])
    teams[target].playerIds.push(p.id)
  }
  return teams
}

export function movePlayer(teams: Team[], playerId: string, toTeamId: string): Team[] {
  return teams.map((t) => {
    const without = t.playerIds.filter((id) => id !== playerId)
    if (t.id === toTeamId) return { ...t, playerIds: [...without, playerId] }
    return { ...t, playerIds: without }
  })
}

/** Jogadores disponíveis que ainda não estão em nenhum time (entraram depois do sorteio). */
export function unassignedPlayers(teams: Team[], playerIds: string[]): string[] {
  const assigned = new Set(teams.flatMap((t) => t.playerIds))
  return playerIds.filter((id) => !assigned.has(id))
}
