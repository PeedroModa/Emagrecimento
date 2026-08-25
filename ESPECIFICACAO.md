# Especificação — Painel de Peso (migração para app web independente)

**Data:** 25/08/2026 · **Origem:** proposta aprovada em conversa no Claude.ai (Fase 1 concluída)
**Arquivos de entrada nesta pasta:** `painel-peso_2.jsx` (código-fonte com TODA a lógica de negócio) · `index.html` (referência visual — usar APENAS estrutura e tipografia, NÃO a paleta)

> **Instrução para o Claude Code:** este arquivo é a especificação aprovada do projeto. A Fase 1 (análise e proposta) já foi feita e aprovada pelo usuário — não a repita. Execute a implementação conforme descrito aqui. O `painel-peso_2.jsx` é a fonte da verdade das fórmulas e regras de negócio: extraia-as SEM ALTERAR. Se surgir decisão relevante não prevista aqui, pare e pergunte antes de decidir.

---

## 1. Objetivo

Transformar o painel pessoal de acompanhamento de peso e composição corporal (hoje um artifact React no Claude.ai) em aplicação web independente, com dados no Supabase, sincronizada entre dispositivos, publicada na Vercel. Uso exclusivamente pessoal (1 usuário), ritual principal: pesagem aos sábados.

## 2. Decisões aprovadas (não rediscutir)

- **Stack:** Vite + React em **JavaScript** (não TypeScript) — preserva o código atual quase intacto e mantém legível pro usuário. React Router para navegação. Chart.js para gráficos (mesma lib da referência visual).
- **Gráfico de linha volta:** peso + média móvel + linha da meta, via Chart.js, na página Evolução. (Foi removido no artifact por bug de renderização do recharts no sandbox de iframe — problema ambiental que não existe fora do artifact. A barra de progressão CSS atual permanece como visual secundário do histórico.)
- **4 páginas:** Hoje / Evolução / Nutrição / Ajustes. Sidebar no desktop, bottom nav no mobile.
- **`foodLogs` descartado:** não migra pro schema. O import de JSON antigo ignora o campo silenciosamente.
- **Paleta ATUAL mantida** (terracota sobre dark frio — tokens na seção 5). Da referência `index.html` adotar SOMENTE: tipografia, estrutura de navegação, padrão de section headers, empty states desenhados, breakpoints, densidade e acabamento.
- **Auth:** Magic Link por e-mail, exclusivamente. Sessão persistida pelo SDK.
- **Deploy:** Vercel.

## 3. Arquitetura

```
src/
  lib/calculations.js   ← funções puras extraídas do jsx SEM alteração
  lib/supabase.js       ← client (só VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
  hooks/useAuth.js, useWeighIns.js, useSettings.js
  components/           ← por domínio (weigh/, nutrition/, layout/, ui/)
  pages/Hoje.jsx, Evolucao.jsx, Nutricao.jsx, Ajustes.jsx, Login.jsx
```

- **Estado:** sem Redux/Zustand. Hooks com cache em memória, atualização otimista (UI responde na hora, reverte se o Supabase falhar), estados explícitos de loading/erro/vazio.
- **Páginas:**
  - **Hoje** (home): registrar pesagem (form com data/peso/nota + cintura/pescoço opcional atrás de toggle), card "É real ou ruído?", variação vs. pesagem anterior, progresso até a meta.
  - **Evolução:** gráfico de linha Chart.js, card de tendência com projeção de composição, recordes, histórico com **edição** (novo — hoje só existe remover) e exclusão.
  - **Nutrição:** calculadora Mifflin-St Jeor (BMR/TDEE/alvo), macros (modos % e g/kg), simulador de ritmo.
  - **Ajustes:** metas (peso, %BF), perfil físico (altura/idade/sexo — hoje hardcoded 175cm/28/M no jsx, viram configurações persistidas), treinos/semana e déficit, backup export/import, logout.

## 4. Supabase

```sql
create table weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg <= 400),
  waist_cm numeric(5,1) check (waist_cm > 0),
  neck_cm numeric(5,1) check (neck_cm > 0),
  note text check (char_length(note) <= 80),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);
create index on weigh_ins (user_id, date desc);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_kg numeric(5,2) default 90,
  bf_target numeric(4,1) default 15,
  height_cm int default 175,
  age int default 28,
  sex text default 'M' check (sex in ('M','F')),
  train_days int default 3,
  deficit_pct int default 15 check (deficit_pct in (10,15,20)),
  macro_mode text default 'pct' check (macro_mode in ('pct','weight')),
  macro_prot_pct numeric default 30,
  macro_fat_pct numeric default 30,
  macro_prot_per_kg numeric default 2,
  macro_fat_per_kg numeric default 0.9,
  updated_at timestamptz default now()
);
```

RLS habilitado nas duas tabelas; políticas de SELECT/INSERT/UPDATE/DELETE todas com `auth.uid() = user_id`. Segurança no banco, não na interface. Nenhuma service key no frontend.

**Não criar:** perfis, avatares, planos, equipes, organizações, convites, cobrança, nada de SaaS. `user_settings` é configuração, não "perfil".

## 5. Design system

**Paleta (manter — extraída do jsx atual):**

```
fundo #17191A · card #212426 · card2 #1D2022 · hover/borda-fraca #2A2E30
borda #34383B · texto #EDEAE2 · texto-2 #8B8F92 · texto-3 #5A5E60
acento/marca #E8552E (terracota) · positivo/perda #5B7B8C (azul-aço)
atenção #C9A24B (dourado)
```

Semântica atual do painel (manter): azul-aço = perda/bom, terracota = ganho/alerta/ação primária, dourado = atenção/neutro-ruim.

**Tipografia (adotar da referência):** Bebas Neue (display: números-herói, títulos), Barlow Condensed (labels/subtítulos), Outfit (corpo), JetBrains Mono (todos os valores numéricos e dados). Substituem Oswald+Inter do jsx.

**Estrutura (adotar da referência):** sidebar ícone+label no desktop → bottom nav no mobile; section header padronizado (título + subtítulo); empty states desenhados para TODA lista/gráfico/estado sem dados (nunca tela vazia); breakpoints 1100/900/760/600; transições discretas; tabelas/histórico com menor densidade que a referência (1 registro/semana, não centenas).

## 6. Regras de negócio a preservar (fonte: painel-peso_2.jsx — extrair sem alterar)

Checklist de verificação com as constantes-chave. Qualquer divergência é bug de migração:

- [ ] **Navy body fat** (homens): `495/(1.0324 − 0.19077·log10(cintura−pescoço) + 0.15456·log10(altura)) − 450`; válido só se cintura>pescoço e resultado entre 2 e 70. Altura vem de `user_settings` (não mais constante).
- [ ] **Mifflin-St Jeor:** `10·peso + 6.25·altura − 5·idade + (M:+5 / F:−161)`. Fatores de atividade por treinos/semana: 0→1.2, 1-3→1.375, 4-5→1.55, 6-7→1.725. Alvo = TDEE·(1−déficit/100), déficit ∈ {10,15,20}.
- [ ] **Macros:** modo % (proteína e gordura editáveis, carbo = 100−ambos, nunca negativo); modo g/kg (proteína e gordura × peso atual, carbo = kcal restantes /4, clamp em 0 com aviso de estouro). 4 kcal/g proteína e carbo, 9 kcal/g gordura. Ordem de exibição: Proteína → Carboidrato → Gordura.
- [ ] **Sinal vs. ruído:** deltas entre pesagens consecutivas; banda de ruído = desvio-padrão dos deltas ANTERIORES (exclui o último) com **piso 0.2kg**; z = últimoDelta/banda. |z|<1 → "Provavelmente ruído"; 1≤|z|<2 → "Talvez tenha emagrecido/engordado"; |z|≥2 → "Emagreceu/Engordou de verdade". Precisa de ≥4 pesagens; abaixo disso, estado "calibrando" pedindo as que faltam. Textos dos vereditos: manter os do jsx (foram reescritos a pedido do usuário para linguagem clara).
- [ ] **Tendência:** regressão linear das pesagens dos últimos **28 dias** → kg/semana; semanas até a meta = restante/perdaSemanal (só se perda>0.05 e restante>0). Faixa saudável 0.4–1.0 kg/sem com os 4 status/textos do jsx. Aviso de amostra <3.
- [ ] **Projeção de composição na meta:** requer ≥2 pesagens com cintura E pescoço; regressão separada de massa gorda e magra; extrapola até a meta, reescala pro peso-meta, **trava em BF mínimo 10%** com aviso explícito de otimismo quando travar; qualidade da perda = % da perda projetada que é gordura (≥75% = cenário ideal). Estados "adormecidos" (0 ou 1 cintura) com os textos do jsx.
- [ ] **Média móvel:** janela de **27 dias** (adequada a pesagem semanal — NÃO voltar para 7 dias: com 1 pesagem/semana a média de 7d fica sempre nula, bug já corrigido).
- [ ] **Recordes:** menor/maior peso com data; maior queda em janela de ~7 dias (referência entre 5 e 9 dias antes, a mais próxima de 7).
- [ ] **IMC** com classificação (abaixo/normal/sobrepeso/obesidade I-II-III) e cores.
- [ ] **Simulador:** slider 0.1–1.5 kg/sem (step 0.05), semanas = restante/ritmo, data projetada pt-BR.
- [ ] **Comportamentos:** 1 pesagem por data (UNIQUE no banco; na UI, confirmar antes de substituir); aceitar vírgula decimal em todos os inputs numéricos; estados "--" em cabeçalho/medidor/calorias/simulador quando não há pesagens (nada de números inventados — não recriar o antigo fallback de 110kg); nota da pesagem ≤80 chars exibida na variação semanal e no histórico; sem seed automático de peso inicial (o usuário importa ou registra).

## 7. Funcionalidades novas (além da migração)

1. **Editar pesagem** (CRUD completo — hoje só cria/remove).
2. **Configurações persistidas** (`user_settings`) — hoje idade/altura/sexo/treinos/déficit/macros resetam por sessão.
3. **Onboarding de migração:** no primeiro login com banco vazio, oferecer "Importar dados do painel antigo" aceitando o JSON no formato: `{version, exportedAt, goal, bfTarget, weightLogs:[{id,date:"YYYY-MM-DD",weight,waist?,neck?,note?}], foodLogs?}` — validar cada registro (peso numérico, data ISO), descartar inválidos, ignorar `foodLogs`, gravar `goal`/`bfTarget` em settings.
4. **Export JSON** com download real (o clipboard-first do jsx era workaround do sandbox; manter botão copiar como secundário). **Import** com merge por data (arquivo vence em datas repetidas, com confirmação mostrando contagens).

## 8. Armadilhas conhecidas (não repetir)

- recharts foi removido por bug de animação em iframe sandbox — irrelevante fora do artifact, mas a decisão aprovada é **Chart.js** (consistência com o outro produto do usuário). Desativar animação inicial não é necessário, mas testar renderização real, não só compilação.
- `window.storage` tinha problema com acessos concorrentes na montagem — Supabase não tem essa limitação, mas manter 1 fetch inicial consolidado por página evita waterfalls.
- Média móvel de 7 dias com pesagem semanal = linha sempre vazia (por isso 27 dias).
- Extrapolação linear de composição sem trava produz BF irreal (<10%) — a trava é intencional, não remover.

## 9. Entrega e validação

Seguir integralmente o checklist de entrega do prompt original do usuário (que ele fornecerá junto): código completo; SQL com tabelas/índices/constraints/RLS; `.env.example` sem secrets; instruções passo a passo de Supabase (projeto, Magic Link, redirect URLs), variáveis de ambiente, Git/GitHub (init, .gitignore com .env/node_modules/dist, commit, push), execução local, build e deploy na Vercel (build `npm run build`, output `dist/`, env vars, redirect de SPA); lista explícita de etapas manuais do usuário.

**Validação obrigatória antes de declarar pronto:** testes unitários (Vitest) das funções de `calculations.js` cobrindo: cenários de ruído/sinal (estável+queda pequena=ruído; estável+queda grande=real; volátil+queda média=ruído), projeção com e sem trava, macros nos dois modos somando exatamente o alvo, Mifflin com os valores de referência (110kg/175cm/28/M/3x → BMR 2059, TDEE 2831, alvo 15% 2406); fluxo completo auth→CRUD→export/import; RLS testado (usuário não acessa dados de outro); responsividade nos 4 breakpoints; console limpo; zero dados fictícios na versão final.

## 10. Etapas manuais do usuário (listar na entrega final com detalhes)

Criar projeto no Supabase e rodar o SQL · configurar Magic Link e redirect URLs · criar `.env` local · criar repositório GitHub e push · importar projeto na Vercel com env vars · atualizar redirect URLs com o domínio da Vercel · exportar o JSON do painel antigo no Claude e importar no app novo.
