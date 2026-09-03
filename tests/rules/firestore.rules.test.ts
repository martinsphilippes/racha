import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

let env: RulesTestEnvironment
const GID = 'g1'
const OWNER = 'owner1'
const OWNER_EMAIL = 'martinsphilippes@gmail.com'
const ORGANIZER = 'org1'
const MANAGER = 'manager1'
const PLAYER = 'player1'
const OUTSIDER = 'outsider1'

function ctx(uid: string) {
  return env.authenticatedContext(uid, uid === OWNER ? { email: OWNER_EMAIL } : { email: `${uid}@teste.com` }).firestore()
}

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore()
    await setDoc(doc(db, 'directory', OWNER), { uid: OWNER, name: 'Dono', email: OWNER_EMAIL, platformRole: 'owner', createdAt: 1 })
    await setDoc(doc(db, 'directory', ORGANIZER), { uid: ORGANIZER, name: 'Org', email: 'o@t.com', platformRole: 'organizer', createdAt: 1 })
    await setDoc(doc(db, 'directory', MANAGER), { uid: MANAGER, name: 'Gestor', email: 'm@t.com', platformRole: 'organizer', createdAt: 1 })
    await setDoc(doc(db, 'directory', PLAYER), { uid: PLAYER, name: 'Atleta', email: 'p@t.com', platformRole: 'athlete', createdAt: 1 })
    await setDoc(doc(db, 'directory', OUTSIDER), { uid: OUTSIDER, name: 'Fora', email: 'f@t.com', platformRole: 'athlete', createdAt: 1 })
    await setDoc(doc(db, 'groups', GID), { name: 'Futsal de terça', sport: 'futsal', createdBy: MANAGER, minPlayers: 10 })
    await setDoc(doc(db, 'groups', GID, 'members', MANAGER), { uid: MANAGER, groupId: GID, name: 'Gestor', role: 'manager', joinedAt: 1, addedBy: MANAGER })
    await setDoc(doc(db, 'groups', GID, 'members', PLAYER), { uid: PLAYER, groupId: GID, name: 'Atleta', role: 'player', joinedAt: 1, addedBy: MANAGER })
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
beforeEach(async () => { await env.clearFirestore(); await seed() })
afterAll(async () => { await env.cleanup() })

describe('diretório e papéis de plataforma', () => {
  it('novo usuário se cadastra no diretório como atleta; não pode se declarar organizador', async () => {
    await assertSucceeds(setDoc(doc(ctx('novo'), 'directory', 'novo'), { uid: 'novo', name: 'Novo', email: 'n@t.com', platformRole: 'athlete', createdAt: 1 }))
    await assertFails(setDoc(doc(ctx('novo2'), 'directory', 'novo2'), { uid: 'novo2', name: 'Novo', email: 'n@t.com', platformRole: 'organizer', createdAt: 1 }))
    await assertFails(setDoc(doc(ctx('novo3'), 'directory', 'novo3'), { uid: 'novo3', name: 'Novo', email: 'n@t.com', platformRole: 'owner', createdAt: 1 }))
  })
  it('o dono (pelo e-mail) se cadastra como owner', async () => {
    await env.withSecurityRulesDisabled(async (c) => deleteDoc(doc(c.firestore(), 'directory', OWNER)))
    await assertSucceeds(setDoc(doc(ctx(OWNER), 'directory', OWNER), { uid: OWNER, name: 'Dono', email: OWNER_EMAIL, platformRole: 'owner', createdAt: 1 }))
  })
  it('só o dono promove/rebaixa organizadores', async () => {
    await assertSucceeds(updateDoc(doc(ctx(OWNER), 'directory', PLAYER), { platformRole: 'organizer' }))
    await assertSucceeds(updateDoc(doc(ctx(OWNER), 'directory', PLAYER), { platformRole: 'athlete' }))
    await assertFails(updateDoc(doc(ctx(ORGANIZER), 'directory', PLAYER), { platformRole: 'organizer' }))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'directory', PLAYER), { platformRole: 'organizer' }))
    await assertFails(updateDoc(doc(ctx(OWNER), 'directory', PLAYER), { platformRole: 'owner' }))
  })
  it('qualquer usuário autenticado lê o diretório; anônimo não', async () => {
    await assertSucceeds(getDocs(collection(ctx(PLAYER), 'directory')))
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'directory')))
  })
})

describe('registro de acessos', () => {
  const entry = (uid: string | null) => ({ uid, name: null, email: null, deviceId: 'dev1', at: 1, platform: 'ios', installed: false, version: '1', path: '/' })
  it('visitante sem conta e usuário logado registram o próprio acesso; ninguém registra por outro', async () => {
    await assertSucceeds(setDoc(doc(env.unauthenticatedContext().firestore(), 'accessLogs', 'a1'), entry(null)))
    await assertSucceeds(setDoc(doc(ctx(PLAYER), 'accessLogs', 'a2'), entry(PLAYER)))
    await assertFails(setDoc(doc(ctx(PLAYER), 'accessLogs', 'a3'), entry(MANAGER)))
    await assertFails(setDoc(doc(ctx(PLAYER), 'accessLogs', 'a4'), { ...entry(PLAYER), extra: 'x' }))
  })
  it('só o dono lê e apaga os acessos; ninguém edita', async () => {
    await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'accessLogs', 'a1'), entry(PLAYER)))
    await assertSucceeds(getDocs(collection(ctx(OWNER), 'accessLogs')))
    await assertFails(getDocs(collection(ctx(ORGANIZER), 'accessLogs')))
    await assertFails(updateDoc(doc(ctx(OWNER), 'accessLogs', 'a1'), { at: 2 }))
    await assertFails(deleteDoc(doc(ctx(PLAYER), 'accessLogs', 'a1')))
    await assertSucceeds(deleteDoc(doc(ctx(OWNER), 'accessLogs', 'a1')))
  })
  it('dono remove registro do diretório de outra pessoa, não o próprio; outros não removem', async () => {
    await assertFails(deleteDoc(doc(ctx(ORGANIZER), 'directory', PLAYER)))
    await assertFails(deleteDoc(doc(ctx(OWNER), 'directory', OWNER)))
    await assertSucceeds(deleteDoc(doc(ctx(OWNER), 'directory', OUTSIDER)))
  })
  it('usuário atualiza o próprio último acesso no diretório', async () => {
    await assertSucceeds(updateDoc(doc(ctx(PLAYER), 'directory', PLAYER), { lastSeenAt: 5 }))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'directory', MANAGER), { lastSeenAt: 5 }))
  })
})

describe('grupos', () => {
  it('organizador cria grupo e vira gestor no mesmo lote; atleta não cria', async () => {
    const db = ctx(ORGANIZER)
    const batch = writeBatch(db)
    batch.set(doc(db, 'groups', 'g2'), { name: 'Society', sport: 'society', createdBy: ORGANIZER, minPlayers: 10 })
    batch.set(doc(db, 'groups', 'g2', 'members', ORGANIZER), { uid: ORGANIZER, groupId: 'g2', name: 'Org', role: 'manager', joinedAt: 1, addedBy: ORGANIZER })
    await assertSucceeds(batch.commit())
    const db2 = ctx(PLAYER)
    const b2 = writeBatch(db2)
    b2.set(doc(db2, 'groups', 'g3'), { name: 'X', sport: 'futsal', createdBy: PLAYER, minPlayers: 10 })
    b2.set(doc(db2, 'groups', 'g3', 'members', PLAYER), { uid: PLAYER, groupId: 'g3', name: 'A', role: 'manager', joinedAt: 1, addedBy: PLAYER })
    await assertFails(b2.commit())
  })
  it('membro lê o grupo; não membro não lê; dono lê tudo', async () => {
    await assertSucceeds(getDoc(doc(ctx(PLAYER), 'groups', GID)))
    await assertFails(getDoc(doc(ctx(OUTSIDER), 'groups', GID)))
    await assertSucceeds(getDoc(doc(ctx(OWNER), 'groups', GID)))
    await assertSucceeds(getDocs(collection(ctx(OWNER), 'groups')))
  })
  it('atleta não altera grupo nem PIX; gestor e dono sim', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID), { pixKey: 'x' }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID), { pixKey: 'x', pixKeyType: 'email' }))
    await assertSucceeds(updateDoc(doc(ctx(OWNER), 'groups', GID), { name: 'Novo nome' }))
    await assertFails(updateDoc(doc(ctx(MANAGER), 'groups', GID), { createdBy: PLAYER }))
  })
  it('descobre os próprios grupos por consulta em grupo de coleção', async () => {
    await assertFails(getDocs(query(collectionGroup(ctx(PLAYER), 'members'), where('groupId', '==', GID))))
    const ok = await assertSucceeds(getDocs(query(collectionGroup(ctx(PLAYER), 'members'), where('uid', '==', PLAYER))))
    expect(ok.size).toBe(1)
  })
})

describe('membros (sem convite)', () => {
  const player = (uid: string, role = 'player') => ({ uid, groupId: GID, name: 'X', role, joinedAt: 1, addedBy: MANAGER })
  it('ninguém entra sozinho; atleta não adiciona ninguém; gestor adiciona atleta do diretório', async () => {
    await assertFails(setDoc(doc(ctx(OUTSIDER), 'groups', GID, 'members', OUTSIDER), player(OUTSIDER)))
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'members', 'alguem'), player('alguem')))
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'members', OUTSIDER), player(OUTSIDER)))
  })
  it('gestor não adiciona outro gestor; dono adiciona organizador como gestor, mas não um atleta', async () => {
    await assertFails(setDoc(doc(ctx(MANAGER), 'groups', GID, 'members', ORGANIZER), player(ORGANIZER, 'manager')))
    await assertSucceeds(setDoc(doc(ctx(OWNER), 'groups', GID, 'members', ORGANIZER), player(ORGANIZER, 'manager')))
    await assertFails(setDoc(doc(ctx(OWNER), 'groups', GID, 'members', OUTSIDER), player(OUTSIDER, 'manager')))
  })
  it('só o dono muda o papel dentro do grupo; atleta não se promove', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'members', PLAYER), { role: 'manager' }))
    await assertFails(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'members', PLAYER), { role: 'manager' }))
    await assertFails(updateDoc(doc(ctx(OWNER), 'groups', GID, 'members', PLAYER), { role: 'manager' })) // atleta de plataforma
    await assertSucceeds(updateDoc(doc(ctx(OWNER), 'groups', GID, 'members', MANAGER), { role: 'player' }))
  })
  it('gestor remove atleta; atleta não remove outros; atleta pode sair', async () => {
    await assertFails(deleteDoc(doc(ctx(PLAYER), 'groups', GID, 'members', MANAGER)))
    await assertSucceeds(deleteDoc(doc(ctx(PLAYER), 'groups', GID, 'members', PLAYER)))
    await env.clearFirestore(); await seed()
    await assertSucceeds(deleteDoc(doc(ctx(MANAGER), 'groups', GID, 'members', PLAYER)))
    await assertFails(deleteDoc(doc(ctx(MANAGER), 'groups', GID, 'members', MANAGER)))
  })
})

describe('partidas e disponibilidade', () => {
  it('atleta não cria nem edita partidas; gestor e dono sim', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1'), { status: 'confirmed' }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1'), { status: 'confirmed', costOverride: 250 }))
    await assertSucceeds(updateDoc(doc(ctx(OWNER), 'groups', GID, 'matches', 'm1'), { status: 'open' }))
  })
  it('atleta informa a própria disponibilidade e posição; não a de outros', async () => {
    await assertSucceeds(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { status: 'unavailable', position: null, updatedAt: 2 }))
    await assertFails(setDoc(doc(ctx(OUTSIDER), 'groups', GID, 'matches', 'm1', 'players', OUTSIDER), { name: 'X', status: 'available', position: 'goalkeeper', paid: false, paidAt: null, updatedAt: 2 }))
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', 'other'), { name: 'O', status: 'available', position: 'line', paid: false, paidAt: null, updatedAt: 1 }))
  })
  it('atleta não altera pagamento; gestor marca pago/não pago', async () => {
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { paid: true }))
    await assertFails(setDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { name: 'A', status: 'available', position: 'line', paid: true, paidAt: 1, updatedAt: 1 }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { paid: true, paidAt: 5 }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1', 'players', PLAYER), { paid: false, paidAt: null }))
  })
  it('gestor registra disponibilidade de outro atleta; atleta não gera times', async () => {
    await assertSucceeds(setDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1', 'players', 'someone'), { name: 'S', status: 'available', position: 'line', paid: false, paidAt: null, updatedAt: 1 }))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'groups', GID, 'matches', 'm1'), { teams: [{ id: 't1', name: 'Time A', playerIds: [PLAYER] }] }))
    await assertSucceeds(updateDoc(doc(ctx(MANAGER), 'groups', GID, 'matches', 'm1'), { teams: [{ id: 't1', name: 'Time A', playerIds: [PLAYER] }] }))
  })
})

describe('locais, agenda, comunicados e perfil', () => {
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
  })
  it('usuário só lê e edita o próprio perfil privado; dono lê', async () => {
    await assertSucceeds(setDoc(doc(ctx(PLAYER), 'users', PLAYER), { name: 'A', email: 'a@a.com', phone: '1', address: 'r', createdAt: 1 }))
    await assertFails(getDoc(doc(ctx(MANAGER), 'users', PLAYER)))
    await assertSucceeds(getDoc(doc(ctx(OWNER), 'users', PLAYER)))
    await assertFails(updateDoc(doc(ctx(PLAYER), 'users', PLAYER), { email: 'b@b.com' }))
    await assertSucceeds(updateDoc(doc(ctx(PLAYER), 'users', PLAYER), { phone: '2' }))
  })
})
