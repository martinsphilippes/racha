// Limpa os emuladores antes da execução para o fluxo começar sempre do zero.
export default async function globalSetup() {
  const project = 'demo-racha'
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' }).catch(() => undefined)
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' }).catch(() => undefined)
}
