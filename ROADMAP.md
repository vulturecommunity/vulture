# Roadmap — do MVP ao produto

O que falta para o Vulture virar um produto de verdade, em ordem de prioridade, com estimativa de
esforço e de custo. Os preços são de setembro/2026, em dólar (a maioria dos serviços cobra em USD),
e servem para dimensionar — não são orçamento fechado.

## Fase A — Fechar o básico de produção (2–3 semanas)

| Item                                                                        | O que fazer                                                                                                       | Por quê                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Development build + EAS**                                                 | `eas build` para Android/iOS, `eas update` para OTA. Perfis `development`, `preview`, `production` em `eas.json`. | Sair do Expo Go (lives reais, push, ícone próprio na tela). |
| **Confirmação de e-mail e recuperação de senha**                            | Ligar "Confirm email" no Supabase, tela "Esqueci minha senha" (`resetPasswordForEmail` + deep link `vulture://`). | Segurança básica de conta.                                  |
| **Login social**                                                            | Google e Apple via Supabase Auth (`signInWithIdToken`). Apple é obrigatório na App Store quando há login social.  | Conversão de cadastro.                                      |
| ~~**Termos de uso, privacidade e exclusão de conta**~~ **feito**             | Tela `configuracoes/conta/excluir`, Edge Function `excluir-conta` (apaga R2 + `auth.users`), trilha em `exclusoes_de_conta`. Textos de termos e privacidade atualizados para cobrir telemetria e direito de eliminação. | Exigência da App Store / Play Store.                        |
| **Curtir comentários, editar legenda, excluir comentário do próprio vídeo** | Colunas já existem; falta UI e RLS para o dono do vídeo apagar comentários.                                       | Completar o social.                                         |
| ~~**Métricas**~~ **feito**                                                  | PostHog em `src/services/telemetria`, com catálogo fechado de eventos (`EVENTOS`). Instrumentado: funil de cadastro, `push_registrado`, palpite, publicação e compartilhamento. Sem chave configurada, não envia nada. | Sem dado não há produto.                                    |
| ~~**Crash reporting**~~ **feito**                                           | Sentry na mesma camada, com `sendDefaultPii: false` e amostragem de 10%.                                           | Ver o que quebra no campo.                                  |

## Fase B — Vídeo em escala: CDN e transcodificação (3–4 semanas)

Hoje o arquivo gravado sobe como está (H.264 720p do celular, ~1–2 MB por 10 s) e é servido
direto do Supabase Storage. Isso quebra com volume: egress caro, sem adaptação de qualidade,
formatos diferentes entre iOS e Android.

**Plano recomendado:** trocar o destino do upload por um serviço de vídeo com transcodificação +
HLS + CDN, mantendo o Supabase como banco.

| Opção                                      | Como                                                                                                                                                                                                          | Custo aproximado                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Cloudflare Stream** (recomendado)        | Upload direto do app via _direct creator upload_ (URL assinada gerada por Edge Function). Ele transcodifica, gera thumbnail, HLS/DASH adaptativo e entrega pela CDN. O app só guarda o `uid` e monta as URLs. | US$ 5 por 1.000 minutos armazenados + US$ 1 por 1.000 minutos entregues. Sem cobrança de egress. |
| Mux                                        | Mesma ideia, mais recursos de analytics.                                                                                                                                                                      | ~US$ 0,0035/min entregue + armazenamento; plano gratuito de teste.                               |
| Próprio (FFmpeg em worker + Cloudflare R2) | Fila (Supabase Queues/pg_cron ou Cloud Run) roda `ffmpeg` gerando 480p/720p/1080p + HLS; R2 tem egress zero.                                                                                                  | R2: US$ 0,015/GB-mês; compute do worker. Mais trabalho de operação.                              |

Mudanças no código: novo método `uploadVideo` no `SupabaseDataService` (pedir URL de upload →
`UploadTask` → salvar `playback_url`/`thumbnail_url` retornados), `expo-video` já toca HLS.
Enquanto o vídeo processa, mostrar "Processando…" no perfil (webhook do provedor atualiza `videos.status`).

**Também nesta fase:** ~~compressão no aparelho antes do upload~~ **feita** — `src/services/midia/video.ts`
limita a 720p/~2 Mbps com `react-native-compressor`, roda antes do upload (o byte economizado nunca
sobe) e devolve o original no Expo Go, onde o módulo nativo não existe. Falta: retomada de upload (TUS)
para redes ruins; limite de 60 s já existe.

> **Revisão de custo (out/2026):** a projeção de US$ 300–420 a 10 k MAU nesta página assume Cloudflare
> Stream (US$ 165). Com o R2 atual, de egress zero, o mesmo cenário dá **US$ 93**. Stream compra
> qualidade adaptativa e transcodificação, não economia — a prioridade dele cai.

## Fase C — Recomendação e descoberta (4–6 semanas)

1. **Sinais**: registrar eventos por vídeo (`view` com tempo assistido, `complete`, `like`, `share`, `comment`, `skip` em < 2 s) numa tabela `events` particionada por dia (ou PostHog → warehouse).
2. **Ranking v1 (sem ML)**: score = curtidas·3 + comentários·5 + compartilhamentos·8 + views·0,1, com decaimento temporal (meia-vida 24 h) e _boost_ por interesses do usuário (categoria do vídeo ∈ interesses escolhidos no onboarding) e por hashtags que ele mais assiste. Materializar em `feed_scores` a cada 5 min (`pg_cron`).
3. **Personalização v2**: filtragem colaborativa leve (co-visualização "quem viu X viu Y") ou embeddings (`pgvector`) de legenda + hashtags + categoria; misturar 70% recomendado / 30% recente / 10% "seguindo".
4. **Diversidade e frescor**: no máximo 2 vídeos seguidos do mesmo autor; garantir vídeos novos (< 24 h) no topo para dar chance a criadores pequenos.
5. **A/B**: flag por usuário para comparar cronológico × recomendado (retenção D1/D7, tempo por sessão).

## Fase D — Moderação e segurança (2–3 semanas, contínuo)

| Item                     | O que fazer                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Painel de moderação**~~ **feito** | `painel/moderacao.html` (arquivo solto, sem build) + Edge Function `moderacao`, autenticada pelo `PAINEL_TOKEN`. A fila agrupa denúncias **por alvo**, não por denúncia: dez pessoas denunciando o mesmo vídeo é um caso. Ações: remover, suspender 7 dias, banir, descartar — todas registradas em `acoes_de_moderacao`. |
| **Moderação automática** | Ao publicar: extrair 3 frames (já temos thumbnail) → API de classificação (Cloudflare Workers AI, AWS Rekognition ou Sightengine ~US$ 29/mês) → conteúdo sexual/violento fica "em análise". Texto de legenda/comentários: lista de palavras + OpenAI Moderation (grátis). |
| **Rate limiting**        | Edge Function ou Postgres: máx. 10 comentários/min, 5 uploads/hora, 1 live ativa por usuário (já garantido).                                                                                                                                                              |
| **Bloqueio/denúncia**    | Já existe; adicionar "silenciar palavras", denúncia em lote e resposta ao denunciante.                                                                                                                                                                                    |
| **Direitos autorais**    | Termos claros (conteúdo do usuário), canal de DMCA, remoção rápida. Importante para um app de torcida: transmissões de jogos são protegidas — reforçar no onboarding e na moderação.                                                                                      |

## Fase E — Notificações push (1–2 semanas)

- `expo-notifications` + **Expo Push Service** (grátis, sem limite oficial de volume).
- Salvar o `ExpoPushToken` em `profiles.push_tokens` (array); trigger em `notifications` chama Edge Function que envia para `https://exp.host/--/api/v2/push/send` (lotes de 100).
- Preferências por tipo (curtida, comentário, seguidor, live começou) e silêncio noturno.
- "Fulano entrou ao vivo" para seguidores é a notificação mais valiosa para engajamento.

## Fase F — Lives em escala (2 semanas)

- LiveKit Cloud **Ship** (US$ 50/mês, 1 TB) ou **Scale**; _simulcast_ já é padrão; gravar a live (Egress) para virar vídeo no feed depois.
- Co-host (2 anfitriões), moderadores no chat, presentes/reações pagas (via RevenueCat).
- Chat por LiveKit Data Channels em vez de Postgres quando passar de ~2 k mensagens/min por live (o Realtime do Supabase tem limite de mensagens/mês).

## Fase G — Camada temática (contínuo)

- ~~**API de partidas**~~ **feito**: a Edge Function `atualizar-calendario` traz a temporada do
  Flamengo da Highlightly para `public.partidas`, com cache no aparelho para sobreviver a quedas de
  rede. `EXPO_PUBLIC_MATCH_DRIVER=mock` volta ao JSON local.
- ~~**Ranking mensal/anual com badges**~~ **feito**: pódio de palpiteiros do jogo, do mês e da
  temporada, apurado uma vez por partida (`apurar_partida`), com título do mês congelado no perfil
  e ligas privadas por código de convite.
- ~~**Push de lembrete e de resultado do palpite**~~ **feito**: `lembrar_palpites` (com o número
  social — "87.412 já palpitaram") e `avisar_resultado_dos_palpites`, os dois pela fila.
- Push de "gol!" durante o jogo, enquetes de escalação, "Torcedor do jogo".
- ~~**Divisões estilo Duolingo**~~ **feito**: Série D → Libertadores, grupos de 30, entrada automática
  ao palpitar, apuração no dia 1 pelo `pg_cron`. As faixas de subida e queda encolhem junto com o
  grupo (`vagas_no_grupo`), senão um grupo de 3 mostraria as três pessoas em zona de acesso — que é
  justamente o tamanho dos grupos agora. Funções do app: `meu_grupo()` e `minha_divisao()`.
- ~~**Card compartilhável do palpite**~~ **feito** (texto + Open Graph): `compartilharPalpite` e a rota
  `/palpite/<id>` na Edge Function `abrir`. O link aponta para o JOGO, não para o palpite de quem
  convidou — quem recebe precisa dar o próprio, que é o que fecha o laço. Falta a versão em imagem.
- Retrospectiva anual ("você cravou 6 de 47, terminou em 3.211º").
- Comunidades por região/embaixadas de torcida.

## Fase H — Monetização (depois de tração)

- Assinatura "Sócio Vulture" (RevenueCat; grátis até US$ 2,5 k/mês de receita): sem anúncios, badges, lives exclusivas.
- Anúncios nativos no feed (AdMob) a cada 8–10 vídeos.
- Presentes em lives (In-App Purchase) com split para criadores.

## Custos estimados por faixa de usuários (mensal, USD)

Premissas: usuário ativo assiste ~30 vídeos/dia (~0,5 GB/mês), 5% publicam 2 vídeos/semana de
15 s, 2% assistem lives 1 h/mês. Sem equipe/salários.

| Faixa (MAU)            | Banco/Auth (Supabase)                                                  | Vídeo (Cloudflare Stream)                                                                                     | Lives (LiveKit)                    | Push / erros / analytics              | Builds (EAS)                 | **Total aprox.**    |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------- | ---------------------------- | ------------------- |
| **até 1 mil** (piloto) | Free (0) — _ou_ Pro US$ 25 para não pausar                             | ~300 min armazenados + 15 k min entregues ≈ **US$ 20**                                                        | Build (0)                          | Free (0)                              | Free (0)                     | **US$ 20–45**       |
| **10 mil**             | Pro US$ 25 + ~US$ 20 de excedente (100 GB storage/egress) ≈ **US$ 45** | 3 k min armazenados + 150 k entregues ≈ **US$ 165**                                                           | Ship **US$ 50**                    | Sentry Team US$ 26, PostHog ~US$ 0–30 | Production US$ 99 (opcional) | **US$ 300–420**     |
| **100 mil**            | Pro + compute Medium/Large + egress ≈ **US$ 250–400**                  | 30 k min armazenados + 1,5 M entregues ≈ **US$ 1.650**                                                        | Scale **US$ 500** (5 TB)           | ~US$ 150                              | US$ 99                       | **US$ 2.700–2.900** |
| **1 milhão**           | Team/Enterprise + réplicas de leitura ≈ **US$ 2–4 k**                  | 300 k min armazenados + 15 M entregues ≈ **US$ 16.500** (negociar volume; ou R2 + FFmpeg próprio ≈ 40% disso) | Enterprise (negociado) ≈ US$ 3–5 k | ~US$ 1 k                              | US$ 99                       | **US$ 25–30 k**     |

Observações:

- **Vídeo é o custo dominante** a partir de 10 k usuários; por isso a Fase B vem antes da Fase C.
- Compressão no aparelho e limite de 60 s cortam esse custo pela metade.
- A partir de ~100 k usuários vale a pena o pipeline próprio (R2 + FFmpeg): egress zero do R2 é o maior ganho.
- Custos de loja: Apple Developer US$ 99/ano; Google Play US$ 25 uma vez.

## Fase I — Escala do banco ✅ (feito)

Os gargalos que estouravam no pico de um clássico foram fechados; o detalhe de cada escolha
está em [`DECISOES.md`](DECISOES.md), seção **Escala**.

| Gargalo | Como estava | Como ficou |
| --- | --- | --- |
| Placar ao vivo | 1 websocket Realtime por aparelho com o app aberto | Edge Function `placar` com `s-maxage=20`: ~3 consultas/min ao banco, com mil ou com um milhão |
| Curtidas/seguidores | `update ... + 1` travando a mesma linha | fila append-only + `consolidar_contadores` no pg_cron |
| Visualizações | 1 UPDATE por vídeo assistido (~3 M/dia a 100 k MAU) | lote no aparelho + `registrar_visualizacoes` |
| Notificações de curtida | 1 linha por curtida | 1 linha agrupada com contador |
| Explorar (trending, hashtags, ranking) | agregação da tabela inteira por request | matviews refrescadas a cada 5 min |
| Busca de perfil | `ilike '%x%'` sem índice utilizável | índice GIN `pg_trgm` |
| Feed "Seguindo" | todos os ids seguidos na querystring | RPC `feed_ids` com join no banco |
| Fan-out de push | 2 mil chamadas HTTP em série na Edge Function | fila `push_pendente` + worker paralelo |
| Retenção | nada era apagado | crons diários + limpeza de arquivos no Storage |

**O que ainda falta para a próxima ordem de grandeza:** particionar `notifications` e
`contador_pendente` por mês; réplica de leitura quando o Postgres passar de ~70% de CPU; e a
Fase B (vídeo em CDN), que continua sendo o custo dominante a partir de 10 k MAU.

## Ordem sugerida

1. ~~Fase I (escala do banco)~~ **feita** → 2. Fase A (produção básica) → 3. Fase B (vídeo) →
4. Fase D (moderação, antes de crescer) → 5. Fase C (recomendação, quando houver dados) →
6. Fases F/G/H.
