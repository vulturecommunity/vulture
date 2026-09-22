# Configurando o Supabase (backend real) — passo a passo para leigos

Tempo estimado: **15 minutos**. Custo: **R$ 0** (plano Free).

Você vai: criar uma conta, criar um projeto, rodar um script SQL, ativar login de visitante e
colar 2 chaves no app. Não precisa saber programar.

---

## 1. Criar a conta e o projeto

1. Abra **https://supabase.com** e clique em **Start your project** (canto superior direito).
2. Entre com **GitHub** ou com e-mail e senha. Confirme o e-mail se ele pedir.
3. Na tela inicial clique em **New project** (botão verde).
   - Se aparecer "Create a new organization", dê um nome qualquer (ex.: `vulture`) e clique **Create organization**.
4. Preencha:
   - **Name:** `vulture`
   - **Database Password:** clique em **Generate a password** e **copie para um lugar seguro** (você quase nunca vai precisar dela, mas guarde).
   - **Region:** `South America (São Paulo)` — mais perto, mais rápido.
   - **Pricing plan:** `Free`.
5. Clique em **Create new project** e espere 1–2 minutos até o projeto ficar verde ("Project is ready" / status _Active_).

## 2. Rodar o script do banco (tabelas, segurança e buckets)

1. No menu da esquerda, clique no ícone **SQL Editor** (um "terminal" com `>_`).
2. Clique em **+ New query** (ou "New snippet").
3. Abra o arquivo **`supabase/schema.sql`** deste projeto no seu computador, selecione **tudo** (Ctrl+A), copie (Ctrl+C) e cole na área de texto do SQL Editor (Ctrl+V).
4. Clique em **Run** (canto inferior direito) ou aperte **Ctrl+Enter**.
5. Deve aparecer **"Success. No rows returned"** embaixo. Se aparecer algum erro em vermelho, rode de novo — o script é idempotente (pode rodar várias vezes sem problema).

O que o script fez por você:

- Tabelas `profiles`, `videos`, `likes`, `comments`, `follows`, `saves`, `live_streams`, `live_messages`, `reports`, `blocks`, `notifications`, com índices e triggers de contadores.
- **RLS ativado em todas as tabelas** (leitura pública do feed; escrita só do dono).
- Buckets de Storage **`videos`**, **`thumbnails`** e **`avatars`** (públicos para leitura; cada usuário só escreve na própria pasta).
- Realtime ligado para o chat das lives.
- Coluna `profiles.email` preenchida automaticamente no cadastro (visível só no painel; o app não consegue ler nem alterar).
- **Nenhum dado fictício.** Se quiser 3 torcedores e 6 vídeos de demonstração para uma apresentação, rode também `supabase/seed-demo.sql` (e apague depois com `delete from auth.users where email like '%@vulture.demo'`).

Para conferir: menu **Table Editor** → você verá as tabelas; menu **Storage** → os 3 buckets.

## 3. Ativar o "Entrar como visitante" e desligar a confirmação de e-mail (opcional, recomendado para demo)

1. Menu da esquerda → **Authentication** → **Sign In / Providers** (ou "Providers").
2. Na seção **Email**, deixe **Enable Email provider** ligado e **desligue "Confirm email"** → **Save**.
   (Assim o cadastro entra na hora, sem precisar clicar no link do e-mail. Ligue de novo quando for para produção.)
3. Ainda em Providers (ou em **Authentication → Settings**), ative **Allow anonymous sign-ins** → **Save**.
   (É isso que faz o botão **"Entrar como visitante"** funcionar no driver Supabase.)

## 4. Copiar as chaves para o app

1. Menu da esquerda → **Project Settings** (engrenagem, lá embaixo) → **API** (ou **Data API**).
2. Copie:
   - **Project URL** — algo como `https://abcdefghijklmnop.supabase.co`
   - **anon public** key (em _Project API keys_) — um texto longo começando com `eyJ...`
     > Se seu painel mostrar "Publishable key" (`sb_publishable_...`) em vez de "anon", use ela: funciona do mesmo jeito.
3. No computador, na pasta do projeto, copie o arquivo `.env.example` para um novo arquivo chamado **`.env`** e edite:

```env
EXPO_PUBLIC_DATA_DRIVER=supabase
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ... (a chave anon/publishable)
```

4. Salve. **Nunca** coloque a chave `service_role` no app.

## 5. Rodar o app apontando para o Supabase

```bash
npx expo start -c
```

(o `-c` limpa o cache para o Expo ler o novo `.env`). Abra no Expo Go. Agora:

- **Criar conta** cria o usuário em _Authentication → Users_ e o perfil em `profiles` (via trigger).
- **Entrar como visitante** cria um usuário anônimo.
- **Publicar** envia o arquivo para o bucket `videos` (com barra de progresso real) e cria a linha em `videos`.
- **Curtir/comentar/seguir** atualizam contadores por triggers e geram linhas em `notifications`.
- O **chat da live** chega em tempo real pelo Realtime.

Para ver os dados: **Table Editor**. Para ver os arquivos: **Storage**. Para ver denúncias: tabela `reports`.

## 5b. Notificações de live (push) — "fulano está ao vivo"

Quando alguém que o usuário segue inicia uma live, os seguidores recebem uma notificação no
celular; tocar nela abre a transmissão. O envio é feito pela Edge Function `notificar-live`
(o app a chama logo depois de criar a live) usando o **Expo Push Service** (gratuito).

> **Sem o passo 0 abaixo, a notificação em tela (sino do app) continua funcionando, mas o
> aviso do sistema (banner/som fora do app) não chega** — o Android exige um projeto Firebase
> próprio para push remoto. É o único passo trabalhoso aqui; o resto é rápido.

### 0. Criar um projeto Firebase e conectar ao EAS (obrigatório para o banner do sistema)

1. Abra **https://console.firebase.google.com** → **Adicionar projeto** → dê um nome (ex.:
   `vulture`) → pode desligar o Google Analytics → **Criar projeto**.
2. Dentro do projeto, clique no ícone **Android** (⚙️ → *Adicionar app* → Android) e cadastre o
   pacote exatamente como está em `app.json` → `expo.android.package`: **`app.vulture.torcida`**.
   Não precisa preencher apelido nem SHA-1. Clique **Registrar app**.
3. Baixe o arquivo **`google-services.json`** que a tela oferece e coloque-o na **raiz do
   projeto** (mesma pasta do `app.json`). Pode pular o resto do assistente do Firebase (os
   passos de adicionar o SDK manualmente não se aplicam ao Expo).
4. No painel do Firebase, vá em **⚙️ Configurações do projeto → Contas de serviço** → aba
   **Firebase Admin SDK** → **Gerar nova chave privada**. Baixa um `.json` — **não** o coloque
   no Git (é secreto).
5. Envie essa chave para o EAS:
   ```bash
   npx eas-cli credentials
   ```
   Escolha **Android** → o perfil do app → **Push Notifications: Manage your FCM V1 key** →
   **Upload a new FCM V1 key** → aponte para o arquivo baixado no passo 4.
6. Diga que o arquivo existe para eu ligar o `googleServicesFile` no `app.json` (ou faça você
   mesmo: adicione `"googleServicesFile": "./google-services.json"` dentro de `expo.android`).
   **Sem essa linha o build ignora o arquivo e o push continua sem funcionar.**
7. Gere um **novo build** (`npx eas-cli build -p android --profile preview`) — sempre necessário
   depois de mudar configuração nativa como essa.

### Backend

1. Rode o `supabase/schema.sql` de novo (ele cria a tabela `push_tokens` e o tipo de
   notificação `live`; é idempotente).
2. Publique a função (mesmos passos do `SETUP_LIVEKIT.md`, seção 2, para `login` e `link`):
   ```bash
   npx supabase functions deploy notificar-live
   ```
   Ela usa apenas as variáveis que o Supabase já injeta (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`) — não precisa cadastrar segredos.
3. **Requisitos no aparelho:** push só funciona no **APK/development build** (o Expo Go no
   Android não recebe push desde o SDK 53). O app pede permissão de notificação no primeiro
   login e registra o token do aparelho em `push_tokens` — isso só dá certo depois do passo 0.
4. Teste com dois celulares: A segue B → B toca **Iniciar live** → A recebe
   "🔴 @b está ao vivo · título · Toque para assistir" → tocar abre a live.
5. (Opcional) Para volumes maiores, crie um _Access Token_ em https://expo.dev/settings/access-tokens
   e cadastre `npx supabase secrets set EXPO_ACCESS_TOKEN=...` — a função passa a autenticar no
   Expo Push Service (limites maiores). Isso não substitui o passo 0.

No **modo demo** (driver `mock`) não há servidor: ao iniciar uma live, a notificação aparece no
próprio aparelho, só para demonstrar o aviso e o toque que abre a live (não depende do Firebase).

## 6. Problemas comuns

| Sintoma                                 | Causa provável                                      | Solução                                                                                                                       |
| --------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| "Supabase não configurado"              | `.env` não foi lido                                 | confira o nome `.env` (sem `.txt`), rode `npx expo start -c`                                                                  |
| Erro ao entrar como visitante           | anonymous sign-ins desligado                        | passo 3                                                                                                                       |
| "Cadastro criado! Confirme o e-mail..." | Confirm email ligado                                | passo 3 (ou clique no link do e-mail)                                                                                         |
| Upload falha com 403                    | script SQL não rodou inteiro (políticas do Storage) | rode o `schema.sql` de novo                                                                                                   |
| Chat da live não atualiza sozinho       | Realtime não ligado na tabela                       | rode o `schema.sql` de novo e confira **Database → Publications → supabase_realtime** contém `live_messages` e `live_streams` |
| Vídeo do `seed-demo.sql` não toca       | o celular está sem internet                         | os clipes de exemplo vêm da internet                                                                                          |

## Limites do plano Free (setembro/2026)

- 500 MB de banco, **1 GB de Storage**, 5 GB de egress/mês, 50 mil usuários ativos/mês, 2 milhões de mensagens Realtime/mês.
- O projeto **pausa após 7 dias sem uso**; basta clicar em _Restore project_ no painel.
- 1 GB de Storage dá para ~100 vídeos de 10 MB. Para um piloto com mais gente, veja o `ROADMAP.md` (CDN de vídeo).
