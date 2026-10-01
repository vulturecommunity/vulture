# Mídia no Cloudflare R2 (egress zero)

## Por que

O plano Free da Supabase dá **5 GB de egress/mês**. O piloto do Vulture estourou com
**27 GB servidos a partir de apenas 65 MB de arquivos** e 18 usuários — porque num app de
vídeo o mesmo arquivo é baixado de novo toda vez que reaparece no feed. O limite que
aperta não é o quanto você guarda, é quantas vezes cada byte sai.

O **Cloudflare R2 não cobra egress. Nenhum, sem teto.** Os mesmos 27 GB custariam zero.
É por isso que a mídia sai do Storage da Supabase; o banco, o Auth e o Realtime ficam onde
estão (estão em 10% dos limites e são excelentes nisso).

**Nada é migrado.** Os arquivos já enviados continuam na Supabase e seguem sendo servidos
— as URLs estão gravadas no banco. Só os uploads **novos** vão para o R2. Num app de mídia,
"o grande dia da migração" é justamente o que não se deve fazer.

Sem `EXPO_PUBLIC_MIDIA_URL` preenchida, o app continua funcionando exatamente como hoje.

---

## 1. Criar o bucket

No painel da Cloudflare → **R2** → *Create bucket*.

- Nome: `vulture-midia`
- Location: *Automatic*

O plano gratuito do R2 dá **10 GB de armazenamento/mês**, 1 M de operações de escrita e
10 M de leitura. Hoje o projeto usa 65 MB — cabe 150 vezes.

## 2. Deixar o bucket público

O app lê os arquivos direto, sem passar pelo servidor. Duas opções:

**a) Domínio próprio (recomendado)** — bucket → *Settings* → *Public access* → *Custom
domain* → `midia.seudominio.com`. Some com a URL feia e permite trocar de provedor depois
sem reescrever as URLs guardadas no banco.

**b) Subdomínio r2.dev** — *Allow Access* em *R2.dev subdomain*. Sai algo como
`https://pub-xxxxxxxx.r2.dev`. Serve para o piloto; a Cloudflare limita a taxa desse
domínio e não recomenda para produção.

Guarde essa base — é o `R2_PUBLIC_URL`.

### Começar no r2.dev e trocar para domínio próprio depois

Dá, e é barato — mas é bom saber o custo antes de escolher.

O banco guarda a **URL inteira** de cada arquivo (`videos.url`, `posts.midias[].url`,
`profiles.avatar_url`, `rasantes.url`). Trocar de domínio depois significa reescrever esse
prefixo nas linhas já gravadas:

Isso já está pronto, e não é para fazer na mão:

```bash
# 1. a base nova passa a ser aceita pela RLS (a antiga continua, para não quebrar nada)
#    psql "$SUPABASE_DB_URL" -c "insert into public.origens_de_midia (base, descricao)
#      values ('https://midia.seudominio.com', 'dominio proprio');"

# 2. a troca, com prévia do que muda e confirmação digitada
export SUPABASE_DB_URL='postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres'
./scripts/trocar-dominio-midia.sh https://pub-xxxx.r2.dev https://midia.seudominio.com
```

O script mostra quantas linhas serão afetadas **por tabela**, pede a frase `TROCAR DOMINIO`
e só então executa — tudo numa transação só, pela função `trocar_dominio_de_midia()`.

A versão anterior desta seção trazia o `update` para copiar e colar, com um "idem para
rasantes, `profiles.avatar_url` e `posts.midias`" no fim. Esse "idem" era a armadilha: os
anexos de post são um **array jsonb**, não uma coluna de texto, e quem seguisse o passo a
passo ficaria com metade das imagens num domínio e metade no outro — sem erro nenhum
aparecer. A função cobre as cinco colunas, inclusive o jsonb, preservando largura e duração
de cada anexo.

Os arquivos **não se movem** — é o mesmo bucket, só muda o endereço por onde ele é servido.
Se você já tiver um domínio, porém, vale usar desde o começo e pular isso.

Depois da troca, falta fora do banco: `EXPO_PUBLIC_MIDIA_URL` no `.env` (é variável de
build, então precisa de build novo), `npx supabase secrets set R2_PUBLIC_URL=<base nova>`, e
deixar a base antiga cadastrada por alguns dias — link já compartilhado continua chegando
por lá até o cache expirar.

Para conferir antes ou depois:

```sql
select * from public.midias_na_base('https://pub-xxxx.r2.dev');
```

## 3. Criar as credenciais

R2 → *Manage R2 API Tokens* → *Create API token*.

- Permissão: **Object Read & Write**
- Escopo: só o bucket `vulture-midia`

Anote **Access Key ID**, **Secret Access Key** e o **Account ID** (aparece na barra lateral
do R2). O Secret só é mostrado uma vez.

> Essas chaves **nunca** entram no app. Elas ficam só nos segredos das Edge Functions; o
> app pede uma URL assinada e sobe o arquivo direto, sem nunca ver a credencial.

## 4. Configurar as Edge Functions

```bash
npx supabase secrets set \
  R2_ACCOUNT_ID=<seu account id> \
  R2_ACCESS_KEY_ID=<access key id> \
  R2_SECRET_ACCESS_KEY=<secret access key> \
  R2_BUCKET=vulture-midia \
  R2_PUBLIC_URL=https://midia.seudominio.com

npx supabase functions deploy midia-assinar
npx supabase functions deploy midia-apagar
```

## 5. Cadastrar a origem no banco

A RLS só aceita anexo de post vindo de um endereço conhecido — é o que impede alguém de
colar no post a URL de um arquivo alheio. Precisa ser **exatamente** o mesmo valor de
`R2_PUBLIC_URL`, **sem barra no fim**:

```sql
insert into public.origens_de_midia (base, descricao)
values ('https://midia.seudominio.com', 'Cloudflare R2')
on conflict (base) do nothing;
```

## 6. Ligar no app

No `.env` (e no `eas.json`, nos perfis `preview` e `production`):

```bash
EXPO_PUBLIC_MIDIA_URL=https://midia.seudominio.com
```

Reinicie com `npx expo start -c` (as variáveis `EXPO_PUBLIC_*` são embutidas no bundle).

---

## Conferir se funcionou

1. Publique um vídeo pelo app.
2. No painel do R2, o arquivo aparece em `videos/<seu-id>/<id>.mp4`.
3. No banco, `select url from videos order by criado_em desc limit 1` — deve começar com
   a sua base, não com `supabase.co`.
4. Os vídeos antigos continuam tocando normalmente (ainda vêm da Supabase).

## Como fica dividido

| O quê | Onde | Por quê |
| --- | --- | --- |
| Vídeo, miniatura, avatar, anexo de post (**novos**) | Cloudflare R2 | egress zero — é 85% do custo |
| Mídia enviada antes da migração | Supabase Storage | já está lá e funciona; migrar é risco sem ganho |
| Banco, Auth, RLS, Realtime, Edge Functions | Supabase | está em 10% dos limites e é o melhor nisso |

## Os três valores precisam bater

Se algum estiver diferente, anexo de post passa a ser recusado com
`violates row-level security`:

| Onde | Chave |
| --- | --- |
| `.env` / `eas.json` do app | `EXPO_PUBLIC_MIDIA_URL` |
| Segredos das Edge Functions | `R2_PUBLIC_URL` |
| Tabela `public.origens_de_midia` | coluna `base` |

Todos sem barra no fim.

## Voltar atrás

Apague `EXPO_PUBLIC_MIDIA_URL` do `.env` e reinicie. Os uploads voltam para a Supabase na
hora, e o que já está no R2 continua sendo servido — as URLs estão no banco e não mudam.
Não é preciso desfazer nada no Cloudflare.

## O que ainda falta para escala de verdade

O R2 resolve o custo de **saída**, não o de **repetição**: o `expo-video` ainda rebaixa o
arquivo toda vez que o item volta à tela. Os próximos passos, na ordem, estão no
[`ROADMAP.md`](ROADMAP.md):

1. Cache de vídeo no aparelho (corta o multiplicador de downloads).
2. Transcodificação + HLS adaptativo (Cloudflare Stream, ou FFmpeg próprio em cima do R2).
