-- ============================================================
-- Painel de Peso — schema completo (tabelas, índices, RLS)
-- Rode este script inteiro no SQL Editor do Supabase.
-- ============================================================

-- Pesagens
create table if not exists weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg <= 400),
  waist_cm numeric(5,1) check (waist_cm > 0),
  neck_cm numeric(5,1) check (neck_cm > 0),
  note text check (char_length(note) <= 80),
  context_tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create index if not exists weigh_ins_user_date_idx on weigh_ins (user_id, date desc);

-- Configurações do usuário (metas, perfil físico, macros)
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_kg numeric(5,2) default 90,
  bf_target numeric(4,1) default 15,
  height_cm int default 175,
  birth_date date,                 -- fonte da verdade da idade (perguntada no 1o acesso)
  age int default 28,              -- espelho calculado de birth_date; usado como fallback
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

-- ============================================================
-- Row Level Security: cada usuário só enxerga os próprios dados.
-- A segurança fica no banco, não na interface.
-- ============================================================

alter table weigh_ins enable row level security;
alter table user_settings enable row level security;

-- weigh_ins
create policy "weigh_ins_select_own" on weigh_ins
  for select using (auth.uid() = user_id);

create policy "weigh_ins_insert_own" on weigh_ins
  for insert with check (auth.uid() = user_id);

create policy "weigh_ins_update_own" on weigh_ins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "weigh_ins_delete_own" on weigh_ins
  for delete using (auth.uid() = user_id);

-- user_settings
create policy "user_settings_select_own" on user_settings
  for select using (auth.uid() = user_id);

create policy "user_settings_insert_own" on user_settings
  for insert with check (auth.uid() = user_id);

create policy "user_settings_update_own" on user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_settings_delete_own" on user_settings
  for delete using (auth.uid() = user_id);
