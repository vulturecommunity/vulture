# Login com Google

O código já está pronto no app. Falta ligar o provedor — são dois lados: Google Cloud
(que emite as credenciais) e Supabase (que recebe o retorno do login).

Sem essa configuração o botão aparece, mas responde
*"Entrar com Google ainda não está ligado neste projeto"* — falha explicada, não erro seco.

---

## Como o fluxo funciona

1. O app pede ao Supabase a URL de autorização do Google
2. Abre essa URL **no navegador do sistema** (não num WebView), então as senhas salvas e
   a verificação em duas etapas do usuário funcionam normalmente
3. O Google devolve para `vulture://login-google` com um código
4. O app troca o código pela sessão

Quem entra pela primeira vez **tem a conta criada automaticamente**, pelo mesmo gatilho do
cadastro por e-mail — já chega com perfil e apelido prontos.

---

## 1. Google Cloud Console

Em [console.cloud.google.com](https://console.cloud.google.com):

1. Crie um projeto (ou use um existente)
2. **APIs e serviços → Tela de permissão OAuth**
   - Tipo: **Externo**
   - Nome do app: `Vulture`
   - E-mail de suporte e de contato: o e-mail do projeto
   - Em **Escopos**, os padrões bastam (`email`, `profile`, `openid`)
   - Enquanto estiver em modo de teste, adicione os e-mails que vão testar em
     **Usuários de teste** — senão o login é recusado
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**
   - Tipo: **Aplicativo da Web** (sim, Web — quem recebe o retorno é o Supabase, não o app)
   - Em **URIs de redirecionamento autorizados**, coloque exatamente:

     ```
     https://mlajeudfsjymgaxjofya.supabase.co/auth/v1/callback
     ```

4. Anote o **Client ID** e o **Client Secret**

---

## 2. Supabase

No painel do projeto → **Authentication → Providers → Google**:

1. Ligue o provedor
2. Cole o **Client ID** e o **Client Secret** do passo anterior
3. **Save**

### 2.1 Liberar o endereço de retorno — não pule

Em **Authentication → URL Configuration → Redirect URLs**, acrescente as duas:

```
vulture://login-google
exp://**
```

A primeira é o APK e o development build — é a única que importa em produção.

### O Expo Go é o caso chato

O Supabase libera `exp://127.0.0.1:8081` por padrão, mas o celular não acessa o Metro por
`127.0.0.1`: acessa pelo IP da sua máquina na rede, algo como
`exp://10.0.0.42:8081/--/login-google`.

E aí vem a parte que faz perder tempo: **`exp://**` não cobre esse endereço.** O GoTrue
recusa expandir curinga para IP que não seja loopback — é proteção contra um curinga abrir
a porta para qualquer máquina da rede. Medido no projeto real:

| Endereço de retorno | Com `exp://**` cadastrado |
| --- | --- |
| `exp://127.0.0.1:8081/--/login-google` | permitido (loopback) |
| `exp://a.b.c.d/--/login-google` | permitido (nome, não IP) |
| `exp://999.999.999.999/…` | permitido (IP inválido vira nome) |
| `exp://192.168.1.5/…` | **bloqueado** |
| `exp://10.0.0.42:8081/…` | **bloqueado** |

Duas saídas:

**Entrada exata** — cole o endereço que o próprio app mostra na mensagem de erro:

```
exp://10.0.0.42:8081/--/login-google
```

Funciona, mas quebra quando o IP mudar (outra rede, roteador reiniciado).

**Túnel** — a saída que não quebra:

```bash
npx expo start --tunnel
```

O endereço vira `exp://algo.exp.direct`, que é nome e não IP, então o `exp://**` cobre
sozinho em qualquer rede. Recarrega mais devagar, e resolve de vez.

Só o Expo Go abre `exp://`, então essas entradas não são buraco em produção — mas vale
tirá-las da lista quando o app for publicado, porque aí não servem mais para nada.

**Esta é a etapa que mais quebra**, e quebra de um jeito enganoso: sem ela o Google
autentica normalmente, mas o Supabase se recusa a mandar o navegador de volta para o app
e redireciona para a Site URL. A aba fica numa página qualquer, a pessoa fecha, e o app
só sabe que o navegador fechou — exatamente o que aconteceria se ela tivesse desistido.

Pior: o fluxo **funciona no Expo Go** mesmo sem isso, porque ali o endereço de retorno é
`exp://…`, que já está liberado por padrão. Então o problema aparece só no APK.

Para conferir sem precisar abrir o app — se o endereço estiver liberado, a resposta volta
para ele; se não, cai na Site URL:

```bash
curl -s -o /dev/null -w '%{redirect_url}\n' \
  "https://<SEU-PROJETO>.supabase.co/auth/v1/verify?token=invalido&type=signup&redirect_to=vulture%3A%2F%2Flogin-google"
```

---

## 3. Testar

Abra o app e toque em **Continuar com Google** na tela de login. Deve abrir o navegador,
pedir a conta e voltar para o app já autenticado.

Para conferir que a conta foi criada:

```sql
select p.apelido, p.email, u.raw_app_meta_data->>'provider' as provedor
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.criado_em desc limit 5;
```

O provedor deve aparecer como `google`.

---

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| "Entrar com Google ainda não está ligado" | provedor desligado no Supabase (passo 2) |
| `redirect_uri_mismatch` no navegador | a URI do passo 1.3 não bate exatamente com a do Supabase |
| **"O navegador fechou sem voltar para o app"** | **`vulture://login-google` faltando nas Redirect URLs (passo 2.1)** |
| Falha no Expo Go dizendo `exp://<IP-da-rede>:8081/…` | o curinga `exp://**` **não** cobre IP; use a entrada exata ou `--tunnel` (passo 2.1) |
| Funcionava no Expo Go e parou do nada | o IP da sua máquina mudou; a entrada exata antiga não vale mais |
| O navegador para numa página "localhost" que não carrega | é o mesmo problema: sem o endereço na lista, o Supabase cai na Site URL, que por padrão é `http://localhost:3000` |
| "Login com Google cancelado" | aí sim foi recusa na tela de consentimento do Google |
| "Acesso bloqueado: não verificado" | app em modo de teste e o e-mail não está em Usuários de teste |

---

## Publicar para além dos testadores

Enquanto a tela de permissão estiver em **modo de teste**, só os e-mails cadastrados em
*Usuários de teste* conseguem entrar (limite de 100). Para abrir ao público é preciso
enviar o app para verificação do Google — processo que exige política de privacidade
hospedada e pode levar alguns dias.

Para o piloto, o modo de teste é suficiente.
