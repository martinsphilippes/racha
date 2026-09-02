# Racha ⚽

PWA para organizar o futebol semanal (futsal e society): presença por partida, posição (linha/goleiro),
rateio automático com isenção de goleiros, PIX, controle de pagamento, sorteio de times e comunicados.

- **Frontend:** Vite + React + TypeScript + Tailwind, PWA instalável (manifest, ícones, service worker).
- **Backend:** Firebase Auth (e-mail/senha) + Cloud Firestore (tempo real nativo). Sem Cloud Functions: toda
  a lógica roda no cliente e a segurança é garantida pelas **regras do Firestore** (`firestore.rules`).
- **Hospedagem:** Vercel (`vercel.json` já configura o SPA e o cache do service worker).

## Como funciona

| Tela | Quem | O que faz |
| --- | --- | --- |
| Início | todos | Próxima partida, **Disponível / Indisponível**, posição, lista de confirmados, valor a pagar, PIX (chave e copia e cola), status do pagamento, times, comunicados |
| Histórico | todos | Partidas passadas com participantes, valor e situação do seu pagamento |
| Gestão | gestor | Painel com números da próxima partida e ações rápidas |
| Gestão › Partida | gestor | Confirmar/cancelar, ajustar participantes, pagamentos, gerar/sortear/mover times, comunicado, editar dados e custo manual |
| Gestão › Locais | gestor | Locais e quadras com valor por hora |
| Gestão › Futebol semanal | gestor | Agenda recorrente; as próximas partidas são geradas automaticamente (cada data é independente) |
| Gestão › Jogadores | gestor | Código de convite, promover/remover membros |
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

### 1. Firebase

1. Crie um projeto no [console do Firebase](https://console.firebase.google.com).
2. **Authentication → Método de login → E-mail/senha:** ativar.
3. **Firestore Database:** criar (modo produção; as regras serão publicadas a seguir). Região sugerida: `southamerica-east1`.
4. **Configurações do projeto → Seus apps → Web:** registre o app e copie as credenciais para o `.env`
   (`VITE_FIREBASE_*`) com `VITE_USE_EMULATORS=false`.
5. Publique regras e índices:

   ```bash
   npx firebase login
   npx firebase use --add        # escolha o projeto criado (atualiza .firebaserc)
   npm run deploy:rules          # firestore.rules + firestore.indexes.json
   ```

   O índice de grupo de coleção em `members.uid` (consulta "meus grupos") é obrigatório em produção.

### 2. Vercel

1. Importe o repositório na Vercel (framework Vite é detectado pelo `vercel.json`).
2. Em **Settings → Environment Variables**, cadastre as mesmas variáveis `VITE_FIREBASE_*` e `VITE_USE_EMULATORS=false`.
3. Em **Authentication → Configurações → Domínios autorizados** no Firebase, adicione o domínio da Vercel.

O app é instalável no celular ("Adicionar à tela inicial"); atualizações do service worker são automáticas.

## Estrutura de dados (Firestore)

```
users/{uid}                          perfil (nome, e-mail, telefone, endereço)
invites/{code}                       código de convite → grupo
groups/{groupId}                     grupo, padrões do futebol, PIX, código de convite
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
somente gestores alteram grupo, PIX, locais, agenda, partidas, pagamentos, times e comunicados.

## Próximos passos sugeridos

- Notificações push (FCM) para comunicados e lembretes de confirmação — o modelo de `announcements` já suporta.
- Contadores desnormalizados na partida (confirmados/pagos) para o histórico não abrir um listener por partida.
- Novas modalidades e posições: basta estender `SPORTS`, `POSITIONS` e `POSITIONS_BY_SPORT` em `src/lib/types.ts`.
- Recuperação de senha por e-mail (Firebase Auth já oferece; falta a tela).
