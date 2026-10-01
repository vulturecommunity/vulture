# Play Console — o que responder em cada tela

Rascunho pronto para colar, com as respostas derivadas do que o código **de fato** faz.
Onde houver divergência entre este arquivo e o app, o app é que manda: corrija aqui.

Antes de começar, confira que isto já está feito:

- [ ] `supabase db push` e deploy de `excluir-conta`, `moderacao` e `abrir`
- [ ] `EXPO_PUBLIC_SENTRY_DSN` e `EXPO_PUBLIC_POSTHOG_KEY` no `.env` **e** nos dois perfis
      do `eas.json` (são variáveis de build: sem elas o APK sai sem telemetria)
- [ ] GitHub Pages ligado no repositório, servindo `docs/privacidade.html`

---

## 1. Ficha da loja

### Nome do app (30 caracteres)

```
Vulture
```

### Descrição curta (80 caracteres)

```
A rede da nação rubro-negra: vídeos, resenha, lives e ranking de palpites.
```

(73 caracteres.)

### Descrição completa (até 4.000 caracteres)

```
O Vulture é o aplicativo da torcida do Flamengo — feito por torcedor, para torcedor.

VÍDEOS DA ARQUIBANCADA
Grave e assista vídeos curtos da nação: o gol visto da Norte, o esquenta antes do jogo,
a festa na saída do Maracanã. Um feed só de rubro-negro, sem algoritmo de outro planeta
decidindo o que você vê.

RANKING DE PALPITES
Crave o placar de cada jogo do Mengão. Acertar em cheio vale 10 pontos, acertar o saldo
vale 5, acertar o vencedor vale 3 — e clássico e mata-mata valem em dobro. No fim do mês,
o pódio fica registrado no seu perfil para sempre.

DIVISÕES
Você não disputa contra o Brasil inteiro. Entra num grupo de até 30 torcedores do seu
nível, da Série D à Libertadores. Os primeiros sobem de divisão todo mês, os últimos
caem. Dá para ganhar, e é isso que faz voltar.

LIGAS PRIVADAS
Crie a liga da firma, do bar ou do grupo da família com um código de convite e veja quem
realmente entende de Flamengo.

LIVES E RESENHA
Transmita ao vivo com chat e reações, ou escreva na Arquibancada: posts curtos, respostas
e marcação de jogo.

CALENDÁRIO E PLACAR AO VIVO
A temporada inteira do Flamengo, com placar atualizado durante a partida.

---

O Vulture é um aplicativo independente, feito por torcedores, sem relação oficial com o
Clube de Regatas do Flamengo. Não usamos logos, escudos nem imagens oficiais do clube.
```

### Categoria

`Esportes` · Tags: `futebol`, `rede social`, `esportes`

### Contato

- E-mail: `lucas.faleiros@eldorado.org.br`
- Política de privacidade: `https://<seu-usuario>.github.io/vulture/privacidade.html`

> A URL sai assim depois de ligar o GitHub Pages em **Settings › Pages › Source: main /docs**.
> Abra o link num navegador anônimo antes de colar aqui: o Play recusa URL que não carrega.

---

## 2. Data Safety (Segurança dos dados)

Esta é a tela que mais dá problema, porque a declaração precisa bater com o comportamento
real do app — e o seu app passou a enviar dados a terceiros quando ganhou telemetria.

**Declarações gerais**

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha algum dos tipos de dados exigidos? | **Sim** |
| Todos os dados são criptografados em trânsito? | **Sim** (HTTPS em tudo) |
| Você oferece uma forma de o usuário pedir a exclusão dos dados? | **Sim** — dentro do app, em Configurações › Conta › Excluir conta |

**Tipos de dados**

| Tipo | Coletado | Compartilhado | Obrigatório | Finalidade |
| --- | --- | --- | --- | --- |
| Nome | Sim | Não | Sim | Funcionalidade do app |
| Endereço de e-mail | Sim | Não | Sim | Funcionalidade do app; Gerenciamento de conta |
| ID do usuário | Sim | **Sim** | Sim | Funcionalidade; Análise; Diagnóstico |
| Fotos | Sim | Não | Não | Funcionalidade do app |
| Vídeos | Sim | Não | Não | Funcionalidade do app |
| Áudio gravado pelo usuário | Sim | Não | Não | Funcionalidade do app (áudio do vídeo e da live) |
| Mensagens no app | Sim | Não | Não | Funcionalidade do app |
| Outro conteúdo gerado pelo usuário | Sim | Não | Não | Funcionalidade do app (posts, palpites, comentários) |
| Interações no app | Sim | **Sim** | Não | Análise |
| Registros de erros (crash logs) | Sim | **Sim** | Não | Diagnóstico |
| Diagnósticos | Sim | **Sim** | Não | Diagnóstico |

**Por que "Compartilhado: Sim" nessas quatro linhas:** o ID do usuário, as interações e os
relatórios de erro saem do seu servidor e vão para PostHog e Sentry, que são empresas
terceiras. O Play considera isso compartilhamento, mesmo sendo processadores contratados.

**O que NÃO declarar** (confira se continua verdade antes de enviar):

- Localização — o app não pede nenhuma permissão de localização
- Informações financeiras — não há pagamento
- Contatos e lista de apps instalados — não são lidos
- Histórico de navegação e de busca — fica apenas no aparelho, nunca sai dele

---

## 3. Classificação de conteúdo (IARC)

| Pergunta | Resposta |
| --- | --- |
| Categoria | Rede social / Comunicação |
| O app permite que usuários interajam ou troquem conteúdo? | **Sim** |
| Usuários podem compartilhar a própria localização? | Não |
| O app permite compra de bens digitais? | Não |
| Há violência, sexo, linguagem imprópria ou drogas no conteúdo do app? | Não (no app em si) |
| Há conteúdo gerado por usuários não moderado? | **Não — há moderação** |

Na pergunta sobre moderação, declare que existem: denúncia de conteúdo e de perfil,
bloqueio entre usuários, varredura automática de texto e uma fila de moderação humana com
remoção, suspensão e banimento. Tudo isso existe no app — não é promessa.

Classificação esperada: **Livre** ou **10+**, conforme o questionário.

---

## 4. Teste fechado

1. **Criar a trilha:** Teste › Teste fechado › Criar faixa.
2. **Lista de testadores:** por e-mail (até 100) ou por grupo do Google. Para 30 pessoas,
   a lista de e-mails é mais simples.
3. **Subir o AAB:** `eas build --platform android --profile production`.
4. **Link de participação:** o Play gera uma URL de opt-in. **Quem não clicar nela antes
   de instalar recebe erro** — mande o link junto com o convite, não depois.

> O teste fechado **não** publica o app na loja: não aparece em busca, não tem página
> pública e não passa pela revisão completa. É compatível com adiar o lançamento.

### O que pedir para os 30 observarem

Peça pouco, específico, e numa frase cada:

1. Você conseguiu criar a conta sem travar em nenhuma tela?
2. **Aceitou receber notificações?** (se a maioria recusar, o problema é o momento em que
   o app pede — e isso muda o produto)
3. Deu pelo menos um palpite no próximo jogo?
4. O que você fez no app depois de olhar o feed? Qualquer coisa serve, inclusive "fechei".
5. Alguma coisa quebrou, ficou cortada na tela ou demorou demais?

Depois de 48 horas, abra o PostHog e compare o que eles disseram com o que fizeram. A
diferença entre as duas coisas é o relatório de verdade.

---

## 5. Antes de apertar "enviar"

- [ ] Instalou o AAB no seu próprio aparelho e abriu todas as telas
- [ ] Criou uma conta nova do zero e apagou ela (o fluxo de exclusão nunca rodou em device)
- [ ] Gravou e publicou um vídeo (a compressão nunca rodou em device)
- [ ] Compartilhou um palpite (o card em imagem nunca foi renderizado)
- [ ] O Sentry recebeu pelo menos um evento de teste
- [ ] O feed tem conteúdo suficiente para alguém passar dois minutos nele
