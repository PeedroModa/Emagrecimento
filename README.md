# Painel de Peso

Painel pessoal de acompanhamento de peso e composição corporal. Vite + React (JavaScript), dados no Supabase (com Row Level Security), login por e-mail e senha (link mágico como alternativa), deploy na Vercel.

- **Hoje** — registrar pesagem, "É real ou ruído?", variação vs. anterior, progresso até a meta
- **Evolução** — gráfico de linha (peso + média móvel 27d + meta), tendência com projeção de composição, recordes, histórico com edição/exclusão
- **Nutrição** — Mifflin-St Jeor (BMR/TDEE/alvo), macros em dois modos (% e g/kg), simulador de ritmo
- **Ajustes** — metas, perfil físico (data de nascimento → idade automática), treinos/déficit, backup export/import JSON, troca de senha, logout

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project**.
2. Escolha nome (ex: `painel-peso`), senha do banco (guarde-a, mas ela não é usada pelo app) e a região mais próxima (São Paulo: `sa-east-1`).
3. Aguarde o projeto provisionar (~2 min).

### 1.1 Rodar o SQL

1. No painel do projeto: **SQL Editor** → **New query**.
2. Cole o conteúdo completo de [`supabase/schema.sql`](supabase/schema.sql).
3. Clique **Run**. Deve terminar sem erros — isso cria as tabelas `weigh_ins` e `user_settings`, o índice e todas as políticas de RLS.

### 1.2 Criar o usuário com senha (sem depender de e-mail)

O SMTP embutido do Supabase é limitado e o e-mail de link mágico costuma não
chegar (ou cair no spam). Por isso o login principal do app é **e-mail + senha**,
com o usuário criado direto no banco, já confirmado.

1. **SQL Editor → New query** → cole o conteúdo de [`supabase/criar-usuario.sql`](supabase/criar-usuario.sql) → **Run**.
2. A última consulta do script deve devolver 1 linha com `confirmado = true`,
   `tem_senha = true`, `trocar_senha = true` e `tem_identidade = true`.

Credenciais criadas:

| e-mail | senha provisória |
| --- | --- |
| `pedro_moda@hotmail.com` | `teste123` |

No primeiro login o app **obriga a trocar a senha** (mínimo 8 caracteres) antes
de liberar o painel — a flag `must_change_password` fica no `user_metadata` e é
apagada assim que a nova senha é salva. Depois disso dá para trocar a senha
quando quiser em **Ajustes → Senha**.

> O script é idempotente: rodar de novo apenas redefine a senha para `teste123`
> e marca a troca obrigatória — é o "esqueci a senha" manual (veja 1.4 para
> configurar SMTP e ter recuperação por e-mail de verdade).
>
> Alternativa pelo Dashboard: **Authentication → Users → Add user**, marcando
> **Auto Confirm User**. Nesse caso rode o SQL depois para marcar a troca de
> senha obrigatória (ele detecta o usuário existente).

### 1.3 Configurar Auth e URLs

1. **Authentication → Providers → Email**: deixe **Email** habilitado (é o
   provider usado tanto pela senha quanto pelo link mágico).
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173` (por enquanto; depois troque pelo domínio da Vercel)
   - **Redirect URLs:** adicione `http://localhost:5173/**`
3. O link mágico continua disponível na tela de login, em "entrar com link
   mágico" — mas só funciona de verdade depois do passo 1.4.

### 1.4 SMTP próprio (para o e-mail voltar a funcionar)

**Por que o link não chegava:** o serviço de e-mail embutido do Supabase é só
para desenvolvimento. Ele limita o envio a ~2 e-mails por hora e, em projetos
novos, só entrega para o e-mail dono do projeto — qualquer outro destinatário é
descartado silenciosamente. Não adianta reenviar: precisa de um SMTP próprio.

Isso é **opcional** — o login por senha (1.2) já funciona sem nada disso. Com
SMTP configurado você ganha: link mágico funcionando e o "esqueci minha senha"
do Supabase.

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

Na tela de login, clique em "entrar com link mágico" e peça um link para o seu
e-mail. Se não chegar em 1–2 minutos:

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

Abra `http://localhost:5173` e entre com `pedro_moda@hotmail.com` / `teste123`.
O app pede uma senha nova e, em seguida, a sua **data de nascimento** — a idade
usada no Mifflin-St Jeor é calculada a partir dela e se atualiza sozinha a cada
aniversário (dá para mudar depois em **Ajustes → Perfil físico**).

### Testes

```bash
npm test          # roda a suíte Vitest (38 testes das regras de negócio)
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

Sem isso, o link mágico redireciona para o lugar errado (o login por senha
funciona de qualquer jeito, mas mantenha as URLs corretas).

---

## 5. Migrar os dados do painel antigo

1. No artifact antigo (Claude.ai), use **Copiar dados** ou **Baixar .json** e salve como arquivo `.json`.
2. No app novo, no primeiro acesso (sem pesagens), a página **Hoje** mostra o card **"Importar dados do painel antigo"** — selecione o arquivo.
3. Alternativamente: **Ajustes → Backup → Importar** (funciona a qualquer momento, com merge por data — o arquivo vence em datas repetidas).
4. `foodLogs` do arquivo antigo é ignorado (decisão de escopo); meta e % de gordura alvo são importados.

---

## 6. Checklist de etapas manuais

- [ ] Criar projeto no Supabase e rodar `supabase/schema.sql`
- [ ] Rodar `supabase/criar-usuario.sql` (usuário com senha, já confirmado)
- [ ] Se o banco é antigo: rodar `supabase/migration-birth-date.sql`
- [ ] Configurar provider Email e Redirect URLs (localhost)
- [ ] (Opcional) Configurar SMTP próprio para link mágico / recuperação de senha
- [ ] Criar `.env` local com URL + anon key
- [ ] `npm install` e `npm run dev` — testar login local
- [ ] Criar repositório no GitHub e fazer push
- [ ] Importar o projeto na Vercel com as 2 variáveis de ambiente
- [ ] Atualizar Site URL / Redirect URLs no Supabase com o domínio da Vercel
- [ ] Exportar o JSON do painel antigo no Claude e importar no app novo

---

## Arquitetura

```
src/
  lib/calculations.js    ← funções puras (Navy, Mifflin, sinal/ruído, tendência...) — extraídas do jsx original
  lib/backup.js          ← export/import JSON
  lib/supabase.js        ← client (só chaves públicas)
  hooks/useAuth.js       ← sessão: login por senha, troca de senha, link mágico
  hooks/useWeighIns.js   ← pesagens: cache em memória + atualização otimista
  hooks/useSettings.js   ← configurações persistidas (debounce na escrita)
  components/
    layout/              ← sidebar (desktop) / bottom nav (mobile), section headers
    ui/                  ← empty states, modal de confirmação, toast
    weigh/               ← form, sinal/ruído, tendência, gráfico, histórico...
    nutrition/           ← calorias, macros, simulador
  pages/                 ← Hoje, Evolucao, Nutricao, Ajustes, Login,
                           TrocarSenha (senha provisória), PrimeiroAcesso (nascimento)
supabase/schema.sql              ← tabelas + índices + constraints + RLS
supabase/criar-usuario.sql       ← usuário com senha, confirmado, troca obrigatória
supabase/migration-birth-date.sql ← adiciona user_settings.birth_date em banco já criado
```

Segurança: RLS em todas as tabelas (`auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE). O frontend usa exclusivamente a anon key; nenhum secret no código ou no Git.
