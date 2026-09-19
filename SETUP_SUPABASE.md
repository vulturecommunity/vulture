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

## 2. Rodar o script do banco (tabelas, segurança, buckets e dados de exemplo)

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
- 3 perfis de exemplo (`nacao@vulture.demo`, `gavea@vulture.demo`, `maraca@vulture.demo` — senha `vulture123`), 6 vídeos e 1 live.

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

## 6. Problemas comuns

| Sintoma                                 | Causa provável                                      | Solução                                                                                                                       |
| --------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| "Supabase não configurado"              | `.env` não foi lido                                 | confira o nome `.env` (sem `.txt`), rode `npx expo start -c`                                                                  |
| Erro ao entrar como visitante           | anonymous sign-ins desligado                        | passo 3                                                                                                                       |
| "Cadastro criado! Confirme o e-mail..." | Confirm email ligado                                | passo 3 (ou clique no link do e-mail)                                                                                         |
| Upload falha com 403                    | script SQL não rodou inteiro (políticas do Storage) | rode o `schema.sql` de novo                                                                                                   |
| Chat da live não atualiza sozinho       | Realtime não ligado na tabela                       | rode o `schema.sql` de novo e confira **Database → Publications → supabase_realtime** contém `live_messages` e `live_streams` |
| Vídeo do seed não toca                  | o celular está sem internet                         | os clipes de exemplo vêm da internet                                                                                          |

## Limites do plano Free (setembro/2026)

- 500 MB de banco, **1 GB de Storage**, 5 GB de egress/mês, 50 mil usuários ativos/mês, 2 milhões de mensagens Realtime/mês.
- O projeto **pausa após 7 dias sem uso**; basta clicar em _Restore project_ no painel.
- 1 GB de Storage dá para ~100 vídeos de 10 MB. Para um piloto com mais gente, veja o `ROADMAP.md` (CDN de vídeo).
