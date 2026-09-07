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

-- updated_at automático: sem isso, substituir uma pesagem via upsert
-- deixa o timestamp congelado no insert original (o cliente não lista
-- a coluna no onConflict), o que cega o feed de "o que mudou".
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger weigh_ins_touch before update on weigh_ins
  for each row execute function set_updated_at();

-- Configurações do usuário (metas, perfil físico, macros)
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_kg numeric(5,2) default 90,
  bf_target numeric(4,1) default 15,
  goal_date date,                  -- data-alvo opcional para a meta de peso (acompanhamento planejado vs. projetado)
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

-- Estado de visita (V2): quando foi a penúltima vez que o usuário abriu
-- o app, para o feed de descobertas comparar "o que mudou desde então".
-- Duas colunas de visita — se houvesse só uma, gravá-la na abertura
-- apagaria o próprio delta que o feed precisa mostrar.
create table if not exists user_app_state (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  last_visit_at     timestamptz,
  previous_visit_at timestamptz,
  feed_seen_at      timestamptz,
  updated_at        timestamptz not null default now()
);

create trigger user_app_state_touch before update on user_app_state
  for each row execute function set_updated_at();

-- Estado do feed de descobertas (V2): o que já foi visto/dispensado.
-- insight_key = "<regra>:<escopo>", não só o id da regra — senão
-- dispensar "platô" uma vez silenciaria platôs para sempre.
create table if not exists insight_state (
  user_id       uuid not null references auth.users(id) on delete cascade,
  insight_key   text not null,
  rule_id       text not null,
  rule_version  int  not null default 1,
  status        text not null default 'seen' check (status in ('seen','dismissed','pinned')),
  payload_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  dismissed_at  timestamptz,
  primary key (user_id, insight_key)
);

create index if not exists insight_state_user_rule_idx on insight_state (user_id, rule_id);

-- Medidas corporais ampliadas (V2, sessão mensal) — tabela independente de
-- weigh_ins: cadências diferentes (diária vs. mensal) não deveriam morar
-- na mesma linha. waist_cm/neck_cm aqui são uma captura própria da sessão
-- completa, separada da cintura/pescoço opcionais do registro diário.
create table if not exists body_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  waist_cm    numeric(5,1) check (waist_cm  between 30 and 250),
  neck_cm     numeric(5,1) check (neck_cm   between 15 and 100),
  hip_cm      numeric(5,1) check (hip_cm    between 40 and 250),
  chest_cm    numeric(5,1) check (chest_cm  between 40 and 250),
  arm_cm      numeric(5,1) check (arm_cm    between 10 and 100),
  thigh_cm    numeric(5,1) check (thigh_cm  between 20 and 120),
  note        text check (char_length(note) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date),
  check (num_nonnulls(waist_cm, neck_cm, hip_cm, chest_cm, arm_cm, thigh_cm) > 0)
);

create index if not exists body_measurements_user_date_idx on body_measurements (user_id, date desc);

create trigger body_measurements_touch before update on body_measurements
  for each row execute function set_updated_at();

-- Marcadores casuais do dia (V2, Etapa 6) — opcionais, um toque só. NULL
-- numa coluna é "não respondeu", não "não aconteceu": essa distinção
-- impede o motor de insights de tratar silêncio como resposta negativa.
create table if not exists day_markers (
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  trained       boolean,
  alcohol       boolean,
  high_sodium   boolean,
  travel        boolean,
  slept_badly   boolean,
  extra_tags    text[],
  note          text check (char_length(note) <= 120),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, date),
  check (
    num_nonnulls(trained, alcohol, high_sodium, travel, slept_badly) > 0
    or coalesce(array_length(extra_tags, 1), 0) > 0
    or note is not null
  )
);

create trigger day_markers_touch before update on day_markers
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security: cada usuário só enxerga os próprios dados.
-- A segurança fica no banco, não na interface.
-- ============================================================

alter table weigh_ins enable row level security;
alter table user_settings enable row level security;
alter table user_app_state enable row level security;
alter table insight_state enable row level security;
alter table body_measurements enable row level security;
alter table day_markers enable row level security;

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

-- user_app_state
create policy "user_app_state_select_own" on user_app_state
  for select using (auth.uid() = user_id);

create policy "user_app_state_insert_own" on user_app_state
  for insert with check (auth.uid() = user_id);

create policy "user_app_state_update_own" on user_app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_app_state_delete_own" on user_app_state
  for delete using (auth.uid() = user_id);

-- insight_state
create policy "insight_state_select_own" on insight_state
  for select using (auth.uid() = user_id);

create policy "insight_state_insert_own" on insight_state
  for insert with check (auth.uid() = user_id);

create policy "insight_state_update_own" on insight_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "insight_state_delete_own" on insight_state
  for delete using (auth.uid() = user_id);

-- body_measurements
create policy "body_measurements_select_own" on body_measurements
  for select using (auth.uid() = user_id);

create policy "body_measurements_insert_own" on body_measurements
  for insert with check (auth.uid() = user_id);

create policy "body_measurements_update_own" on body_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "body_measurements_delete_own" on body_measurements
  for delete using (auth.uid() = user_id);

-- day_markers
create policy "day_markers_select_own" on day_markers
  for select using (auth.uid() = user_id);

create policy "day_markers_insert_own" on day_markers
  for insert with check (auth.uid() = user_id);

create policy "day_markers_update_own" on day_markers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "day_markers_delete_own" on day_markers
  for delete using (auth.uid() = user_id);
