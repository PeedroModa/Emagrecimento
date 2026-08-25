# Painel de Peso

Painel pessoal de acompanhamento de peso e composição corporal. Vite + React (JavaScript), dados no Supabase (com Row Level Security), autenticação por Magic Link, deploy na Vercel.

- **Hoje** — registrar pesagem, "É real ou ruído?", variação vs. anterior, progresso até a meta
- **Evolução** — gráfico de linha (peso + média móvel 27d + meta), tendência com projeção de composição, recordes, histórico com edição/exclusão
- **Nutrição** — Mifflin-St Jeor (BMR/TDEE/alvo), macros em dois modos (% e g/kg), simulador de ritmo
- **Ajustes** — metas, perfil físico, treinos/déficit, backup export/import JSON, logout

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project**.
2. Escolha nome (ex: `painel-peso`), senha do banco (guarde-a, mas ela não é usada pelo app) e a região mais próxima (São Paulo: `sa-east-1`).
3. Aguarde o projeto provisionar (~2 min).

### 1.1 Rodar o SQL

1. No painel do projeto: **SQL Editor** → **New query**.
2. Cole o conteúdo completo de [`supabase/schema.sql`](supabase/schema.sql).
3. Clique **Run**. Deve terminar sem erros — isso cria as tabelas `weigh_ins` e `user_settings`, o índice e todas as políticas de RLS.

### 1.2 Configurar Magic Link

1. **Authentication → Providers → Email**: deixe **Email** habilitado. Desmarque "Confirm email" se quiser login em 1 clique (opcional).
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173` (por enquanto; depois troque pelo domínio da Vercel)
   - **Redirect URLs:** adicione `http://localhost:5173/**`
3. (Opcional) **Authentication → Email Templates → Magic Link**: personalize o texto do e-mail.

### 1.3 Pegar as chaves públicas

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

Abra `http://localhost:5173`, digite seu e-mail, clique no link recebido — pronto.

### Testes

```bash
npm test          # roda a suíte Vitest (28 testes das regras de negócio)
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

Sem isso, o link mágico redireciona para o lugar errado.

---

## 5. Migrar os dados do painel antigo

1. No artifact antigo (Claude.ai), use **Copiar dados** ou **Baixar .json** e salve como arquivo `.json`.
2. No app novo, no primeiro acesso (sem pesagens), a página **Hoje** mostra o card **"Importar dados do painel antigo"** — selecione o arquivo.
3. Alternativamente: **Ajustes → Backup → Importar** (funciona a qualquer momento, com merge por data — o arquivo vence em datas repetidas).
4. `foodLogs` do arquivo antigo é ignorado (decisão de escopo); meta e % de gordura alvo são importados.

---

## 6. Checklist de etapas manuais

- [ ] Criar projeto no Supabase e rodar `supabase/schema.sql`
- [ ] Configurar Magic Link e Redirect URLs (localhost)
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
  hooks/useAuth.js       ← sessão Magic Link
  hooks/useWeighIns.js   ← pesagens: cache em memória + atualização otimista
  hooks/useSettings.js   ← configurações persistidas (debounce na escrita)
  components/
    layout/              ← sidebar (desktop) / bottom nav (mobile), section headers
    ui/                  ← empty states, modal de confirmação, toast
    weigh/               ← form, sinal/ruído, tendência, gráfico, histórico...
    nutrition/           ← calorias, macros, simulador
  pages/                 ← Hoje, Evolucao, Nutricao, Ajustes, Login
supabase/schema.sql      ← tabelas + índices + constraints + RLS
```

Segurança: RLS em todas as tabelas (`auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE). O frontend usa exclusivamente a anon key; nenhum secret no código ou no Git.
