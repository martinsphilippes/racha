# Racha 10 ⚽

PWA para organizar o futebol semanal (futsal e society): presença por partida, posição (linha/goleiro),
rateio automático com isenção de goleiros, PIX, controle de pagamento, sorteio de times e comunicados.

- **Frontend:** Vite + React + TypeScript + Tailwind, PWA instalável (manifest, ícones, service worker).
- **Backend:** Firebase Auth (e-mail/senha) + Cloud Firestore (tempo real nativo). Sem Cloud Functions: toda
  a lógica roda no cliente e a segurança é garantida pelas **regras do Firestore** (`firestore.rules`).
- **Hospedagem:** Vercel (`vercel.json` já configura o SPA e o cache do service worker).

## Papéis de acesso

| Papel | Quem | Pode |
| --- | --- | --- |
| **Dono** | a conta com o e-mail fixado em `src/lib/platform.ts` e em `firestore.rules` | tudo: promover/rebaixar organizadores (aba **Admin**), acessar e administrar qualquer grupo |
| **Organizador** | quem o dono promoveu | criar grupos, cadastrar locais/quadras/agenda, adicionar atletas ao grupo (busca por nome ou e-mail no diretório), pagamentos, times, comunicados |
| **Atleta** | todo mundo que cria conta | responder disponibilidade e posição, ver rateio, PIX, times e comunicados dos grupos em que foi colocado |

Não existe código de convite: há um único cadastro, e o organizador coloca o atleta no grupo.
Somente o dono muda papéis (regra garantida no Firestore, não só na interface).

## Como funciona

| Tela | Quem | O que faz |
| --- | --- | --- |
| Início | todos | Próxima partida, **Disponível / Indisponível**, posição, lista de confirmados, valor a pagar, PIX (chave e copia e cola), status do pagamento, times, comunicados |
| Histórico | todos | Partidas passadas com participantes, valor e situação do seu pagamento |
| Gestão | gestor | Painel com números da próxima partida e ações rápidas |
| Gestão › Partida | gestor | Confirmar/cancelar, ajustar participantes, pagamentos, gerar/sortear/mover times, comunicado, editar dados e custo manual |
| Gestão › Locais | gestor | Locais e quadras com valor por hora |
| Gestão › Futebol semanal | gestor | Agenda recorrente; as próximas partidas são geradas automaticamente (cada data é independente) |
| Gestão › Jogadores | gestor | Adicionar atletas do diretório, remover; dono define gestores |
| Admin | dono | Lista de usuários com papel (atleta/organizador) e todos os grupos |
| Gestão › Grupo e PIX | gestor | Nome, modalidade, mínimo de jogadores, chave PIX |
| Perfil | todos | Dados pessoais, trocar de grupo, entrar/criar grupo |

Regras de negócio centrais (em `src/lib/matches.ts`, com testes):

- Custo da partida = valor/hora da quadra × duração (ou valor manual do gestor).
- **Goleiros não pagam.** Valor individual = custo ÷ jogadores de linha disponíveis, recalculado a cada mudança.
- Partida cujo horário já passou aparece como **Finalizada** automaticamente.

## Rodando localmente (com emuladores, sem projeto Firebase)

Pré-requisitos: Node 22+, Java 21+ (para os emuladores).

```bash
npm install
cp .env.example .env            # deixe VITE_USE_EMULATORS=true
npm run emulators               # terminal 1: Auth + Firestore locais
npm run dev                     # terminal 2: http://localhost:5173
```

Testes:

```bash
npm test          # lógica: rateio, isenção de goleiro, datas, sorteio, PIX
npm run test:rules   # regras de segurança contra o emulador (sobe e derruba sozinho)
npm run test:e2e     # fluxo completo gestor + atleta no navegador (precisa dos emuladores rodando)
```

## Colocando em produção

### 1. Firebase (um comando)

```bash
npx firebase login          # uma vez: abre o navegador para autorizar sua conta Google
npm run setup:firebase      # cria projeto, Firestore, e-mail/senha, app Web, regras e índices
git add src/firebase.config.json .firebaserc
git commit -m "Configura Firebase" && git push
```

O script `scripts/setup-firebase.mjs` é idempotente (pode rodar de novo) e aceita
`--project <id>`, `--region <região>` e `--domains a.vercel.app,b.com`.
Ele grava a **configuração pública** do Web SDK em `src/firebase.config.json`, que é versionada de propósito:
não é segredo (é entregue ao navegador de qualquer forma) e a segurança vem da autenticação + regras do Firestore.
Variáveis `VITE_FIREBASE_*` no ambiente, quando existirem, têm prioridade sobre o arquivo.

Se preferir fazer manualmente no console: criar projeto → Authentication → E-mail/senha → Firestore (produção,
`southamerica-east1`) → app Web → colar a configuração no JSON → `npm run deploy:rules`.
O índice de grupo de coleção em `members.uid` (consulta "meus grupos") é obrigatório em produção.

### 2. Vercel

Produção: **https://racha-silk-zeta.vercel.app** (projeto `racha` na Vercel, ligado a este repositório).
Cada push na branch `main` gera um deploy de produção automático com HTTPS; outras branches geram previews. `vercel.json` cuida das rotas do SPA e do cache do service worker.
Nenhuma variável de ambiente é necessária quando `src/firebase.config.json` está preenchido.

O app é instalável no celular ("Adicionar à tela inicial"); atualizações do service worker são automáticas.

## Estrutura de dados (Firestore)

```
directory/{uid}                      nome, e-mail e papel de plataforma (visível a autenticados; papel só o dono altera)
users/{uid}                          perfil privado (telefone, endereço)
groups/{groupId}                     grupo, padrões do futebol, PIX
  members/{uid}                      papel (manager | player) — fonte da verdade de acesso
  venues/{venueId}                   local
  courts/{courtId}                   quadra (local, modalidade, valor/hora)
  schedules/{scheduleId}             futebol recorrente (dia, horário, duração, quadra)
  matches/{matchId}                  partida (snapshot do local/quadra/valor, status, times)
    players/{uid}                    disponibilidade, posição, pagamento
  announcements/{announcementId}     comunicados (gerais ou de uma partida)
```

Regras de segurança (`firestore.rules`, cobertas por `tests/rules`):
atleta só lê grupos dos quais participa e só altera a própria disponibilidade/posição (nunca o pagamento);
somente gestores alteram grupo, PIX, locais, agenda, partidas, pagamentos, times e comunicados;
somente o dono altera papéis de plataforma e define gestores; ninguém entra em um grupo sozinho.

## Próximos passos sugeridos

- Notificações push (FCM) para comunicados e lembretes de confirmação — o modelo de `announcements` já suporta.
- Contadores desnormalizados na partida (confirmados/pagos) para o histórico não abrir um listener por partida.
- Novas modalidades e posições: basta estender `SPORTS`, `POSITIONS` e `POSITIONS_BY_SPORT` em `src/lib/types.ts`.
- Recuperação de senha por e-mail (Firebase Auth já oferece; falta a tela).
