#!/usr/bin/env node
/**
 * Provisiona o Firebase do Racha de ponta a ponta, de forma idempotente:
 *   1. cria (ou reutiliza) o projeto Firebase;
 *   2. ativa as APIs de Firestore e Identity Toolkit;
 *   3. cria o banco Firestore (default) na região escolhida;
 *   4. ativa login por e-mail/senha e autoriza os domínios da Vercel;
 *   5. cria (ou reutiliza) o app Web e grava src/firebase.config.json;
 *   6. publica firestore.rules e firestore.indexes.json;
 *   7. aponta .firebaserc para o projeto.
 *
 * Pré-requisito único: `npx firebase login` (uma vez, abre o navegador).
 *
 * Uso:
 *   node scripts/setup-firebase.mjs [--project <id>] [--region southamerica-east1] [--domains a.vercel.app,b.com]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] ?? true] : [])).filter(Boolean))

const REGION = args.region ?? 'southamerica-east1'
const DOMAINS = String(args.domains ?? 'racha-silk-zeta.vercel.app,racha-martinsphilippes.vercel.app').split(',').map((d) => d.trim()).filter(Boolean)
const DISPLAY_NAME = 'Racha'

const firebaseBin = path.join(root, 'node_modules', '.bin', 'firebase')
function fb(cmdArgs, opts = {}) {
  const out = execFileSync(firebaseBin, [...cmdArgs, '--non-interactive'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts })
  return out.trim()
}
function fbJson(cmdArgs) {
  return JSON.parse(fb([...cmdArgs, '--json']))
}
function log(msg) { console.log(`\n▶ ${msg}`) }

// ---------- 0. autenticação ----------
const accounts = fbJson(['login:list'])
if (!accounts.result?.length && !accounts.length) {
  console.error('Faça login primeiro: npx firebase login')
  process.exit(1)
}

// Cliente HTTP autenticado do próprio firebase-tools (usa a conta logada).
const { requireAuth } = require('firebase-tools/lib/requireAuth')
const { Client } = require('firebase-tools/lib/apiv2')
await requireAuth({})
const api = (urlPrefix) => new Client({ urlPrefix, auth: true, apiVersion: 'v1' })

// ---------- 1. projeto ----------
log('Projeto Firebase')
let projectId = args.project
const existing = fbJson(['projects:list']).result ?? []
if (!projectId) {
  const found = existing.find((p) => p.displayName === DISPLAY_NAME || p.projectId.startsWith('racha-'))
  if (found) projectId = found.projectId
}
if (projectId && existing.some((p) => p.projectId === projectId)) {
  console.log(`Reutilizando projeto ${projectId}`)
} else {
  projectId = projectId ?? `racha-${Math.random().toString(36).slice(2, 8)}`
  console.log(`Criando projeto ${projectId}…`)
  fb(['projects:create', projectId, '--display-name', DISPLAY_NAME])
}

// ---------- 2. APIs ----------
log('Ativando APIs (Firestore, Identity Toolkit)')
const serviceusage = api('https://serviceusage.googleapis.com')
for (const svc of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
  await serviceusage.request({ method: 'POST', path: `/v1/projects/${projectId}/services/${svc}:enable`, body: {} }).catch((e) => console.warn(`  ${svc}: ${e.message}`))
}

// ---------- 3. Firestore ----------
log(`Banco Firestore (${REGION})`)
try {
  fb(['firestore:databases:create', '(default)', '--location', REGION, '--project', projectId])
  console.log('Banco criado')
} catch {
  console.log('Banco já existe (ok)')
}

// ---------- 4. Authentication ----------
log('Login por e-mail/senha e domínios autorizados')
const identity = api('https://identitytoolkit.googleapis.com')
const current = await identity.request({ method: 'GET', path: `/admin/v2/projects/${projectId}/config` }).then((r) => r.body).catch(() => ({}))
const authorized = new Set([...(current.authorizedDomains ?? ['localhost', `${projectId}.firebaseapp.com`, `${projectId}.web.app`]), ...DOMAINS])
await identity.request({
  method: 'PATCH',
  path: `/admin/v2/projects/${projectId}/config`,
  queryParams: { updateMask: 'signIn.email,authorizedDomains' },
  body: { signIn: { email: { enabled: true, passwordRequired: true } }, authorizedDomains: [...authorized] },
})
console.log(`E-mail/senha ativo. Domínios: ${[...authorized].join(', ')}`)

// ---------- 5. App Web ----------
log('App Web e configuração pública')
const apps = fbJson(['apps:list', 'WEB', '--project', projectId]).result ?? []
let appId = apps[0]?.appId
if (!appId) {
  const created = fbJson(['apps:create', 'WEB', DISPLAY_NAME, '--project', projectId])
  appId = created.result?.appId ?? created.appId
  console.log(`App Web criado: ${appId}`)
} else {
  console.log(`Reutilizando app Web ${appId}`)
}
const sdk = fbJson(['apps:sdkconfig', 'WEB', appId, '--project', projectId])
const cfg = sdk.result?.sdkConfig ?? sdk.sdkConfig ?? sdk.result ?? sdk
const publicConfig = {
  apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId,
  storageBucket: cfg.storageBucket ?? '', messagingSenderId: cfg.messagingSenderId ?? '', appId: cfg.appId,
}
writeFileSync(path.join(root, 'src', 'firebase.config.json'), JSON.stringify(publicConfig, null, 2) + '\n')
console.log('Gravado src/firebase.config.json')

// ---------- 6. .firebaserc + regras ----------
log('Regras e índices do Firestore')
const rcPath = path.join(root, '.firebaserc')
const rc = JSON.parse(readFileSync(rcPath, 'utf8'))
rc.projects = { ...rc.projects, default: projectId }
writeFileSync(rcPath, JSON.stringify(rc, null, 2) + '\n')
fb(['deploy', '--only', 'firestore', '--project', projectId, '--force'], { stdio: 'inherit' })

console.log(`
✅ Firebase pronto: ${projectId}
   Console: https://console.firebase.google.com/project/${projectId}/overview

Próximo passo: commit e push (a Vercel publica automaticamente com a configuração):
   git add src/firebase.config.json .firebaserc && git commit -m "Configura Firebase" && git push
`)
