# Custos — o que está ligado, o que não contratar ainda, e quando mudar

Documento operacional. Para a arquitetura por trás das escolhas, veja
[`ESCALA.md`](ESCALA.md).

Todos os números vêm de medição real do projeto, não de estimativa de catálogo: o vídeo de
referência tem **0,41 MB por segundo** (720p), então um clipe de 20 s ocupa **8,3 MB**.

---

## Situação atual

| Serviço | Plano | Custo/mês | Observação |
| --- | --- | --- | --- |
| Cloudflare R2 | Free (10 GB) | **US$ 0** | usando 0,02% |
| Supabase | Free | **US$ 0** | banco, Auth, Edge Functions |
| LiveKit Cloud | Free | **US$ 0** | **ligado e funcionando** |
| Expo EAS | Free | **US$ 0** | builds pelo plano gratuito |
| Highlightly | Free | **US$ 0** | 100 consultas/dia, cabe folgado |
| **Total** | | **US$ 0** | |

---

## Otimizações aplicadas

### `Cache-Control` nos uploads do R2

Cada arquivo sobe com `public, max-age=31536000, immutable`. Sem isso, o CDN não guarda na
borda e **cada exibição vira uma operação de leitura cobrada** — além de o aparelho baixar
tudo de novo a cada rolagem.

Isto foi uma regressão: o upload para o Storage da Supabase enviava esse cabeçalho e ele se
perdeu na migração para o R2. Mídia aqui é imutável (id único por arquivo, nunca
sobrescrito), então cache de um ano é seguro.

> Guardado por teste em `src/services/__tests__/midiaRemota.test.ts`, que verifica o
> cabeçalho chegando ao `UploadTask` — não só a existência da constante.

### "Economizar dados" agora impede o pré-carregamento

Montar o player já dispara o download; não existe "montar sem baixar". Antes, quem ligava
a economia de dados continuava baixando o vídeo seguinte em segundo plano — exatamente o
que a pessoa pediu para não acontecer.

Vídeo pré-carregado e nunca assistido é download 100% desperdiçado: gasta o dado móvel do
usuário e uma leitura cobrada no R2.

### Compressão de imagem no aparelho

Miniatura 540 px (~30× menor), foto 1080 px, avatar 512 px. Uma miniatura real do projeto
caiu de **1,9 MB para 26 KB**.

---

## O que NÃO contratar ainda

Esta é a maior economia disponível, e não exige código nenhum.

### Expo EAS Build — US$ 99/mês

**Não assine.** O plano gratuito dá builds suficientes para um app em ritmo normal.

Para gerar APK sem gastar cota:

```bash
npx expo run:android          # build local (precisa de Android Studio + JDK 17)
```

**Quando assinar:** se você publicar atualização toda semana e a fila do plano gratuito
começar a atrapalhar. Antes disso, é US$ 99/mês por conveniência que você ainda não usa.

### Supabase Pro — US$ 25/mês

**Fique no Free.** O limite que aperta primeiro é o egress de API/JSON (5 GB/mês), que
comporta cerca de **2.000–3.000 usuários ativos** agora que a mídia saiu de lá.

**Quando assinar:** quando o painel acusar egress acima de 80%, ou ao passar de ~2.000
usuários ativos. A essa altura, US$ 25 é barato pelo que você já tem rodando.

---

## LiveKit — ligado, e assim deve ficar

**Não desative.** Dois motivos:

**1. Hoje não custa nada.** Com o uso atual, o consumo fica na faixa gratuita. Desativar
economizaria US$ 0 e custaria a funcionalidade inteira.

**2. O modo simulado não transmite vídeo.** É importante entender o que ele faz:

| Quem | O que vê no modo simulado |
| --- | --- |
| Anfitrião | a própria câmera, **só na tela dele** — nada é transmitido |
| Espectador | uma imagem estática escurecida. **Não vê você.** |

O que continua funcionando de verdade: a live aparece na lista, o chat é real (Supabase
Realtime), as reações funcionam, o contador de espectadores é real e o push
"@fulano está ao vivo" é disparado.

Ou seja: **a live existe socialmente, mas não tem imagem.** Quem entrar esperando te ver
encontra uma capa parada com o chat rolando.

### Quando o modo simulado entra sozinho

Não é uma configuração — é detecção em runtime (`src/services/live/livekit-nativo.ts`):

```
LiveKit real   = módulos nativos presentes  E  chaves configuradas
Modo simulado  = qualquer um dos dois faltando
```

| Ambiente | Resultado |
| --- | --- |
| Expo Go | **sempre simulado** (o Expo Go não tem os módulos nativos de WebRTC) |
| APK do EAS / development build | **LiveKit real**, porque as chaves estão nos segredos |

Então: para testar live com vídeo de verdade, use o APK — no Expo Go nunca vai funcionar,
e isso é limitação do Expo Go, não do app.

### Se um dia precisar desligar de propósito

Remova as chaves e o app cai no simulado sozinho, sem quebrar:

```bash
npx supabase secrets unset LIVEKIT_API_KEY LIVEKIT_API_SECRET LIVEKIT_URL
```

Para religar, basta recolocá-las (pegue em livekit.cloud → Settings → Keys):

```bash
npx supabase secrets set LIVEKIT_API_KEY=<chave> LIVEKIT_API_SECRET=<segredo> LIVEKIT_URL=wss://vulture-i9dz6wb0.livekit.cloud
```

**Quando o LiveKit passa a custar:** a partir de alguns milhares de minutos de
participante por mês. Com 2% dos usuários assistindo 1 h/mês, isso acontece por volta de
**4.000–5.000 usuários ativos**. Confira os tiers atuais no site deles antes de contar com
esse número.

---

## Painel de uso

Página externa (fora do app) que mostra quanto de cada plano gratuito já foi consumido:

**https://claude.ai/artifact/RthsVzGmRpQDSaYdcmkbFp**

Pede um token na primeira abertura — o `PAINEL_TOKEN`, que fica salvo no navegador. Não é
a anon key de propósito: a anon key está embutida no APK, e quem tivesse o APK veria a
telemetria de infraestrutura do projeto. Também não é a service role, porque a página roda
no navegador. Este token só lê números agregados.

| Onde | O quê |
| --- | --- |
| `painel_de_uso()` | função SQL que junta tudo numa chamada |
| Edge Function `painel` | expõe o JSON, autenticada pelo `PAINEL_TOKEN` |
| `monitorar-midia` | grava o snapshot diário (R2 + banco + contas juntos) |

O painel mede **armazenamento no R2, escritas no R2, tamanho do banco e contas**, e marca
70%/85%/95% em cada trilho — os mesmos limiares que disparam push de alerta.

O que ele **não** mede, e diz isso na tela em vez de inventar número: egress da Supabase e
leituras Classe B do R2. Os dois passam longe do banco (um sai pelo gateway, o outro vai do
celular direto para a Cloudflare), então só existem no painel de cada provedor. Métrica
errada é pior que métrica ausente — dá confiança falsa justamente onde a conta chega.

A curva de crescimento e a projeção de "quando o limite seria atingido" só aparecem depois
de alguns dias, porque o levantamento roda uma vez por dia (04:20).

```bash
# trocar o token
npx supabase secrets set PAINEL_TOKEN=<novo>
```

---

## Alertas — configure uma vez

### Já automatizado

O bucket do R2 é medido todo dia (04:20) e alerta em 70%/85%/95%. Para receber no celular:

```sql
insert into public.administradores (usuario_id)
select id from public.profiles where apelido = 'seu_apelido';
```

Consultas úteis:

```sql
select * from public.uso_do_r2();                               -- situação agora
select * from public.alertas_de_infra order by criado_em desc;  -- histórico
```

### Configure no painel (5 minutos, grátis)

- **Cloudflare** → Notifications → alerta de uso do R2
- **Supabase** → Settings → Billing → aviso de spend cap

---

## Projeção

| Usuários | R2 | Supabase | LiveKit | EAS | **Total/mês** |
| --- | --- | --- | --- | --- | --- |
| 20 (hoje) | US$ 0 | Free | Free | Free | **US$ 0** |
| 500 | US$ 0,16 | Free | Free | Free | **US$ 0,16** |
| 5.000 | US$ 3 | US$ 25 | ~US$ 50 | Free | **~US$ 78** |
| 50.000 | US$ 50 | US$ 75 | US$ 200–500 | US$ 99 | **US$ 424–724** |

Note que o custo **por usuário** cai conforme cresce (US$ 0,035 → US$ 0,008): as taxas
fixas se diluem. Isso é saudável — o app não fica mais caro por pessoa quando dá certo.

---

## O que ainda dá para economizar

Em ordem de retorno por esforço:

1. **Cache de vídeo no aparelho** — o maior pendente. Corta as leituras repetidas e dá
   replay instantâneo. Ganha o usuário (menos dado móvel) e ganha a conta.
2. **Compressão de vídeo** — hoje são ~25 MB por minuto, sem compressão. Exige
   development build com módulo nativo; não funciona no Expo Go.
3. **Domínio próprio no R2** — o `pub-*.r2.dev` tem limite de taxa e a Cloudflare não o
   recomenda para produção. Ver [`SETUP_R2.md`](SETUP_R2.md).

### O que NÃO vale a pena

Verificado e descartado, para você não perder tempo:

- **Enxugar o payload da API** — só o campo `hashtags_norm` é desperdiçado, ~3% do JSON.
  Mexer na consulta arrisca o feed para economizar centavos.
- **Reduzir a frequência dos crons** — 43 mil invocações/mês de 500 mil gratuitas. Não é
  gargalo, e mexer atrasaria os pushes.
- **Gravar em 480p** — corta ~60% do vídeo, mas a qualidade cai de forma visível. Num app
  cujo produto é vídeo, é economia no lugar errado.

---

## Zerar o app sem perder as contas

Durante o piloto é comum querer recomeçar os testes do zero — sem gastar cota de
armazenamento com conteúdo de teste e sem fazer ninguém criar conta de novo.

```bash
export SUPABASE_SERVICE_ROLE_KEY='...'   # painel → Settings → API → service_role
./scripts/limpar-tudo.sh
```

O script mostra a situação atual, **exige que você digite `APAGAR CONTEUDO`** e só então
executa, devolvendo um relatório do que saiu.

| Apaga | Mantém |
| --- | --- |
| vídeo, foto, post, comentário, curtida | **contas** (auth.users + profiles) |
| palpite, ranking, títulos, ligas | tokens de push dos aparelhos |
| conversa, mensagem, rasante, live | administradores que recebem alerta |
| notificação, denúncia, filas | configuração do R2 e limites de custo |
| **os arquivos no Cloudflare R2** | calendário do Flamengo |

**A ordem importa e é proposital:** primeiro os arquivos no R2, depois as linhas no banco.
Ao contrário, uma falha no meio apagaria as URLs do banco e deixaria os arquivos órfãos no
bucket — ocupando cota para sempre, sem ninguém saber que estão lá.

Três travas independentes impedem execução acidental: a função SQL exige a frase exata, a
Edge Function exige a service role key (que nunca está no app nem no repositório), e o
script pede confirmação digitada. Nenhuma sozinha é suficiente.

## A regra de fundo

A distinção que importa não é "caro ou barato", é **custo fixo versus custo que multiplica
por usuário**.

US$ 25/mês é previsível. Egress de vídeo multiplica por cada visualização — foi o que
derrubou o projeto com 18 usuários e o que custaria US$ 19.500/mês com 50 mil.

**Toda atenção vai para o que multiplica.** Hoje isso é armazenamento e leituras no R2, e
os dois estão medidos diariamente com alerta antes do limite.
