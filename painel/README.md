# Placar de Custos

Página fora do app que mostra quanto de cada plano gratuito já foi consumido. Para a
leitura dos números e o que fazer com eles, veja [`../CUSTOS.md`](../CUSTOS.md).

## Como abrir

```bash
xdg-open painel/index.html      # Linux
```

Na primeira vez ela pede o `PAINEL_TOKEN`. O token fica guardado no navegador; não precisa
digitar de novo.

É um arquivo solto de propósito — sem build, sem servidor, sem dependência. Abrir pelo
`file://` funciona porque a Edge Function responde com `Access-Control-Allow-Origin: *`,
e isso vale também para a origem `null` de um arquivo local.

## Por que não está hospedado

Três caminhos foram tentados ou descartados:

| Onde | Por que não |
| --- | --- |
| Artifact do Claude | a CSP do sandbox só permite conexão com a própria origem — o `fetch` para a Supabase era barrado antes de sair |
| A própria Edge Function | o gateway da Supabase reescreve a resposta para `text/plain` e aplica `default-src 'none'; sandbox` (proteção anti-phishing do domínio compartilhado) |
| GitHub Pages | o repositório é privado, e Pages em repositório privado exige plano pago |

Se um dia quiser abrir pelo celular, o caminho gratuito é o Cloudflare Pages — a conta já
existe por causa do R2:

```bash
npx wrangler pages deploy painel --project-name=vulture-painel
```

A página não guarda nenhum número dentro dela, então hospedar não vaza nada: o que aparece
continua atrás do token.

## Onde cada peça mora

| Peça | Arquivo |
| --- | --- |
| A página | `painel/index.html` |
| O endpoint | `supabase/functions/painel/index.ts` |
| A consulta | `painel_de_uso()`, em `supabase/migrations/20260930170000_painel_de_uso.sql` |
| O levantamento diário | `supabase/functions/monitorar-midia/index.ts` (cron 04:20) |

## Trocar o token

```bash
npx supabase secrets set PAINEL_TOKEN=<novo>
npx supabase functions deploy painel --no-verify-jwt
```

No painel, o botão **Trocar token** apaga o que estava guardado no navegador — junto com o
último resultado em cache.
