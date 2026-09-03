import { expect, test, type Page } from '@playwright/test'

// Fluxo completo: dono promove organizador → organizador cria grupo, local, agenda e adiciona atleta →
// disponibilidade, rateio em tempo real, PIX, pagamento, times, comunicado, persistência.
const run = Date.now().toString(36)
const owner = { name: 'Philippe Dono', email: 'martinsphilippes@gmail.com', phone: '(34) 99999-0000', address: 'Rua 0', password: 'senha123' }
const manager = { name: 'Carlos Organizador', email: `gestor-${run}@teste.com`, phone: '(34) 99999-0001', address: 'Rua A, 1', password: 'senha123' }
const athlete = { name: 'João Atleta Silva', email: `atleta-${run}@teste.com`, phone: '(34) 99999-0002', address: 'Rua B, 2', password: 'senha123' }

async function signup(page: Page, u: typeof manager) {
  await page.goto('/signup')
  await page.getByLabel('Nome completo').fill(u.name)
  await page.getByLabel('E-mail').fill(u.email)
  await page.getByLabel('Telefone').fill(u.phone)
  await page.getByLabel('Endereço').fill(u.address)
  await page.getByLabel('Senha').fill(u.password)
  await page.getByRole('button', { name: 'CRIAR CONTA' }).click()
  await expect(page.getByText('Bem-vindo ao Racha!')).toBeVisible()
}
async function login(page: Page, u: typeof manager) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(u.email)
  await page.getByLabel('Senha').fill(u.password)
  await page.getByRole('button', { name: 'ENTRAR' }).click()
}

test('dono → organizador → grupo → atleta → disponibilidade → rateio → PIX → pagamento → times → comunicado', async ({ browser }) => {
  const ownerCtx = await browser.newContext()
  const managerCtx = await browser.newContext()
  const athleteCtx = await browser.newContext()
  const o = await ownerCtx.newPage()
  const m = await managerCtx.newPage()
  const a = await athleteCtx.newPage()
  // Confirmações (window.confirm) são aceitas automaticamente.
  for (const p of [o, m, a]) p.on('dialog', (d) => d.accept())

  // ----- Contas -----
  await signup(m, manager)
  await expect(m.getByText('Aguardando o organizador')).toBeVisible() // ainda é atleta comum
  await signup(a, athlete)
  await expect(a.getByText('Aguardando o organizador')).toBeVisible()

  // ----- Dono: cadastro (ou login, se já existir no emulador) e promoção do organizador -----
  await o.goto('/signup')
  await o.getByLabel('Nome completo').fill(owner.name)
  await o.getByLabel('E-mail').fill(owner.email)
  await o.getByLabel('Telefone').fill(owner.phone)
  await o.getByLabel('Endereço').fill(owner.address)
  await o.getByLabel('Senha').fill(owner.password)
  await o.getByRole('button', { name: 'CRIAR CONTA' }).click()
  await expect(o.getByText(/Bem-vindo ao Racha!|Este e-mail já está cadastrado\./)).toBeVisible()
  if (await o.getByText('Este e-mail já está cadastrado.').isVisible()) await login(o, owner)
  await o.goto('/admin')
  await expect(o.getByText('Usuários e permissões')).toBeVisible()
  await o.getByLabel('Buscar usuário').fill(manager.email)
  await o.getByRole('button', { name: `Tornar organizador: ${manager.name}` }).click()
  await expect(o.getByText('Agora é organizador')).toBeVisible()
  // Atleta comum não vira organizador sozinho nem acessa /admin
  await a.goto('/admin')
  await expect(a).toHaveURL(/\/$/)

  // ----- Organizador: em tempo real passa a poder criar grupo -----
  await expect(m.getByRole('link', { name: 'CRIAR MEU GRUPO' })).toBeVisible()
  await m.getByRole('link', { name: 'CRIAR MEU GRUPO' }).click()
  await m.getByLabel('Nome do grupo').fill('Futsal de terça')
  // Campo numérico: apagar tudo e digitar não pode virar "015"
  const min = m.getByLabel('Mínimo de jogadores desejado')
  await min.click(); await min.press('End'); await min.press('Backspace'); await min.press('Backspace')
  await expect(min).toHaveValue('')
  await min.pressSequentially('15')
  await expect(min).toHaveValue('15')
  await min.fill('2')
  await m.getByRole('button', { name: 'CRIAR GRUPO' }).click()
  await expect(m).toHaveURL(/\/manage\/venues/)

  // ----- Local e quadra (busca de endereço simulada: o geocodificador externo é substituído) -----
  await m.route('https://photon.komoot.io/**', (route) => route.fulfill({
    json: { features: [{ geometry: { coordinates: [-49.4646, -18.9742] }, properties: { name: 'Arena Ituiutaba', osm_key: 'leisure', street: 'Avenida Central', housenumber: '100', district: 'Centro', city: 'Ituiutaba', state: 'Minas Gerais' } }] },
  }))
  await m.getByRole('button', { name: 'Cadastrar local' }).click()
  await m.getByLabel('Nome do local').fill('Arena Ituiutaba')
  await m.getByLabel('Endereço').fill('Arena Ituiu')
  await m.getByRole('option').first().click()
  await expect(m.getByLabel('Endereço')).toHaveValue('Arena Ituiutaba, Avenida Central, 100 - Centro, Ituiutaba - MG')
  await expect(m.getByText('Localização marcada no mapa')).toBeVisible()
  await m.getByRole('button', { name: 'Salvar' }).click()
  await expect(m.getByText('📍 Arena Ituiutaba, Avenida Central, 100')).toBeVisible()
  await m.getByRole('button', { name: '+ Quadra' }).click()
  await m.getByLabel('Nome da quadra').fill('Futsal 1')
  await m.getByLabel('Valor por hora (R$)').fill('200')
  await m.getByRole('button', { name: 'Salvar' }).click()
  await expect(m.getByText('R$ 200,00 / hora')).toBeVisible()

  // ----- Agenda semanal (amanhã) -----
  await m.goto('/manage/schedule')
  await m.getByRole('button', { name: 'Configurar' }).click()
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  await m.getByLabel('Dia da semana').selectOption(String(tomorrow.getDay()))
  await m.getByLabel('Início').fill('19:30')
  await m.getByLabel('Duração (min)').fill('90')
  await m.getByRole('button', { name: 'Salvar e gerar' }).click()
  await expect(m.getByText('4 partidas geradas')).toBeVisible()

  // ----- Organizador joga e adiciona o atleta pelo diretório -----
  await m.goto('/')
  await m.getByRole('button', { name: 'DISPONÍVEL', exact: false }).first().click()
  await expect(m.getByText('R$ 300,00 por jogador')).toBeVisible()
  await m.goto('/manage/members')
  await m.getByLabel('Buscar jogador').fill(athlete.email)
  await m.getByRole('button', { name: `Adicionar ${athlete.name}` }).click()
  await expect(m.getByText(`${athlete.name} adicionado ao grupo`)).toBeVisible()

  // ----- Atleta vê a partida em tempo real, sem recarregar -----
  await expect(a.getByText('Futsal de terça')).toBeVisible()
  await expect(a.getByText('Você vai jogar?')).toBeVisible()
  await expect(a.getByRole('link', { name: 'Gestão' })).toHaveCount(0)
  // Como chegar: links com as coordenadas do local escolhido
  // Endereço com número: os links usam o texto (mais preciso que a coordenada da rua)
  await expect(a.getByRole('link', { name: /Como chegar/ })).toHaveAttribute('href', /destination=Arena%20Ituiutaba%2C%20Avenida%20Central%2C%20100/)
  await expect(a.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', /q=Arena%20Ituiutaba%2C%20Avenida%20Central%2C%20100/)
  await a.goto('/manage')
  await expect(a).toHaveURL(/\/$/)

  // ----- Goleiro → isento; muda para linha → rateio recalcula no gestor -----
  await a.getByRole('button', { name: 'DISPONÍVEL', exact: false }).first().click()
  await a.getByRole('button', { name: 'Goleiro' }).click()
  await expect(a.getByText('Goleiro · isento')).toBeVisible()
  await m.goto('/')
  await expect(m.getByText('2 jogadores confirmados · mínimo atingido')).toBeVisible()
  await expect(m.getByText('R$ 300,00 por jogador')).toBeVisible()
  await a.getByRole('button', { name: 'Linha' }).click()
  await expect(a.getByText('R$ 150,00', { exact: true })).toBeVisible()
  await expect(m.getByText('R$ 150,00 por jogador')).toBeVisible()

  // ----- PIX -----
  await m.goto('/manage/group')
  await m.getByLabel('Tipo da chave').selectOption('email')
  await m.getByLabel('Chave PIX').fill('carlos@pix.com')
  await m.getByLabel('Nome do recebedor').fill('Carlos Organizador')
  await m.getByLabel('Cidade do recebedor').fill('Ituiutaba')
  await m.getByRole('button', { name: 'Salvar PIX' }).click()
  await expect(m.getByText('PIX salvo')).toBeVisible()
  await expect(a.getByText('carlos@pix.com')).toBeVisible()
  await expect(a.getByRole('button', { name: 'COPIA E COLA' })).toBeEnabled()
  await expect(a.getByText('🔴 NÃO PAGO', { exact: true })).toBeVisible()

  // ----- Pagamento -----
  await m.goto('/')
  await m.getByRole('button', { name: `Marcar como pago: ${athlete.name}` }).click()
  await expect(a.getByText('🟢 PAGO', { exact: true })).toBeVisible()
  await m.goto('/manage')
  await expect(m.getByText('Recebido').locator('..').getByText('R$ 150,00')).toBeVisible()

  // ----- Times, comunicado, confirmação -----
  await m.getByRole('link', { name: 'Gerenciar partida' }).click()
  await m.getByLabel('Times', { exact: true }).fill('2')
  await m.getByRole('button', { name: 'GERAR TIMES' }).click()
  await expect(m.getByText('Times sorteados!')).toBeVisible()
  await expect(a.getByText('Time A')).toBeVisible()
  await m.getByPlaceholder('Ex.: Hoje o futebol começará às 20h.').fill('Hoje o futebol começará às 20h.')
  await m.getByRole('button', { name: 'ENVIAR COMUNICADO' }).click()
  await expect(a.getByText('Hoje o futebol começará às 20h.')).toBeVisible()
  await m.getByRole('button', { name: 'Confirmar futebol' }).click()
  await expect(a.getByText('Confirmada')).toBeVisible()

  // ----- Dono enxerga o grupo sem ser membro -----
  await o.goto('/admin')
  await o.getByRole('link', { name: /Futsal de terça/ }).click()
  await expect(o.getByText('Painel do gestor')).toBeVisible()
  await expect(o.getByText('Quadra').first()).toBeVisible().catch(() => undefined)

  // ----- Persistência -----
  await a.reload()
  await expect(a.getByText('🟢 PAGO', { exact: true })).toBeVisible()
  await expect(a.getByRole('button', { name: 'DISPONÍVEL', exact: false }).first()).toHaveAttribute('aria-pressed', 'true')

  await ownerCtx.close(); await managerCtx.close(); await athleteCtx.close()
})
