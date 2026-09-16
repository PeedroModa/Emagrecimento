-- ============================================================
-- Treinos reais (importados do Gravl ou de outro app).
--
-- Uma linha por sessão. `external_id` é o id do app de origem: o import é
-- um upsert por (user_id, external_id), então reimportar o mesmo arquivo ou
-- sincronizar de novo nunca duplica. O fator de atividade passa a usar o
-- volume REAL das últimas 4 semanas (ver src/lib/training.js) em vez dos
-- botões estáticos de Ajustes, que ficam como fallback.
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

create table if not exists training_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  external_id  text not null,
  date         date not null,                       -- dia LOCAL do treino
  minutes      int not null check (minutes > 0 and minutes <= 600),
  kind         text,                                 -- 'strength' | 'cardio' | outro
  calories     int check (calories >= 0),
  source       text not null default 'gravl',
  created_at   timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists training_sessions_user_date_idx on training_sessions (user_id, date desc);

alter table training_sessions enable row level security;

drop policy if exists "training_sessions_select_own" on training_sessions;
create policy "training_sessions_select_own" on training_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "training_sessions_insert_own" on training_sessions;
create policy "training_sessions_insert_own" on training_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "training_sessions_update_own" on training_sessions;
create policy "training_sessions_update_own" on training_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "training_sessions_delete_own" on training_sessions;
create policy "training_sessions_delete_own" on training_sessions
  for delete using (auth.uid() = user_id);
