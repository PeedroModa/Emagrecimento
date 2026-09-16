-- ============================================================
-- Hidratação: registros de ingestão de água.
--
-- Cada linha é UM registro (toque num recipiente). Quantidade sempre em ml;
-- logged_at é timestamptz para reconstruir horário e agrupar por dia no
-- cliente. A meta diária (peso × 50 ml/kg) NÃO é persistida: deriva do peso
-- oficial em weigh_ins — uma única fonte de verdade.
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

create table if not exists water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  logged_at   timestamptz not null default now(),
  amount_ml   int not null check (amount_ml > 0 and amount_ml <= 5000),
  created_at  timestamptz not null default now()
);

create index if not exists water_logs_user_time_idx on water_logs (user_id, logged_at desc);

alter table water_logs enable row level security;

drop policy if exists "water_logs_select_own" on water_logs;
create policy "water_logs_select_own" on water_logs
  for select using (auth.uid() = user_id);

drop policy if exists "water_logs_insert_own" on water_logs;
create policy "water_logs_insert_own" on water_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "water_logs_delete_own" on water_logs;
create policy "water_logs_delete_own" on water_logs
  for delete using (auth.uid() = user_id);
