# VULTURE 🦅

App mobile estilo TikTok para a torcida rubro-negra: feed vertical de vídeos, gravação pela câmera,
curtidas, comentários, perfis, explorar por hashtags, lives com chat em tempo real e uma camada
temática (próximo jogo, ranking de torcedores, canais da torcida).

> **Aviso legal:** o Vulture é um app **não oficial, feito por torcedores**. Não tem vínculo com o
> clube e **não usa escudo, logotipos, uniformes nem marcas registradas**. O ícone é uma silhueta
> própria de urubu (`assets/images/urubu.svg`), gerada por `scripts/gerar-icones.js`.

## Como rodar em 3 comandos

```bash
npm install
npx expo start
# leia o QR code com o app Expo Go (Android) ou a câmera (iOS)
```

Pronto. O app abre no **modo demonstração** (`EXPO_PUBLIC_DATA_DRIVER=mock`): tudo funciona
offline, sem cadastro em nenhum serviço. Toque em **"Entrar como visitante"** e use.

Requisitos: Node 20+ (testado com 24), npm 10+, celular com o app **Expo Go** (mesma rede Wi-Fi
do computador) — ou emulador Android / simulador iOS.

> Se o QR code não conectar, a rede provavelmente isola os aparelhos (Wi-Fi "público" ou de
> empresa). Use `npx expo start --tunnel`, que passa por fora da rede local.

### Clonando em outro computador

```bash
git clone https://github.com/InacioWork/vulture.git
cd vulture
npm install
npx expo start        # ou --tunnel, se o QR não conectar
```

Não precisa de Android Studio nem Xcode para o dia a dia: o app roda no Expo Go. Só o `npm install`
e pronto — o repositório já traz `package-lock.json`, `google-services.json` e os ícones.

**Um arquivo não vem no repositório: o `.env`** (fica de fora por higiene). Sem ele o app abre no
modo demonstração, que funciona sozinho. Para ligar no Supabase de verdade, crie o `.env` a partir
do `.env.example` — os valores reais do projeto estão no `eas.json`, no perfil `preview`:

```bash
cp .env.example .env     # no Windows: copy .env.example .env
# troque EXPO_PUBLIC_DATA_DRIVER para "supabase" e cole a URL e a anon key do eas.json
```

## O que está pronto

| Área         | Funcionalidades                                                                                                                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação | login/cadastro por e-mail e senha, visitante (demo), onboarding (foto, apelido, 3 interesses), sessão persistida, rotas protegidas                                                                                                                                                                                                                  |
| Feed         | scroll vertical com snap, autoplay do item visível, pré-carregamento do próximo, mute por toque, duplo toque = curtir animado, overlay (@usuário, legenda, hashtags clicáveis, áudio), painel de vidro com barra de ações (curtir, comentar, salvar, compartilhar nativo, mais), seletor _Para você_ / _Seguindo_, 120 vídeos de exemplo sem travar |
| Criação      | câmera com pressionar-e-segurar (até 60 s, contador e barra), frontal/traseira, flash/tocha, foto (post de 5 s), importar da galeria, preview com refazer, legenda + hashtags + categoria, upload com **progresso real**, thumbnail automática, opção de salvar na galeria                                                                          |
| Social       | curtidas, comentários com respostas em 1 nível, seguir/deixar de seguir, perfil (grade, contadores, curtidos, salvos, editar), explorar (busca por usuário e hashtag, trending, hashtags em alta), notificações em tela, denunciar/bloquear (requisito das lojas)                                                                                   |
| Lives        | lista de lives ativas com espectadores, assistir + chat em tempo real + reações 🔴⚫🦅🏆 flutuantes, iniciar/encerrar live com preview da câmera. **LiveKit de verdade** em development build; **modo simulado automático** no Expo Go                                                                                                              |
| Temático     | barra de canais (#Maracanã #Bastidores #Golaço #Torcida #Base #Resenha), faixa com **último resultado e próximo jogo reais do Flamengo** (TheSportsDB, com AO VIVO quando a bola rola), ranking semanal de torcedores                                                                                                                               |
| Mensagens    | caixa de entrada com conversas privadas, chat em tempo real com balões e separadores por dia, regra de quem pode te chamar (quem você segue / seus seguidores), novos seguidores com data, "adicionar torcedores" com sugestões por afinidade                                                                                                       |
| Rasantes     | vídeo de até 15 s que some em 24 h, fileira no topo das mensagens, anel no avatar do perfil, visualizador em tela cheia                                                                                                                                                                                                                             |
| Qualidade    | TypeScript strict, ESLint, Prettier, 154 testes (Jest + Testing Library), roteiro de teste manual                                                                                                                                                                                                                                                   |

## Arquitetura

```
src/
  app/                 rotas (Expo Router): (auth)/, (tabs)/, criar/, live/, video/[id], usuario/[id], hashtag/[tag]...
  components/          ui/ (Botao, Avatar, Input, Sheet, EstadoVazio, Carregando, Erro), feed/, comentarios/, lives/, perfil/, explorar/...
  hooks/               TanStack Query + lógica de tela (useFeed, useInteracoes, useLive, usePublicar...)
  stores/              Zustand: authStore, playerStore, uiStore, criacaoStore
  services/
    data/              DataService (types.ts) + drivers: mock/ (AsyncStorage) e supabase/ (Postgres/Auth/Storage/Realtime)
    live/              detecção do LiveKit em runtime, tokens, modo simulado
    partidas/          MatchService (TheSportsDB real + JSON local de reserva)
    midia/             arquivos locais e thumbnails
  theme/ constants/ types/ utils/
supabase/schema.sql    script idempotente: tabelas, índices, triggers, RLS, buckets (sem dados fictícios)
supabase/seed-demo.sql dados de demonstração opcionais (3 perfis, 6 vídeos, 1 live)
supabase/functions/    Edge Function que gera tokens do LiveKit
```

### Dois drivers de dados, uma interface

Toda a camada de dados fica atrás de **`src/services/data/types.ts` (`DataService`)**. A
implementação é escolhida por variável de ambiente, sem mudar código:

| `EXPO_PUBLIC_DATA_DRIVER` | Implementação         | Onde os dados ficam                                                                 |
| ------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `mock` (padrão)           | `MockDataService`     | AsyncStorage + arquivos do aparelho. 8 perfis, 120 vídeos, 3 lives, chat com "bots" |
| `supabase`                | `SupabaseDataService` | Postgres + Auth + Storage + Realtime do seu projeto Supabase (grátis)               |

Para ligar o backend real: copie `.env.example` para `.env`, preencha as chaves (passo a passo em
[`SETUP_SUPABASE.md`](SETUP_SUPABASE.md)) e rode `npx expo start -c`.

### Lives

`@livekit/react-native` precisa de módulos nativos que **não existem no Expo Go**. O app detecta
isso em runtime (`src/services/live/livekit-nativo.ts`): se o módulo existe **e** as chaves estão
no `.env`, usa o LiveKit; senão ativa o **modo live simulada** (câmera local como preview + chat e
reações funcionando) e mostra um aviso discreto. Para lives reais é preciso um **development build**:

```bash
npx expo run:android      # build local gratuito (precisa de Android Studio + JDK 17)
```

Passo a passo das chaves em [`SETUP_LIVEKIT.md`](SETUP_LIVEKIT.md).

### Distribuir para testadores (APK Android via EAS Build)

O `eas.json` já tem o perfil **`preview`**, que gera um `.apk` instalável ligado ao Supabase (as
variáveis `EXPO_PUBLIC_*` ficam embutidas; a chave anon é pública por design, o RLS protege o banco).

```bash
npx eas-cli login                                              # conta Expo (grátis)
npx eas-cli build -p android --profile preview --non-interactive
```

Ao terminar, o painel em https://expo.dev mostra um link/QR code do APK: mande para quem for
testar; a pessoa baixa, permite "instalar de fontes desconhecidas" e abre — sem Expo Go e sem o
seu PC ligado. Como o APK inclui os módulos nativos do LiveKit, basta preencher as chaves do
`SETUP_LIVEKIT.md` no perfil `preview` do `eas.json` para as lives saírem do modo simulado.

iOS exige o Apple Developer Program (US$ 99/ano) e distribuição por TestFlight; por isso o piloto
é só Android.

#### Tamanho do APK

O primeiro APK saiu com **177 MB**, e 80% disso era biblioteca nativa:

| O que                      | Quanto pesava | Por quê                                               |
| -------------------------- | ------------- | ----------------------------------------------------- |
| `lib/x86` + `lib/x86_64`   | 82 MB         | arquiteturas de **emulador**; nenhum celular usa      |
| `lib/armeabi-v7a`          | 24 MB         | ARM de 32 bits; a Play Store exige 64 bits desde 2019 |
| ML Kit de código de barras | ~20 MB        | vem no `expo-camera`; o Vulture nunca lê códigos      |

Dois detalhes desta versão do Expo/RN fizeram a primeira tentativa não surtir efeito, e
valem como aviso para quem for mexer aqui:

1. **Não adianta escrever `abiFilters` no `build.gradle`.** O plugin gradle do React Native
   roda depois e faz `defaultConfig.ndk.abiFilters.addAll(reactNativeArchitectures)` — ou seja,
   ele **soma** as arquiteturas de volta. A única chave que funciona é a propriedade
   `-PreactNativeArchitectures`.
2. **O `expo-camera` vem pré-compilado** do cache Maven do EAS, então o `build.gradle` dele
   (onde a flag do leitor de códigos é lida) nunca era avaliado. Por isso o
   `expo.autolinking.buildFromSource` no `package.json`: força esse módulo a compilar do
   código-fonte para a flag valer.

O perfil `preview` empacota só `arm64-v8a` e desliga o leitor de códigos; o perfil
`production` gera um `.aab` **com todas as arquiteturas**, porque quem fatia por aparelho é a
Play Store e cada pessoa baixa só a sua.

> Emulador x86 precisa de um build próprio: troque `-PreactNativeArchitectures` para `x86_64`.

O que ainda pesa, se precisar apertar mais: **WebRTC do LiveKit (11,5 MB)**, necessário para as
lives reais, e o **código Java/Kotlin (~18 MB)**, que o R8 encolheria com
`-Pandroid.enableMinifyInReleaseBuilds=true` — ganho de ~7 MB, mas exige testar no aparelho,
porque o R8 pode remover código chamado por reflexão.

## Scripts

| Comando                                                     | O que faz                   |
| ----------------------------------------------------------- | --------------------------- |
| `npm start` / `npx expo start`                              | inicia o Metro (Expo Go)    |
| `npm run android` / `npm run ios`                           | abre no emulador/simulador  |
| `npm run typecheck`                                         | `tsc --noEmit`              |
| `npm run lint`                                              | ESLint (`expo lint`)        |
| `npm test` / `npm run test:watch` / `npm run test:coverage` | Jest                        |
| `node scripts/gerar-icones.js`                              | regenera os ícones do urubu |

## Variáveis de ambiente

Veja `.env.example`. Só `EXPO_PUBLIC_DATA_DRIVER` é lida no modo demo; as demais são necessárias
apenas para `supabase` e para lives reais. Variáveis `EXPO_PUBLIC_*` são embutidas no bundle —
nunca coloque segredos nelas (a API Secret do LiveKit fica só na Edge Function).

## Limitações conhecidas (MVP)

- **Vídeos de exemplo** são clipes públicos de teste (Big Buck Bunny, Sintel, Jellyfish, CC0 do MDN)
  servidos pela internet; as miniaturas de exemplo são fotos aleatórias (Lorem Picsum). O celular
  precisa de internet para vê-los; os vídeos **que você grava** ficam no aparelho.
- Sem transcodificação/CDN: os vídeos são reproduzidos no formato em que foram gravados.
- Feed "Para Você" é cronológico (sem algoritmo de recomendação).
- Push funciona no APK (Firebase/FCM configurado); no Expo Go do Android o push remoto não existe.
- Lives no Expo Go são simuladas (limitação do Expo Go, não do app).
- Dados do jogo vêm da TheSportsDB (chave de teste pública); `EXPO_PUBLIC_MATCH_DRIVER=mock` volta
  ao JSON local.
- Moderação de denúncias é manual (tabela `reports` no painel do Supabase).

O que falta para virar produto está em [`ROADMAP.md`](ROADMAP.md); as decisões técnicas em
[`DECISOES.md`](DECISOES.md); o roteiro de validação no celular em [`TESTE_MANUAL.md`](TESTE_MANUAL.md).

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript 6 (strict) · Expo Router · Zustand · TanStack Query ·
@shopify/flash-list · expo-camera · expo-video · expo-image-picker · expo-media-library · expo-image ·
expo-haptics · react-native-gesture-handler · react-native-reanimated · Supabase JS · LiveKit RN ·
Jest + @testing-library/react-native · ESLint + Prettier. Tudo com planos gratuitos.
