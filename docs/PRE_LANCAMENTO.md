# Pré-lançamento — o que foi feito e o que falta

Estado em **04/10/2026**. Lista fechada dos bloqueadores levantados na revisão e do que
faltava para o app ter chance de prender quem baixa.

Legenda: ✅ feito e testado · ⚠️ escrito, falta rodar contra o banco · 🔑 depende de algo
que só você tem (chave, conta paga, painel)

---

## Bloqueadores de publicação

| # | Item | Estado | Onde |
| - | ---- | ------ | ---- |
| 1 | Recuperação de senha a partir do login | ✅ | [`(auth)/recuperar.tsx`](../src/app/(auth)/recuperar.tsx) |
| 2 | E-mail não confirmado com reenvio | ✅ | [`(auth)/login.tsx`](../src/app/(auth)/login.tsx) |
| 3 | Sign in with Apple | ✅ código · 🔑 conta | [`services/auth/apple.ts`](../src/services/auth/apple.ts) |
| 4 | Rate limiting no servidor | ⚠️ | [`20261004120000_limite_de_frequencia.sql`](../supabase/migrations/20261004120000_limite_de_frequencia.sql) |
| 5 | Telemetria sem chave no build | ✅ trava · 🔑 chaves | [`scripts/conferir-ambiente.js`](../scripts/conferir-ambiente.js) |
| 6 | Teste instável quebrando o CI | ✅ | `MockDataService.ts` (rasantes) |

### 1. Recuperação de senha — ✅

O `resetPasswordForEmail` existia, mas só em Configurações › Conta › Senha, que exige
estar logado. Quem esquecia a senha não alcançava nenhuma tela de dentro do app: a conta
virava perda total. Agora há link na tela de login, tela própria e confirmação neutra
("se existe uma conta com…"), que não transforma a tela num verificador de e-mails
cadastrados. 9 testes.

### 2. E-mail não confirmado — ✅

Com `Confirm email` ligado no Supabase, o login respondia "Falha ao entrar" e a pessoa
ficava trancada com a senha certa na mão. O erro agora tem código próprio
(`email_nao_confirmado`) e a tela oferece reenviar a confirmação. Novo método
`reenviarConfirmacaoDeEmail` nos dois drivers.

### 3. Sign in with Apple — ✅ código, 🔑 conta

A App Store (Guideline 4.8) exige o login da Apple em todo app que oferece login social de
terceiro — e o Vulture oferece Google. Implementado com carregamento opcional em runtime
(mesmo padrão do LiveKit): no Android e no Expo Go o módulo nem é carregado e o botão não
aparece. `expo-apple-authentication` instalado, `usesAppleSignIn` e o plugin no
`app.json`. 8 testes cobrem o que dá para cobrir sem iPhone.

**Falta você:** Apple Developer Program (US$ 99/ano), habilitar o provider Apple no painel
do Supabase e rodar numa build de iOS assinada. O caminho feliz nunca executou.

### 4. Rate limiting — ⚠️ falta rodar

Nenhuma escrita tinha teto. Uma conta podia inserir dez mil comentários num minuto, e cada
comentário gera notificação → push → fan-out: um laço de spam sai caro em três serviços ao
mesmo tempo. Trigger `BEFORE INSERT` genérico em sete tabelas, com os tetos do Fase D do
roadmap (10 comentários/min, 5 uploads/hora, 40 mensagens/min…). Trigger e não RPC porque
a chave anon é pública: dá para falar direto com o PostgREST e desviar de qualquer função.

**Falta rodar.** Não há Postgres, Docker nem Podman nesta máquina, então o SQL nunca foi
executado. A migration traz autoteste embutido (estoura o teto de propósito e confere que
barrou), e o projeto já tem a ferramenta certa:

```bash
./scripts/testar-migrations.sh 20261004      # precisa de docker ou podman
```

### 5. Telemetria — ✅ trava, 🔑 chaves

`EXPO_PUBLIC_SENTRY_DSN` e `EXPO_PUBLIC_POSTHOG_KEY` estavam vazias nos três perfis do
`eas.json`. O APK saía cego, e isso não quebra nada — é esse o problema. `npm run conferir`
agora reprova o build, e `npm run build:preview` / `build:producao` passam por ele antes de
chamar o `eas`. 5 testes garantem que a regra não seja afrouxada por descuido.

**Falta você:** colar as duas chaves no `eas.json` (e no `.env`, para o Expo Go). Hoje
`npm run conferir` sai com código 1 e lista exatamente as quatro pendências.

### 6. Teste instável — ✅

`mensagens.test.ts` comparava `expiraEm - criadoEm` com exatamente 24 h, mas eram duas
leituras separadas do relógio: um milissegundo entre elas e o teste falhava. Falhou numa
rodada com `--coverage` e passou na seguinte. Agora é uma leitura só.

---

## O que faltava para prender quem baixa

| # | Item | Estado | Onde |
| - | ---- | ------ | ---- |
| 7 | Feed "Para você" ranqueado | ✅ app · ⚠️ SQL | [`rankingDoFeed.ts`](../src/utils/rankingDoFeed.ts) · [`20261004130000_ranking_do_feed.sql`](../supabase/migrations/20261004130000_ranking_do_feed.sql) |
| 8 | Ficha da loja reposicionada | ✅ | [`PLAY_CONSOLE.md`](PLAY_CONSOLE.md) |

### 7. Ranking do feed — ✅ no app, ⚠️ SQL falta rodar

`feed_ids` terminava em `order by criado_em desc` para as duas abas: "Para você" era a aba
"Mais recente" com outro nome. Isso significa abrir o app duas vezes no mesmo dia e ver
exatamente a mesma coisa, vídeo bom de anteontem que nunca reaparece, e dois autores ativos
ocupando a tela inteira.

Agora:

```
qualidade = ln(1 + curtidas·3 + comentários·5 + compartilhamentos·8 + views·0,1)
frescor   = exp(-horas/24)
rodízio   = 0,7 ^ (n-1)        n = posição do vídeo entre os do mesmo autor
score     = (0,5 + qualidade) · frescor · rodízio
```

Materializado em `videos.feed_score`, recalculado a cada 5 min pelo `pg_cron`. Dois ajustes
por pessoa ficam na consulta: ×1,25 para a categoria escolhida no onboarding e **×100 para
o vídeo que você mesmo acabou de publicar, por 2 horas** — sem isso quem publica abre o
feed, não acha o próprio vídeo e conclui que o app perdeu; não há segunda tentativa.

"Seguindo" continua cronológica de propósito: quem abre aquela aba pediu uma coisa
específica, e reordenar seria desobedecer.

A mesma fórmula existe duas vezes — no Postgres e em TypeScript ([`rankingDoFeed.ts`](../src/utils/rankingDoFeed.ts))
— porque o modo demonstração não tem banco, e sem isso a tela que você vê no Expo Go seria
outro produto. **As duas precisam mudar juntas.** 12 testes cobrem a versão TS.

**Falta rodar** o mesmo `./scripts/testar-migrations.sh`. Atenção especial ao `grant`: o
`drop function` da versão antiga leva junto a permissão, e sem recriá-la o feed para de
carregar para todo mundo. A migration já recria — é a linha mais perigosa dela.

### 8. Ficha da loja — ✅

A descrição abria com "vídeos curtos da nação", que é a única parte do app que disputa
atenção direta com o TikTok — onde já existe conteúdo do Flamengo de sobra, com algoritmo
maduro e criadores grandes. Agora abre com o palpite: não existe em lugar nenhum, funciona
no primeiro dia com o feed vazio (quem gera conteúdo é o calendário, não os usuários) e tem
laço de convite fechado. O vídeo segura quem já veio; o palpite é o que traz.

---

## Verificação

```
tsc --noEmit    limpo
eslint src      limpo
jest            389 testes, 49 suítes, todos passando
```

Não executado nesta máquina, por falta de ferramenta: as duas migrations novas (sem
Postgres/Docker) e qualquer coisa que exija aparelho (Apple, push, câmera).

---

## Falta fazer

Em ordem. As estimativas são de trabalho, não de calendário.

| O que | Quanto | Depende de |
| ----- | ------ | ---------- |
| Rodar `./scripts/testar-migrations.sh` e depois `supabase db push` | 1 h | instalar Docker ou Podman |
| Colar as chaves de Sentry e PostHog nos perfis do `eas.json` | 15 min | criar as contas (grátis) |
| Ligar "Confirm email" no painel do Supabase | 5 min | — |
| Gerar o AAB e passar o checklist de `PLAY_CONSOLE.md` §5 | meio dia | — |
| Beta fechado de 30 pessoas **na semana de um jogo grande** | — | a data importa mais que a feature |
| Sign in with Apple ponta a ponta | meio dia | Apple Developer (US$ 99/ano) |

Fora deste pacote, e ainda de pé no [`ROADMAP.md`](../ROADMAP.md): CDN/transcodificação de
vídeo (Fase B), moderação automática de imagem (Fase D) e recomendação de verdade com
sinais por usuário (Fase C). Nenhum deles bloqueia o beta fechado.

### A decisão que ficou com você

Eu reposicionei a **ficha da loja** para o palpite, mas não mexi em qual aba o app abre —
isso muda a primeira tela de todo mundo e é chamada sua, não minha. Se concordar com o
reposicionamento até o fim, o app deveria abrir na Arquibancada (jogos/palpites) nos dias
de jogo e no feed nos outros. É meia hora de trabalho; só não quis tomar a decisão por você.
