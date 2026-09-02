import { expect, test, type Page } from '@playwright/test'

// Fluxo completo: interface → Firestore (emulador) → atualização em tempo real na outra sessão.
const run = Date.now().toString(36)
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

test('gestor e atleta: grupo → local → agenda → disponibilidade → rateio → PIX → pagamento → times → comunicado', async ({ browser }) => {
  const managerCtx = await browser.newContext()
  const athleteCtx = await browser.newContext()
  const m = await managerCtx.newPage()
  const a = await athleteCtx.newPage()

  // ----- Gestor: cadastro e grupo -----
  await signup(m, manager)
  await m.getByRole('link', { name: 'Sou organizador: criar grupo' }).click()
  await m.getByLabel('Nome do grupo').fill('Futsal de terça')
  await m.getByLabel('Mínimo de jogadores desejado').fill('2')
  await m.getByRole('button', { name: 'CRIAR GRUPO' }).click()
  await expect(m).toHaveURL(/\/manage\/venues/)

  // ----- Local e quadra -----
  await m.getByRole('button', { name: 'Cadastrar local' }).click()
  await m.getByLabel('Nome do local').fill('Arena Ituiutaba')
  await m.getByLabel('Endereço').fill('Av. Central, 100')
  await m.getByRole('button', { name: 'Salvar' }).click()
  await expect(m.getByText('Arena Ituiutaba')).toBeVisible()
  await m.getByRole('button', { name: '+ Quadra' }).click()
  await m.getByLabel('Nome da quadra').fill('Futsal 1')
  await m.getByLabel('Valor por hora (R$)').fill('200')
  await m.getByRole('button', { name: 'Salvar' }).click()
  await expect(m.getByText('R$ 200,00 / hora')).toBeVisible()

  // ----- Agenda semanal (amanhã, para a partida estar sempre no futuro) -----
  await m.goto('/manage/schedule')
  await m.getByRole('button', { name: 'Configurar' }).click()
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  await m.getByLabel('Dia da semana').selectOption(String(tomorrow.getDay()))
  await m.getByLabel('Início').fill('19:30')
  await m.getByLabel('Duração (min)').fill('90')
  await m.getByRole('button', { name: 'Salvar e gerar' }).click()
  await expect(m.getByText('4 partidas geradas')).toBeVisible()
  await expect(m.getByText('R$ 200,00/h → R$ 300,00 por partida')).toBeVisible()

  // ----- Painel do gestor mostra a próxima partida -----
  await m.goto('/manage')
  await expect(m.getByText('19h30 às 21h00 · Arena Ituiutaba · Futsal 1')).toBeVisible()
  await expect(m.getByText('Valor partida').locator('..').getByText('R$ 300,00')).toBeVisible()

  // ----- Gestor também joga -----
  await m.goto('/')
  await expect(m.getByText('Você vai jogar?')).toBeVisible()
  await expect(m.getByText('Faltam 2 jogadores para atingir o mínimo de 2')).toBeVisible()
  await m.getByRole('button', { name: 'DISPONÍVEL', exact: false }).first().click()
  await expect(m.getByText('Sua posição')).toBeVisible()
  await expect(m.getByText('R$ 300,00 por jogador')).toBeVisible()

  // ----- Código de convite -----
  await m.goto('/manage/members')
  const code = (await m.getByTestId('invite-code').textContent())!.trim()
  expect(code).toHaveLength(6)

  // ----- Atleta: cadastro e entrada no grupo -----
  await signup(a, athlete)
  await a.getByRole('link', { name: 'TENHO UM CÓDIGO DE CONVITE' }).click()
  await a.getByLabel('Código de convite').fill(code)
  await a.getByRole('button', { name: 'ENTRAR NO GRUPO' }).click()
  await expect(a.getByText('Futsal de terça')).toBeVisible()
  await expect(a.getByText('Você vai jogar?')).toBeVisible()
  await expect(a.getByText('Faltam 1 jogador para atingir o mínimo de 2')).toBeVisible()
  // Atleta comum não tem aba Gestão e é redirecionado se tentar
  await expect(a.getByRole('link', { name: 'Gestão' })).toHaveCount(0)
  await a.goto('/manage')
  await expect(a).toHaveURL(/\/$/)

  // ----- Atleta confirma como goleiro → isento; gestor vê em tempo real -----
  await a.getByRole('button', { name: 'DISPONÍVEL', exact: false }).first().click()
  await a.getByRole('button', { name: 'Goleiro' }).click()
  await expect(a.getByText('Goleiro · isento')).toBeVisible()
  await m.goto('/')
  await expect(m.getByText('2 jogadores confirmados · mínimo atingido')).toBeVisible()
  await expect(m.getByText('1 goleiro')).toBeVisible()
  await expect(m.getByText('R$ 300,00 por jogador')).toBeVisible() // só o gestor paga

  // ----- Atleta muda para linha → rateio recalculado sem recarregar a página do gestor -----
  await a.getByRole('button', { name: 'Linha' }).click()
  await expect(a.getByText('R$ 150,00', { exact: true })).toBeVisible()
  await expect(m.getByText('R$ 150,00 por jogador')).toBeVisible()
  await expect(m.getByText('2 linha')).toBeVisible()

  // ----- PIX configurado pelo gestor aparece para o atleta -----
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

  // ----- Gestor marca o atleta como pago; atleta vê em tempo real -----
  await m.goto('/')
  await m.getByRole('button', { name: `Marcar como pago: ${athlete.name}` }).click()
  await expect(m.getByRole('button', { name: `Marcar como não pago: ${athlete.name}` })).toBeVisible()
  await expect(a.getByText('🟢 PAGO', { exact: true })).toBeVisible()

  // ----- Painel financeiro -----
  await m.goto('/manage')
  await expect(m.getByText('Recebido').locator('..').getByText('R$ 150,00')).toBeVisible()
  await expect(m.getByText('Restante').locator('..').getByText('R$ 150,00')).toBeVisible()

  // ----- Times -----
  await m.getByRole('link', { name: 'Gerenciar partida' }).click()
  await m.getByLabel('Times', { exact: true }).fill('2')
  await m.getByRole('button', { name: 'GERAR TIMES' }).click()
  await expect(m.getByText('Times sorteados!')).toBeVisible()
  await expect(m.getByText('SORTEAR NOVAMENTE')).toBeVisible()
  await expect(a.getByText('Time A')).toBeVisible()
  await expect(a.getByText('Time B')).toBeVisible()

  // ----- Comunicado da partida -----
  await m.getByPlaceholder('Ex.: Hoje o futebol começará às 20h.').fill('Hoje o futebol começará às 20h.')
  await m.getByRole('button', { name: 'ENVIAR COMUNICADO' }).click()
  await expect(a.getByText('Hoje o futebol começará às 20h.')).toBeVisible()

  // ----- Confirmar partida -----
  await m.getByRole('button', { name: 'Confirmar futebol' }).click()
  await expect(a.getByText('Confirmada')).toBeVisible()

  // ----- Persistência: recarregar a página do atleta mantém tudo -----
  await a.reload()
  await expect(a.getByText('🟢 PAGO', { exact: true })).toBeVisible()
  await expect(a.getByText('Time A')).toBeVisible()
  await expect(a.getByRole('button', { name: 'DISPONÍVEL', exact: false }).first()).toHaveAttribute('aria-pressed', 'true')

  // ----- Histórico vazio (ainda não houve partida passada) -----
  await a.goto('/history')
  await expect(a.getByText('Nenhuma partida anterior')).toBeVisible()

  await managerCtx.close()
  await athleteCtx.close()
})
