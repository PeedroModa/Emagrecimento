# Painel de Peso

Painel de acompanhamento de peso e composição corporal, **multiusuário**: cada
pessoa cria a própria conta e só enxerga os próprios dados — o isolamento é
garantido pelo Row Level Security do Supabase, não pela interface. Vite +
React (JavaScript), autenticação por e-mail/senha (com cadastro,
recuperação de senha e link mágico como alternativas), deploy na Vercel.

- **Hoje** — registrar pesagem, "É real ou ruído?", variação vs. anterior, progresso até a meta
- **Evolução** — gráfico de linha (peso + tendência + meta) com janela de análise selecionável (27 dias padrão, 60, 90, 180, 365), tendência com projeção de composição, recordes, histórico com edição/exclusão
- **Nutrição** — Mifflin-St Jeor (BMR/TDEE/alvo, com fórmula específica por sexo), macros em dois modos (% e g/kg), simulador de ritmo — treinos/semana e déficit são só exibidos aqui, editados em Ajustes
- **Ajustes** — metas, perfil físico (data de nascimento → idade automática), treinos/déficit, backup export/import JSON, troca de senha, logout

Isolamento entre contas: nenhum dado — pesagens, configurações, metas — de um
usuário é visível, editável ou removível por outro. Ver
[`supabase/test-rls-isolation.sql`](supabase/test-rls-isolation.sql) para a
prova executável disso contra o banco real.

----

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project**.
2. Escolha nome (ex: `painel-peso`), senha do banco (guarde-a, mas ela não é usada pelo app) e a região mais próxima (São Paulo: `sa-east-1`).
3. Aguarde o projeto provisionar (~2 min).

### 1.1 Rodar o SQL

1. No painel do projeto: **SQL Editor** → **New query**.
2. Cole o conteúdo completo de [`supabase/schema.sql`](supabase/schema.sql).
3. Clique **Run**. Deve terminar sem erros — isso cria as tabelas `weigh_ins` e `user_settings`, o índice e todas as políticas de RLS.

### 1.2 Cadastro — self-service ou manual

Qualquer pessoa pode criar a própria conta direto na tela de login ("criar
conta" → e-mail + senha). Se o projeto tiver **"Confirm email"** ligado
(padrão do Supabase), a pessoa recebe um e-mail de confirmação — o que exige
SMTP configurado (seção 1.4) para chegar de forma confiável. Sem SMTP
próprio, o e-mail embutido do Supabase é limitado (poucos envios por hora, e
em projetos novos só entrega para o e-mail dono do projeto) e pode nunca
chegar.

Para não depender disso — seu próprio uso, ou para dar acesso a alguém antes
de configurar SMTP — dá para criar a conta direto no banco, já confirmada,
com uma senha provisória:

1. **SQL Editor → New query** → cole o conteúdo de [`supabase/criar-usuario.sql`](supabase/criar-usuario.sql) (edite o e-mail/senha no topo do script antes de rodar) → **Run**.
2. A última consulta do script deve devolver 1 linha com `confirmado = true`,
   `tem_senha = true`, `trocar_senha = true` e `tem_identidade = true`.

No primeiro login com essa senha provisória, o app **obriga a trocar a senha**
(mínimo 8 caracteres) antes de liberar o painel — a flag `must_change_password`
fica no `user_metadata` e é apagada assim que a nova senha é salva. Depois
disso dá para trocar a senha quando quiser em **Ajustes → Senha**, ou pedir
"esqueci minha senha" na tela de login (também precisa de SMTP para o e-mail
de redefinição chegar).

> O script é idempotente: rodar de novo apenas redefine a senha da conta
> configurada nele.
>
> Alternativa pelo Dashboard: **Authentication → Users → Add user**, marcando
> **Auto Confirm User**. Nesse caso rode o SQL depois (com o mesmo e-mail)
> para marcar a troca de senha obrigatória.

### 1.3 Configurar Auth e URLs

1. **Authentication → Providers → Email**: deixe **Email** habilitado (é o
   provider usado por senha, cadastro, recuperação de senha e link mágico).
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173` (por enquanto; depois troque pelo domínio da Vercel)
   - **Redirect URLs:** adicione `http://localhost:5173/**`
3. Cadastro, "esqueci minha senha" e link mágico já ficam disponíveis na tela
   de login — mas o e-mail que cada um dispara só chega de forma confiável
   depois do passo 1.4 (SMTP próprio).

### 1.4 SMTP próprio (para o e-mail voltar a funcionar)

**Por que o link não chegava:** o serviço de e-mail embutido do Supabase é só
para desenvolvimento. Ele limita o envio a ~2 e-mails por hora e, em projetos
novos, só entrega para o e-mail dono do projeto — qualquer outro destinatário é
descartado silenciosamente. Não adianta reenviar: precisa de um SMTP próprio.

Para o seu próprio uso, isso é **opcional** — `criar-usuario.sql` (1.2) já
funciona sem nada disso. Mas para **convidar outras pessoas**, SMTP próprio
passa a importar de verdade: sem ele, o cadastro self-service pode nunca
confirmar (se "Confirm email" estiver ligado) e "esqueci minha senha" nunca
chega. Com SMTP configurado, os três fluxos passam a funcionar: cadastro,
recuperação de senha e link mágico.

#### a) Criar a conta no provedor

Escolha um. Sugestão para uso pessoal, sem domínio próprio:

| Provedor | Grátis | Precisa de domínio? |
| --- | --- | --- |
| **Brevo** (ex-Sendinblue) | 300 e-mails/dia | Não — dá para verificar um endereço avulso |
| **Resend** | 3.000/mês | Sim, para enviar a qualquer destinatário |
| **AWS SES** | 3.000/mês (12 meses) | Sim, e sai do sandbox só sob pedido |

Com **Brevo** (caminho mais curto):

1. Crie a conta em [brevo.com](https://www.brevo.com) e confirme o e-mail.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: cadastre o
   endereço que vai aparecer no "De:" (ex: `pedromodah@gmail.com`) e clique no
   link de verificação que a Brevo manda para ele.
3. **SMTP & API → SMTP**: anote o **Login** (seu e-mail da conta) e gere a
   **SMTP key** — essa chave é a senha, e ela só aparece uma vez.

#### b) Preencher no Supabase

**Authentication → Emails → SMTP Settings** (em projetos mais antigos:
**Project Settings → Auth → SMTP Settings**) → ligue **Enable Custom SMTP**:

| Campo | Valor (Brevo) |
| --- | --- |
| Sender email | o endereço verificado no passo (a2) |
| Sender name | `Painel de Peso` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | o Login do painel SMTP da Brevo |
| Password | a SMTP key gerada |

Salve. Depois, em **Authentication → Rate Limits**, suba o
**"Rate limit for sending emails"** (o padrão de 2/hora é a trava do serviço
embutido; com SMTP próprio pode ir para 30/hora, por exemplo).

> As credenciais SMTP ficam **só no Supabase** — não entram no `.env` nem no
> repositório. O frontend nunca toca nelas.

#### c) Testar

Na tela de login, teste os três fluxos que dependem de e-mail: "criar conta"
(deve chegar um e-mail de confirmação, se "Confirm email" estiver ligado),
"esqueci minha senha" e "entrar com link mágico". Se algum e-mail não chegar
em 1–2 minutos:

- **Authentication → Logs** no Supabase mostra o erro exato do envio (auth
  recusada, remetente não verificado, porta bloqueada).
- Cheque o spam. Enviar com remetente `@gmail.com`/`@hotmail.com` por um relay
  de terceiros costuma cair em spam no Outlook/Hotmail por causa de DMARC — se
  isso acontecer, use um domínio seu como remetente, ou continue no login por
  senha, que não depende de e-mail nenhum.

### 1.5 Pegar as chaves públicas

**Project Settings → API**:
- **Project URL** → vai em `VITE_SUPABASE_URL`
- **anon public** key → vai em `VITE_SUPABASE_ANON_KEY`

> ⚠️ NUNCA use a `service_role` key no frontend nem no `.env` deste projeto. O app só precisa das chaves públicas — a segurança é garantida pelo RLS no banco.

---

## 2. Rodar localmente

Pré-requisito: [Node.js](https://nodejs.org) 18+ instalado.

```bash
# 1. instalar dependências
npm install

# 2. criar o .env a partir do exemplo
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux

# 3. editar .env com a URL e a anon key do seu projeto Supabase

# 4. rodar
npm run dev
```

Abra `http://localhost:5173`. Se criou a conta pelo `criar-usuario.sql`, entre
com o e-mail/senha configurados nele — o app pede para trocar a senha
provisória no primeiro login. Se criou pela tela "criar conta", já entra
direto (ou depois de confirmar o e-mail, conforme a configuração do
projeto). Em seguida o app pede **sexo, data de nascimento, altura, peso
meta, treinos por semana e déficit** — o mínimo para o Mifflin-St Jeor e o
progresso até a meta funcionarem desde o primeiro dia (dá para mudar tudo
depois em **Ajustes**). Peso atual não é pedido aí — é a primeira pesagem,
registrada na página **Hoje**.

### Testes

```bash
npm test          # roda a suíte Vitest (93 testes: regras de negócio, cache/isolamento entre sessões, auth)
```

### Build de produção

```bash
npm run build     # gera dist/
npm run preview   # serve o build localmente para conferir
```

---

## 3. Git e GitHub

O `.gitignore` já exclui `.env`, `node_modules/` e `dist/` — nenhum secret vai para o repositório.

```bash
# inicializar e primeiro commit
git init
git add .
git commit -m "Painel de peso: app inicial"

# criar o repositório no GitHub (github.com/new, pode ser privado)
# e conectar:
git remote add origin https://github.com/SEU-USUARIO/painel-peso.git
git branch -M main
git push -u origin main

# atualizações futuras:
git add .
git commit -m "descrição da mudança"
git push
```

---

## 4. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório do GitHub.
2. A Vercel detecta Vite automaticamente. Confirme:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = a URL do seu projeto
   - `VITE_SUPABASE_ANON_KEY` = a anon key
4. **Deploy**. O arquivo [`vercel.json`](vercel.json) já cuida do rewrite de SPA (todas as rotas → `index.html`).

### 4.1 Atualizar as URLs no Supabase

Depois do primeiro deploy, com o domínio em mãos (ex: `https://painel-peso.vercel.app`):

1. **Authentication → URL Configuration**:
   - **Site URL:** `https://painel-peso.vercel.app`
   - **Redirect URLs:** adicione `https://painel-peso.vercel.app/**` (mantenha o localhost se quiser continuar desenvolvendo).

Sem isso, o link mágico e os e-mails de confirmação/redefinição redirecionam
para o lugar errado (o login por senha já cadastrada funciona de qualquer
jeito, mas mantenha as URLs corretas para todo o resto).

---

## 5. Migrar dados de uma conta antiga

1. Na conta antiga: **Ajustes → Backup → Baixar .json** (ou **Copiar dados**).
2. Entre com a conta de destino e, se ainda não tiver pesagens, a página
   **Hoje** mostra o card **"Importar dados do painel antigo"** — selecione o
   arquivo.
3. Alternativamente: **Ajustes → Backup → Importar**, a qualquer momento
   (merge por data — o arquivo vence em datas repetidas).
4. O import sempre grava na conta **atualmente logada** — não existe caminho
   na interface para importar dados na conta de outra pessoa; a escrita
   também é validada pelo RLS no banco (`auth.uid() = user_id`), então nem um
   arquivo adulterado manualmente conseguiria escrever fora da própria conta.

---

## 6. Convidando outras pessoas

Cada pessoa cria a própria conta (self-service, seção 1.2) e só vê os
próprios dados — não existe nenhum dado compartilhado ou visível entre
contas. Antes de convidar alguém, veja a seção 7 abaixo para confirmar isso
com um teste real contra o banco.

Sem SMTP próprio configurado (seção 1.4), o cadastro e a recuperação de
senha por e-mail podem não funcionar para quem não é o dono do projeto — a
alternativa é você mesmo rodar `supabase/criar-usuario.sql` com o e-mail da
pessoa e passar a senha provisória por fora.

---

## 7. Prova de isolamento entre contas (RLS)

[`supabase/test-rls-isolation.sql`](supabase/test-rls-isolation.sql) cria dois
usuários de teste dentro de uma transação, tenta ler/editar/apagar/criar
dados cruzados entre eles nas duas tabelas, e confere que a política de RLS
bloqueia tudo — usando o motor de RLS de verdade, não só relendo as
políticas. Roda inteiro dentro de `BEGIN; ... ROLLBACK;`: nada persiste,
pode rodar quantas vezes quiser.

Cole o arquivo **inteiro** no SQL Editor e rode como uma única execução. Sem
nenhum `RAISE EXCEPTION`, o isolamento está comprovado.

---

## 8. Checklist de etapas manuais

- [ ] Criar projeto no Supabase e rodar `supabase/schema.sql`
- [ ] (Opcional) Rodar `supabase/criar-usuario.sql` para uma conta sem depender de e-mail
- [ ] Se o banco é antigo: rodar `supabase/migration-birth-date.sql`
- [ ] Configurar provider Email e Redirect URLs (localhost)
- [ ] (Recomendado antes de convidar outras pessoas) Configurar SMTP próprio para cadastro/recuperação de senha/link mágico
- [ ] Criar `.env` local com URL + anon key
- [ ] `npm install` e `npm run dev` — testar cadastro e login local
- [ ] Rodar `supabase/test-rls-isolation.sql` no SQL Editor e confirmar que não há `RAISE EXCEPTION`
- [ ] Criar repositório no GitHub e fazer push
- [ ] Importar o projeto na Vercel com as 2 variáveis de ambiente
- [ ] Atualizar Site URL / Redirect URLs no Supabase com o domínio da Vercel

---

## Arquitetura

```
src/
  lib/calculations.js    ← funções puras (Navy, Mifflin M/F, sinal/ruído, tendência...) — extraídas do jsx original
  lib/backup.js          ← export/import JSON, sempre escopado à conta logada
  lib/supabase.js        ← client (só chaves públicas)
  hooks/useAuth.js       ← sessão: senha, cadastro, recuperação de senha, link mágico, sessão expirada
  hooks/useWeighIns.js   ← pesagens: cache em memória + atualização otimista, isolado por sessão (guarda de epoch)
  hooks/useSettings.js   ← configurações persistidas (debounce na escrita), mesmo isolamento
  components/
    layout/              ← sidebar (desktop) / bottom nav (mobile), section headers
    ui/                  ← empty states, modal de confirmação, toast
    weigh/               ← form, sinal/ruído, tendência, gráfico, histórico...
    nutrition/           ← calorias, macros, simulador (consomem treino/déficit; não editam)
  pages/                 ← Hoje, Evolucao, Nutricao, Ajustes, Login (entrar/criar conta/recuperar/link mágico),
                           TrocarSenha (senha provisória, recuperação ou troca voluntária), PrimeiroAcesso (perfil completo)
supabase/schema.sql              ← tabelas + índices + constraints + RLS
supabase/criar-usuario.sql       ← cria conta com senha, confirmada, sem depender de e-mail
supabase/migration-birth-date.sql ← adiciona user_settings.birth_date em banco já criado
supabase/test-rls-isolation.sql  ← prova executável de isolamento entre contas (transação com rollback)
```

Segurança: RLS em todas as tabelas (`auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE). O frontend usa exclusivamente a anon key; nenhum secret no código ou no Git.
