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

Em **Authentication → URL Configuration → Redirect URLs**, acrescente:

```
vulture://login-google
```

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
| **Funciona no Expo Go, falha no APK** | **o mesmo: o Expo Go usa `exp://`, já liberado; o APK usa `vulture://`, que não está** |
| "Login com Google cancelado" | aí sim foi recusa na tela de consentimento do Google |
| "Acesso bloqueado: não verificado" | app em modo de teste e o e-mail não está em Usuários de teste |

---

## Publicar para além dos testadores

Enquanto a tela de permissão estiver em **modo de teste**, só os e-mails cadastrados em
*Usuários de teste* conseguem entrar (limite de 100). Para abrir ao público é preciso
enviar o app para verificação do Google — processo que exige política de privacidade
hospedada e pode levar alguns dias.

Para o piloto, o modo de teste é suficiente.
