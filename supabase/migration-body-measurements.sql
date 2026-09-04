-- ============================================================
-- V2 — Etapa 5: medidas corporais ampliadas (sessão mensal).
--
-- Tabela independente de weigh_ins — cadências diferentes (diária vs.
-- mensal) não deveriam morar na mesma linha. waist_cm/neck_cm AQUI são uma
-- captura própria da sessão completa de medidas, deliberadamente separada
-- da cintura/pescoço opcionais do registro diário de peso (que continuam
-- existindo em weigh_ins, sem migração — são fontes independentes, para
-- propósitos diferentes: o registro diário alimenta o acompanhamento do
-- dia a dia; esta tabela alimenta o mapa corporal, as razões
-- cintura/altura e cintura/quadril, e a fórmula Navy feminina).
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

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
  -- uma sessão de medição vazia não é um dado, é lixo
  check (num_nonnulls(waist_cm, neck_cm, hip_cm, chest_cm, arm_cm, thigh_cm) > 0)
);

create index if not exists body_measurements_user_date_idx on body_measurements (user_id, date desc);

-- reaproveita a função criada em migration-insights-foundation.sql; se este
-- script rodar primeiro (banco novo), cria também.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists body_measurements_touch on body_measurements;
create trigger body_measurements_touch before update on body_measurements
  for each row execute function set_updated_at();

alter table body_measurements enable row level security;

drop policy if exists "body_measurements_select_own" on body_measurements;
create policy "body_measurements_select_own" on body_measurements
  for select using (auth.uid() = user_id);

drop policy if exists "body_measurements_insert_own" on body_measurements;
create policy "body_measurements_insert_own" on body_measurements
  for insert with check (auth.uid() = user_id);

drop policy if exists "body_measurements_update_own" on body_measurements;
create policy "body_measurements_update_own" on body_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_measurements_delete_own" on body_measurements;
create policy "body_measurements_delete_own" on body_measurements
  for delete using (auth.uid() = user_id);
