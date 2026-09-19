# Configurando lives reais com LiveKit — passo a passo para leigos

Tempo estimado: **30–40 minutos** (a maior parte é instalar o Android Studio). Custo: **R$ 0**
(LiveKit Cloud plano _Build_, gratuito).

## Por que isso é necessário?

No **Expo Go** as lives rodam em **modo simulado** (o app avisa na tela): você vê sua própria
câmera, o chat e as reações funcionam, mas o vídeo não sai do seu celular. Isso acontece porque o
LiveKit usa WebRTC, um módulo nativo que o Expo Go não traz. Para transmitir de verdade o app
precisa ser compilado com esse módulo — um **development build**. O código já está pronto; o app
detecta sozinho quando o módulo existe e sai do modo simulado.

Você vai: (1) criar um projeto grátis no LiveKit Cloud, (2) publicar a função que gera tokens no
Supabase, (3) colocar 2 linhas no `.env`, (4) gerar o build. **Pré-requisito:** ter feito o
`SETUP_SUPABASE.md`.

---

## 1. Criar o projeto no LiveKit Cloud (grátis)

1. Abra **https://cloud.livekit.io** e clique em **Sign up** (GitHub ou Google).
2. Clique em **Create project** (ou "New project"). Nome: `vulture`. Região: a mais próxima (ex.: _South America_).
3. Com o projeto aberto, vá em **Settings** (engrenagem) → **Keys** → **Create key** (ou "+ Add key").
   - Descrição: `vulture-app` → **Generate**.
4. Uma janela vai mostrar 3 valores — **copie os três agora** (o _Secret_ não aparece de novo):
   - **WebSocket URL** — algo como `wss://vulture-abc123.livekit.cloud`
   - **API Key** — algo como `APIxxxxxxxxxxxx`
   - **API Secret** — um texto longo

> A **API Secret nunca vai para o app**. Ela fica só no servidor (Edge Function), que assina os tokens.

## 2. Publicar a função que gera tokens (Supabase Edge Function)

O arquivo já está pronto em `supabase/functions/livekit-token/index.ts`. Só falta enviar para o seu
projeto Supabase e cadastrar os segredos.

1. Abra um terminal na pasta do projeto e faça login no Supabase CLI (abre o navegador para autorizar):
   ```bash
   npx supabase login
   ```
2. Descubra a **Reference ID** do projeto: no painel do Supabase → **Project Settings** → **General** → _Reference ID_ (ex.: `abcdefghijklmnop`). Ligue a pasta ao projeto:
   ```bash
   npx supabase link --project-ref abcdefghijklmnop
   ```
   (ele pode pedir a senha do banco que você guardou no passo 1 do SETUP_SUPABASE.)
3. Cadastre os segredos (troque pelos seus valores do passo 1):
   ```bash
   npx supabase secrets set LIVEKIT_URL=wss://vulture-abc123.livekit.cloud LIVEKIT_API_KEY=APIxxxxxxxxxxxx LIVEKIT_API_SECRET=coloque-o-secret-aqui
   ```
4. Publique a função:
   ```bash
   npx supabase functions deploy livekit-token
   ```
5. No painel → **Edge Functions** você deve ver `livekit-token` com status _Active_. A URL dela é:
   `https://SEU-PROJETO.supabase.co/functions/v1/livekit-token`

A função valida o usuário logado (JWT do Supabase), confere na tabela `live_streams` se ele é o
anfitrião da sala (só o anfitrião pode publicar vídeo) e devolve um token válido por 2 horas.

## 3. Colocar as chaves no app

No arquivo `.env` (criado no SETUP_SUPABASE) acrescente:

```env
EXPO_PUBLIC_LIVEKIT_URL=wss://vulture-abc123.livekit.cloud
EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT=https://SEU-PROJETO.supabase.co/functions/v1/livekit-token
```

## 4. Gerar o development build (Android, local e gratuito)

### 4a. Instalar o que falta (uma vez só)

1. **JDK 17**: https://adoptium.net → _Temurin 17 (LTS)_ → instale.
2. **Android Studio**: https://developer.android.com/studio → instale com as opções padrão. Ao abrir, em _More Actions → SDK Manager_ confirme que **Android SDK Platform 35** (ou a mais recente) e **Android SDK Build-Tools** estão marcados → _Apply_.
3. Variável de ambiente `ANDROID_HOME` apontando para a pasta do SDK (no Windows normalmente `C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk`). No PowerShell:
   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   ```
   Feche e abra o terminal de novo.
4. No celular Android: **Configurações → Sobre o telefone → toque 7 vezes em "Número da versão"** para liberar as _Opções do desenvolvedor_; depois em _Opções do desenvolvedor_ ative **Depuração USB**. Conecte o cabo USB e aceite o aviso no celular.

### 4b. Compilar e instalar

Na pasta do projeto:

```bash
npx expo run:android
```

Na primeira vez demora 5–15 minutos (baixa o Gradle e compila o WebRTC). Ao terminar, o app
**Vulture** (ícone do urubu) é instalado no celular e abre sozinho conectado ao Metro. A partir daí,
`npx expo start` + abrir o app instalado (em vez do Expo Go) recarrega o JS na hora.

> **Sem Android Studio?** Use a nuvem gratuita da Expo:
> `npm install -g eas-cli` → `eas login` → `eas build --profile development --platform android`
> (o plano Free da EAS tem uma cota mensal de builds). Baixe o `.apk` gerado e instale no celular.

> **iPhone:** `npx expo run:ios` exige um Mac com Xcode. Ou `eas build --profile development --platform ios` (precisa de conta Apple Developer).

## 5. Testar

1. Abra o app instalado (não o Expo Go). Vá em **Lives**: o aviso "Modo live simulada" **não deve aparecer**.
2. **Iniciar live** → título → **Entrar ao vivo**. No canto aparece o selo _LiveKit_.
3. Em **outro celular** (pode ser no Expo Go em modo simulado para o chat, ou outro dev build para ver o vídeo), entre na mesma conta ou em outra e abra a live na aba **Lives**: o vídeo da câmera do anfitrião aparece com 1–2 s de atraso e o chat é compartilhado.
4. No painel do LiveKit Cloud → **Sessions** você vê a sala, os participantes e o consumo.

## 6. Problemas comuns

| Sintoma                                          | Solução                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Aviso "Modo live simulada" continua no dev build | confira as 2 variáveis no `.env` e rode `npx expo start -c`; confira que abriu o app **Vulture**, não o Expo Go       |
| "Falha ao obter token da live (401)"             | a Edge Function não recebeu o JWT: entre com uma conta (o visitante anônimo também vale) e confira o deploy da função |
| "Falha ao obter token da live (500)"             | segredos não cadastrados: repita o passo 2.3 e faça o deploy de novo                                                  |
| Build falha com "SDK location not found"         | `ANDROID_HOME` não configurado (passo 4a.3)                                                                           |
| Build falha por memória                          | feche o Android Studio e rode de novo; ou use `eas build`                                                             |
| Espectador não vê vídeo                          | o anfitrião precisa estar num dev build (Expo Go não publica vídeo)                                                   |

## Limites do plano Build (gratuito) do LiveKit Cloud — setembro/2026

- **50 GB** de tráfego por mês, **100 participantes simultâneos**, **5.000 minutos de conexão/mês**, sem cartão de crédito.
- Um espectador em 720p consome ~1 GB/hora → dá para cerca de 50 horas de audiência por mês. Para além disso, o plano _Ship_ custa US$ 50/mês (ver `ROADMAP.md`).
