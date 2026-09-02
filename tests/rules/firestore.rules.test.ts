import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, deleteDoc } from 'firebase/firestore'

let env: RulesTestEnvironment
const GID = 'g1'
const MANAGER = 'manager1'
const PLAYER = 'player1'
const OUTSIDER = 'outsider1'

function ctx(uid: string) {
  return env.authenticatedContext(uid).firestore()
}

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore()
    await setDoc(doc(db, 'groups', GID), { name: 'Futsal de terça', sport: 'futsal', createdBy: MANAGER, inviteCode: 'ABC123', minPlayers: 10 })
    await setDoc(doc(db, 'groups', GID, 'members', MANAGER), { uid: MANAGER, groupId: GID, name: 'Gestor', role: 'manager', joinedAt: 1 })
    await setDoc(doc(db, 'groups', GID, 'members', PLAYER), { uid: PLAYER, groupId: GID, name: 'Atleta', role: 'player', joinedAt: 1 })
    await setDoc(doc(db, 'invites', 'ABC123'), { groupId: GID, groupName: 'Futsal de terça', createdAt: 1 })
    await setDoc(doc(db, 'groups', GID, 'matches', 'm1'), { date: '2026-09-08', status: 'open', hourlyRate: 200, durationMinutes: 90, costOverride: null, teams: [] })
    await setDoc(doc(db, 'groups', GID, 'matches', 'm1', 'players', PLAYER), { name: 'Atleta', status: 'available', position: 'line', paid: false, paidAt: null, updatedAt: 1 })
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-racha',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})
afterAll(async () => {
  await env.cleanup()
})

describe('acesso ao grupo', () => {
  it('membro lê o grupo; não membro não lê', async () => {
    await assertSucceeds(getDoc(doc(ctx(PLAYER), 'groups', GID)))
    await assertFails(getDoc(doc(ctx(OUTSIDER), 'groups', GID)))
  })
  it('atleta não altera configurações do grupo nem PIX; gestor sim', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID), { pixKey: 'x' }))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID), { name: 'Outro' }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID), { pixKey: 'x', pixKeyType: 'email' }))
  })
  it('gestor não altera createdBy', async () => {
    await assertFails(updateDoc(doc(ctx(MANAGER), 'groups', GID), { createdBy: PLAYER }))
  })
  it('descobre os próprios grupos por consulta em grupo de coleção', async () => {
    // sem filtrar pelo próprio uid a consulta é recusada; com o filtro funciona
    await assertFails(getDocs(query(collectionGroup(ctx(PLAYER), 'members'), where('groupId', '==', GID))))
    const ok = await assertSucceeds(getDocs(query(collectionGroup(ctx(PLAYER), 'members'), where('uid', '==', PLAYER))))
    expect(ok.size).toBe(1)
    expect(ok.docs[0].data().groupId).toBe(GID)
  })
})

describe('criação de grupo', () => {
  it('usuário cria grupo, vira gestor e publica convite no mesmo lote', async () => {
    const db = ctx(OUTSIDER)
    const batch = writeBatch(db)
    batch.set(doc(db, 'groups', 'g2'), { name: 'Society de sábado', sport: 'society', createdBy: OUTSIDER, inviteCode: 'ZZZ999', minPlayers: 10 })
    batch.set(doc(db, 'groups', 'g2', 'members', OUTSIDER), { uid: OUTSIDER, groupId: 'g2', name: 'Fulano', role: 'manager', joinedAt: 1 })
    batch.set(doc(db, 'invites', 'ZZZ999'), { groupId: 'g2', groupName: 'Society de sábado', createdAt: 1 })
    await assertSucceeds(batch.commit())
  })
  it('não pode se declarar gestor de grupo que não criou', async () => {
    await assertFails(setDoc(doc(ctx(OUTSIDER), 'groups', GID, 'members', OUTSIDER), { uid: OUTSIDER, groupId: GID, name: 'X', role: 'manager', joinedAt: 1 }))
  })
})

describe('entrada por convite', () => {
  it('entra com código correto como atleta', async () => {
    await assertSucceeds(setDoc(doc(ctx(OUTSIDER), 'groups', GID, 'members', OUTSIDER), { uid: OUTSIDER, groupId: GID, name: 'Novo', role: 'player', joinedAt: 1, inviteCode: 'ABC123' }))
  })
  it('código errado é recusado', async () => {
    await assertFails(setDoc(doc(ctx(OUTSIDER), 'groups', GID, 'members', OUTSIDER), { uid: OUTSIDER, groupId: GID, name: 'Novo', role: 'player', joinedAt: 1, inviteCode: 'WRONG' }))
  })
  it('gestor remove membro; atleta não remove outros', async () => {
    await assertFails(deleteDoc(doc(ctx(PLAYER), 'groups', GID, 'members', MANAGER)))
    await assertSucceeds(deleteDoc(doc(ctx(MANAGER), 'groups', GID, 'members', PLAYER)))
  })
  it('atleta não se promove a gestor', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'members', PLAYER), { role: 'manager' }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'members', PLAYER), { role: 'manager' }))
  })
})

describe('partidas e disponibilidade', () => {
  it('atleta não cria nem edita partidas; gestor sim', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1'), { status: 'confirmed' }))
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm2'), { date: '2026-09-15' }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1'), { status: 'confirmed', costOverride: 250 }))
  })
  it('atleta informa a própria disponibilidade e posição', async () => {
    await assertSucceeds(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { status: 'unavailable', position: null, updatedAt: 2 }))
    await assertFails(setDoc(doc(ctx(OUTSIDER), 'groups', GID, 'matches', 'm1', 'players', OUTSIDER), { name: 'X', status: 'available', position: 'goalkeeper', paid: false, paidAt: null, updatedAt: 2 }))
  })
  it('atleta não altera o próprio pagamento nem o de outros', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { paid: true }))
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', 'other'), { name: 'O', status: 'available', position: 'line', paid: false, paidAt: null, updatedAt: 1 }))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { status: 'available', paid: true }))
  })
  it('atleta não cria o próprio registro já como pago', async () => {
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { name: 'A', status: 'available', position: 'line', paid: true, paidAt: 1, updatedAt: 1 }))
  })
  it('gestor registra disponibilidade de outro atleta (organizar participantes)', async () => {
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1', 'players', 'someone'), { name: 'S', status: 'available', position: 'line', paid: false, paidAt: null, updatedAt: 1 }))
  })
  it('gestor marca pago/não pago de qualquer atleta', async () => {
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { paid: true, paidAt: 5 }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { paid: false, paidAt: null }))
  })
  it('atleta não gera times; gestor sim', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1'), { teams: [{ id: 't1', name: 'Time A', playerIds: [PLAYER] }] }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1'), { teams: [{ id: 't1', name: 'Time A', playerIds: [PLAYER] }] }))
  })
})

describe('locais, agenda e comunicados', () => {
  it('atleta não cadastra local nem altera valor da quadra', async () => {
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'venues', 'v1'), { name: 'Arena' }))
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'venues', 'v1'), { name: 'Arena' }))
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'courts', 'c1'), { venueId: 'v1', name: 'Futsal 1', hourlyRate: 200 }))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'courts', 'c1'), { hourlyRate: 1 }))
    await assertSucceeds(getDoc(doc(ctx(PLAYER), 'groups', GID, 'courts', 'c1')))
  })
  it('só gestor cria agenda e comunicados', async () => {
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'schedules', 's1'), { weekday: 2 }))
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'schedules', 's1'), { weekday: 2 }))
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'announcements', 'a1'), { text: 'oi', createdBy: PLAYER }))
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'announcements', 'a1'), { text: 'oi', createdBy: MANAGER }))
    await assertSucceeds(getDoc(doc(ctx(PLAYER), 'groups', GID, 'announcements', 'a1')))
  })
})

describe('perfil', () => {
  it('usuário só lê e edita o próprio perfil', async () => {
    await assertSucceeds(setDoc(doc(ctx(PLAYER), 'users', PLAYER), { name: 'A', email: 'a@a.com', phone: '1', address: 'r', createdAt: 1 }))
    await assertFails(getDoc(doc(ctx(MANAGER), 'users', PLAYER)))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'users', PLAYER), { email: 'b@b.com' }))
    await assertSucceeds(updateDoc(doc(ctx(PLAYER), 'users', PLAYER), { phone: '2' }))
  })
})
