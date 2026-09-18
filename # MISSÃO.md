# MISSÃO

Você é um engenheiro mobile sênior. Construa DO ZERO, nesta pasta, um aplicativo mobile funcional
estilo TikTok voltado para a torcida do Flamengo, chamado "VULTURE" (urubu, o mascote da torcida).
É um MVP de proposta comercial: o design pode ser simples, mas TODAS as funcionalidades precisam
funcionar de verdade e ser demonstráveis num celular real. Arquitetura pensada para escalar depois.

Identidade: nome do pacote/slug "vulture", tema escuro, vermelho #E30613 / preto #111 / branco.
Observação legal: é um app não oficial de torcedores. NÃO use escudo, logos ou marcas registradas
do clube. Crie um ícone próprio (silhueta de urubu estilizada em SVG/PNG, feita por você).
Deixe isso escrito no README.

# REGRAS DE EXECUÇÃO — LEIA ANTES DE TUDO

1. Trabalhe 100% autônomo. NÃO me faça perguntas no meio do caminho. Se houver ambiguidade,
   escolha a opção mais simples que funcione e registre a decisão em DECISOES.md.
2. Nada de "TODO", nada de tela vazia, nada de função que só dá console.log. Se está no menu, funciona.
3. Execute os comandos você mesmo, leia os erros e corrija até passar. Não me entregue código quebrado.
4. Critério de pronto: `npm run typecheck`, `npm run lint` e `npm test` rodam com ZERO erros, e o app
   inicia com `npx expo start` sem crash.
5. Commits pequenos e frequentes no git a cada fase concluída (`git add -A && git commit -m "..."`).
6. Use português do Brasil em toda a UI, comentários e documentação.
7. Ambiente: Windows + PowerShell. Nunca use `&&` para encadear comandos; rode um por vez ou use `;`.
8. Se uma biblioteca falhar ou for incompatível com o SDK atual, troque por outra e registre em DECISOES.md.
9. Ao final de cada FASE, imprima um checklist do que ficou pronto e siga para a próxima sem parar.

# STACK OBRIGATÓRIA (100% gratuita)

- Expo SDK mais recente estável + React Native + TypeScript (strict)
- Expo Router (navegação por arquivos, com tabs)
- Zustand (estado global) + TanStack Query (cache/servidor)
- @shopify/flash-list (feed performático)
- expo-camera (gravar vídeo/foto), expo-video (playback), expo-image-picker, expo-media-library
- expo-image, expo-haptics, react-native-gesture-handler, react-native-reanimated
- Supabase (Postgres + Auth + Storage + Realtime) via @supabase/supabase-js
- LiveKit (@livekit/react-native) para transmissão ao vivo
- Jest + @testing-library/react-native para testes unitários/componentes
- ESLint + Prettier
  Antes de instalar, verifique na documentação oficial do Expo qual é o SDK estável atual e quais
  versões das libs são compatíveis com ele (use `npx expo install` sempre, nunca `npm install` direto
  para libs nativas).

# ARQUITETURA DE DADOS EM DOIS DRIVERS (crítico para o MVP)

Toda a camada de dados deve ficar atrás de UMA interface (`src/services/data/types.ts`) com duas
implementações intercambiáveis por variável de ambiente `EXPO_PUBLIC_DATA_DRIVER`:

- `mock` → dados locais em AsyncStorage + 12 vídeos de exemplo (use vídeos livres de direitos,
  ex.: arquivos de teste públicos do Google/Big Buck Bunny, ou gere clipes coloridos
  localmente). Upload salva no dispositivo. TUDO funciona offline, sem cadastro em nada.
- `supabase` → implementação real contra o Supabase.

O app DEVE abrir e funcionar 100% no driver `mock` logo após `npx expo start`, sem eu configurar
nada. Esse é o modo de demonstração. O driver supabase liga só com as chaves no .env.

# FASES

## FASE 0 — Ambiente

- Confirme Node >= 20. Crie o projeto Expo com TypeScript + Expo Router nesta pasta, nome "vulture".
- Configure ESLint, Prettier, path aliases (@/), jest-expo, e scripts npm:
  `start`, `android`, `ios`, `typecheck`, `lint`, `test`, `test:watch`.
- Crie .env.example e .gitignore corretos.

## FASE 1 — Fundação visual e navegação

- Design tokens (cores, espaçamentos, tipografia) em src/theme. Tema escuro por padrão.
- Tabs inferiores: Feed (Início) | Explorar | [+ Gravar] | Lives | Perfil.
- Componentes base: Botao, Avatar, Input, Sheet, EstadoVazio, Carregando, Erro.

## FASE 2 — Camada de dados

- Interface DataService com: auth, listFeed, getVideo, uploadVideo, like/unlike, comments,
  follow/unfollow, getProfile, updateProfile, listLives, createLive, report.
- Implemente MockDataService completo e SupabaseDataService completo.
- Testes unitários cobrindo o MockDataService.

## FASE 3 — Autenticação

- Login/cadastro por e-mail e senha + "entrar como visitante" (modo demo).
- Onboarding curto: escolher apelido, foto e 3 interesses
  (Jogos, Bastidores, Torcida, Memes, Análises).
- Sessão persistida; rotas protegidas.

## FASE 4 — FEED VERTICAL (o coração do app)

- Scroll vertical de tela cheia com snap, autoplay do vídeo visível, pause dos demais,
  pré-carregamento do próximo, mute/unmute com toque, duplo toque = curtir com animação.
- Overlay: @usuario, legenda, hashtags clicáveis, música/áudio, botões laterais
  (curtir, comentar, salvar, compartilhar via Share nativo).
- Abas no topo: "Para Você" e "Seguindo".
- Deve rodar liso com 100+ itens (use FlashList + memo + limitar players simultâneos).

## FASE 5 — Criação de conteúdo

- Tela de câmera: gravar vídeo (até 60s) com botão de pressionar e segurar, contador, alternar
  câmera frontal/traseira, flash, e importar da galeria. Também tirar foto (foto vira post estático
  com duração de 5s no feed).
- Preview com opção de refazer, adicionar legenda, hashtags e escolher categoria.
- Upload com barra de progresso real, geração de thumbnail, e publicação no feed.
- Funciona nos dois drivers (no mock, salva local).

## FASE 6 — Social

- Curtidas, comentários (com respostas em 1 nível), seguir/deixar de seguir.
- Perfil: grade de vídeos do usuário, contadores, editar perfil, aba "Curtidos".
- Explorar: busca por usuário e hashtag + grade de trending.
- Notificações locais em tela (lista de eventos: curtiu, comentou, seguiu).
- Denunciar/bloquear conteúdo (requisito para lojas de app).

## FASE 7 — LIVES

- Tela "Lives": lista de transmissões ativas com thumbnail e contador de espectadores.
- Assistir live (player LiveKit) + chat em tempo real (Supabase Realtime no driver supabase,
  local no mock) + corações flutuantes.
- Iniciar live: título, preview da câmera, botão "Entrar ao vivo", encerrar.
- IMPORTANTE: LiveKit não funciona no Expo Go. Então:
  a) implemente de verdade com @livekit/react-native para uso em development build;
  b) detecte em runtime se o módulo nativo está disponível; se não estiver, ative
  automaticamente o "modo live simulada" (usa a câmera local como preview + chat funcional),
  exibindo um aviso discreto. Assim a demo nunca quebra;
  c) documente no README o comando exato do development build local gratuito
  (`npx expo run:android`) e como gerar as chaves LiveKit Cloud (plano Build, grátis).

## FASE 8 — Camada temática (o diferencial)

- Barra de canais/hashtags no topo do Explorar: #Maracanã #Bastidores #Golaço #Torcida #Base #Resenha.
- Card de "Próximo jogo" e "Último resultado" no topo do feed, alimentado por um serviço
  `MatchService` com dados mockados em JSON local + interface pronta para plugar uma API real depois
  (deixe o adaptador e um TODO documentado no ROADMAP, não implemente API paga).
- Reações temáticas (🔴⚫🦅🏆) no lugar do like simples na tela de live.
- Ranking semanal de torcedores (por curtidas recebidas) na tela Explorar.

## FASE 9 — Testes (obrigatório, é MVP de proposta)

- Testes unitários: MockDataService, stores Zustand, formatadores, hooks.
- Testes de componente: card do feed, botão de curtir, tela de login, tela de comentários.
- Mínimo 25 testes passando, cobertura >= 60% em src/services e src/components.
- Crie `TESTE_MANUAL.md`: roteiro numerado de 15 passos que qualquer pessoa segue no celular para
  validar todas as funcionalidades, com o resultado esperado de cada passo.

## FASE 10 — Entrega

Gere estes arquivos:

- README.md — o que é, arquitetura, como rodar em 3 comandos, requisitos, limitações.
- SETUP_SUPABASE.md — passo a passo com cliques para criar a conta grátis, criar o projeto,
  rodar o SQL, criar os buckets e colar as chaves no .env. Escrito para leigo.
- SETUP_LIVEKIT.md — mesma coisa para as lives.
- DECISOES.md — decisões técnicas e trade-offs.
- ROADMAP.md — o que falta para virar produto: CDN de vídeo, transcodificação, algoritmo de
  recomendação, moderação, push notifications, custos estimados por faixa de usuários.
- supabase/schema.sql — script único e idempotente.

# BANCO DE DADOS (schema.sql)

Tabelas: profiles, videos, likes, comments, follows, saves, live_streams, live_messages, reports.
Requisitos: chaves estrangeiras, índices nos campos de ordenação/busca, triggers para manter
contadores (likes_count, comments_count, followers_count), RLS ativado em TODAS as tabelas com
políticas corretas (leitura pública do feed, escrita só do dono), e buckets de Storage
`videos`, `thumbnails`, `avatars` com políticas. Inclua seed de dados de exemplo.

# CRITÉRIOS DE ACEITE (valide um por um antes de me entregar)

[ ] `npx expo start` sobe e o app abre no Expo Go sem nenhuma configuração minha
[ ] Feed rola vertical com vídeos tocando automaticamente e sem travar
[ ] Consigo gravar um vídeo pela câmera, publicar e ver ele no feed e no meu perfil
[ ] Curtir, comentar, seguir e salvar persistem depois de fechar e abrir o app
[ ] Busca por hashtag e por usuário retorna resultados
[ ] Tela de live abre, chat funciona, e o modo simulado ativa sozinho no Expo Go
[ ] Login, cadastro, logout e modo visitante funcionam
[ ] typecheck, lint e test passam com zero erros
[ ] Trocar EXPO_PUBLIC_DATA_DRIVER para supabase faz o app usar o backend real sem mudar código

# RELATÓRIO FINAL

Ao terminar, imprima: (1) o checklist acima marcado, (2) os comandos exatos que eu devo rodar para
ver o app no meu celular, (3) o que ficou fora do escopo e por quê, (4) os limites dos planos
gratuitos usados. Comece agora pela FASE 0.
