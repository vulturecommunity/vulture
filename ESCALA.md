# Escala — o que usar em cada camada, e quando trocar

Este documento existe por um motivo concreto: o projeto **já foi bloqueado uma vez** por
estourar cota sem aviso. Foram 27 GB de egress servidos a partir de 65 MB de arquivos,
com 18 usuários — e a descoberta só veio quando o app parou de funcionar.

A lição não foi "escolhemos o serviço errado". Foi que **custo de mídia não é o quanto
você guarda, é quantas vezes cada byte sai** — e que o que não é medido vira surpresa.

---

## A ideia central: não existe "um backend"

Num app de vídeo, custo e trabalho se distribuem de forma muito desigual:

| Camada | ~% do custo | ~% do trabalho de manutenção |
| --- | --- | --- |
| Entrega de vídeo | 85% | baixo (se for gerenciado) |
| Banco / API / Auth | 10% | **alto** |
| Realtime / chat | 5% | médio |

Escolher "uma plataforma que faz tudo" obriga a aceitar a pior opção de cada camada. Foi
exatamente o que aconteceu: a Supabase é excelente nos 10% e péssima nos 85%.

---

## Camada 1 — Mídia (vídeo, imagem)

**Hoje: Cloudflare R2.** ✅ implementado

O R2 não cobra egress. Nenhum, sem teto. Como saída de mídia é ~85% do custo de um app de
vídeo, essa única decisão muda a ordem de grandeza da conta.

**Divisão atual:**

| O quê | Onde | Por quê |
| --- | --- | --- |
| Mídia nova (vídeo, miniatura, avatar, anexo) | Cloudflare R2 | egress zero |
| Mídia anterior à migração | Supabase Storage | já está lá e funciona; migrar é risco sem ganho |

Nada foi migrado de propósito: num app de mídia, "o grande dia da migração" é o que tem
mais chance de quebrar link, e o ganho seria zero — o custo está no tráfego futuro, não no
acervo.

**Quando trocar de novo:** quando a conta de armazenamento passar de ~US$ 50/mês, vale
avaliar transcodificação + HLS (Cloudflare Stream, ou FFmpeg próprio em cima do R2). O
ganho aí não é egress — é entregar 480p para quem está no 4G em vez de 1080p sempre.

**O que o R2 NÃO resolve:** o custo de **repetição**. O `expo-video` rebaixa o arquivo
toda vez que o item volta à tela. Cache no aparelho continua sendo o maior ganho pendente.

---

## Camada 2 — Banco, Auth, API

**Hoje: Supabase (Postgres).** ✅ e a recomendação é **ficar**

O ativo aqui não é a hospedagem, é o **schema**: a apuração do ranking na escrita, as
matviews de descoberta, os contadores assíncronos, as políticas de RLS. É isso que faz o
app aguentar o pico de um clássico, e é tudo Postgres puro.

**Se um dia a Supabase apertar, troque de hospedeiro — não de tecnologia.** Neon, RDS ou
qualquer Postgres gerenciado recebem as migrations como estão. Trocar para Firestore ou
DynamoDB jogaria fora todo esse trabalho.

**Por que não Firebase/Firestore**, mesmo escalando sem esforço: o ranking é uma agregação
com desempate por três critérios e a descoberta são matviews. Em Firestore isso vira
código de aplicação mantido à mão, contando leitura por documento. Escala fácil, mantém
mal, e o custo por leitura em escala é pior que o do Postgres.

**Quando agir:** réplica de leitura quando o Postgres passar de ~70% de CPU sustentado.

---

## Camada 3 — Realtime

**Hoje: Supabase Realtime**, só onde é insubstituível (chat de live, mensagens diretas).

O placar ao vivo **já saiu** do Realtime: era um websocket por aparelho com o app aberto
durante o jogo — no pico de um clássico, centenas de milhares de conexões simultâneas.
Virou Edge Function com `Cache-Control` de 20 s, e o banco passou a receber ~3 consultas
por minuto independentemente de serem mil ou um milhão de torcedores.

**Quando trocar:** por volta de **10 mil conexões simultâneas**, o chat deve migrar para
os data channels do LiveKit (já está no projeto) ou para Ably/Pusher.

---

## Camada 4 — Push

**Hoje: Expo Push Service + fila no Postgres.** ✅ implementado

O fan-out é feito no banco (dois `INSERT ... SELECT`) e a entrega fica com um worker que
manda lotes em paralelo. Um perfil com 200 mil seguidores escoa sozinho, sem timeout.

**Quando trocar:** o Expo Push é gratuito e sem limite oficial de volume. Só sairia daqui
se precisasse de segmentação avançada ou A/B de mensagem — aí FCM direto ou OneSignal.

---

## Monitoramento de cota — para não ser pego de novo

### O que já está medido automaticamente

A Edge Function `monitorar-midia` lista o bucket do R2 todo dia (04:20) pela API S3 e
grava um snapshot em `public.uso_do_bucket`. Logo depois, `verificar_uso_de_midia()`
compara com o plano e registra alerta em `public.alertas_de_infra`.

**Níveis:** aviso em 70%, alerta em 85%, crítico em 95% — configuráveis em
`public.plano_de_midia`, sem migration.

**Deduplicação:** um nível dispara uma vez por mês. Atravessar 70% avisa; só volta a
avisar se subir para 85%. Alerta que repete todo dia é alerta que ninguém lê.

### Como receber os avisos no celular

Cadastre-se como administrador — sem isso o alerta só fica na tabela:

```sql
insert into public.administradores (usuario_id)
select id from public.profiles where apelido = 'seu_apelido';
```

### Como consultar à mão

```sql
select * from public.uso_do_r2();                                    -- situação atual
select * from public.alertas_de_infra order by criado_em desc;       -- histórico
select * from public.uso_do_bucket order by medido_em desc limit 7;  -- últimos 7 dias
```

### O que essa medição não cobre

| Métrica | Limite grátis | Medido? |
| --- | --- | --- |
| Armazenamento | 10 GB | ✅ exato (listagem do bucket) |
| Operações Classe A (escrita) | 1 M/mês | ⚠️ estimado pelos objetos criados no mês |
| Operações Classe B (leitura) | 10 M/mês | ❌ não medível daqui |

Classe B não passa por nós — o download vai do celular direto para o R2. Para um app de
vídeo isso é aceitável, porque **o limite que aperta é o armazenamento**: arquivos são
grandes, então 10 M de leituras/mês é muito mais folgado que 10 GB. Se um dia as leituras
importarem, o número exato exige a API GraphQL de Analytics da Cloudflare, com um token de
`Account Analytics: Read`.

---

## Custo por faixa de usuários

Estimativa com a arquitetura atual (R2 para mídia, Supabase para o resto):

| MAU | Mídia (R2) | Banco (Supabase) | Realtime | Total aprox./mês |
| --- | --- | --- | --- | --- |
| até 1 mil | US$ 0 (dentro do grátis) | US$ 0–25 | US$ 0 | **US$ 0–25** |
| 10 mil | ~US$ 5 (300 GB armazenados) | US$ 25–45 | US$ 0–50 | **US$ 30–100** |
| 100 mil | ~US$ 45 (3 TB) | US$ 250–400 | US$ 100–500 | **US$ 400–950** |
| 1 milhão | ~US$ 450 (30 TB) | US$ 2–4 k | US$ 1–3 k | **US$ 4–8 k** |

Compare com a mesma escala pagando egress: a 1 M de MAU, só a saída de vídeo passaria de
**US$ 16 mil/mês**. A diferença entre pagar US$ 8 mil e pagar US$ 25 mil está quase toda
em três decisões: egress zero, compressão no aparelho e não rebaixar o mesmo arquivo.

---

## Ordem recomendada daqui para frente

1. **Cache de vídeo no aparelho** — corta o multiplicador de downloads, que é o que
   derrubou o projeto da primeira vez. Maior ganho pendente.
2. **Transcodificação + HLS adaptativo** — entregar 480p em rede ruim em vez de 1080p
   sempre.
3. **Chat fora do Realtime da Supabase** — quando passar de ~10 mil simultâneos.
4. **Réplica de leitura no Postgres** — quando passar de ~70% de CPU sustentado.
